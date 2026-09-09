/**
 * e-Social TS_nome (leiaute S-1.3 / v_S_01_03_00): 2–70 chars,
 * letters + space + apostrophe + period + hyphen. Newlines and OCR junk fail XSD.
 */
export const TS_NOME_MIN = 2;
export const TS_NOME_MAX = 70;
export const TS_NOME_PATTERN = /^[A-Za-zÀ-ú '. -]{2,70}$/;

const TS_NOME_TAGS = ['nmMed', 'nmResp', 'nmTrab', 'nmSoc'] as const;

const TITULOS_OCR =
  /\b(?:dra?\.?a?|drª|drº|m[eé]dic[oa]s?|ocupacional|examinador[ae]?|coordenador[ae]?|respons[aá]vel|pcmso|crm|rqe|assinatura|carimbo)\b/gi;

const CONECTORES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du']);

const CAMPOS_NOME_MEDICO = [
  'medico_nome',
  'nmMed',
  'medicoNome',
  'medico_examinador_nome',
] as const;

const CAMPOS_NOME_PCMSO = [
  'medico_pcmso_nome',
  'medicoPcmsoNome',
  'nmResp',
] as const;

const CAMPOS_NOME_TRAB = ['nmTrab', 'nome'] as const;

function cortarTsNome(valor: string): string {
  if (valor.length <= TS_NOME_MAX) return valor;
  return valor.slice(0, TS_NOME_MAX).replace(/[ '. -]+$/g, '').trim();
}

function looksLikePersonName(valor: string): boolean {
  const palavras = valor.split(/\s+/).filter(Boolean);
  const nomes = palavras.filter((w) => w.length >= 2 && /^[A-Za-zÀ-ú'-]+$/.test(w));
  return nomes.length >= 2 && valor.length >= 5;
}

export function isValidTsNome(valor: string): boolean {
  if (typeof valor !== 'string') return false;
  if (/[\r\n\t\f\v]/.test(valor)) return false;
  return TS_NOME_PATTERN.test(valor);
}

export function sanitizeTsNome(raw: string | null | undefined): string {
  if (raw == null) return '';
  let s = String(raw).normalize('NFC');
  s = s.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ');
  s = s.replace(/[\r\n\t\f\v]+/g, ' ');
  s = s.replace(/[^A-Za-zÀ-ú '. -]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  const light = cortarTsNome(s);
  const heavy = cortarTsNome(
    light
      .replace(TITULOS_OCR, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter((w) => w.length >= 2 || CONECTORES.has(w.toLowerCase()))
      .join(' '),
  );

  if (looksLikePersonName(heavy) && isValidTsNome(heavy)) return heavy;
  if (isValidTsNome(light)) return light;
  if (isValidTsNome(heavy)) return heavy;
  return heavy || light;
}

function asNomeString(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (valor && typeof valor === 'object') {
    const obj = valor as Record<string, unknown>;
    if (typeof obj.nmMed === 'string') return obj.nmMed;
    if (typeof obj.nmResp === 'string') return obj.nmResp;
    if (typeof obj.nome === 'string') return obj.nome;
  }
  return '';
}

export function coletarNomeMedico(dados: Record<string, unknown> | null | undefined): string {
  if (!dados) return '';
  const esp = (dados.dadosEspecificos && typeof dados.dadosEspecificos === 'object'
    ? dados.dadosEspecificos
    : {}) as Record<string, unknown>;
  const nested = [
    dados.medico,
    esp.medico,
    (dados.aso as Record<string, unknown> | undefined)?.medico,
    (esp.aso as Record<string, unknown> | undefined)?.medico,
    (dados.exMedOcup as Record<string, unknown> | undefined)?.medico,
    ((dados.exMedOcup as Record<string, unknown> | undefined)?.aso as Record<string, unknown> | undefined)?.medico,
    (esp.exMedOcup as Record<string, unknown> | undefined)?.medico,
  ];
  const candidatos = [
    ...CAMPOS_NOME_MEDICO.map((c) => dados[c]),
    ...CAMPOS_NOME_MEDICO.map((c) => esp[c]),
    ...nested.map(asNomeString),
  ];
  for (const c of candidatos) {
    if (typeof c === 'string' && c.trim()) return c;
  }
  return '';
}

export function coletarNomePcmso(dados: Record<string, unknown> | null | undefined): string {
  if (!dados) return '';
  const esp = (dados.dadosEspecificos && typeof dados.dadosEspecificos === 'object'
    ? dados.dadosEspecificos
    : {}) as Record<string, unknown>;
  const candidatos = [
    ...CAMPOS_NOME_PCMSO.map((c) => dados[c]),
    ...CAMPOS_NOME_PCMSO.map((c) => esp[c]),
    asNomeString(dados.respMonit),
    asNomeString(esp.respMonit),
    asNomeString((dados.exMedOcup as Record<string, unknown> | undefined)?.respMonit),
  ];
  for (const c of candidatos) {
    if (typeof c === 'string' && c.trim()) return c;
  }
  return '';
}

export function xmlTemNomeTsInvalido(xml: string | null | undefined): boolean {
  if (!xml) return false;
  const re = /<(nmMed|nmResp|nmTrab|nmSoc)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    if (!isValidTsNome(match[2])) return true;
  }
  return false;
}

export function nomesTsDoXml(xml: string): { tag: string; valor: string }[] {
  const out: { tag: string; valor: string }[] = [];
  const re = /<(nmMed|nmResp|nmTrab|nmSoc)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    out.push({ tag: match[1], valor: match[2] });
  }
  return out;
}

export { CAMPOS_NOME_MEDICO, CAMPOS_NOME_PCMSO, CAMPOS_NOME_TRAB, TS_NOME_TAGS };
