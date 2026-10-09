/**
 * Prazo do contrato no cadastro GT/DP.
 * O select grava o texto em `prazo_contrato` (TEXT). Sem enum no Postgres.
 * Experiência não vira Indeterminado sozinha aos 90 dias.
 */

export const PRAZO_CONTRATO_OPCOES = [
  'Indeterminado',
  'Determinado',
  'Experiência',
  'Não se aplica',
  'temporário',
] as const;

export type PrazoContratoOpcao = (typeof PRAZO_CONTRATO_OPCOES)[number];

const OPCOES = new Set<string>(PRAZO_CONTRATO_OPCOES);

export const PRAZO_CONTRATO_DIAS_FIELDS = [
  'prazo_contrato_dias',
  'prazo_contrato_prorrog_dias',
] as const;

export const PRAZO_CONTRATO_DATA_FIELDS = [
  'prazo_contrato_termino',
  'prazo_contrato_prorrog_termino',
] as const;

export function prazoContratoZeraDatas(prazo: string): boolean {
  return prazo === 'Indeterminado' || prazo === 'Não se aplica';
}

/** Determinado, temporário e Experiência pedem Dias + Término. */
export function prazoContratoExigeVigencia(prazo: string): boolean {
  return prazo === 'Determinado' || prazo === 'temporário' || prazo === 'Experiência';
}

/** Só Experiência pede prorrogação. */
export function prazoContratoExigeProrrogacao(prazo: string): boolean {
  return prazo === 'Experiência';
}

/** Lista canônica. Texto livre antigo entra no fim, sem ser reescrito. */
export function opcoesPrazoContrato(atual: unknown): string[] {
  const base = [...PRAZO_CONTRATO_OPCOES];
  const text = atual == null ? '' : String(atual);
  if (text && !OPCOES.has(text)) return [...base, text];
  return base;
}

/** Limpa no estado do form os campos que o tipo novo não usa. Não roda no load. */
export function aplicarTrocaPrazoContrato<T extends Record<string, unknown>>(prev: T, prazo: string): T {
  const next: Record<string, unknown> = { ...prev, prazo_contrato: prazo };
  if (!prazoContratoExigeVigencia(prazo)) {
    next.prazo_contrato_dias = '';
    next.prazo_contrato_termino = '';
    next.prazo_contrato_prorrog_dias = '';
    next.prazo_contrato_prorrog_termino = '';
  } else if (!prazoContratoExigeProrrogacao(prazo)) {
    next.prazo_contrato_prorrog_dias = '';
    next.prazo_contrato_prorrog_termino = '';
  }
  return next as T;
}
