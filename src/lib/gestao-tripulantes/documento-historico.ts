/**
 * Derived grouping of GT documents / trainings of the same type.
 * Older siblings stay in the DB; UI and pendency counts use the primary only.
 */
import {
  classificarValidadeCivil,
  dataLocalISO,
  type ClassificacaoValidadeCivil,
} from '@/lib/gestao-tripulantes/validade-civil';

export interface DocumentoAgrupavel {
  id: string;
  tipo_documento?: string | null;
  subtipo?: string | null;
  titulo?: string | null;
  descricao?: string | null;
  origem?: string | null;
  data_emissao?: string | null;
  data_validade?: string | null;
  status_validacao?: string | null;
  created_at?: string | null;
  colaborador_id?: string | null;
  treinamento_data?: {
    nome_curso?: string | null;
    tipo_curso?: string | null;
  } | null;
}

export interface DocumentoGrupo<T extends DocumentoAgrupavel> {
  key: string;
  primary: T;
  historico: T[];
}

export interface ContagemDocsPrimarios {
  qtd_docs_vencidos: number;
  qtd_docs_vencendo: number;
  qtd_docs_validos: number;
  total_grupos: number;
  permanentes: number;
}

/** Known course phrases → stable code. Longer phrases first. */
const CURSO_FRASE_PARA_CODIGO: ReadonlyArray<{ phrase: string; code: string }> = [
  { phrase: 'curso basico de seguranca de plataforma', code: 'CBSP' },
  { phrase: 'treinamento basico de seguranca', code: 'TBS-I' },
  { phrase: 'compressed air emergency breathing', code: 'CA-EBS' },
  { phrase: 't-huet', code: 'T-HUET' },
  { phrase: 'thuet', code: 'T-HUET' },
  { phrase: 'bosiet', code: 'BOSIET' },
  { phrase: 'ca-ebs', code: 'CA-EBS' },
  { phrase: 'caebs', code: 'CA-EBS' },
  { phrase: 'gmdss', code: 'GMDSS' },
  { phrase: 'tbs-i', code: 'TBS-I' },
  { phrase: 'cbsp', code: 'CBSP' },
  { phrase: 'cess', code: 'CESS' },
  { phrase: 'huet', code: 'T-HUET' },
];

const FILE_EXT_RE = /(\.pdf|\.jpg|\.jpeg|\.png|\.webp|_rotated|\(\d+\))$/i;
const CODE_LIKE_RE = /^[A-Z][A-Z0-9.\-_ /]{0,20}$/;
const TRAILING_CODE_RE = /(?:[-–—]|[\(])\s*([A-Z][A-Z0-9.\-]{1,18})\s*[\)]?$/i;

