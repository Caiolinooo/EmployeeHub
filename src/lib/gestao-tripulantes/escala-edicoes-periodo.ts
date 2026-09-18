/**
 * Filtro de período (de/ate) da trilha de edições de escala — lib PURA
 * (sem next/server e sem cliente Supabase, para ser testável via
 * `npx tsx --test` e reutilizável por rota e serviço).
 *
 * Contrato: datas civis completas `YYYY-MM-DD`, INCLUSIVAS, interpretadas no
 * fuso BRT (offset fixo `-03:00`, sem DST — mesmo idiom de `mesAnoAtualBRT`
 * em fechamentoV2.ts / `mesReferenciaAtualBRT` em fechamento-periodo-resolver.ts).
 * O timestamptz `created_at` é comparado com:
 *   created_at >= `${de}T00:00:00-03:00`
 *   created_at <= `${ate}T23:59:59-03:00`
 * ou seja, uma edição criada qualquer hora do dia `de`..`ate` em BRT entra.
 */

const RE_DATA_COMPLETA = /^\d{4}-\d{2}-\d{2}$/;

export interface JanelaPeriodoBRT {
  /** `de` normalizado (YYYY-MM-DD) ou null quando ausente. */
  de: string | null;
  /** `ate` normalizado (YYYY-MM-DD) ou null quando ausente. */
  ate: string | null;
  /** `created_at >=` value (ISO com offset BRT) ou null. */
  createdDe: string | null;
  /** `created_at <=` value (ISO com offset BRT) ou null. */
  createdAte: string | null;
}

export type JanelaPeriodoResultado =
  | { ok: true; janela: JanelaPeriodoBRT }
  | { ok: false; error: string };

const VAZIA: JanelaPeriodoBRT = { de: null, ate: null, createdDe: null, createdAte: null };

/**
 * Valida `de`/`ate` e devolve os limites de `created_at` em BRT.
 * - Ausentes/brancos → janela vazia (filtro não aplicado).
 * - Não `YYYY-MM-DD` completo ou data de calendário inexistente (ex: 2026-02-30)
 *   → `{ ok:false, error }` (rota responde 400).
 * - `de` > `ate` → `{ ok:false, error }` (400 explícito; NÃO inverte em silêncio —
 *   mesmo idiom de `data_desembarque < data_embarque` → 400 em POST/PUT /embarques).
 */
export function normalizarJanelaPeriodoBRT(
  de?: string | null,
  ate?: string | null,
): JanelaPeriodoResultado {
  const deTrim = String(de ?? '').trim();
  const ateTrim = String(ate ?? '').trim();
  if (!deTrim && !ateTrim) return { ok: true, janela: VAZIA };

  const validar = (valor: string): string | null => {
    if (!RE_DATA_COMPLETA.test(valor)) return null;
    const [y, m, d] = valor.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
    if (Number.isNaN(dt.getTime()) || dt.getDate() !== d || dt.getMonth() !== m - 1) return null;
    return valor;
  };

  let deOk: string | null = null;
  let ateOk: string | null = null;
  if (deTrim) {
    deOk = validar(deTrim);
    if (!deOk) {
      return { ok: false, error: 'Parâmetro "de" inválido — use data completa YYYY-MM-DD.' };
    }
  }
  if (ateTrim) {
    ateOk = validar(ateTrim);
    if (!ateOk) {
      return { ok: false, error: 'Parâmetro "ate" inválido — use data completa YYYY-MM-DD.' };
    }
  }
  // Comparação lexicográfica de YYYY-MM-DD (mesmo idiom de escala-recorte.ts — sem Date).
  if (deOk && ateOk && deOk > ateOk) {
    return { ok: false, error: 'Período inválido: "de" é posterior a "ate".' };
  }
  return {
    ok: true,
    janela: {
      de: deOk,
      ate: ateOk,
      createdDe: deOk ? `${deOk}T00:00:00-03:00` : null,
      createdAte: ateOk ? `${ateOk}T23:59:59-03:00` : null,
    },
  };
}
