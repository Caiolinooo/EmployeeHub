import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelPayroll } from '@/lib/payroll/payroll-auth';
import { coletarRubricasEscala, coletarFerias } from '@/lib/payroll/fontes-dp';
import { normalizeCpf } from '@/lib/gestao-tripulantes/cpf';

export const dynamic = 'force-dynamic';

interface SheetRow {
  id: string;
  company_id: string;
  department_id: string | null;
  reference_month: number;
  reference_year: number;
  status: string;
}

interface SemSalarioItem {
  id: string;
  nome: string;
  cpf: string | null;
  matricula: string | null;
}

interface SemVinculoItem {
  cpf: string;
  nome: string;
  motivo: string;
}

interface DivergenciaWkGt {
  code: string;
  nome: string;
  /** Colaboradores cujo lançamento GT desse código foi descartado (WK vence). */
  colaboradores: number;
}

/** Mesma regra de carregarEmployeesPorCpf (fontes-dp): CPF normalizado, ativo e admissão mais recente vencem. */
async function mapEmployeesPorCpf(companyId: string): Promise<Map<string, string>> {
  const mapa = new Map<string, { id: string; status: string; admission: string }>();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('payroll_employees')
      .select('id, cpf, status, admission_date')
      .eq('company_id', companyId)
      .order('id')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Erro ao carregar payroll_employees: ${error.message}`);
    const rows = data || [];
    for (const row of rows) {
      const cpf = normalizeCpf(row.cpf || '');
      if (cpf.length !== 11) continue;
      const candidato = { id: row.id as string, status: String(row.status || ''), admission: String(row.admission_date || '') };
      const atual = mapa.get(cpf);
      if (!atual) {
        mapa.set(cpf, candidato);
        continue;
      }
      const atualAtivo = atual.status === 'active';
      const candAtivo = candidato.status === 'active';
      if (candAtivo && !atualAtivo) mapa.set(cpf, candidato);
      else if (candAtivo === atualAtivo && candidato.admission > atual.admission) mapa.set(cpf, candidato);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return new Map([...mapa].map(([cpf, v]) => [cpf, v.id]));
}

/**
 * GET /api/payroll/sheets/[id]/checklist
 * Checklist de consistência pré-fechamento da competência (design §2):
 * - escalaTravada: escala GT da competência homologada (gt_relatorios_aprovacoes
 *   status 'aprovado'/'enviado' — é a trava real do fechamento de escala).
 * - semSalario: payroll_employees ativos da empresa com base_salary 0/null.
 * - semVinculo: colaboradores GT com escala na competência sem ficha na folha
 *   (pendências da coleta de fontes-dp — reuso, sem recálculo).
 * - divergenciasWkGt: códigos cujo lançamento GT seria descartado por precedência
 *   WK (mesma regra de sincronizarModulosInternos, em modo somente-leitura).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await garantirNivelPayroll(request, 'view');
    if (!gate.ok) return gate.error;

    const { id } = await params;
    const { data: sheet, error: sheetError } = await supabaseAdmin
      .from('payroll_sheets')
      .select('id, company_id, department_id, reference_month, reference_year, status')
      .eq('id', id)
      .maybeSingle();
    if (sheetError) {
      console.error('[API payroll/checklist] sheet:', sheetError);
      return NextResponse.json({ success: false, error: 'Erro ao carregar a folha' }, { status: 500 });
    }
    if (!sheet) {
      return NextResponse.json({ success: false, error: 'Folha não encontrada' }, { status: 404 });
    }
    const folha = sheet as SheetRow;
    const competencia = { mes: folha.reference_month, ano: folha.reference_year };
    const mesReferencia = `${competencia.ano}-${String(competencia.mes).padStart(2, '0')}`;

    // Sheet de centro de custo → mesma restrição de coleta do sync (por nome do centro GT).
    let centroCustoFiltro: string | undefined;
    if (folha.department_id) {
      const { data: dept } = await supabaseAdmin
        .from('payroll_departments')
        .select('name')
        .eq('id', folha.department_id)
        .maybeSingle();
      centroCustoFiltro = dept?.name?.trim() || undefined;
    }

    const [aprovacaoEscala, semSalarioQuery, escala, ferias] = await Promise.all([
      supabaseAdmin
        .from('gt_relatorios_aprovacoes')
        .select('status, aprovado_em')
        .eq('mes_referencia', mesReferencia)
        .maybeSingle(),
      (() => {
        let q = supabaseAdmin
          .from('payroll_employees')
          .select('id, name, cpf, registration_number')
          .eq('company_id', folha.company_id)
          .eq('status', 'active')
          .or('base_salary.is.null,base_salary.eq.0')
          .order('name', { ascending: true });
        if (folha.department_id) q = q.eq('department_id', folha.department_id);
        return q;
      })(),
      coletarRubricasEscala(competencia, { companyId: folha.company_id, centroCusto: centroCustoFiltro }),
      coletarFerias(competencia, { companyId: folha.company_id, centroCusto: centroCustoFiltro }),
    ]);

    const escalaStatus = String(aprovacaoEscala.data?.status || '');
    const escalaTravada = escalaStatus === 'aprovado' || escalaStatus === 'enviado';

    const semSalario: SemSalarioItem[] = (semSalarioQuery.data || []).map((e) => ({
      id: e.id as string,
      nome: (e.name as string) || '',
      cpf: (e.cpf as string) || null,
      matricula: (e.registration_number as string) || null,
    }));

    const pendencias = [...escala.pendencias, ...ferias.pendencias];
    const semVinculo: SemVinculoItem[] = pendencias
      .filter((p) => p.cpf && p.motivo.startsWith('Sem ficha'))
      .map((p) => ({ cpf: p.cpf, nome: p.nome, motivo: p.motivo }));

    // Precedência WK (read-only): item GT cujo employee+code já existe como
    // origem='wk' na sheet seria descartado pelo sync — espelha o checklist.
    const itensPropostos = [...escala.itens, ...ferias.itens];
    const divergenciasWkGt: DivergenciaWkGt[] = [];
    if (itensPropostos.length > 0) {
      const [employees, codesRes, wkRes] = await Promise.all([
        mapEmployeesPorCpf(folha.company_id),
        supabaseAdmin
          .from('payroll_codes')
          .select('id, code, name')
          .in('code', [...new Set(itensPropostos.map((i) => i.code))])
          .eq('is_active', true),
        supabaseAdmin
          .from('payroll_sheet_items')
          .select('employee_id, code_id')
          .eq('sheet_id', folha.id)
          .eq('origem', 'wk'),
      ]);
      if (codesRes.error) throw new Error(`Erro ao carregar payroll_codes: ${codesRes.error.message}`);
      if (wkRes.error) throw new Error(`Erro ao ler itens WK da sheet: ${wkRes.error.message}`);

      const codePorId = new Map<string, { code: string; name: string }>();
      const codeIdPorCodigo = new Map<string, string>();
      for (const c of codesRes.data || []) {
        if (!codeIdPorCodigo.has(c.code)) codeIdPorCodigo.set(c.code, c.id);
        codePorId.set(c.id, { code: c.code, name: c.name });
      }
      const chavesWk = new Set((wkRes.data || []).map((i) => `${i.employee_id}|${i.code_id}`));

      const porCodigo = new Map<string, Set<string>>();
      for (const item of itensPropostos) {
        const codeId = codeIdPorCodigo.get(item.code);
        if (!codeId) continue;
        const employeeId = employees.get(item.cpf);
        if (!employeeId) continue;
        if (!chavesWk.has(`${employeeId}|${codeId}`)) continue;
        const set = porCodigo.get(codeId) || new Set<string>();
        set.add(employeeId);
        porCodigo.set(codeId, set);
      }
      for (const [codeId, colaboradores] of porCodigo) {
        const meta = codePorId.get(codeId);
        divergenciasWkGt.push({
          code: meta?.code || codeId,
          nome: meta?.name || '',
          colaboradores: colaboradores.size,
        });
      }
      divergenciasWkGt.sort((a, b) => a.code.localeCompare(b.code));
    }

    return NextResponse.json({
      success: true,
      data: {
        sheetId: folha.id,
        competencia: { mes: competencia.mes, ano: competencia.ano },
        escalaTravada,
        escalaStatus: escalaStatus || null,
        semSalario,
        semVinculo,
        divergenciasWkGt,
        bloqueios: {
          semSalario: semSalario.length,
          semVinculo: semVinculo.length,
          divergenciasWkGt: divergenciasWkGt.length,
        },
      },
    });
  } catch (error) {
    console.error('[API payroll/checklist Error]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao montar checklist da folha' },
      { status: 500 },
    );
  }
}
