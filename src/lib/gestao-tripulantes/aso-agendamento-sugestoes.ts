import {
  dayCodeForCivilDay,
  hasAsteriskScheduleCode,
  isEmbarcadoPobDayCode,
  type EscalaEventoDia,
} from '@/lib/gestao-tripulantes/embarque-status';
import { dataLocalISO } from '@/lib/gestao-tripulantes/validade-civil';
import type { AsoDiaClasse, AsoSugestaoData } from '@/lib/gestao-tripulantes/aso-agendamento-status';
import {
  ASO_ANTECEDENCIA_DIAS_DEFAULT,
  ASO_MAX_SUGESTOES_DEFAULT,
  ASO_MIN_LEAD_DIAS_DEFAULT,
} from '@/lib/gestao-tripulantes/aso-agendamento-status';

export interface AsoSugestaoParams {
  hoje?: string;
  dataValidade: string | null | undefined;
  eventos: EscalaEventoDia[];
  antecedenciaDias?: number;
  minLeadDias?: number;
  maxSugestoes?: number;
}

export interface AsoSugestaoResultado {
  janela_inicio: string;
  janela_fim: string;
  data_validade: string | null;
  sugestoes: AsoSugestaoData[];
  dias_avaliados: number;
}

export function adicionarDiasYmd(ymd: string, dias: number): string {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return dataLocalISO(new Date(y, (m || 1) - 1, (d || 1) + dias));
}

export function weekdayLocal(ymd: string): number {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getDay();
}

export function iterarDiasCivil(inicio: string, fim: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) return [];
  if (inicio > fim) return [];
  const days: string[] = [];
  let cur = inicio;
  let guard = 0;
  while (cur <= fim && guard < 400) {
    days.push(cur);
    cur = adicionarDiasYmd(cur, 1);
    guard += 1;
  }
  return days;
}

export function janelaSugestaoAso(opts: {
  hoje: string;
  dataValidade: string | null | undefined;
  antecedenciaDias: number;
  minLeadDias: number;
}): { inicio: string; fim: string; dataValidade: string | null } {
  const validade = String(opts.dataValidade || '').slice(0, 10);
  const validadeOk = /^\d{4}-\d{2}-\d{2}$/.test(validade) ? validade : null;
  const leadStart = adicionarDiasYmd(opts.hoje, Math.max(0, opts.minLeadDias));

  if (!validadeOk) {
    return {
      inicio: leadStart,
      fim: adicionarDiasYmd(leadStart, Math.max(14, opts.antecedenciaDias)),
      dataValidade: null,
    };
  }

  if (validadeOk < opts.hoje) {
    return {
      inicio: leadStart,
      fim: adicionarDiasYmd(leadStart, Math.max(14, opts.antecedenciaDias)),
      dataValidade: validadeOk,
    };
  }

  const alertaStart = adicionarDiasYmd(validadeOk, -opts.antecedenciaDias);
  const inicio = alertaStart > leadStart ? alertaStart : leadStart;
  const fim = validadeOk < inicio ? adicionarDiasYmd(inicio, 14) : validadeOk;
  return { inicio, fim, dataValidade: validadeOk };
}

export interface AsoDiaClassificacao {
  classe: AsoDiaClasse;
  score: number;
  bloqueado: boolean;
  conflito_on: boolean;
  motivo: string;
}

/**
 * Heuristic (DOX): prefer STB / ashore days so ASO does not steal ON / DBA logistics slots.
 * STB best; unmarked/folga next; FI / OFF-C / TRE usable; FER/AFAST/ON/DBA blocked from the preferred list.
 */
