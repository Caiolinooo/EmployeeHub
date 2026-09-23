import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { garantirNivelFinanceiro } from '@/lib/financeiro/financeiro-auth';
import { finErro, finOk } from '../_lib/http';
import type { FinVisaoGeral } from '@/types/financeiro';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/visao-geral?competencia=YYYY-MM&empresaId=
 * KPIs do hub (§7.1 Aba Visão geral): faturas/NFS-e por status, cobranças
 * abertas, recebido no mês e folhas por status + lista de competências.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await garantirNivelFinanceiro(request, 'view');
    if (!gate.ok) return gate.error;

    const { searchParams } = new URL(request.url);
    const empresaIdBruto = searchParams.get('empresaId');
    const empresaId = empresaIdBruto && empresaIdBruto !== 'todas' && /^[0-9a-f-]{36}$/i.test(empresaIdBruto) ? empresaIdBruto : null;
    const competencia = searchParams.get('competencia'); // YYYY-MM
    const comp = competencia ? /^(\d{4})-(\d{2})$/.exec(competencia) : null;
    const anoFiltro = comp ? Number(comp[1]) : null;
    const mesFiltro = comp ? Number(comp[2]) : null;

    if (empresaIdBruto && !empresaId) {
      return NextResponse.json(
        { success: false, error: 'empresaId inválido (uuid ou "todas")' },
        { status: 400 },
      );
    }

    let queryFaturas = supabaseAdmin
      .from('fin_faturas')
      .select('id, status, valor_total, competencia_mes, competencia_ano, data_emissao')
      .eq('empresa_id', empresaId);
    if (anoFiltro) queryFaturas = queryFaturas.eq('competencia_ano', anoFiltro);
    if (mesFiltro) queryFaturas = queryFaturas.eq('competencia_mes', mesFiltro);
    const { data: faturas, error: errFaturas } = await queryFaturas;
    if (errFaturas) return NextResponse.json({ success: false, error: errFaturas.message }, { status: 500 });
    const listaFaturas = (faturas || []) as {
      id: string; status: string; valor_total: number;
      competencia_mes: number | null; competencia_ano: number | null;
    }[];

    const faturasPorStatus: Record<string, number> = {};
    let totalFaturas = 0;
    for (const f of listaFaturas) {
      faturasPorStatus[f.status] = (faturasPorStatus[f.status] || 0) + 1;
      if (f.status !== 'cancelada') totalFaturas += 1;
    }

    const idsFaturas = listaFaturas.map((f) => f.id);

    const nfsePorStatus: Record<string, number> = {};
    let cobrancasAbertas = 0;
    if (idsFaturas.length > 0) {
      const { data: emissoes } = await supabaseAdmin
        .from('fin_nfse_emissoes')
        .select('status')
        .in('fatura_id', idsFaturas);
      for (const e of (emissoes || []) as { status: string }[]) {
        nfsePorStatus[e.status] = (nfsePorStatus[e.status] || 0) + 1;
      }

      const { count: abertas } = await supabaseAdmin
        .from('fin_cobrancas')
        .select('id', { count: 'exact', head: true })
        .in('fatura_id', idsFaturas)
        .in('status', ['pendente', 'gerada']);
      cobrancasAbertas = abertas || 0;
    }

    let queryContas = supabaseAdmin.from('fin_contas_bancarias').select('id');
    if (empresaId) queryContas = queryContas.eq('empresa_id', empresaId);
    const { data: contas } = await queryContas;
    const idsContas = ((contas || []) as { id: string }[]).map((c) => c.id);

    let recebidoMes = 0;
    if (idsContas.length > 0) {
      const hoje = new Date();
      const mesRef = mesFiltro ?? hoje.getMonth() + 1;
      const anoRef = anoFiltro ?? hoje.getFullYear();
      const primeiro = `${anoRef}-${String(mesRef).padStart(2, '0')}-01`;
      const ultimoDia = new Date(anoRef, mesRef, 0).getDate();
      const ultimo = `${anoRef}-${String(mesRef).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
      const { data: creditos } = await supabaseAdmin
        .from('fin_conciliacoes')
        .select('valor')
        .in('conta_bancaria_id', idsContas)
        .eq('tipo', 'credito')
        .eq('status', 'conciliado')
        .gte('data_movimento', primeiro)
        .lte('data_movimento', ultimo);
      recebidoMes = ((creditos || []) as { valor: number }[]).reduce((s, c) => s + Number(c.valor || 0), 0);
    }

    let queryFolhas = supabaseAdmin.from('payroll_sheets').select('status');
    if (empresaId) queryFolhas = queryFolhas.eq('company_id', empresaId);
    if (anoFiltro) queryFolhas = queryFolhas.eq('reference_year', anoFiltro);
    if (mesFiltro) queryFolhas = queryFolhas.eq('reference_month', mesFiltro);
    const { data: folhas } = await queryFolhas;
    const folhasPorStatus: Record<string, number> = {};
    for (const f of (folhas || []) as { status: string }[]) {
      folhasPorStatus[f.status] = (folhasPorStatus[f.status] || 0) + 1;
    }

    // Competências disponíveis (últimos 12 períodos com faturas) para o seletor
    let queryComps = supabaseAdmin
      .from('fin_faturas')
      .select('competencia_mes, competencia_ano, valor_total, status')
      .order('competencia_ano', { ascending: false })
      .order('competencia_mes', { ascending: false })
      .limit(500);
    if (empresaId) queryComps = queryComps.eq('empresa_id', empresaId);
    const { data: compsRows } = await queryComps;
    const mapaComps = new Map<string, { faturas: number; total: number }>();
    for (const r of (compsRows || []) as { competencia_mes: number | null; competencia_ano: number | null; valor_total: number; status: string }[]) {
      if (!r.competencia_mes || !r.competencia_ano || r.status === 'cancelada') continue;
      const chave = `${r.competencia_ano}-${String(r.competencia_mes).padStart(2, '0')}`;
      const atual = mapaComps.get(chave) || { faturas: 0, total: 0 };
      atual.faturas += 1;
      atual.total += Number(r.valor_total || 0);
      mapaComps.set(chave, atual);
    }
    const competencias = [...mapaComps.entries()]
      .slice(0, 12)
      .map(([competencia, v]) => ({ competencia, ...v }));

    const data: FinVisaoGeral = {
      kpis: {
        faturasPorStatus,
        totalFaturas,
        nfsePorStatus,
        cobrancasAbertas,
        recebidoMes,
        folhasPorStatus,
      },
      competencias,
    };
    return finOk(data);
  } catch (e) {
    return finErro(e);
  }
}
