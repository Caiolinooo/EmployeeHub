/**
 * Lib PURA de importação de planilhas .xlsx para o módulo Indicadores (R&S).
 * Sem Supabase/Next — quem grava é a route (api/indicadores/import/confirm);
 * aqui só acontece parse/detecção/tipagem em memória.
 *
 * Detecção de cabeçalho (planilhas reais R&S têm legendas acima do cabeçalho):
 * entre as linhas de índice ≤ 30 com ≥ 3 células não vazias, escolhe a de
 * MAIOR contagem de células não vazias; empate → MENOR índice (o cabeçalho
 * sempre está acima dos dados).
 *
 * Colunas: células não vazias da linha de cabeçalho, mapeadas pelo ÍNDICE da
 * coluna (colunas esparsas NÃO são deslocadas). key = slug do label (sem
 * acentos, kebab-case; colisão → sufixo -2, -3...).
 *
 * Valores: Date → 'YYYY-MM-DD' (dia civil LOCAL, sem shift UTC); number →
 * number; string → trim ('' vira null); null → null.
 *
 * Tipo por amostra (até 50 valores não nulos): ≥ 60% data → 'data'; ≥ 60%
 * número → 'percentual' se todos em [0,1] com algum fracionário e o label
 * sugere percentual, senão 'numero'; restante 'texto'.
 */
import * as XLSX from 'xlsx';

export type TipoColuna = 'data' | 'numero' | 'percentual' | 'texto';

export interface ColunaAnalisada {
  key: string;
  label: string;
  tipo: TipoColuna;
}

export interface AbaAnalisada {
  nome: string;
  headerRow: number; // 1-based
  colunas: ColunaAnalisada[];
  linhas: Record<string, unknown>[];
  totalLinhas: number;
}

export interface ResultadoAnalise {
  arquivoNome: string;
  abas: AbaAnalisada[];
}

