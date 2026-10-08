/**
 * Horas líquidas do dia no Registro de Ponto.
 * A batida continua no PontoFlow. Este cálculo só mostra o dia e o aviso de jornada.
 * Não grava rubrica e não cria batida de almoço.
 *
 * Almoço fixo 12:00–13:00 (America/Sao_Paulo), intervalo meio-aberto [12:00, 13:00).
 * Desconta só a sobreposição com o turno. Fora dessa janela, o desconto é zero.
 */

export const FUSO_PONTO = 'America/Sao_Paulo';
export const ALMOCO_INICIO_MIN = 12 * 60;
export const ALMOCO_FIM_MIN = 13 * 60;
export const JORNADA_MINUTOS = 8 * 60;

export type PunchKind = 'in' | 'out';
export type ExpedienteFase = 'aguardando_inicio' | 'em_aberto' | 'encerrado';

export interface HojePonto {
  date: string;
  open: boolean;
  horaIni: string | null;
  horaFim: string | null;
}

export interface JornadaDia {
  grossMinutes: number;
  lunchMinutes: number;
  netMinutes: number;
  lunchApplied: boolean;
  belowEightHours: boolean;
}

export function paraRelogio(value: string): string | null {
  const trimmed = value.trim();
  const clock = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(trimmed);
  if (clock) return `${clock[1].padStart(2, '0')}:${clock[2]}`;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) return null;
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(trimmed)) return null;
  const instant = new Date(trimmed);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO_PONTO,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  if (!hour || !minute) return null;
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

export function dataCivilSaoPaulo(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_PONTO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return '';
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function dataTrabalho(raw: string, at: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const instant = new Date(at);
  if (Number.isNaN(instant.getTime())) return '';
  return dataCivilSaoPaulo(instant);
}

function minutosRelogio(value: string): number | null {
  const clock = paraRelogio(value);
  if (!clock) return null;
  const [hour, minute] = clock.split(':');
  return Number(hour) * 60 + Number(minute);
}

export function calcularJornada(horaIni: string, horaFim: string): JornadaDia | null {
  const start = minutosRelogio(horaIni);
  const end = minutosRelogio(horaFim);
  if (start === null || end === null || end <= start) return null;
  const overlapStart = Math.max(start, ALMOCO_INICIO_MIN);
  const overlapEnd = Math.min(end, ALMOCO_FIM_MIN);
  const lunchMinutes = Math.max(0, overlapEnd - overlapStart);
  const grossMinutes = end - start;
  const netMinutes = grossMinutes - lunchMinutes;
  return {
    grossMinutes,
    lunchMinutes,
    netMinutes,
    lunchApplied: lunchMinutes > 0,
    belowEightHours: netMinutes < JORNADA_MINUTOS,
  };
}

export function formatarMinutos(total: number): string {
  const sign = total < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(total));
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${hours}h${String(minutes).padStart(2, '0')}`;
}

export function faseExpediente(today: Pick<HojePonto, 'open' | 'horaIni' | 'horaFim'>): ExpedienteFase {
  if (today.horaFim) return 'encerrado';
  if (today.open || today.horaIni) return 'em_aberto';
  return 'aguardando_inicio';
}

export function acoesExpediente(fase: ExpedienteFase): { inicio: boolean; fim: boolean } {
  switch (fase) {
    case 'aguardando_inicio':
      return { inicio: true, fim: false };
    case 'em_aberto':
      return { inicio: false, fim: true };
    case 'encerrado':
      return { inicio: false, fim: false };
    default: {
      const _nunca: never = fase;
      return _nunca;
    }
  }
}

export function rejeitarBatida(fase: ExpedienteFase, kind: PunchKind): string | null {
  switch (fase) {
    case 'aguardando_inicio':
      return kind === 'in' ? null : 'Marque o início do expediente antes do fim.';
    case 'em_aberto':
      return kind === 'out' ? null : 'O início do expediente já foi registrado hoje.';
    case 'encerrado':
      return kind === 'in'
        ? 'O início do expediente já foi registrado hoje.'
        : 'O fim do expediente já foi registrado hoje.';
    default: {
      const _nunca: never = fase;
      return _nunca;
    }
  }
}

export function normalizarHoje(raw: {
  date: string;
  open?: boolean;
  horaIni?: string | null;
  horaFim?: string | null;
}): HojePonto {
  const horaIni = raw.horaIni ? paraRelogio(raw.horaIni) : null;
  const horaFim = raw.horaFim ? paraRelogio(raw.horaFim) : null;
  return {
    date: raw.date,
    open: raw.open === true && !horaFim,
    horaIni,
    horaFim,
  };
}

export function montarHojeAposBatida(input: {
  kind: PunchKind;
  at: string;
  previous: HojePonto | null;
  returnedIni: string | null;
  returnedFim: string | null;
  date: string;
}): HojePonto {
  const fromAt = paraRelogio(input.at);
  const returnedIni = input.returnedIni ? paraRelogio(input.returnedIni) : null;
  const returnedFim = input.returnedFim ? paraRelogio(input.returnedFim) : null;
  switch (input.kind) {
    case 'in':
      return {
        date: input.date,
        open: true,
        horaIni: returnedIni || fromAt,
        horaFim: null,
      };
    case 'out':
      return {
        date: input.date,
        open: false,
        horaIni: returnedIni || input.previous?.horaIni || null,
        horaFim: returnedFim || fromAt,
      };
    default: {
      const _nunca: never = input.kind;
      return _nunca;
    }
  }
}

export function preferirRelogios(primary: HojePonto, fallback: HojePonto): HojePonto {
  const horaIni = primary.horaIni || fallback.horaIni;
  const horaFim = primary.horaFim || fallback.horaFim;
  return {
    date: primary.date || fallback.date,
    horaIni,
    horaFim,
    open: !horaFim && (primary.open || fallback.open),
  };
}

export function resumoHoje(hoje: HojePonto): { jornada: JornadaDia | null; avisoMenosDeOitoHoras: boolean } {
  const jornada = hoje.horaIni && hoje.horaFim ? calcularJornada(hoje.horaIni, hoje.horaFim) : null;
  return {
    jornada,
    avisoMenosDeOitoHoras: jornada?.belowEightHours === true,
  };
}
