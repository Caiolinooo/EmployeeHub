/**
 * Linear OCR field matchers (CodeQL js/polynomial-redos).
 * Separators and values do not share a quantified class.
 * Bounds replace open-ended `*` / `+` on overlapping sets.
 */

const SEP = '[:.\\-|]{0,8}[\\s\\t]{0,20}';

const NOME_RE = new RegExp(
  String.raw`(?:NOME|NOME\s{0,3}COMPLETO|TRABALHADOR|PACIENTE)${SEP}([A-ZÀ-Ú][A-ZÀ-Ú\x20\t]{2,59})`,
);
const MAE_RE = new RegExp(
  String.raw`(?:FILIAÇÃO|MÃE|MAE)${SEP}([A-ZÀ-Ú][A-ZÀ-Ú\s]{2,59})`,
);
const PAI_RE = new RegExp(
  String.raw`(?:PAI)${SEP}([A-ZÀ-Ú][A-ZÀ-Ú\s]{2,59})`,
);
const CTPS_RE = new RegExp(String.raw`CTPS${SEP}(\d{1,20})`);
const CNH_RE = new RegExp(String.raw`CNH${SEP}(\d{1,20})`);
const PIS_RE = new RegExp(String.raw`PIS${SEP}(\d{1,20})`);
const RUA_RE = new RegExp(
  String.raw`(?:RUA|AVENIDA|AV|TRAVESSA|PRACA|ESTRADA)${SEP}([A-ZÀ-Ú0-9,][A-ZÀ-Ú\s0-9,]{0,119})`,
);

const NOME_STOP = ['CPF', 'RG', 'DN', 'EMPRESA', 'FUNÇÃO', 'CARGO', 'SETOR'] as const;
const MAE_STOP = ['PAI', 'CPF', 'RG', 'NATURALIDADE'] as const;
const PAI_STOP = ['MÃE', 'MAE', 'CPF', 'RG', 'NATURALIDADE'] as const;

function isWs(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v';
}

/** Same cut as `/\s+(?:LABEL).*$/i` without the open-ended `.*$`. */
export function cortarAposRotulo(valor: string, rotulos: readonly string[]): string {
  const upper = valor.toUpperCase();
  const labels = rotulos.map((r) => r.toUpperCase());
  for (let i = 0; i < upper.length; i++) {
    if (!isWs(upper[i]!)) continue;
    let j = i + 1;
    while (j < upper.length && isWs(upper[j]!)) j += 1;
    for (const lab of labels) {
      if (upper.startsWith(lab, j)) {
        return valor.slice(0, i).trim();
      }
    }
  }
  return valor.trim();
}

function firstCapture(upper: string, re: RegExp): string | null {
  const m = upper.match(re);
  return m?.[1] ? m[1] : null;
}

export function extrairNomeOcr(upper: string): string | null {
  const raw = firstCapture(upper, NOME_RE);
  if (!raw) return null;
  const nome = cortarAposRotulo(raw.trim(), NOME_STOP);
  return nome.length >= 3 ? nome : null;
}

export function extrairNomeMaeOcr(upper: string): string | null {
  const raw = firstCapture(upper, MAE_RE);
  if (!raw) return null;
  const nome = cortarAposRotulo(raw.trim(), MAE_STOP);
  return nome || null;
}

export function extrairNomePaiOcr(upper: string): string | null {
  const raw = firstCapture(upper, PAI_RE);
  if (!raw) return null;
  const nome = cortarAposRotulo(raw.trim(), PAI_STOP);
  return nome || null;
}

export function extrairCtpsOcr(upper: string): string | null {
  return firstCapture(upper, CTPS_RE);
}

export function extrairCnhOcr(upper: string): string | null {
  return firstCapture(upper, CNH_RE);
}

export function extrairPisOcr(upper: string): string | null {
  return firstCapture(upper, PIS_RE);
}

export function extrairLogradouroOcr(upper: string): string | null {
  const raw = firstCapture(upper, RUA_RE);
  return raw ? raw.trim() : null;
}