const MAX_INDICE_CABECALHO = 30; // índice 0-based máximo varrido
const MIN_CELULAS_CABECALHO = 3;
const TAM_AMOSTRA_TIPO = 50;
const UMBRAL_TIPO = 0.6;
// Label sugere percentual? (comparado SEM acentos/minúsculas: indice, índice,
// eficacia/eficácia, retenção/retencao e '%' caem todos aqui).
const LABEL_PERCENTUAL = /%|indice|percent|eficacia|retenc/i;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Célula com conteúdo? (null, undefined e string em branco não contam). */
function celulaNaoVazia(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

/** Data civil local → 'YYYY-MM-DD' (nunca new Date().toISOString(), que dá shift UTC). */
function dataIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

/** Normaliza uma célula para o valor gravado em `dados`. */
function valorCelula(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return dataIsoLocal(v);
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  return v; // boolean etc.
}

/** Label → key: sem acentos, kebab-case ('Data de Embarque' → 'data-de-embarque'). */
function slugLabel(label: string): string {
  const base = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'coluna';
}

/** slug único dentro da aba: colisão → sufixo -2, -3... */
function keyUnica(base: string, usados: Set<string>): string {
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * Índice (0-based) da linha de cabeçalho: entre as linhas de índice ≤ 30 com
 * ≥ 3 células não vazias, a de MAIOR contagem; empate → menor índice.
 * Retorna -1 quando nenhuma linha qualifica.
 */
function detectarIndiceCabecalho(rows: unknown[][]): number {
  let melhorIdx = -1;
  let melhorCont = 0;
  const limite = Math.min(rows.length, MAX_INDICE_CABECALHO + 1);
  for (let i = 0; i < limite; i += 1) {
    const cont = (rows[i] || []).filter(celulaNaoVazia).length;
    if (cont < MIN_CELULAS_CABECALHO) continue;
    if (cont > melhorCont) {
      melhorCont = cont;
      melhorIdx = i;
    }
  }
  return melhorIdx;
}

/** Tipo da coluna por amostra de até 50 valores não nulos (ver cabeçalho). */
function tiparColuna(label: string, valores: unknown[]): TipoColuna {
  const amostra = valores.filter((v) => v !== null && v !== undefined).slice(0, TAM_AMOSTRA_TIPO);
  const n = amostra.length;
  if (n === 0) return 'texto';

  let datas = 0;
  let numeros = 0;
  for (const v of amostra) {
    if (typeof v === 'number') numeros += 1;
    else if (typeof v === 'string' && DATA_ISO.test(v)) datas += 1;
  }

  if (datas / n >= UMBRAL_TIPO) return 'data';
  if (numeros / n >= UMBRAL_TIPO) {
    const nums = amostra.filter((v): v is number => typeof v === 'number');
    const todosEmZeroUm = nums.every((v) => v >= 0 && v <= 1);
    const algumFracionario = nums.some((v) => !Number.isInteger(v));
    const labelNorm = label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (todosEmZeroUm && algumFracionario && LABEL_PERCENTUAL.test(labelNorm)) return 'percentual';
    return 'numero';
  }
  return 'texto';
}

export interface OpcoesAnalise {
  arquivoNome?: string;
  /** Override de cabeçalho por nome da aba (1-based). Ausente → detecção. */
  headerRows?: Record<string, number>;
}

/**
 * Analisa o workbook: cada aba com cabeçalho detectável vira uma AbaAnalisada.
 * Abas sem nenhuma linha qualificável nos primeiros 31 índices são puladas.
 */
export function analisarWorkbook(buffer: Buffer, opts?: OpcoesAnalise) {
  const wb = XLSX.read(buffer, { cellDates: true });
  const abas: AbaAnalisada[] = [];

  for (const nome of wb.SheetNames) {
    const ws = wb.Sheets[nome];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: null,
      // Mantém linhas em branco para que o índice no array == número da linha
      // da planilha (headerRow 1-based bate com o que o usuário vê no Excel).
      blankrows: true,
    });

    const override = opts?.headerRows?.[nome];
    const indice = override && override >= 1 ? override - 1 : detectarIndiceCabecalho(rows);
    if (indice < 0 || indice >= rows.length) continue;

    // Colunas: células não vazias do cabeçalho, pelo ÍNDICE da coluna.
    const header = rows[indice] || [];
    const colunas: ColunaAnalisada[] = [];
    const usados = new Set<string>();
    const idxParaKey = new Map<number, string>();
    header.forEach((cell, colIdx) => {
      if (!celulaNaoVazia(cell)) return;
      const label = cell instanceof Date ? dataIsoLocal(cell) : String(cell).trim();
      const key = keyUnica(slugLabel(label), usados);
      usados.add(key);
      idxParaKey.set(colIdx, key);
      colunas.push({ key, label, tipo: 'texto' });
    });
    if (colunas.length === 0) continue;

    // Linhas abaixo do cabeçalho; vazias (só null/branco) são puladas.
    const linhas: Record<string, unknown>[] = [];
    for (let i = indice + 1; i < rows.length; i += 1) {
      const row = rows[i] || [];
      const dados: Record<string, unknown> = {};
      let temValor = false;
      for (const [colIdx, key] of idxParaKey) {
        const v = valorCelula(row[colIdx]);
        dados[key] = v;
        if (v !== null && v !== undefined) temValor = true;
      }
      if (temValor) linhas.push(dados);
    }

    // Tipagem por amostra dos valores já normalizados.
    for (const col of colunas) {
      col.tipo = tiparColuna(col.label, linhas.map((l) => l[col.key]));
    }

    abas.push({
      nome,
      headerRow: indice + 1,
      colunas,
      linhas,
      totalLinhas: linhas.length,
    });
  }

  return { arquivoNome: opts?.arquivoNome || '', abas };
}

/**
 * Assinatura estável consumida pelo frontend e pelo gate G2:
 * analisarPlanilha(buffer, { arquivoNome }) → ResultadoAnalise.
 * Override de headerRow (modo 'substituir'/reimportação) usa analisarWorkbook.
 */
export function analisarPlanilha(buffer: Buffer, opts?: { arquivoNome?: string }) {
  return analisarWorkbook(buffer, opts);
}
