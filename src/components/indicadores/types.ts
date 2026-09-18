/**
 * Tipos e formatadores do módulo Indicadores R&S.
 *
 * Espelham EXATAMENTE o contrato da API `/api/indicadores/**` (entregue pela
 * folha A) — não redefinir formatos aqui. Todas as respostas seguem o envelope
 * `{ success, data, error }` padrão do repo.
 */

export type IndicadorTipoColuna = 'data' | 'numero' | 'percentual' | 'texto';

export interface IndicadorColuna {
  key: string;
  label: string;
  tipo: IndicadorTipoColuna;
}

export interface IndicadorEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** 1) POST /api/indicadores/import/analyze → data */
export interface AbaAnalyze {
  nome: string;
  headerRow: number;
  colunas: IndicadorColuna[];
  linhas: Record<string, unknown>[];
  totalLinhas: number;
}

export interface AnalyzeData {
  arquivoNome: string;
  abas: AbaAnalyze[];
}

/** 2) POST /api/indicadores/import/confirm → data */
export interface AbaImportada {
  id: string;
  nome: string;
  totalLinhas: number;
}

export interface ConfirmData {
  planilhaId: string;
  abas: AbaImportada[];
}

/** 3) GET /api/indicadores/planilhas → data */
export interface PlanilhaAba {
  id: string;
  nome: string;
  totalLinhas: number;
  colunas: IndicadorColuna[];
}

export interface PlanilhaItem {
  id: string;
  nome: string;
  arquivoNome: string;
  criadoEm: string;
  abas: PlanilhaAba[];
}

export interface PlanilhasData {
  planilhas: PlanilhaItem[];
}

/** 5) GET /api/indicadores/abas/[id]/linhas → data */
export interface LinhaItem {
  id: string;
  dados: Record<string, unknown>;
  ordem: number;
}

export interface LinhasData {
  aba: { id: string; nome: string; colunas: IndicadorColuna[] };
  linhas: LinhaItem[];
  total: number;
  pagina: number;
  porPagina: number;
}

// ---------------------------------------------------------------------------
// Formatadores (pt-BR)
// ---------------------------------------------------------------------------

function paraNumeroSeguro(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (typeof valor === 'string' && valor.trim() !== '') {
    const n = Number(valor.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function dataParaBR(d: Date): string {
  // 4+ chamadas (ISO, Date, serial Excel, timestamp de card) — formato dd/mm/aaaa em lockstep.
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const EXCEL_EPOCA_MS = Date.UTC(1899, 11, 30);

/** Serial do Excel (dias desde 1899-12-30) → dd/mm/aaaa, quando plausível. */
function serialExcelParaBR(valor: string): string | null {
  const n = paraNumeroSeguro(valor);
  if (n == null || !Number.isInteger(n) || n < 20000 || n > 60000) return null;
  return dataParaBR(new Date(EXCEL_EPOCA_MS + n * 86400000));
}

/** Renderiza qualquer valor de célula tipo `data` como dd/mm/aaaa. */
export function formatarDataBR(valor: unknown): string {
  if (valor == null || valor === '') return '—';
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return dataParaBR(valor);
  const s = String(valor).trim();
  if (!s) return '—';
  // ISO: yyyy-mm-dd[THH:mm...]
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  // Já em formato BR
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  // Serial do Excel (planilhas brutas costumam trazer número)
  const serial = serialExcelParaBR(s);
  if (serial) return serial;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return dataParaBR(d);
  return s;
}

/** Renderiza célula tipo `numero` com toLocaleString('pt-BR'). */
export function formatarNumeroBR(valor: unknown): string {
  const n = paraNumeroSeguro(valor);
  if (n == null) return valor == null || valor === '' ? '—' : String(valor);
  return n.toLocaleString('pt-BR');
}

/**
 * Renderiza célula tipo `percentual`: o backend grava FRAÇÃO (0.1234 = 12,34%),
 * exibimos ×100 com 1 casa decimal + '%'.
 */
export function formatarPercentualBR(valor: unknown): string {
  const n = paraNumeroSeguro(valor);
  if (n == null) return valor == null || valor === '' ? '—' : String(valor);
  return `${(n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Texto puro com quebra preservada (a quebra visual é feita por classe no DOM). */
export function formatarTextoBR(valor: unknown): string {
  if (valor == null) return '—';
  const s = String(valor);
  return s === '' ? '—' : s;
}

export function formatarCelula(valor: unknown, tipo: IndicadorTipoColuna): string {
  switch (tipo) {
    case 'data':
      return formatarDataBR(valor);
    case 'numero':
      return formatarNumeroBR(valor);
    case 'percentual':
      return formatarPercentualBR(valor);
    default:
      return formatarTextoBR(valor);
  }
}

/** yyyy-mm-dd (para <input type="date">) a partir de valor arbitrário do backend. */
export function valorParaInputData(valor: unknown): string {
  if (valor == null || valor === '') return '';
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`;
  }
  const s = String(valor).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const serial = serialExcelParaBR(s);
  if (serial) {
    const p = serial.split('/');
    return `${p[2]}-${p[1]}-${p[0]}`;
  }
  return '';
}

/** dd/mm/aaaa hh:mm para timestamps exibidos em cards (criadoEm). */
export function formatarDataHoraBR(valor: unknown): string {
  if (!valor) return '—';
  const d = valor instanceof Date ? valor : new Date(String(valor));
  if (Number.isNaN(d.getTime())) return String(valor);
  return `${dataParaBR(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
