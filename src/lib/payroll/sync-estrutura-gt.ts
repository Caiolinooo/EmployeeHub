/**
 * Espelha a estrutura do GT na folha.
 *   gt_empresas      → payroll_companies   (upsert por CNPJ ou nome)
 *   gt_centros_custo → payroll_departments (upsert por company_id + code)
 *
 * GT é a fonte da verdade. Sem contraparte GT ativa, a ficha da folha
 * fica is_active=false (é assim que o protótipo Luz Marítima saiu do select).
 * Idempotente: só mexe em name/is_active/cnpj e code/name/is_active.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const digitos = (v: string | null | undefined): string => (v || '').replace(/\D/g, '');

const formatarCnpj = (v: string): string => {
  const d = digitos(v);
  return d.length === 14
    ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
    : v;
};

interface GtEmpresa {
  id: string;
  nome: string | null;
  cnpj: string | null;
  ativo: boolean | null;
}

interface GtCentroCusto {
  id: string;
  nome: string | null;
  codigo: string | null;
  ativo: boolean | null;
}

interface PayrollCompany {
  id: string;
  name: string;
  cnpj: string;
  is_active: boolean;
}

interface PayrollDepartment {
  id: string;
  company_id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface ResultadoSyncEstrutura {
  empresas: {
    inseridas: number;
    atualizadas: number;
    desativadas: number;
    semCnpj: string[];
    inativasIgnoradas: string[];
  };
  departments: {
    inseridos: number;
    atualizados: number;
    desativados: number;
  };
}

export async function sincronizarEstruturaGt(
  supabase: SupabaseClient,
): Promise<ResultadoSyncEstrutura> {
  const { data: gtRows, error: gtErr } = await supabase
    .from('gt_empresas')
    .select('id, nome, cnpj, ativo')
    .order('nome');
  if (gtErr) throw new Error(`gt_empresas: ${gtErr.message}`);
  const gt = (gtRows || []) as GtEmpresa[];

  const { data: prRows, error: prErr } = await supabase
    .from('payroll_companies')
    .select('id, name, cnpj, is_active');
  if (prErr) throw new Error(`payroll_companies: ${prErr.message}`);
  const payroll = (prRows || []) as PayrollCompany[];
  const porCnpj = new Map(payroll.map((p) => [digitos(p.cnpj), p]));
  const porNome = new Map(payroll.map((p) => [p.name.trim().toLowerCase(), p]));

  let inseridas = 0;
  let atualizadas = 0;
  const semCnpj: string[] = [];
  const inativasIgnoradas: string[] = [];

  for (const e of gt) {
    const nome = (e.nome || '').trim();
    if (!nome) continue;
    const ativa = e.ativo !== false;
    const d = digitos(e.cnpj);
    const existente = (d && porCnpj.get(d)) || porNome.get(nome.toLowerCase()) || null;

    if (!ativa && !existente) {
      inativasIgnoradas.push(nome);
      continue;
    }
    if (!d && !existente) {
      semCnpj.push(nome);
      continue;
    }

    if (existente) {
      const patch: Record<string, unknown> = { name: nome, is_active: ativa };
      if (d && !digitos(existente.cnpj)) patch.cnpj = formatarCnpj(e.cnpj || '');
      const { error } = await supabase.from('payroll_companies').update(patch).eq('id', existente.id);
      if (error) throw new Error(`update ${nome}: ${error.message}`);
      atualizadas += 1;
    } else {
      const { error } = await supabase
        .from('payroll_companies')
        .insert({ name: nome, cnpj: formatarCnpj(e.cnpj || ''), is_active: true });
      if (error) throw new Error(`insert ${nome}: ${error.message}`);
      inseridas += 1;
    }
  }

  const gtAtivosCnpj = new Set(gt.filter((e) => e.ativo !== false).map((e) => digitos(e.cnpj)).filter(Boolean));
  const gtAtivosNome = new Set(gt.filter((e) => e.ativo !== false).map((e) => (e.nome || '').trim().toLowerCase()));
  let desativadas = 0;
  for (const p of payroll) {
    const temContraparte = gtAtivosCnpj.has(digitos(p.cnpj)) || gtAtivosNome.has(p.name.trim().toLowerCase());
    if (!temContraparte && p.is_active) {
      const { error } = await supabase.from('payroll_companies').update({ is_active: false }).eq('id', p.id);
      if (error) throw new Error(`desativar ${p.name}: ${error.message}`);
      desativadas += 1;
    }
  }

  const { data: ccRows, error: ccErr } = await supabase
    .from('gt_centros_custo')
    .select('id, nome, codigo, ativo')
    .order('nome');
  if (ccErr) throw new Error(`gt_centros_custo: ${ccErr.message}`);
  const centrosAtivos = ((ccRows || []) as GtCentroCusto[])
    .filter((c) => c.ativo !== false && (c.nome || '').trim());

  const { data: empresasAtivas, error: eaErr } = await supabase
    .from('payroll_companies')
    .select('id, name')
    .eq('is_active', true);
  if (eaErr) throw new Error(`payroll_companies ativas: ${eaErr.message}`);

  let deptInseridos = 0;
  let deptAtualizados = 0;
  let deptDesativados = 0;
  for (const emp of empresasAtivas || []) {
    const { data: deptRows, error: dErr } = await supabase
      .from('payroll_departments')
      .select('id, company_id, code, name, is_active')
      .eq('company_id', emp.id);
    if (dErr) throw new Error(`payroll_departments ${emp.name}: ${dErr.message}`);
    const existentes = new Map(((deptRows || []) as PayrollDepartment[]).map((d) => [d.code, d]));

    for (const c of centrosAtivos) {
      const nome = (c.nome || '').trim();
      const code = ((c.codigo || nome).trim() || nome).slice(0, 10);
      const existente = existentes.get(code);
      if (existente) {
        if (existente.name !== nome || !existente.is_active) {
          const { error } = await supabase
            .from('payroll_departments')
            .update({ name: nome, is_active: true })
            .eq('id', existente.id);
          if (error) throw new Error(`update dept ${code}: ${error.message}`);
          deptAtualizados += 1;
        }
      } else {
        const { error } = await supabase
          .from('payroll_departments')
          .insert({ company_id: emp.id, code, name: nome, is_active: true });
        if (error) throw new Error(`insert dept ${code} em ${emp.name}: ${error.message}`);
        deptInseridos += 1;
      }
    }

    const codigosAtivos = new Set(
      centrosAtivos.map((c) => (((c.codigo || c.nome || '').trim()) || '').slice(0, 10)),
    );
    for (const d of (deptRows || []) as PayrollDepartment[]) {
      if (!codigosAtivos.has(d.code) && d.is_active) {
        const { error } = await supabase
          .from('payroll_departments')
          .update({ is_active: false })
          .eq('id', d.id);
        if (error) throw new Error(`desativar dept ${d.code}: ${error.message}`);
        deptDesativados += 1;
      }
    }
  }

  return {
    empresas: { inseridas, atualizadas, desativadas, semCnpj, inativasIgnoradas },
    departments: { inseridos: deptInseridos, atualizados: deptAtualizados, desativados: deptDesativados },
  };
}
