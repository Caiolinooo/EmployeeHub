/**
 * Datas civis do e-Social (XSD = YYYY-MM-DD).
 * Números com barra/ponto/hífen = sempre DD/MM/YYYY (PT-BR).
 * Nunca Date.parse / new Date(string) — V8 lê MM/DD.
 * Nomes de mês: PT-BR e EN.
 * dtExm ambíguo (ISO invertido ou slash US) alinha em dtAso.
 */

export const MESES_ESOCIAL: Record<string, string> = {
  JAN: '01',
  JANEIRO: '01',
  JANUARY: '01',
  FEV: '02',
  FEVEREIRO: '02',
  FEB: '02',
  FEBRUARY: '02',
  MAR: '03',
  MARCO: '03',
  MARÇO: '03',
  MARCH: '03',
  ABR: '04',
  ABRIL: '04',
  APR: '04',
  APRIL: '04',
  MAI: '05',
  MAIO: '05',
  MAY: '05',
  JUN: '06',
  JUNHO: '06',
  JUNE: '06',
  JUL: '07',
  JULHO: '07',
  JULY: '07',
  AGO: '08',
  AGOSTO: '08',
  AUG: '08',
  AUGUST: '08',
  SET: '09',
  SETEMBRO: '09',
  SEP: '09',
  SEPT: '09',
  SEPTEMBER: '09',
  OUT: '10',
  OUTUBRO: '10',
  OCT: '10',
  OCTOBER: '10',
  NOV: '11',
  NOVEMBRO: '11',
  NOVEMBER: '11',
  DEZ: '12',
  DEZEMBRO: '12',
  DEC: '12',
  DECEMBER: '12',
};

const ISO_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;
const ISO_EXACT = /^\d{4}-\d{2}-\d{2}$/;
const YMD_SEP = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/;
const SLASH = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const CAMPOS_DATA_EXAME = ['data', 'dtExm', 'dtExame', 'data_exame'] as const;

export interface ExameXmlS2220 {
  dtExm: string;
  procRealizado: string;
  obsProc?: string;
  ordExame?: string;
}

