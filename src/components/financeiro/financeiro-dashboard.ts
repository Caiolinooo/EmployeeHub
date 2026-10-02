/** Séries puras do painel (barras e variação). Sem fetch. */

export interface PontoCompetencia {
  competencia: string;
  faturas: number;
  total: number;
}

export interface BarraCompetencia extends PontoCompetencia {
  mes: number;
  fracao: number;
}

export function barrasCompetencia(competencias: PontoCompetencia[]): BarraCompetencia[] {
  const ordenadas = [...competencias].sort((a, b) => a.competencia.localeCompare(b.competencia));
  const max = Math.max(1, ...ordenadas.map((ponto) => ponto.total));
  return ordenadas.map((ponto) => ({
    ...ponto,
    mes: Number(ponto.competencia.slice(5, 7)) || 0,
    fracao: ponto.total / max,
  }));
}

/** Variação do total faturado da competência contra o mês anterior presente na série. */
export function variacaoContraMesAnterior(
  competencias: Array<{ competencia: string; total: number }>,
  competencia: string,
): number | null {
  const ordenadas = [...competencias].sort((a, b) => a.competencia.localeCompare(b.competencia));
  const idx = ordenadas.findIndex((ponto) => ponto.competencia === competencia);
  if (idx <= 0) return null;
  const anterior = ordenadas[idx - 1].total;
  const atual = ordenadas[idx].total;
  if (anterior <= 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

export const ORDEM_STATUS_FATURA = ['rascunho', 'emitida', 'nfse_emitida', 'paga', 'cancelada'] as const;

export type StatusFaturaPainel = (typeof ORDEM_STATUS_FATURA)[number];

export function fatiasStatus(porStatus: Record<string, number>): Array<{ status: StatusFaturaPainel; valor: number }> {
  return ORDEM_STATUS_FATURA
    .map((status) => ({ status, valor: porStatus[status] ?? 0 }))
    .filter((fatia) => fatia.valor > 0);
}
