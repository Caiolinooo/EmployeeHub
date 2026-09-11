/**
 * Regime de trabalho / escala: NxN offshore vs administrativos/onshore sem rotação.
 * 14x14 is never the empty default.
 */

export const REGIMES_SEM_ROTACAO = ['sem_escala', 'administrativo', 'onshore'] as const;
export const REGIMES_ROTACAO_NXN = ['14x14', '28x28', '15x15', '30x30', '60x60'] as const;

export type RegimeSemRotacao = (typeof REGIMES_SEM_ROTACAO)[number];
export type RegimeRotacaoNxN = (typeof REGIMES_ROTACAO_NXN)[number];
export type RegimeTrabalhoConhecido = RegimeSemRotacao | RegimeRotacaoNxN;

export interface CamposEscalaColaborador {
  escala_embarque?: number | string | null;
  escala_folga?: number | string | null;
  regime_trabalho?: string | null;
}

export interface EscalaDiasExtraidos {
  diasEmbarque: number;
  diasFolga: number;
  label: string;
  aplicaDobraAutomatica: boolean;
}

export const REGIME_TRABALHO_OPTIONS: ReadonlyArray<{
  value: RegimeTrabalhoConhecido;
  label: string;
}> = [...REGIMES_SEM_ROTACAO, ...REGIMES_ROTACAO_NXN].map((value) => ({
  value,
  label: labelRegimeSelect(value),
}));

export function normalizeRegimeKey(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-]+/g, '_');
}

function isRegimeSemRotacaoId(value: string): value is RegimeSemRotacao {
  return (REGIMES_SEM_ROTACAO as readonly string[]).includes(value);
}

function isRegimeRotacaoNxNId(value: string): value is RegimeRotacaoNxN {
  return (REGIMES_ROTACAO_NXN as readonly string[]).includes(value);
}

export function parseNxNPair(value: string | null | undefined): [number, number] | null {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d+)\s*[xX/:\-]\s*(\d+)$/);
  if (!match) return null;
  const a = parseInt(match[1], 10);
  const b = parseInt(match[2], 10);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
  return [a, b];
}

export function parseRegimeTrabalho(value: string | null | undefined): RegimeTrabalhoConhecido | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const key = normalizeRegimeKey(raw);

  if (key === 'sem_escala' || key === 'semescala' || key === 'sem_rotacao' || key === 'semrotacao') {
    return 'sem_escala';
  }
  if (key === 'administrativo' || key === 'admin') {
    return 'administrativo';
  }
  if (key === 'onshore') {
    return 'onshore';
  }

  const nxn = parseNxNPair(raw);
  if (nxn) {
    const token = `${nxn[0]}x${nxn[1]}`;
    if (isRegimeRotacaoNxNId(token)) return token;
  }

  return null;
}

export function isRegimeSemRotacao(value: string | null | undefined): boolean {
  const parsed = parseRegimeTrabalho(value);
  return parsed !== null && isRegimeSemRotacaoId(parsed);
}

/** Null/empty token + both day fields 0 (Aislan-like) reads as Sem escala, not 14x14. */
export function inferRegimeUi(c: CamposEscalaColaborador): string {
  const known = parseRegimeTrabalho(c.regime_trabalho);
  if (known) return known;
  const embarque = parseDiasEscala(c.escala_embarque);
  const folga = parseDiasEscala(c.escala_folga);
  if (embarque === 0 && folga === 0) return 'sem_escala';
  return String(c.regime_trabalho || '').trim();
}

export function isRegimeRotacaoNxN(value: string | null | undefined): boolean {
  const parsed = parseRegimeTrabalho(value);
  return parsed !== null && isRegimeRotacaoNxNId(parsed);
}

export function labelRegimeSelect(regime: RegimeTrabalhoConhecido): string {
  switch (regime) {
    case 'sem_escala':
      return 'Sem escala (sem rotação embarque/folga)';
    case 'administrativo':
      return 'Administrativo (onshore, sem escala offshore)';
    case 'onshore':
      return 'Onshore (sem rotação embarque/folga)';
    case '14x14':
      return '14 x 14 (14 dias a bordo / 14 dias folga)';
    case '28x28':
      return '28 x 28 (28 dias a bordo / 28 dias folga)';
    case '15x15':
      return '15 x 15 (15 dias a bordo / 15 dias folga)';
    case '30x30':
      return '30 x 30 (30 dias a bordo / 30 dias folga)';
    case '60x60':
      return '60 x 60 (60 dias a bordo / 60 dias folga)';
    default: {
      const _never: never = regime;
      return _never;
    }
  }
}