export function classificarCodigoEscalaParaAso(code: string | null | undefined): AsoDiaClassificacao {
  const raw = String(code || '').trim();
  const upper = raw.replace(/\s+/g, '').toUpperCase();

  if (isEmbarcadoPobDayCode(raw)) {
    return {
      classe: 'on',
      score: 0,
      bloqueado: true,
      conflito_on: true,
      motivo: 'ON (a bordo) — interfere no planejamento de logística',
    };
  }
  if (hasAsteriskScheduleCode(raw) || upper === 'ON*') {
    return {
      classe: 'on_previsto',
      score: 5,
      bloqueado: true,
      conflito_on: true,
      motivo: 'ON* previsto — ainda compete com a escala de bordo',
    };
  }
  if (upper === 'DBA' || upper === 'DOBRA') {
    return {
      classe: 'dba',
      score: 0,
      bloqueado: true,
      conflito_on: true,
      motivo: 'DBA (dobra) — extensão de embarque',
    };
  }
  if (upper === 'FER' || upper === 'FERIAS' || upper === 'FÉRIAS' || upper === 'AFAST') {
    return {
      classe: 'afast',
      score: 0,
      bloqueado: true,
      conflito_on: false,
      motivo: 'Férias/afastamento — colaborador indisponível',
    };
  }
  if (upper === 'STB' || upper === 'STANDBY') {
    return {
      classe: 'stb',
      score: 100,
      bloqueado: false,
      conflito_on: false,
      motivo: 'STB (standby) — preferencial, não interfere no ON',
    };
  }
  if (!upper || upper === '-' || upper === 'FOLGA' || upper === 'OFF') {
    return {
      classe: 'livre',
      score: 75,
      bloqueado: false,
      conflito_on: false,
      motivo: 'Sem marcação de bordo (folga/terra)',
    };
  }
  if (upper === 'FI') {
    return {
      classe: 'fi',
      score: 55,
      bloqueado: false,
      conflito_on: false,
      motivo: 'FI (folga indenizada) — em terra',
    };
  }
  if (upper === 'OFF-C' || upper === 'OFFC') {
    return {
      classe: 'offc',
      score: 50,
      bloqueado: false,
      conflito_on: false,
      motivo: 'OFF-C (troca de turma)',
    };
  }
  if (upper === 'TRE' || upper === 'TF') {
    return {
      classe: 'tre',
      score: 35,
      bloqueado: false,
      conflito_on: false,
      motivo: 'TRE (treinamento) — possível, mas compete com capacitação',
    };
  }
  return {
    classe: 'outro',
    score: 25,
    bloqueado: false,
    conflito_on: false,
    motivo: `Código ${upper || '—'} — avaliável, sem preferência`,
  };
}

function bonusMeioBlocoStb(codes: Map<string, string>, ymd: string): number {
  if (classificarCodigoEscalaParaAso(codes.get(ymd) || '').classe !== 'stb') return 0;
  let start = ymd;
  let end = ymd;
  while (true) {
    const prev = adicionarDiasYmd(start, -1);
    if (classificarCodigoEscalaParaAso(codes.get(prev) || '').classe !== 'stb') break;
    start = prev;
  }
  while (true) {
    const next = adicionarDiasYmd(end, 1);
    if (classificarCodigoEscalaParaAso(codes.get(next) || '').classe !== 'stb') break;
    end = next;
  }
  const len = iterarDiasCivil(start, end).length;
  if (len < 5) return 5;
  const idx = iterarDiasCivil(start, end).indexOf(ymd);
  if (idx <= 1 || idx >= len - 2) return 0;
  return 15;
}

function scoreDia(
  ymd: string,
  codigo: string,
  validade: string | null,
  codes: Map<string, string>,
): AsoSugestaoData {
  const cls = classificarCodigoEscalaParaAso(codigo);
  let score = cls.score;
  const wd = weekdayLocal(ymd);
  if (wd >= 1 && wd <= 5) score += 10;
  else score -= 8;
  score += bonusMeioBlocoStb(codes, ymd);
  if (validade) {
    const dist = Math.abs(
      (Date.parse(`${ymd}T12:00:00`) - Date.parse(`${validade}T12:00:00`)) / 86400000,
    );
    if (dist <= 21) score += 4;
  }
  return {
    data: ymd,
    codigo_escala: codigo || '—',
    classe: cls.classe,
    score,
    motivo: cls.motivo,
    conflito_on: cls.conflito_on,
    bloqueado: cls.bloqueado,
  };
}

export function sugerirDatasAso(params: AsoSugestaoParams): AsoSugestaoResultado {
  const hoje = params.hoje || dataLocalISO();
  const antecedenciaDias = params.antecedenciaDias ?? ASO_ANTECEDENCIA_DIAS_DEFAULT;
  const minLeadDias = params.minLeadDias ?? ASO_MIN_LEAD_DIAS_DEFAULT;
  const maxSugestoes = params.maxSugestoes ?? ASO_MAX_SUGESTOES_DEFAULT;
  const janela = janelaSugestaoAso({
    hoje,
    dataValidade: params.dataValidade,
    antecedenciaDias,
    minLeadDias,
  });
  const dias = iterarDiasCivil(janela.inicio, janela.fim);
  const codes = new Map<string, string>();
  for (const ymd of dias) {
    codes.set(ymd, dayCodeForCivilDay(params.eventos, ymd));
  }

  const avaliados = dias.map((ymd) =>
    scoreDia(ymd, codes.get(ymd) || '', janela.dataValidade, codes),
  );
  const preferidos = avaliados.filter((d) => !d.bloqueado).sort((a, b) => b.score - a.score);
  const fallback = avaliados.filter((d) => d.bloqueado).sort((a, b) => b.score - a.score);

  const picked: AsoSugestaoData[] = [];
  const seen = new Set<string>();
  for (const row of [...preferidos, ...fallback]) {
    if (seen.has(row.data)) continue;
    seen.add(row.data);
    picked.push(row);
    if (picked.length >= maxSugestoes) break;
  }

  return {
    janela_inicio: janela.inicio,
    janela_fim: janela.fim,
    data_validade: janela.dataValidade,
    sugestoes: picked,
    dias_avaliados: dias.length,
  };
}
