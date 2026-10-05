import type { FinCarteira } from '@/types/financeiro';
import { agingCarteira, type TituloCarteira } from '@/lib/financeiro/regras-financeiro';

/**
 * Montagem da carteira de recebimentos (aging) do GET /api/financeiro/carteira.
 * Mesma abordagem do visao-geral: o `admin` entra por parâmetro para os testes
 * mockarem sem carregar `@/lib/supabase`.
 */

/** Fatura emitida/nfse_emitida é o que está a receber (mesma regra de podeCobrarFatura). */
const STATUS_RECEBIVEIS = ['emitida', 'nfse_emitida'];

export type CarteiraErroDb = { message?: string; code?: string } | null;

/** Subconjunto thenable do query builder do supabase usado nesta montagem. */
export type CarteiraQuery = {
  select: (...args: unknown[]) => CarteiraQuery;
  eq: (coluna: string, valor: unknown) => CarteiraQuery;
  in: (coluna: string, valores: unknown[]) => CarteiraQuery;
  then: (
    onfulfilled?: (value: { data: unknown; error: CarteiraErroDb }) => unknown,
    onrejected?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

/** Client mínimo: `from(tabela)` devolve o query builder (supabase ou mock). */
export type CarteiraAdmin = {
  // Query builder do supabase e o mock thenable não compartilham um tipo público.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (tabela: string) => any;
};

export type CarteiraResultado =
  | { ok: true; carteira: FinCarteira }
  | { ok: false; status: number; error: string };

interface FaturaCarteiraRow {
  id: string;
  cliente_id: string | null;
  valor_total: number;
  data_vencimento: string | null;
  cliente_snapshot: Record<string, unknown> | null;
  cliente: { id: string; nome: string } | null;
}

interface CobrancaLiquidadaRow {
  fatura_id: string | null;
  valor: number;
}

/**
 * Carteira = saldo em aberto de cada fatura (total − tudo que já liquidou)
 * agrupado em aging por faixas. `moeda` é única por consulta: somar BRL com USD
 * daria um total sem significado.
 */
export async function montarCarteira(
  admin: CarteiraAdmin,
  params: { empresaId: string | null; moeda: string; referencia: string },
): Promise<CarteiraResultado> {
  let faturas = admin
    .from('fin_faturas')
    .select('id, cliente_id, valor_total, data_vencimento, cliente_snapshot, cliente:fin_clientes(id, nome)')
    .in('status', STATUS_RECEBIVEIS)
    .eq('moeda', params.moeda);
  if (params.empresaId) faturas = faturas.eq('empresa_id', params.empresaId);

  const { data, error } = await faturas;
  if (error) return { ok: false, status: 500, error: error.message || 'erro ao ler faturas' };

  const rows = (data || []) as unknown as FaturaCarteiraRow[];
  const ids = rows.map((r) => r.id);

  const liquidadoPorFatura = new Map<string, number>();
  if (ids.length > 0) {
    const { data: cobrancas, error: errCob } = await admin
      .from('fin_cobrancas')
      .select('fatura_id, valor')
      .in('fatura_id', ids)
      .eq('status', 'liquidada');
    if (errCob) return { ok: false, status: 500, error: errCob.message || 'erro ao ler cobranças' };
    for (const c of (cobrancas || []) as unknown as CobrancaLiquidadaRow[]) {
      if (!c.fatura_id) continue;
      liquidadoPorFatura.set(
        c.fatura_id,
        (liquidadoPorFatura.get(c.fatura_id) || 0) + Number(c.valor || 0),
      );
    }
  }

  const titulos: TituloCarteira[] = rows.map((r) => {
    const snapNome = r.cliente_snapshot?.nome;
    return {
      id: r.id,
      clienteId: r.cliente_id,
      clienteNome:
        r.cliente?.nome ||
        (typeof snapNome === 'string' && snapNome.trim() !== '' ? snapNome.trim() : '—'),
      valor: Number(r.valor_total || 0) - (liquidadoPorFatura.get(r.id) || 0),
      vencimento: r.data_vencimento,
    };
  });

  // `referencia` e `moeda` voltam na resposta: sem o eco o cliente não descobre
  // com que dia e em que moeda os totais foram calculados (moeda é única/consulta).
  return {
    ok: true,
    carteira: {
      ...agingCarteira(titulos, params.referencia),
      referencia: params.referencia,
      moeda: params.moeda,
    },
  };
}
