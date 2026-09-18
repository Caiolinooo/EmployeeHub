/**
 * Recorte de marcações de escala (v5.80) — módulo PURO (sem Supabase/Next),
 * testável via `npx tsx --test src/lib/gestao-tripulantes/escala-recorte.test.ts`.
 *
 * Antes (overlap-replace v5.76.1/v5.79): salvar um evento sobre um evento do
 * MESMO tipo normalizado soft-deletava a linha inteira — apagando pontas do
 * ciclo que o operador não queria tocar. Agora a linha sobreposta é RECORTADA
 * em torno do período salvo:
 * - head  = parte do evento ANTES do período salvo  (existe se evento.data_embarque < início salvo)
 * - tail  = parte DEPOIS (existe se evento.data_desembarque > fim salvo; linha
 *   aberta recortada gera tail ABERTO [fim+1..NULL])
 * - só head  → encurtar_fim   (UPDATE: data_desembarque = início salvo - 1)
 * - só tail  → encurtar_inicio (UPDATE: data_embarque  = fim salvo + 1)
 * - head e tail → dividir (soft-delete + 2 fragmentos)
 * - nenhum → apagar (soft-delete total — comportamento anterior, inalterado)
 * - flags: apagarAnteriores descarta o head; apagarPosteriores descarta o tail.
 *
 * Tipo/merge NÃO são responsabilidade daqui: o match "keep" de período exato e
 * o filtro type-aware (escala-overlap.ts) rodam ANTES do recorte nas rotas —
 * período idêntico nunca chega a esta função (keep/merge vence).
 *
 * Datas: ISO `YYYY-MM-DD`, comparação LEXICOGRÁFICA determinística. Sem
 * `Date`/timezone (diferente de escala-contagem.ts, que usa Date para a grade).
 * Sobreposição espelha buscarSobrepostos (SQL): `data_embarque <= fim` AND
 * (`data_desembarque IS NULL` OR `>= início`) — a linha aberta sobrepõe tudo a
 * partir do seu início (não precisa da janela +90d de rotationOverlapsPeriod,
 * que existe para colunas da grade, não para corte no banco).
 */

export interface EventoRecorteInput {
  data_embarque: string | null | undefined;
  /** null/''/undefined = linha aberta (a bordo). */
  data_desembarque?: string | null | undefined;
}

export interface PeriodoRecorteInput {
  inicio: string | null | undefined;
  fim: string | null | undefined;
}

export interface FlagsRecorte {
  apagarAnteriores: boolean;
  apagarPosteriores: boolean;
}

export const FLAGS_RECORTE_PADRAO: FlagsRecorte = {
  apagarAnteriores: false,
  apagarPosteriores: false,
};

/**
 * Lê `apagar_anteriores` / `apagar_posteriores` do body: undefined/ausente =
 * false (default do contrato); aceita boolean e as formas string/numéricas
 * "true"/1 que clientes em TypeScript às vezes serializam.
 */
export function lerFlagRecorte(valor: unknown): boolean {
  return valor === true || valor === 'true' || valor === 1 || valor === '1';
}

export type PapelFragmentoRecorte = 'head' | 'tail';

/** Fragmento de linha: [inicio..fim] inclusivos; fim null = aberto. */
export interface FragmentoRecorte {
  papel: PapelFragmentoRecorte;
  inicio: string;
  fim: string | null;
}

export type RecorteAcao =
  | 'nada'
  | 'encurtar_fim'
  | 'encurtar_inicio'
  | 'dividir'
  | 'apagar';

export type ResultadoRecorte =
  | { acao: 'nada'; novaDataEmbarque?: undefined; novaDataDesembarque?: undefined; fragmentos: [] }
  | { acao: 'apagar'; novaDataEmbarque?: undefined; novaDataDesembarque?: undefined; fragmentos: [] }
  | {
      acao: 'encurtar_fim';
      novaDataEmbarque?: undefined;
      novaDataDesembarque: string;
      fragmentos: [];
    }
  | {
      acao: 'encurtar_inicio';
      novaDataEmbarque: string;
      novaDataDesembarque?: undefined;
      fragmentos: [];
    }
  | {
      acao: 'dividir';
      novaDataEmbarque?: undefined;
      novaDataDesembarque?: undefined;
      fragmentos: [FragmentoRecorte, FragmentoRecorte];
    };

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Normaliza qualquer valor para `YYYY-MM-DD` (fatia os 10 primeiros chars); inválido → null. */
export function diaISO(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const iso = valor.trim().slice(0, 10);
  return ISO_DIA.test(iso) ? iso : null;
}