export function stripAcentos(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizarTextoDocumento(raw: string | null | undefined): string {
  return stripAcentos(String(raw || ''))
    .toLowerCase()
    .replace(FILE_EXT_RE, '')
    .replace(/\bdeclara[cç][aã]o(?:\s+de|\s+da|\s+do)?\b/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function isDeclaracaoDocumento(doc: DocumentoAgrupavel): boolean {
  const blob = [doc.titulo, doc.descricao, doc.subtipo, doc.origem, doc.treinamento_data?.nome_curso]
    .filter(Boolean)
    .join(' ');
  if (/\bdeclara[cç][aã]o\b/i.test(blob)) return true;
  return normalizarTextoDocumento(doc.subtipo) === 'declaracao';
}

function isCodeLike(value: string): boolean {
  const upper = value.trim().toUpperCase();
  if (!CODE_LIKE_RE.test(upper)) return false;
  if (/^\d{5,}$/.test(upper.replace(/\D/g, ''))) return false;
  return upper.length <= 20;
}

function codigoDeFrase(normalized: string): string | null {
  for (const { phrase, code } of CURSO_FRASE_PARA_CODIGO) {
    const re = new RegExp(`(?:^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`);
    if (re.test(` ${normalized} `)) return code;
  }
  return null;
}

function codigoDeCampo(raw: string | null | undefined): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  if (isCodeLike(trimmed)) return trimmed.toUpperCase().replace(/\s+/g, '-');
  const fromPhrase = codigoDeFrase(normalizarTextoDocumento(trimmed));
  if (fromPhrase) return fromPhrase;
  const trailing = trimmed.match(TRAILING_CODE_RE);
  if (trailing && isCodeLike(trailing[1])) {
    const mapped = codigoDeFrase(normalizarTextoDocumento(trailing[1]));
    return mapped || trailing[1].toUpperCase();
  }
  return null;
}

/** Stable grouping key: tipo + course/document code (not fragile exact title). */
export function chaveAgrupamentoDocumento(doc: DocumentoAgrupavel): string {
  const tipo = String(doc.tipo_documento || 'outro').toLowerCase().trim() || 'outro';
  const codigo =
    codigoDeCampo(doc.subtipo) ||
    codigoDeCampo(doc.treinamento_data?.tipo_curso) ||
    codigoDeCampo(doc.titulo) ||
    codigoDeCampo(doc.treinamento_data?.nome_curso) ||
    codigoDeFrase(normalizarTextoDocumento(doc.titulo)) ||
    codigoDeFrase(normalizarTextoDocumento(doc.treinamento_data?.nome_curso));

  if (codigo) return `${tipo}:${codigo}`;

  const tituloNorm = normalizarTextoDocumento(doc.titulo) || normalizarTextoDocumento(doc.treinamento_data?.nome_curso);
  if (tituloNorm) return `${tipo}:${tituloNorm}`;
  return `${tipo}:${doc.id}`;
}

function isoDate(value: string | null | undefined): string {
  const s = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function rankValidade(classificacao: ClassificacaoValidadeCivil, status: string | null | undefined): number {
  switch (classificacao) {
    case 'sem_validade':
      return status === 'pendente' || status === 'reprovado' || status === 'cancelado' ? 2 : 5;
    case 'valido':
      return 4;
    case 'vencendo':
      return 3;
    case 'vencido':
      return 1;
    default: {
      const _never: never = classificacao;
      return _never;
    }
  }
}

function comparePrimario(a: DocumentoAgrupavel, b: DocumentoAgrupavel, hoje: string): number {
  const rankA = rankValidade(classificarValidadeCivil(a.data_validade, hoje), a.status_validacao);
  const rankB = rankValidade(classificarValidadeCivil(b.data_validade, hoje), b.status_validacao);
  if (rankA !== rankB) return rankB - rankA;

  const certA = isDeclaracaoDocumento(a) ? 0 : 1;
  const certB = isDeclaracaoDocumento(b) ? 0 : 1;
  if (certA !== certB) return certB - certA;

  const valA = isoDate(a.data_validade);
  const valB = isoDate(b.data_validade);
  if (valA !== valB) return valB.localeCompare(valA);

  const emA = isoDate(a.data_emissao) || isoDate(a.created_at);
  const emB = isoDate(b.data_emissao) || isoDate(b.created_at);
  if (emA !== emB) return emB.localeCompare(emA);

  return String(b.id).localeCompare(String(a.id));
}

/**
 * Groups documents of the same course/type. Primary = latest relevant issuance
 * (valid/permanent over expired; certificate over declaração; then newest dates).
 */
export function agruparDocumentosPorTipo<T extends DocumentoAgrupavel>(
  docs: T[],
  hoje = dataLocalISO(),
): DocumentoGrupo<T>[] {
  const buckets = new Map<string, T[]>();
  for (const doc of docs) {
    const key = chaveAgrupamentoDocumento(doc);
    const list = buckets.get(key);
    if (list) list.push(doc);
    else buckets.set(key, [doc]);
  }

  const groups: DocumentoGrupo<T>[] = [];
  for (const [key, list] of buckets) {
    const sorted = [...list].sort((a, b) => comparePrimario(a, b, hoje));
    const [primary, ...historico] = sorted;
    groups.push({ key, primary, historico });
  }

  groups.sort((a, b) => comparePrimario(a.primary, b.primary, hoje));
  return groups;
}

export function primariosDocumentos<T extends DocumentoAgrupavel>(docs: T[], hoje = dataLocalISO()): T[] {
  return agruparDocumentosPorTipo(docs, hoje).map((g) => g.primary);
}

export function contarDocsPorStatusPrimario(
  docs: DocumentoAgrupavel[],
  hoje = dataLocalISO(),
): ContagemDocsPrimarios {
  const groups = agruparDocumentosPorTipo(docs, hoje);
  let vencidos = 0;
  let vencendo = 0;
  let validos = 0;
  let permanentes = 0;

  for (const g of groups) {
    const alerta = classificarValidadeCivil(g.primary.data_validade, hoje);
    switch (alerta) {
      case 'vencido':
        vencidos += 1;
        break;
      case 'vencendo':
        vencendo += 1;
        break;
      case 'valido':
        validos += 1;
        break;
      case 'sem_validade':
        permanentes += 1;
        if (g.primary.status_validacao !== 'pendente' && g.primary.status_validacao !== 'reprovado') {
          validos += 1;
        }
        break;
      default: {
        const _never: never = alerta;
        void _never;
      }
    }
  }

  return {
    qtd_docs_vencidos: vencidos,
    qtd_docs_vencendo: vencendo,
    qtd_docs_validos: validos,
    total_grupos: groups.length,
    permanentes,
  };
}

/** Sum primary-only vencido/vencendo/valido across colaboradores (dashboard KPIs). */
export function somarDocsPorStatusPrimario(
  docs: DocumentoAgrupavel[],
  hoje = dataLocalISO(),
): { vencidos: number; vencendo: number; validos: number } {
  const byColab = new Map<string, DocumentoAgrupavel[]>();
  for (const doc of docs) {
    const id = doc.colaborador_id || doc.id;
    const list = byColab.get(id);
    if (list) list.push(doc);
    else byColab.set(id, [doc]);
  }

  let vencidos = 0;
  let vencendo = 0;
  let validos = 0;
  for (const list of byColab.values()) {
    const counts = contarDocsPorStatusPrimario(list, hoje);
    vencidos += counts.qtd_docs_vencidos;
    vencendo += counts.qtd_docs_vencendo;
    validos += counts.qtd_docs_validos;
  }
  return { vencidos, vencendo, validos };
}

export function idsComPrimarioVencido<T extends DocumentoAgrupavel>(
  docs: T[],
  hoje = dataLocalISO(),
): Set<string> {
  const byColab = new Map<string, T[]>();
  for (const doc of docs) {
    const id = doc.colaborador_id;
    if (!id) continue;
    const list = byColab.get(id);
    if (list) list.push(doc);
    else byColab.set(id, [doc]);
  }

  const out = new Set<string>();
  for (const [id, list] of byColab) {
    const groups = agruparDocumentosPorTipo(list, hoje);
    if (groups.some((g) => classificarValidadeCivil(g.primary.data_validade, hoje) === 'vencido')) {
      out.add(id);
    }
  }
  return out;
}