function pad2(n: number | string): string {
  return String(n).padStart(2, '0');
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

function toIso(year: number, month: number, day: number): string {
  if (!isValidYmd(year, month, day)) return '';
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function mesPorNome(raw: string): string | null {
  const key = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\./g, '')
    .trim();
  return MESES_ESOCIAL[key] || MESES_ESOCIAL[raw.toUpperCase().replace(/\./g, '').trim()] || null;
}

function parseIsoKeep(raw: string): string {
  const m = raw.match(ISO_PREFIX);
  if (!m) return '';
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const keep = toIso(year, month, day);
  if (keep) return keep;
  return toIso(year, day, month);
}

function parseSlashPtBr(raw: string): string {
  const m = raw.match(SLASH);
  if (!m) return '';
  return toIso(Number(m[3]), Number(m[2]), Number(m[1]));
}

function parseSlashUs(raw: string): string {
  const m = raw.match(SLASH);
  if (!m) return '';
  return toIso(Number(m[3]), Number(m[1]), Number(m[2]));
}

function parseMesPorExtenso(raw: string): string {
  const diaMesAno = raw.match(
    /^(\d{1,2})\s*(?:de\s+)?([A-Za-zÀ-ÿ]+)\.?\s*(?:de\s+)?(\d{4})$/i,
  );
  if (diaMesAno) {
    const mes = mesPorNome(diaMesAno[2]);
    if (mes) return toIso(Number(diaMesAno[3]), Number(mes), Number(diaMesAno[1]));
  }
  const mesDiaAno = raw.match(/^([A-Za-zÀ-ÿ]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (mesDiaAno) {
    const mes = mesPorNome(mesDiaAno[1]);
    if (mes) return toIso(Number(mesDiaAno[3]), Number(mes), Number(mesDiaAno[2]));
  }
  return '';
}

/** Interpreta a string como data civil PT-BR. ISO válido permanece. */
export function normalizeEsocialDate(raw: string | undefined | null): string {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';

  if (s.includes('T') && ISO_PREFIX.test(s)) {
    return parseIsoKeep(s);
  }
  if (ISO_PREFIX.test(s) && s[4] === '-') {
    return parseIsoKeep(s);
  }

  const ymd = s.match(YMD_SEP);
  if (ymd) {
    return toIso(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  }

  const named = parseMesPorExtenso(s);
  if (named) return named;

  return parseSlashPtBr(s);
}

export function isSwapDiaMes(isoA: string, isoB: string): boolean {
  const a = isoA.match(ISO_PREFIX);
  const b = isoB.match(ISO_PREFIX);
  if (!a || !b) return false;
  if (a[1] !== b[1]) return false;
  if (a[2] === b[2] && a[3] === b[3]) return false;
  return a[2] === b[3] && a[3] === b[2];
}

/**
 * Data de exame no mesmo ASO: PT-BR primeiro;
 * se a leitura US ou o ISO invertido coincidir com dtAso, usa dtAso.
 */
export function alinharDataExamePtBr(
  raw: string | undefined | null,
  ancoraIso: string | undefined | null,
): string {
  const ancora = ancoraIso && ISO_EXACT.test(ancoraIso.slice(0, 10))
    ? ancoraIso.slice(0, 10)
    : normalizeEsocialDate(ancoraIso);
  const br = normalizeEsocialDate(raw);
  if (!ancora) return br;

  const trimmed = raw == null ? '' : String(raw).trim();
  const isoDireto = trimmed.match(ISO_PREFIX);
  if (isoDireto) {
    const iso = `${isoDireto[1]}-${isoDireto[2]}-${isoDireto[3]}`;
    if (iso === ancora || isSwapDiaMes(iso, ancora)) return ancora;
  }

  const us = parseSlashUs(trimmed);
  if (br === ancora || us === ancora) return ancora;
  if (br && isSwapDiaMes(br, ancora)) return ancora;
  if (us && isSwapDiaMes(us, ancora)) return ancora;

  return br || ancora;
}

export function xmlTemDtExmInvertida(xml: string | undefined | null): boolean {
  if (!xml) return false;
  const aso = xml.match(/<dtAso>(\d{4}-\d{2}-\d{2})<\/dtAso>/);
  if (!aso) return false;
  const ancora = aso[1];
  const exames = [...xml.matchAll(/<dtExm>([^<]+)<\/dtExm>/g)];
  return exames.some((m) => {
    const raw = m[1].trim();
    const aligned = alinharDataExamePtBr(raw, ancora);
    return Boolean(aligned && aligned !== raw);
  });
}

export function corrigirXmlDatasS2220PtBr(xml: string): { xml: string; alterado: boolean } {
  if (!xml) return { xml: xml || '', alterado: false };
  const aso = xml.match(/<dtAso>([^<]+)<\/dtAso>/);
  const ancora = aso ? (normalizeEsocialDate(aso[1]) || aso[1].trim()) : '';
  let alterado = false;

  let next = xml;
  if (aso && ancora && aso[1].trim() !== ancora) {
    next = next.replace(`<dtAso>${aso[1]}</dtAso>`, `<dtAso>${ancora}</dtAso>`);
    alterado = true;
  }

  next = next.replace(/<dtExm>([^<]+)<\/dtExm>/g, (full, raw: string) => {
    const aligned = alinharDataExamePtBr(raw, ancora);
    if (aligned && aligned !== raw.trim()) {
      alterado = true;
      return `<dtExm>${aligned}</dtExm>`;
    }
    return full;
  });

  return { xml: next, alterado };
}

export function extrairExamesDoXmlS2220(xml: string): ExameXmlS2220[] {
  const blocos = [...xml.matchAll(/<exame>\s*([\s\S]*?)\s*<\/exame>/g)];
  const exames: ExameXmlS2220[] = [];
  for (const bloco of blocos) {
    const body = bloco[1];
    const dtExm = (body.match(/<dtExm>([^<]+)<\/dtExm>/) || [])[1];
    const procRealizado = (body.match(/<procRealizado>([^<]+)<\/procRealizado>/) || [])[1];
    if (!dtExm || !procRealizado) continue;
    exames.push({
      dtExm: dtExm.trim(),
      procRealizado: procRealizado.trim(),
      obsProc: (body.match(/<obsProc>([^<]+)<\/obsProc>/) || [])[1],
      ordExame: (body.match(/<ordExame>([^<]+)<\/ordExame>/) || [])[1],
    });
  }
  return exames;
}

export function hidratarExamesDoXmlS2220(dados: Record<string, any>, xml: string | undefined | null): boolean {
  if (!dados || !xml) return false;
  const existentes =
    dados.exames_realizados
    || dados.exames
    || dados.dadosEspecificos?.exames_realizados
    || dados.dadosEspecificos?.exames;
  if (Array.isArray(existentes) && existentes.length > 0) return false;

  const extraidos = extrairExamesDoXmlS2220(xml);
  if (extraidos.length === 0) return false;

  const lista = extraidos.map((ex) => ({
    ...ex,
    data: ex.dtExm,
    codProc: ex.procRealizado,
  }));
  dados.exames_realizados = lista;
  dados.exames = lista;
  if (!dados.dadosEspecificos) dados.dadosEspecificos = {};
  dados.dadosEspecificos.exames_realizados = lista;
  dados.dadosEspecificos.exames = lista;
  return true;
}

export function resolverAncoraS2220(dados: any): string {
  if (!dados) return '';
  const esp = dados.dadosEspecificos || {};
  const candidatos = [
    dados.dtAso,
    dados.data_realizacao,
    dados.dataRealizacao,
    dados.data_aso,
    dados.dataAso,
    dados.dtExame,
    esp.dtAso,
    esp.data_realizacao,
    esp.dataRealizacao,
    esp.data_aso,
    esp.dataAso,
    esp.dtExame,
    dados.exMedOcup?.aso?.dtAso,
    dados.aso?.dtAso,
    esp.exMedOcup?.aso?.dtAso,
    esp.aso?.dtAso,
  ];
  for (const c of candidatos) {
    const n = normalizeEsocialDate(c);
    if (n) return n;
  }
  return '';
}

export function listarExamesEvento(dados: any): any[] {
  if (!dados) return [];
  const listas: any[][] = [];
  const pushIfArray = (v: unknown) => {
    if (Array.isArray(v) && v.length > 0) listas.push(v);
  };
  const esp = dados.dadosEspecificos || {};
  pushIfArray(dados.exames_realizados);
  pushIfArray(dados.exames);
  pushIfArray(esp.exames_realizados);
  pushIfArray(esp.exames);
  pushIfArray(dados.aso?.exames);
  pushIfArray(dados.aso?.exames_realizados);
  pushIfArray(dados.exMedOcup?.exames);
  pushIfArray(dados.exMedOcup?.aso?.exames);
  pushIfArray(dados.exMedOcup?.aso?.exames_realizados);
  pushIfArray(esp.aso?.exames);
  pushIfArray(esp.aso?.exames_realizados);
  pushIfArray(esp.exMedOcup?.aso?.exames);
  return listas.flat();
}

export function alinharCamposDataExame(exame: Record<string, any>, ancoraIso: string): boolean {
  if (!exame || typeof exame !== 'object') return false;
  let mudou = false;
  for (const campo of CAMPOS_DATA_EXAME) {
    if (exame[campo] == null || exame[campo] === '') continue;
    const aligned = alinharDataExamePtBr(String(exame[campo]), ancoraIso);
    if (aligned && aligned !== String(exame[campo])) {
      exame[campo] = aligned;
      mudou = true;
    }
  }
  return mudou;
}
