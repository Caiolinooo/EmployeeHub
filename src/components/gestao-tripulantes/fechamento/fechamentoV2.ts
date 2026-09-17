/**
 * Tipos e helpers compartilhados do Fechamento v2 (UI).
 *
 * Consumem os campos definidos no contrato compartilhado GT v2:
 * - relatorio-mensal ganha { periodo, pendencias, marcados }
 * - gt_fechamento_periodos / gt_fechamento_marcacoes / gt_escala_edicoes
 *
 * Fuso: mês de referência default ancorado em BRT (-3h).
 * Datas: ISO YYYY-MM-DD para storage, dd/mm/aaaa para display.
 */

/** Mês civil atual em BRT (toISOString() viraria o mês em 21h do fim de mês). */
export function mesAnoAtualBRT(): string {
  const nowBrt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return nowBrt.toISOString().slice(0, 7);
}

/** ISO YYYY-MM-DD (ou ISO datetime) → dd/mm/aaaa. */
export function formatarDataBR(
  iso: string | null | undefined,
  opts?: { comHora?: boolean; anoCurto?: boolean },
): string {
  if (!iso) return '—';
  const clean = String(iso).trim();
  const datePart = clean.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return clean;
  const [, y, m, d] = match;
  const ano = opts?.anoCurto ? y.slice(2) : y;
  const base = `${d}/${m}/${ano}`;
  if (opts?.comHora && clean.length >= 16) {
    return `${base} ${clean.slice(11, 16)}`;
  }
  return base;
}

/** Fonte do período resolvido pelo relatorio-mensal / gt_fechamento_periodos. */
export type PeriodoFonte = 'explicit' | 'config' | 'mes';

export interface FechamentoPeriodoInfo {
  dataInicio: string;
  dataFim: string;
  fonte: PeriodoFonte | string;
}

export interface PendenciaColaboradorPayload {
  colaboradorId: string;
  nome: string;
  fiDeficitPendente: number;
  dbaDiasPendentes: string[];
  folgaAberta: boolean;
  proximoEmbarque?: string | null;
}

export interface PendenciasPayload {
  porColaborador: PendenciaColaboradorPayload[];
  totais: { fi: number; dba: number };
}

export interface MarcadosResumoPayload {
  listaConfirmada: boolean;
  total: number;
}

/** Linha de colaboradoresTotais — campos novos do v2 são opcionais (back-compat). */
export interface ColaboradorTotaisLinha {
  colaboradorId?: string;
  colaborador_id?: string;
  id?: string;
  matricula?: string;
  cpf?: string;
  cpf_formatado?: string;
  nome: string;
  cargo?: string;
  centro_custo?: string;
  empresa?: string;
  embarcacao?: string;
  regime_escala?: string;
  total_dias_on?: number;
  total_dias_dba?: number;
  total_dias_fi?: number;
  total_dias_folga?: number;
  total_dias_stb?: number;
  total_dias_tre?: number;
  total_dias_fer?: number;
  checagens?: {
    escala_ok?: boolean;
    soma_ok?: boolean;
    alertas?: string[];
  };
  [key: string]: unknown;
}

export type EscalaEdicaoOperacao =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'rejeicao'
  | 'reversao';

export type EscalaEdicaoStatus = 'aplicada' | 'revertida' | 'rejeitada';

export interface EscalaEdicaoItem {
  id: string;
  embarque_id?: string | null;
  colaborador_id?: string | null;
  operacao: EscalaEdicaoOperacao | string;
  status: EscalaEdicaoStatus | string;
  dados_anteriores?: Record<string, unknown> | null;
  dados_novos?: Record<string, unknown> | null;
  motivo?: string | null;
  ator_id?: string | null;
  ator_nome?: string | null;
  ator_role?: string | null;
  ator_cpf?: string | null;
  ip?: string | null;
  revisada_por_id?: string | null;
  revisada_por_nome?: string | null;
  revisada_em?: string | null;
  created_at?: string | null;
  /** GET /escala-edicoes devolve `colaboradorNome` (camelCase) resolvido por join. */
  colaboradorNome?: string | null;
  /** Fallback legado (snake_case) — mantido para robustez de parse. */
  colaborador_nome?: string | null;
}

/** Campos exibidos no diff antes→depois da fila de revisão. */
export const EDICAO_DIFF_FIELDS = [
  'data_embarque',
  'data_desembarque',
  'data_prevista_desembarque',
  'tipo',
  'embarcacao',
  'local_embarque',
  'local_desembarque',
  'observacoes',
] as const;

export function resolverColaboradorIdLinha(linha: ColaboradorTotaisLinha): string | null {
  const direto =
    (linha.colaboradorId || linha.colaborador_id || linha.id || '') as string;
  return direto && String(direto).trim() ? String(direto) : null;
}
