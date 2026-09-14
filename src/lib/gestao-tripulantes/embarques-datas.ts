/**
 * Datas de escala do colaborador derivadas dos eventos de gt_historico_embarques.
 * As colunas data_ultimo_embarque / data_ultimo_desembarque / data_proximo_embarque
 * de gt_colaboradores tinham como único escritor o pull MIO (desligado na v5.77.0)
 * e congelaram — a fonte canônica da escala são os próprios eventos (portal é a
 * única verdade). Regra 100% pura, sem Supabase, para reuso na leitura (ficha),
 * na escrita (save/exclusão de embarques) e nos testes.
 */
import { civilYmdNumber } from './escala-contagem';

export interface EventoEscalaDatasLike {
  data_embarque: string | null;
  data_desembarque: string | null;
  /** Soft-delete: linhas marcadas não entram no cálculo. */
  deleted_at?: string | null;
}

export interface DatasEscalaDerivadas {
  data_ultimo_embarque: string | null;
  data_ultimo_desembarque: string | null;
  data_proximo_embarque: string | null;
}

/** Data civil LOCAL (meia-noite do dia) — nunca `new Date('YYYY-MM-DD')` (parseia UTC). */
export function hojeCivil(ref?: Date): Date {
  const now = ref ?? new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Date (civil local) → 'YYYY-MM-DD'. */
export function toCivilYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Deriva as 3 datas de escala a partir dos eventos vivos:
 * - data_ultimo_embarque     = max(data_embarque)     com data_embarque ≤ hoje
 * - data_ultimo_desembarque  = max(data_desembarque)  com data_desembarque ≤ hoje (null ignorado)
 * - data_proximo_embarque    = min(data_embarque)     com data_embarque > hoje
 * Soft-deletados e datas inválidas são ignorados. Retorna null por campo quando
 * não há evento que o determine — o chamador decide o fallback (coluna/valor anterior).
 */
export function derivarDatasEscala(
  eventos: EventoEscalaDatasLike[] | null | undefined,
  hoje?: Date,
): DatasEscalaDerivadas {
  const base = hoje ?? hojeCivil();
  const hojeNum = base.getFullYear() * 10000 + (base.getMonth() + 1) * 100 + base.getDate();

  let ultEmbNum = -1;
  let ultEmb: string | null = null;
  let ultDesNum = -1;
  let ultDes: string | null = null;
  let proEmbNum = Number.MAX_SAFE_INTEGER;
  let proEmb: string | null = null;

  for (const ev of eventos || []) {
    if (!ev || ev.deleted_at) continue;

    const embNum = civilYmdNumber(ev.data_embarque);
    if (embNum > 0) {
      if (embNum <= hojeNum) {
        if (embNum > ultEmbNum) {
          ultEmbNum = embNum;
          ultEmb = String(ev.data_embarque).slice(0, 10);
        }
      } else if (embNum < proEmbNum) {
        proEmbNum = embNum;
        proEmb = String(ev.data_embarque).slice(0, 10);
      }
    }

    const desNum = civilYmdNumber(ev.data_desembarque);
    if (desNum > 0 && desNum <= hojeNum && desNum > ultDesNum) {
      ultDesNum = desNum;
      ultDes = String(ev.data_desembarque).slice(0, 10);
    }
  }

  return {
    data_ultimo_embarque: ultEmb,
    data_ultimo_desembarque: ultDes,
    data_proximo_embarque: proEmb,
  };
}
