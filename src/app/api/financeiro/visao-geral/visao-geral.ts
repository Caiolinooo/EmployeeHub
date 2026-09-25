import type { FinVisaoGeral } from '@/types/financeiro';

export type VisaoGeralHttp = {
  status: number;
  body: { success: true; data: FinVisaoGeral } | { success: false; error: string | undefined };
};

/**
 * Filtro de empresa do GET /visao-geral.
 * Ausente, vazio, "todas" ou "null" = sem filtro (UI manda isso por padrão).
 * Uuid válido = filtra. Qualquer outro valor = inválido.
 */
export function resolverEmpresaIdFiltro(
  bruto: string | null,
): { ok: true; empresaId: string | null } | { ok: false } {
  if (bruto == null) return { ok: true, empresaId: null };
  const v = bruto.trim();
  if (v === '' || v.toLowerCase() === 'todas' || v.toLowerCase() === 'null') {
    return { ok: true, empresaId: null };
  }
  if (/^[0-9a-f-]{36}$/i.test(v)) return { ok: true, empresaId: v };
  return { ok: false };
}

export type VisaoGeralErroDb = { message?: string; code?: string } | null;

/** Subconjunto thenable do query builder do supabase usado nesta rota. */
export type VisaoGeralQuery = {
  select: (...args: unknown[]) => VisaoGeralQuery;
  eq: (coluna: string, valor: unknown) => VisaoGeralQuery;
  in: (coluna: string, valores: unknown[]) => VisaoGeralQuery;
  order: (coluna: string, opts?: { ascending?: boolean }) => VisaoGeralQuery;
  limit: (n: number) => VisaoGeralQuery;
  gte: (coluna: string, valor: unknown) => VisaoGeralQuery;
  lte: (coluna: string, valor: unknown) => VisaoGeralQuery;
  then: (
    onfulfilled?: (value: { data: unknown; error: VisaoGeralErroDb; count?: number | null }) => unknown,
    onrejected?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

/** Client mínimo: `from(tabela)` devolve o query builder (supabase ou mock). */
export type VisaoGeralAdmin = {
  // Query builder do supabase e o mock thenable não compartilham um tipo público.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (tabela: string) => any;
};

export type VisaoGeralLogger = (info: { message?: string; code?: string }) => void;

const LOG_PREFIX = '[api/financeiro/visao-geral]';

export function logErroFaturas(info: { message?: string; code?: string }): void {
  console.error(LOG_PREFIX, { message: info.message, code: info.code });
}

/**
 * Corpo do GET /api/financeiro/visao-geral (após o gate de auth).
 * Recebe o client admin para os testes mockarem sem carregar `@/lib/supabase`.
 */
export async function montarVisaoGeral(
  request: { url: string },
  supabaseAdmin: VisaoGeralAdmin,
  logErro: VisaoGeralLogger = logErroFaturas,
): Promise<VisaoGeralHttp> {
  const { searchParams } = new URL(request.url);
  const resolvido = resolverEmpresaIdFiltro(searchParams.get('empresaId'));
  if (!resolvido.ok) {
    return {
      status: 400,
      body: { success: false, error: 'empresaId inválido (uuid ou "todas")' },
    };
  }
  const empresaId = resolvido.empresaId;
  const competencia = searchParams.get('competencia');
  const comp = competencia ? /^(\d{4})-(\d{2})$/.exec(competencia) : null;
  const anoFiltro = comp ? Number(comp[1]) : null;
  const mesFiltro = comp ? Number(comp[2]) : null;

  let queryFaturas = supabaseAdmin
    .from('fin_faturas')
    .select('id, status, valor_total, competencia_mes, competencia_ano, data_emissao');
  if (empresaId) queryFaturas = queryFaturas.eq('empresa_id', empresaId);
  if (anoFiltro) queryFaturas = queryFaturas.eq('competencia_ano', anoFiltro);
  if (mesFiltro) queryFaturas = queryFaturas.eq('competencia_mes', mesFiltro);
  const { data: faturas, error: errFaturas } = (await queryFaturas) as {
    data: unknown;
    error: VisaoGeralErroDb;
  };
  if (errFaturas) {
    logErro({ message: errFaturas.message, code: errFaturas.code });
    return { status: 500, body: { success: false, error: errFaturas.message } };
  }
  const listaFaturas = (faturas || []) as {
    id: string;
    status: string;
    valor_total: number;
    competencia_mes: number | null;
    competencia_ano: number | null;
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
    const { data: emissoes } = (await supabaseAdmin
      .from('fin_nfse_emissoes')
      .select('status')
      .in('fatura_id', idsFaturas)) as { data: unknown };
    for (const e of (emissoes || []) as { status: string }[]) {
      nfsePorStatus[e.status] = (nfsePorStatus[e.status] || 0) + 1;
    }

    const { count: abertas } = (await supabaseAdmin
      .from('fin_cobrancas')
      .select('id', { count: 'exact', head: true })
      .in('fatura_id', idsFaturas)
      .in('status', ['pendente', 'gerada'])) as { count?: number | null };
    cobrancasAbertas = abertas || 0;
  }

  let queryContas = supabaseAdmin.from('fin_contas_bancarias').select('id');
  if (empresaId) queryContas = queryContas.eq('empresa_id', empresaId);
  const { data: contas } = (await queryContas) as { data: unknown };
  const idsContas = ((contas || []) as { id: string }[]).map((c) => c.id);

  let recebidoMes = 0;
  if (idsContas.length > 0) {
    const hoje = new Date();
    const mesRef = mesFiltro ?? hoje.getMonth() + 1;
    const anoRef = anoFiltro ?? hoje.getFullYear();
    const primeiro = `${anoRef}-${String(mesRef).padStart(2, '0')}-01`;
    const ultimoDia = new Date(anoRef, mesRef, 0).getDate();
    const ultimo = `${anoRef}-${String(mesRef).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
    const { data: creditos } = (await supabaseAdmin
      .from('fin_conciliacoes')
      .select('valor')
      .in('conta_bancaria_id', idsContas)
      .eq('tipo', 'credito')
      .eq('status', 'conciliado')
      .gte('data_movimento', primeiro)
      .lte('data_movimento', ultimo)) as { data: unknown };
    recebidoMes = ((creditos || []) as { valor: number }[]).reduce((s, c) => s + Number(c.valor || 0), 0);
  }

  let queryFolhas = supabaseAdmin.from('payroll_sheets').select('status');
  if (empresaId) queryFolhas = queryFolhas.eq('company_id', empresaId);
  if (anoFiltro) queryFolhas = queryFolhas.eq('reference_year', anoFiltro);
  if (mesFiltro) queryFolhas = queryFolhas.eq('reference_month', mesFiltro);
  const { data: folhas } = (await queryFolhas) as { data: unknown };
  const folhasPorStatus: Record<string, number> = {};
  for (const f of (folhas || []) as { status: string }[]) {
    folhasPorStatus[f.status] = (folhasPorStatus[f.status] || 0) + 1;
  }

  let queryComps = supabaseAdmin
    .from('fin_faturas')
    .select('competencia_mes, competencia_ano, valor_total, status')
    .order('competencia_ano', { ascending: false })
    .order('competencia_mes', { ascending: false })
    .limit(500);
  if (empresaId) queryComps = queryComps.eq('empresa_id', empresaId);
  const { data: compsRows } = (await queryComps) as { data: unknown };
  const mapaComps = new Map<string, { faturas: number; total: number }>();
  for (const r of (compsRows || []) as {
    competencia_mes: number | null;
    competencia_ano: number | null;
    valor_total: number;
    status: string;
  }[]) {
    if (!r.competencia_mes || !r.competencia_ano || r.status === 'cancelada') continue;
    const chave = `${r.competencia_ano}-${String(r.competencia_mes).padStart(2, '0')}`;
    const atual = mapaComps.get(chave) || { faturas: 0, total: 0 };
    atual.faturas += 1;
    atual.total += Number(r.valor_total || 0);
    mapaComps.set(chave, atual);
  }
  const competencias = [...mapaComps.entries()]
    .slice(0, 12)
    .map(([compChave, v]) => ({ competencia: compChave, ...v }));

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
  return { status: 200, body: { success: true, data } };
}
