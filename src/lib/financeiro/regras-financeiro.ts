/**
 * Regras de negócio PURAS do módulo Financeiro (§5.2/§6 do design) — sem
 * Supabase/Next, testáveis com tsx --test. A camada de DB (service.ts) chama
 * estas funções e persiste os resultados; estados/números nunca mudam sem
 * passar por aqui.
 */
import type { FinCobrancaStatus, FinConciliacaoTipo, FinFaturaStatus, FinNfseStatus } from '@/types/financeiro';

// ============================================================
// Faturas — número sequencial e máquina de estados
// ============================================================

/** Próximo número sequencial de fatura dentro de (empresa, ano): max+1. */
export function proximoNumeroFatura(numerosUsados: number[]): number {
  return numerosUsados.reduce((max, n) => (n > max ? n : max), 0) + 1;
}

export function podeEditarFatura(status: FinFaturaStatus): boolean {
  return status === 'rascunho';
}

export function podeEmitirFatura(status: FinFaturaStatus): boolean {
  return status === 'rascunho';
}

/** DELETE de fatura → status=cancelada; 409 se não rascunho/emitida (§6). */
export function podeCancelarFatura(status: FinFaturaStatus): boolean {
  return status === 'rascunho' || status === 'emitida';
}

export interface ItemFaturaCalculo {
  descricao?: string;
  referencia?: string;
  quantidade?: number;
  valor_unitario?: number;
  valor_total?: number;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

export interface ItemCalculado {
  descricao: string;
  referencia?: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

/** Normaliza um item: valor_total = quantidade × valor_unitario (default qty 1). */
export function calcularItem(item: ItemFaturaCalculo): ItemCalculado {
  const quantidade = round2(Number(item.quantidade ?? 1));
  const valor_unitario = round2(Number(item.valor_unitario ?? 0));
  const referencia = item.referencia?.trim();
  return {
    descricao: String(item.descricao || '').trim(),
    ...(referencia ? { referencia } : {}),
    quantidade,
    valor_unitario,
    valor_total: round2(quantidade * valor_unitario),
  };
}

/** Valida e calcula a lista de itens; total = soma dos itens. Erro → {ok:false}. */
export function calcularItensFatura(itens: ItemFaturaCalculo[]):
  { ok: true; itens: ItemCalculado[]; total: number }
  | { ok: false; erro: string } {
  if (!Array.isArray(itens) || itens.length === 0) {
    return { ok: false, erro: 'Fatura precisa de ao menos um item' };
  }
  const calculados = itens.map(calcularItem);
  for (const it of calculados) {
    if (!it.descricao) return { ok: false, erro: 'Todo item precisa de descrição' };
    if (!Number.isFinite(it.quantidade) || it.quantidade <= 0) {
      return { ok: false, erro: `Quantidade inválida no item '${it.descricao}'` };
    }
    if (!Number.isFinite(it.valor_unitario) || it.valor_unitario < 0) {
      return { ok: false, erro: `Valor unitário inválido no item '${it.descricao}'` };
    }
  }
  const total = round2(calculados.reduce((s, it) => s + it.valor_total, 0));
  return { ok: true, itens: calculados, total };
}

/** 'YYYY-MM' → {mes, ano}; inválido → null. */
export function parseCompetencia(
  competencia: string | null | undefined,
): { mes: number; ano: number } | null {
  if (!competencia) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(competencia.trim());
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return { mes, ano };
}

// ============================================================
// NFS-e — §5.2 (moeda, RPS, estados)
// ============================================================

export type MotivoBloqueioNfse =
  | 'fatura_status_invalido'
  | 'fatura_moeda_invalida';

/**
 * §5.2.1 — emissão exige fatura `emitida` e moeda BRL (NFS-e é nacional).
 * Retorna o motivo do bloqueio (→ HTTP 409) ou ok.
 */
export function verificarEmissaoNfse(fatura: { status: FinFaturaStatus; moeda: string }):
  { ok: true } | { ok: false; motivo: MotivoBloqueioNfse } {
  if (fatura.status !== 'emitida') return { ok: false, motivo: 'fatura_status_invalido' };
  if ((fatura.moeda || '').toUpperCase() !== 'BRL') return { ok: false, motivo: 'fatura_moeda_invalida' };
  return { ok: true };
}

const TRANSICOES_NFSE: Record<FinNfseStatus, FinNfseStatus[]> = {
  rps_gerado: ['enviado'],
  enviado: ['autorizado', 'rejeitado'],
  autorizado: ['cancelado'],
  rejeitado: ['enviado'],
  cancelado: [],
};

/** §5.2.3 — máquina de estados da emissão. */
export function transicaoNfseValida(de: FinNfseStatus, para: FinNfseStatus): boolean {
  return (TRANSICOES_NFSE[de] || []).includes(para);
}

/** Tipo do evento fin_eventos para uma transição de emissão (§5.2.3). */
export function eventoDeTransicaoNfse(para: FinNfseStatus): string | null {
  switch (para) {
    case 'enviado': return 'nfse.enviado';
    case 'autorizado': return 'nfse.autorizada';
    case 'rejeitado': return 'nfse.rejeitada';
    case 'cancelado': return 'nfse.cancelada';
    default: return null;
  }
}

/** §5.2.5 — reemitir só com status IN ('rps_gerado','rejeitado'). */
export function podeReemitirNfse(status: FinNfseStatus): boolean {
  return status === 'rps_gerado' || status === 'rejeitado';
}

/** Consulta de situação: qualquer emissão não cancelada. */
export function podeConsultarNfse(status: FinNfseStatus): boolean {
  return status !== 'cancelado';
}

/** §5.2 — cancelamento só de emissão autorizada. */
export function podeCancelarNfse(status: FinNfseStatus): boolean {
  return status === 'autorizado';
}

/** §5.2.4 — autorizado atualiza fatura para nfse_emitida; cancelamento volta para emitida. */
export function statusFaturaAposNfse(para: FinNfseStatus): FinFaturaStatus | null {
  if (para === 'autorizado') return 'nfse_emitida';
  if (para === 'cancelado') return 'emitida';
  return null;
}

// ============================================================
// Conciliação automática (§6) — txid / nossoNumero / valor+data
// ============================================================

export interface MovimentoConciliavel {
  idExterno: string;
  data: string; // YYYY-MM-DD
  tipo: FinConciliacaoTipo;
  valor: number;
  descricao?: string;
  nossoNumero?: string;
  txid?: string;
}

export interface CobrancaConciliavel {
  id: string;
  valor: number;
  vencimento?: string | null;
  nosso_numero?: string | null;
  txid?: string | null;
  status: FinCobrancaStatus;
}

export type CriterioConciliacao = 'txid' | 'nosso_numero' | 'valor_data';

export interface ResultadoConciliacao {
  cobrancaId: string | null;
  criterio: CriterioConciliacao | null;
}

/**
 * Casa um movimento de CRÉDITO contra cobranças `gerada` (§6):
 *   1. txid exato; 2. nosso_numero exato; 3. valor + data (movimento na data
 *   de vencimento). Débitos e cobranças não-`gerada` nunca casam.
 */
export function conciliarMovimento(
  movimento: MovimentoConciliavel,
  cobrancas: CobrancaConciliavel[],
): ResultadoConciliacao {
  if (movimento.tipo !== 'credito') return { cobrancaId: null, criterio: null };
  const candidatas = cobrancas.filter((c) => c.status === 'gerada');
  if (candidatas.length === 0) return { cobrancaId: null, criterio: null };

  if (movimento.txid) {
    const hit = candidatas.find((c) => c.txid && c.txid === movimento.txid);
    if (hit) return { cobrancaId: hit.id, criterio: 'txid' };
  }
  if (movimento.nossoNumero) {
    const hit = candidatas.find((c) => c.nosso_numero && c.nosso_numero === movimento.nossoNumero);
    if (hit) return { cobrancaId: hit.id, criterio: 'nosso_numero' };
  }
  const valor = round2(movimento.valor);
  const hitValorData = candidatas.find(
    (c) => round2(Number(c.valor)) === valor && c.vencimento && c.vencimento === movimento.data,
  );
  if (hitValorData) return { cobrancaId: hitValorData.id, criterio: 'valor_data' };

  return { cobrancaId: null, criterio: null };
}

// ============================================================
// Cobranças — estados
// ============================================================

/** Reconsulta/adapter só atualiza cobranças abertas. */
export function podeAtualizarCobranca(status: FinCobrancaStatus): boolean {
  return status === 'pendente' || status === 'gerada';
}

/** Cobrança só é gerada contra fatura emitida/nfse_emitida (nunca rascunho/cancelada). */
export function podeCobrarFatura(status: FinFaturaStatus): boolean {
  return status === 'emitida' || status === 'nfse_emitida';
}
