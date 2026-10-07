/**
 * Horas aprovadas do PontoFlow → itens da folha (origem timesheet).
 * O portal não recalcula. Código sem mapa vira aviso, não rubrica inventada.
 */

export interface RubricaLine {
  code: string;
  quantity: number;
}

export interface RubricaMapRow {
  tsCode: string;
  payrollCodeId: string;
}

export interface FolhaItemPlanejado {
  payrollCodeId: string;
  tsCode: string;
  quantity: number;
}

export function competenciaFromPeriodEnd(periodEnd: string): { mes: number; ano: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodEnd);
  if (!match) return null;
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return { mes, ano };
}

export function parseRubricaLines(raw: unknown): RubricaLine[] {
  if (!Array.isArray(raw)) return [];
  const out: RubricaLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const code = 'code' in item && typeof item.code === 'string' ? item.code.trim() : '';
    const quantity = 'quantity' in item ? Number(item.quantity) : NaN;
    if (!code || !Number.isFinite(quantity) || quantity < 0) continue;
    out.push({ code, quantity: Math.round(quantity * 100) / 100 });
  }
  return out;
}

/** Cruza lines do evento com ts_rubrica_map. Sem mapa = aviso, sem item. */
export function planejarItensFolha(
  lines: RubricaLine[],
  map: RubricaMapRow[],
): { itens: FolhaItemPlanejado[]; avisos: string[] } {
  const byCode = new Map<string, string>();
  for (const row of map) {
    if (row.tsCode && row.payrollCodeId) byCode.set(row.tsCode, row.payrollCodeId);
  }
  const itens: FolhaItemPlanejado[] = [];
  const avisos: string[] = [];
  for (const line of lines) {
    const payrollCodeId = byCode.get(line.code);
    if (!payrollCodeId) {
      avisos.push(`Código ${line.code} sem rubrica mapeada`);
      continue;
    }
    itens.push({ payrollCodeId, tsCode: line.code, quantity: line.quantity });
  }
  return { itens, avisos };
}