function diasNoMes(ano: number, mes: number): number {
  if (mes < 1 || mes > 12) return 30;
  if (mes === 2) {
    const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
    return bissexto ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
}

/**
 * Soma `delta` dias a uma data civil ISO SEM Date/timezone (aritmética de
 * calendário pura — determinística em qualquer fuso). Delta pequeno (±1 no uso,
 * mas suporta qualquer inteiro).
 */
export function somarDiasISO(iso: string, delta: number): string {
  const [anoStr, mesStr, diaStr] = iso.split('-');
  let ano = parseInt(anoStr, 10);
  let mes = parseInt(mesStr, 10);
  let dia = parseInt(diaStr, 10) + (Number.isFinite(delta) ? Math.trunc(delta) : 0);
  while (dia > diasNoMes(ano, mes)) {
    dia -= diasNoMes(ano, mes);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  while (dia < 1) {
    mes -= 1;
    if (mes < 1) {
      mes = 12;
      ano -= 1;
    }
    dia += diasNoMes(ano, mes);
  }
  const pad = (n: number, size: number) => String(n).padStart(size, '0');
  return `${pad(ano, 4)}-${pad(mes, 2)}-${pad(dia, 2)}`;
}

/** Dia anterior (início do head: fim do evento original antes do recorte). */
export function diaAnterior(iso: string): string {
  return somarDiasISO(iso, -1);
}

/** Dia seguinte (início do tail logo após o período salvo). */
export function diaSeguinte(iso: string): string {
  return somarDiasISO(iso, 1);
}

const NADA: ResultadoRecorte = { acao: 'nada', fragmentos: [] };

/**
 * Calcula o recorte de UMA linha de evento sobreposta pelo período sendo salvo.
 *
 * Sempre clipe o período ao intervalo do evento (head/tail só existem fora do
 * clipe). Retorna a ação a executar na linha + os fragmentos (quando 'dividir').
 */
export function computarRecorte(
  evento: EventoRecorteInput,
  periodo: PeriodoRecorteInput,
  flags: FlagsRecorte = FLAGS_RECORTE_PADRAO,
): ResultadoRecorte {
  const evIni = diaISO(evento?.data_embarque);
  const evFim = diaISO(evento?.data_desembarque); // null = linha aberta
  const pIni = diaISO(periodo?.inicio);
  const pFim = diaISO(periodo?.fim);
  // evFim null/inválido é linha aberta — válido. Só o início é obrigatório.
  if (!evIni || !pIni || !pFim) return NADA;
  if (pFim < pIni) return NADA; // período invertido — defensivo (rotas já rejeitam)

  // Sem sobreposição (mesma semântica do buscarSobrepostos, lexicográfica):
  // evento começa depois do fim do período OU fecha antes do início do período.
  if (evIni > pFim) return NADA;
  if (evFim !== null && evFim < pIni) return NADA;

  // Clipe do período ao evento. Linha aberta: clipe termina no fim do período
  // (o tail aberto continua além dele).
  const clipIni = evIni > pIni ? evIni : pIni; // max(evIni, pIni)
  const clipFim = evFim !== null && evFim < pFim ? evFim : pFim; // min(evFim, pFim)

  const temHead = !flags.apagarAnteriores && evIni < clipIni;
  const temTail = !flags.apagarPosteriores && (evFim === null || evFim > clipFim);

  if (temHead && temTail) {
    return {
      acao: 'dividir',
      fragmentos: [
        { papel: 'head', inicio: evIni, fim: diaAnterior(clipIni) },
        { papel: 'tail', inicio: diaSeguinte(clipFim), fim: evFim },
      ],
    };
  }
  if (temHead) {
    return { acao: 'encurtar_fim', novaDataDesembarque: diaAnterior(clipIni), fragmentos: [] };
  }
  if (temTail) {
    return { acao: 'encurtar_inicio', novaDataEmbarque: diaSeguinte(clipFim), fragmentos: [] };
  }
  // Nem head nem tail: o clipe cobre o evento inteiro → soft-delete total
  // (período maior/idêntico ao evento, ou flags descartando as duas pontas).
  return { acao: 'apagar', fragmentos: [] };
}
