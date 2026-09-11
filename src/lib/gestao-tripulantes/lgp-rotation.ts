/**
 * Derive Man Schedule rotation extras (FI / DBA / STB / OFF-C) from a LGP row
 * plus the next embark of the same person. Used when materializing mio_cache
 * into gt_historico_embarques so runtime never needs the blob.
 */

export interface RawLGPRecord {
  Matrícula?: string;
  Nome?: string;
  'Função/Cargo'?: string;
  CPF?: string;
  Regime?: string;
  Origem?: string;
  Destino?: string;
  'Centro de Custo do Integrante'?: string;
  'Nº RTPE'?: string;
  'Prev. de Emb.'?: string;
  'Embarque Real'?: string;
  'Prev. Desemb.'?: string;
  'RTPE Status'?: string;
  'Nº RTPD'?: string;
  'Prev. Desemb. RTPD'?: string;
  'Desembarque Real'?: string;
  'RTPD Status'?: string;
  'Qtd. de Dias'?: string;
  'Folga Início'?: string;
  'Folga Fim'?: string;
  [key: string]: unknown;
}

export type DetectedExtraType = 'fi' | 'dba' | 'stb' | 'offc';

export function parseLgpDate(str: string | null | undefined): Date | null {
  if (!str || String(str).trim() === '') return null;
  const d = new Date(`${String(str).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(d1: Date, d2: Date): number {
  return Math.round((d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000));
}

function isoDay(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function lgpRotationStart(record: RawLGPRecord): string | null {
  const v = record['Embarque Real'] || record['Prev. de Emb.'] || null;
  return v ? String(v).slice(0, 10) : null;
}

export function lgpRotationEnd(record: RawLGPRecord): string | null {
  const v = record['Desembarque Real'] || record['Prev. Desemb. RTPD'] || record['Prev. Desemb.'] || null;
  return v ? String(v).slice(0, 10) : null;
}

export function detectRotationType(
  currentRecord: RawLGPRecord,
  nextRecord: RawLGPRecord | null
): { type: 'normal' | DetectedExtraType; extraPeriods: { start: string; end: string; type: DetectedExtraType }[] } {
  const extraPeriods: { start: string; end: string; type: DetectedExtraType }[] = [];

  const desembarqueReal = parseLgpDate(currentRecord['Desembarque Real']);
  const prevDesemb = parseLgpDate(currentRecord['Prev. Desemb.']);
  const folgaInicio = parseLgpDate(currentRecord['Folga Início']);
  const folgaFim = parseLgpDate(currentRecord['Folga Fim']);
  const rotationEnd = desembarqueReal || prevDesemb;

  if (!rotationEnd) {
    return { type: 'normal', extraPeriods };
  }

  const nextEmbReal = nextRecord ? parseLgpDate(nextRecord['Embarque Real']) : null;
  const nextPrevEmb = nextRecord ? parseLgpDate(nextRecord['Prev. de Emb.']) : null;
  const nextEmbarque = nextEmbReal || nextPrevEmb;

  if (!nextEmbarque) {
    if (folgaInicio && folgaFim) {
      const daysAfterFolga = daysBetween(rotationEnd, folgaInicio);
      if (daysAfterFolga > 1) {
        extraPeriods.push({ start: isoDay(rotationEnd), end: isoDay(folgaInicio), type: 'offc' });
      }
      extraPeriods.push({ start: isoDay(folgaInicio), end: isoDay(folgaFim), type: 'offc' });
    }
    return { type: 'normal', extraPeriods };
  }

  const daysBetweenRotations = daysBetween(rotationEnd, nextEmbarque);

  if (daysBetweenRotations <= 1) {
    extraPeriods.push({ start: isoDay(rotationEnd), end: isoDay(nextEmbarque), type: 'dba' });
    return { type: 'dba', extraPeriods };
  }

  if (folgaInicio && folgaFim) {
    const daysAfterFolga = daysBetween(rotationEnd, folgaInicio);
    if (daysAfterFolga > 1) {
      extraPeriods.push({ start: isoDay(rotationEnd), end: isoDay(folgaInicio), type: 'offc' });
    }
    extraPeriods.push({ start: isoDay(folgaInicio), end: isoDay(folgaFim), type: 'offc' });
    const daysFolgaToEnd = daysBetween(folgaFim, nextEmbarque);
    if (daysFolgaToEnd > 1) {
      extraPeriods.push({ start: isoDay(folgaFim), end: isoDay(nextEmbarque), type: 'stb' });
      return { type: 'stb', extraPeriods };
    }
  } else {
    extraPeriods.push({ start: isoDay(rotationEnd), end: isoDay(nextEmbarque), type: 'offc' });
  }

  return { type: 'normal', extraPeriods };
}