export function labelRegimeCompacto(regime: RegimeTrabalhoConhecido): string {
  switch (regime) {
    case 'sem_escala':
      return 'Sem escala';
    case 'administrativo':
      return 'Administrativo';
    case 'onshore':
      return 'Onshore';
    case '14x14':
      return '14x14';
    case '28x28':
      return '28x28';
    case '15x15':
      return '15x15';
    case '30x30':
      return '30x30';
    case '60x60':
      return '60x60';
    default: {
      const _never: never = regime;
      return _never;
    }
  }
}

export function aplicaDobraAutomaticaRegime(regime: RegimeTrabalhoConhecido): boolean {
  switch (regime) {
    case 'sem_escala':
    case 'administrativo':
    case 'onshore':
      return false;
    case '14x14':
    case '28x28':
    case '15x15':
    case '30x30':
    case '60x60':
      return true;
    default: {
      const _never: never = regime;
      return _never;
    }
  }
}

export function parseDiasEscala(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function persistirCamposEscala(input: CamposEscalaColaborador): {
  regime_trabalho: string | null;
  escala_embarque: number | null;
  escala_folga: number | null;
} {
  const regimeRaw = input.regime_trabalho == null ? null : String(input.regime_trabalho).trim();
  const regime = regimeRaw === '' ? null : regimeRaw;
  const known = parseRegimeTrabalho(regime);

  if (known && isRegimeSemRotacaoId(known)) {
    return { regime_trabalho: known, escala_embarque: 0, escala_folga: 0 };
  }

  const embarque = parseDiasEscala(input.escala_embarque);
  const folga = parseDiasEscala(input.escala_folga);

  if (known && isRegimeRotacaoNxNId(known)) {
    const pair = parseNxNPair(known);
    return {
      regime_trabalho: known,
      escala_embarque: embarque != null && embarque > 0 ? embarque : (pair ? pair[0] : null),
      escala_folga: folga != null && folga > 0 ? folga : (pair ? pair[1] : null),
    };
  }

  return {
    regime_trabalho: regime,
    escala_embarque: embarque,
    escala_folga: folga,
  };
}

export function escalaDiasParaForm(
  regime: string | null | undefined,
  value: number | string | null | undefined,
): string {
  if (isRegimeSemRotacao(regime)) return '0';
  if (value == null || value === '') return '';
  return String(value);
}

/**
 * Extrai dias regulares de bordo/folga. Empty/null/sem_escala/administrativo/onshore
 * never become 14x14. Dobra automática only when there is a positive NxN rotation.
 */
export function extractEscalaDias(c: CamposEscalaColaborador): EscalaDiasExtraidos {
  const known = parseRegimeTrabalho(c.regime_trabalho);

  if (known && isRegimeSemRotacaoId(known)) {
    return {
      diasEmbarque: 0,
      diasFolga: 0,
      label: labelRegimeCompacto(known),
      aplicaDobraAutomatica: false,
    };
  }

  let diasEmbarque = 0;
  let diasFolga = 0;

  const embarqueParsed = parseDiasEscala(c.escala_embarque);
  const folgaParsed = parseDiasEscala(c.escala_folga);
  if (embarqueParsed != null && embarqueParsed > 0) diasEmbarque = embarqueParsed;
  if (folgaParsed != null && folgaParsed > 0) diasFolga = folgaParsed;

  if ((!diasEmbarque || !diasFolga) && c.regime_trabalho && typeof c.regime_trabalho === 'string') {
    const nxn = parseNxNPair(c.regime_trabalho.trim());
    if (nxn) {
      if (!diasEmbarque) diasEmbarque = nxn[0];
      if (!diasFolga) diasFolga = nxn[1];
    }
  }

  if (known && isRegimeRotacaoNxNId(known)) {
    const pair = parseNxNPair(known);
    if (pair) {
      if (!diasEmbarque) diasEmbarque = pair[0];
      if (!diasFolga) diasFolga = pair[1];
    }
    const label = c.regime_trabalho && String(c.regime_trabalho).trim()
      ? String(c.regime_trabalho).trim()
      : labelRegimeCompacto(known);
    return {
      diasEmbarque,
      diasFolga: diasFolga || diasEmbarque,
      label,
      aplicaDobraAutomatica: diasEmbarque > 0,
    };
  }

  const aplicaDobraAutomatica = diasEmbarque > 0;
  const rawLabel = c.regime_trabalho && String(c.regime_trabalho).trim()
    ? String(c.regime_trabalho).trim()
    : '';

  if (!aplicaDobraAutomatica) {
    return {
      diasEmbarque: 0,
      diasFolga: 0,
      label: rawLabel || '—',
      aplicaDobraAutomatica: false,
    };
  }

  return {
    diasEmbarque,
    diasFolga: diasFolga || diasEmbarque,
    label: rawLabel || `${diasEmbarque}x${diasFolga || diasEmbarque}`,
    aplicaDobraAutomatica: true,
  };
}

export function formatRegimeDisplay(c: CamposEscalaColaborador): string {
  const inferred = inferRegimeUi(c);
  const known = parseRegimeTrabalho(inferred || c.regime_trabalho);
  if (known && isRegimeSemRotacaoId(known)) {
    return labelRegimeCompacto(known);
  }
  const extracted = extractEscalaDias(c);
  if (!extracted.aplicaDobraAutomatica) {
    return extracted.label === '—' ? '—' : extracted.label;
  }
  return `${extracted.label} (${extracted.diasEmbarque}d a bordo / ${extracted.diasFolga}d folga)`;
}

export function regimeFromMioIntegrante(mio: {
  regime_trabalho?: string | null;
  regime?: string | null;
  Regime?: string | null;
  [key: string]: unknown;
}): string | null {
  const candidates = [
    mio.regime_trabalho,
    mio.regime,
    mio.Regime,
    typeof mio['Regime de Trabalho'] === 'string' ? mio['Regime de Trabalho'] : null,
  ];
  for (const c of candidates) {
    if (c != null && String(c).trim()) return String(c).trim();
  }
  return null;
}

export function mapMioRegimeToLocal(mioRegime: string | null | undefined): {
  regime_trabalho: string | null;
  escala_embarque: number | null;
  escala_folga: number | null;
} {
  const raw = String(mioRegime || '').trim();
  if (!raw) {
    return { regime_trabalho: 'sem_escala', escala_embarque: 0, escala_folga: 0 };
  }

  const known = parseRegimeTrabalho(raw);
  if (known) {
    return persistirCamposEscala({ regime_trabalho: known });
  }

  const key = normalizeRegimeKey(raw);
  if (key.includes('administrativ')) {
    return { regime_trabalho: 'administrativo', escala_embarque: 0, escala_folga: 0 };
  }
  if (key.includes('onshore') || key.includes('em_terra') || key === 'terra') {
    return { regime_trabalho: 'onshore', escala_embarque: 0, escala_folga: 0 };
  }
  if (key.includes('sem_escala') || key.includes('semescala')) {
    return { regime_trabalho: 'sem_escala', escala_embarque: 0, escala_folga: 0 };
  }
  // Offshore / unknown: persist the source label, never invent 14x14.
  return { regime_trabalho: raw, escala_embarque: null, escala_folga: null };
}

/**
 * Local explicit regime (including sem_escala) wins on MIO pull.
 * Returns fields to write, or null when the update must skip regime columns.
 */
export function mesclarRegimeMio(
  local: CamposEscalaColaborador | null,
  mioRegime: string | null | undefined,
): {
  regime_trabalho: string | null;
  escala_embarque: number | null;
  escala_folga: number | null;
} | null {
  const mapped = mapMioRegimeToLocal(mioRegime);
  if (!local) return mapped;

  const localRaw = local.regime_trabalho == null ? '' : String(local.regime_trabalho).trim();
  if (localRaw) return null;

  return mapped;
}
