/**
 * Client-safe KPI board types + pure helpers (no Supabase).
 * Server CRUD lives in `kpi-board.ts`.
 */
import type { IADashboardLayout, IADashboardWidget } from '@/types/ia';

export const MAX_KPI_WIDGETS = 24;
export const MAX_BOARD_TITLE = 120;
export const MAX_HTML_SANDBOX_BYTES = 100_000;
export const ACTIVE_BOARD_STORAGE_KEY = 'abz_kpi_active_board_id';

export const KPI_DATASOURCE_ALLOWLIST = [
  'buscar_kpis_sistema',
  'analisar_kpis_negocio',
  'buscar_sinais_kpi_comunicacao',
  'buscar_dados_usuario',
  'buscar_reembolsos',
  'buscar_ferias',
  'buscar_epis',
  'buscar_tripulantes',
  'buscar_documentos_vencidos',
  'buscar_escalas',
  'buscar_cursos_disponiveis',
  'buscar_progresso_academy',
  'meus_emails',
  'meu_calendario',
  'minhas_conversas_teams',
] as const;

export type KpiDataSourceTool = (typeof KPI_DATASOURCE_ALLOWLIST)[number];

/** html_sandbox = ADMIN-only sandboxed iframe (never parent origin / dangerouslySetInnerHTML) */
export type KpiWidgetType = 'metric' | 'table' | 'list' | 'chart' | 'markdown' | 'html_sandbox';

export const KPI_WIDGET_TYPES = [
  'metric',
  'table',
  'list',
  'chart',
  'markdown',
  'html_sandbox',
] as const satisfies readonly KpiWidgetType[];

export interface KpiBoardWidget {
  id: string;
  type: KpiWidgetType;
  title?: string;
  data?: unknown;
  dataSource?: {
    tool: string;
    args?: Record<string, unknown>;
    /** Dot-path into tool JSON (ex: comunicacao.email_sinais) */
    path?: string;
  };
  config?: Record<string, unknown>;
}

export interface KpiBoardSpec {
  version: 1;
  columns?: number;
  widgets: KpiBoardWidget[];
}

export type KpiBoardVisibility = 'private' | 'team' | 'org';

export interface KpiBoardRow {
  id: string;
  user_id: string;
  title: string;
  spec: KpiBoardSpec;
  revision: number;
  visibility: KpiBoardVisibility;
  is_active: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** BoardSpec → GenerativeDashboard layout (skips markdown + html_sandbox) */
export function boardSpecToLayout(spec: KpiBoardSpec, boardId?: string): IADashboardLayout {
  return {
    id: boardId || 'kpi-board',
    columns: spec.columns || 3,
    widgets: (spec.widgets || [])
      .filter((w) => w.type !== 'markdown' && w.type !== 'html_sandbox')
      .map((w) => ({
        id: w.id,
        type: w.type as IADashboardWidget['type'],
        title: w.title || '',
        data: normalizeWidgetData(w.type, w.data),
        config: w.config,
      })),
  };
}

// ─── Widget data normalization (LLM variance + tool binding) ───────────────

const NESTED_ARRAY_KEYS = [
  'items',
  'rows',
  'data',
  'results',
  'email_sinais',
  'teams_sinais',
  'sinais',
  'emails',
  'messages',
  'mensagens',
  'pendencias',
  'list',
  'valores',
  'metrics',
] as const;

function pickString(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c === 'object') continue;
    const s = String(c).trim();
    if (s && s !== 'undefined' && s !== 'null' && s !== '[object Object]') return s;
  }
  return '';
}

function pickNumber(...candidates: unknown[]): number | undefined {
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c;
    if (typeof c === 'string' && c.trim() !== '' && !Number.isNaN(Number(c))) {
      return Number(c);
    }
  }
  return undefined;
}

/** Resolve `a.b.0.c` into nested tool JSON. */
export function extractByPath(root: unknown, path?: string): unknown {
  if (!path || !String(path).trim()) return root;
  const parts = String(path)
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean);
  let cur: unknown = root;
  for (const part of parts) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(part);
      cur = Number.isInteger(idx) ? cur[idx] : undefined;
      continue;
    }
    if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[part];
      continue;
    }
    return undefined;
  }
  return cur;
}

function firstNestedArray(obj: Record<string, unknown>): unknown[] | null {
  for (const key of NESTED_ARRAY_KEYS) {
    const v = obj[key];
    if (Array.isArray(v)) return v;
  }
  // comunicacao.email_sinais etc.
  for (const v of Object.values(obj)) {
    if (Array.isArray(v) && v.length > 0) return v;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested = firstNestedArray(v as Record<string, unknown>);
      if (nested) return nested;
    }
  }
  return null;
}

function normalizeListItem(item: unknown, i: number): {
  id: string | number;
  title: string;
  subtitle: string;
  status?: string;
} {
  if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
    return { id: i, title: String(item), subtitle: '' };
  }
  const o =
    item && typeof item === 'object' ? (item as Record<string, unknown>) : ({} as Record<string, unknown>);
  const title =
    pickString(
      o.title,
      o.label,
      o.name,
      o.nome,
      o.assunto,
      o.subject,
      o.assunto_ou_preview,
      o.text,
      o.preview,
      o.mensagem,
      o.message,
      o.categoria,
      o.category,
      o.dominio,
      o.resumo
    ) || 'Item';
  const subtitle = pickString(
    o.subtitle,
    o.description,
    o.descricao,
    o.value,
    o.valor,
    o.status,
    o.de,
    o.from,
    o.email,
    o.data,
    o.date,
    o.motivo,
    o.relevancia,
    o.count != null ? String(o.count) : '',
    o.total != null ? String(o.total) : '',
    o.unidade,
    o.unit
  );
  const urgent =
    o.status === 'urgent' ||
    o.relevancia === 'alta' ||
    String(o.priority || o.prioridade || '').toLowerCase() === 'high';
  return {
    id: (o.id as string | number) ?? i,
    title,
    subtitle,
    status: urgent ? 'urgent' : undefined,
  };
}

function normalizeChartItems(raw: unknown): { name: string; value: number }[] {
  if (Array.isArray(raw)) {
    return raw.slice(0, 48).map((item, i) => {
      if (typeof item === 'number') return { name: String(i + 1), value: item };
      if (typeof item === 'string') {
        const n = Number(item);
        return { name: item, value: Number.isFinite(n) ? n : 0 };
      }
      const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      return {
        name:
          pickString(o.name, o.label, o.categoria, o.category, o.mes, o.month, o.x, o.key) ||
          String(i + 1),
        value: pickNumber(o.value, o.total, o.count, o.y, o.quantidade, o.qtd) ?? 0,
      };
    });
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.items)) return normalizeChartItems(o.items);
    if (Array.isArray(o.data) && !Array.isArray(o.labels)) return normalizeChartItems(o.data);
    if (Array.isArray(o.labels)) {
      const values =
        (Array.isArray(o.values) && o.values) ||
        (Array.isArray(o.datasets) &&
          o.datasets[0] &&
          typeof o.datasets[0] === 'object' &&
          Array.isArray((o.datasets[0] as { data?: unknown }).data) &&
          (o.datasets[0] as { data: unknown[] }).data) ||
        [];
      return (o.labels as unknown[]).slice(0, 48).map((lab, i) => ({
        name: String(lab),
        value: pickNumber(values[i]) ?? 0,
      }));
    }
    // Flat map of category → number
    const entries = Object.entries(o).filter(
      ([k, v]) =>
        !['type', 'chartType', 'height', 'error', 'empty', 'emptyMessage'].includes(k) &&
        (typeof v === 'number' || (typeof v === 'string' && !Number.isNaN(Number(v))))
    );
    if (entries.length > 0) {
      return entries.slice(0, 48).map(([k, v]) => ({ name: k, value: Number(v) }));
    }
  }
  return [];
}

/**
 * True when widget payload has nothing useful to paint
 * (empty snapshot that should yield to dataSource resolution).
 */
export function isEmptyWidgetData(type: string, data: unknown): boolean {
  if (data == null) return true;
  if (typeof data === 'string') return !data.trim();
  if (typeof data !== 'object') return false;
  const o = data as Record<string, unknown>;
  if (o.error != null && String(o.error).trim()) return false;
  if (o.empty === true) return true;

  switch (type) {
    case 'metric': {
      if (o.value !== undefined && o.value !== null && o.value !== '') return false;
      if (Array.isArray(o.metrics) && o.metrics.length > 0) return false;
      return pickNumber(o.total, o.count, o.quantidade) === undefined;
    }
    case 'list': {
      const items = o.items ?? o.rows ?? o.data ?? firstNestedArray(o);
      if (!Array.isArray(items) || items.length === 0) return true;
      return items.every((it) => {
        if (typeof it === 'string' || typeof it === 'number') return !String(it).trim();
        if (!it || typeof it !== 'object') return true;
        const r = it as Record<string, unknown>;
        return !pickString(
          r.title,
          r.label,
          r.name,
          r.assunto,
          r.subject,
          r.text,
          r.assunto_ou_preview,
          r.nome
        );
      });
    }
    case 'chart': {
      return normalizeChartItems(o).length === 0;
    }
    case 'table': {
      const rows = o.rows ?? o.data;
      return !Array.isArray(rows) || rows.length === 0;
    }
    case 'markdown': {
      return !pickString(o.content, o.text, o.markdown, o.html);
    }
    case 'html_sandbox': {
      return !pickString(o.srcdoc, o.html, o.content);
    }
    default:
      return Object.keys(o).length === 0;
  }
}

/**
 * Coerce LLM/tool variance into shapes GenerativeDashboard expects:
 * metric {value,label}, list {items:[{title,subtitle}]}, chart {type,items:[{name,value}]},
 * table {columns,rows}, markdown {content}.
 */
export function normalizeWidgetData(type: string, data: unknown): unknown {
  if (data == null) {
    if (type === 'list') return { items: [], emptyMessage: 'Nenhum item' };
    if (type === 'chart') return { type: 'bar', items: [], emptyMessage: 'Sem dados para o gráfico' };
    if (type === 'table') return { columns: [], rows: [], emptyMessage: 'Sem dados para exibir' };
    if (type === 'metric') return { value: '—', label: 'Sem dados', empty: true };
    if (type === 'markdown') return { content: '' };
    return data;
  }

  if (typeof data === 'object' && data !== null && 'error' in (data as object)) {
    const err = String((data as { error?: unknown }).error || 'Erro ao carregar dados');
    if (type === 'markdown') return { content: `⚠️ ${err}` };
    if (type === 'metric') return { value: '—', label: err, error: err };
    if (type === 'list') return { items: [], emptyMessage: err, error: err };
    if (type === 'chart') return { type: 'bar', items: [], emptyMessage: err, error: err };
    if (type === 'table') return { columns: [], rows: [], emptyMessage: err, error: err };
    return data;
  }

  if (type === 'metric') {
    if (typeof data === 'number' || typeof data === 'string') {
      return { value: data, label: 'Valor' };
    }
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.metrics) && o.metrics[0] && typeof o.metrics[0] === 'object') {
      return normalizeWidgetData('metric', o.metrics[0]);
    }
    if (o.value !== undefined && o.value !== null && o.value !== '') {
      return {
        ...o,
        value: o.value,
        label: pickString(o.label, o.title, o.name, o.nome) || o.label,
      };
    }
    const num = pickNumber(o.total, o.count, o.quantidade, o.qtd, o.pendentes);
    if (num !== undefined) {
      return {
        value: num,
        label: pickString(o.label, o.title, o.name) || 'Total',
        unit: o.unit ?? o.unidade,
        change: o.change,
        trend: o.trend,
        action: o.action,
      };
    }
    // Heuristic: first numeric field
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        return { value: v, label: k };
      }
    }
    return { value: '—', label: pickString(o.label, o.title) || 'Sem dados', empty: true };
  }

  if (type === 'list') {
    let itemsRaw: unknown[] | null = null;
    if (Array.isArray(data)) itemsRaw = data;
    else if (typeof data === 'object') {
      const o = data as Record<string, unknown>;
      if (Array.isArray(o.items)) itemsRaw = o.items;
      else if (Array.isArray(o.rows)) itemsRaw = o.rows;
      else if (Array.isArray(o.data)) itemsRaw = o.data;
      else itemsRaw = firstNestedArray(o);
    }
    const items = (itemsRaw || []).slice(0, 40).map(normalizeListItem);
    const emptyMessage =
      (typeof data === 'object' &&
        data &&
        pickString(
          (data as { emptyMessage?: unknown }).emptyMessage,
          (data as { message?: unknown }).message
        )) ||
      'Nenhum item';
    return { items, emptyMessage };
  }

  if (type === 'chart') {
    const o =
      data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : ({ items: data } as Record<string, unknown>);
    const items = normalizeChartItems(Array.isArray(data) ? data : o);
    const chartType = pickString(o.type, o.chartType, o.kind) || 'bar';
    const safeType =
      chartType === 'pie' || chartType === 'line' || chartType === 'bar' ? chartType : 'bar';
    return {
      type: safeType,
      items,
      height: typeof o.height === 'number' ? o.height : 200,
      emptyMessage: pickString(o.emptyMessage) || 'Sem dados para o gráfico',
    };
  }

  if (type === 'table') {
    if (Array.isArray(data)) {
      const rows = data.slice(0, 50) as Record<string, unknown>[];
      const keys =
        rows[0] && typeof rows[0] === 'object' ? Object.keys(rows[0]).slice(0, 8) : [];
      return {
        columns: keys.map((k) => ({ key: k, label: k })),
        rows,
        emptyMessage: 'Sem dados para exibir',
      };
    }
    const o = data as Record<string, unknown>;
    let rows = (o.rows ?? o.data) as unknown;
    if (!Array.isArray(rows)) {
      const nested = firstNestedArray(o);
      rows = nested || [];
    }
    const rowArr = (rows as unknown[]).slice(0, 50);
    let columns = o.columns as unknown;
    if (!Array.isArray(columns) || columns.length === 0) {
      const keys =
        rowArr[0] && typeof rowArr[0] === 'object'
          ? Object.keys(rowArr[0] as object).slice(0, 8)
          : [];
      columns = keys.map((k) => ({ key: k, label: k }));
    }
    return {
      columns,
      rows: rowArr,
      actions: o.actions,
      emptyMessage: pickString(o.emptyMessage) || 'Sem dados para exibir',
    };
  }

  if (type === 'markdown') {
    if (typeof data === 'string') return { content: data };
    const o = data as Record<string, unknown>;
    return {
      content: pickString(o.content, o.text, o.markdown, o.html) || '',
    };
  }

  return data;
}

/**
 * Map raw tool JSON → widget payload, then normalize.
 * Prefer `path` when set; otherwise dig known nested arrays for list/table/chart.
 */
export function adaptToolResultToWidget(
  type: string,
  parsed: unknown,
  opts?: { path?: string; widgetTitle?: string }
): unknown {
  let source = extractByPath(parsed, opts?.path);

  // Title heuristics for comms boards when path omitted
  if (
    source === parsed &&
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    (type === 'list' || type === 'table')
  ) {
    const title = (opts?.widgetTitle || '').toLowerCase();
    const o = parsed as Record<string, unknown>;
    const comunicacao =
      o.comunicacao && typeof o.comunicacao === 'object'
        ? (o.comunicacao as Record<string, unknown>)
        : o;
    if (title.includes('email') || title.includes('e-mail') || title.includes('mail')) {
      const emails = comunicacao.email_sinais ?? o.email_sinais;
      if (Array.isArray(emails)) source = emails;
    } else if (title.includes('teams') || title.includes('mensagem')) {
      const teams = comunicacao.teams_sinais ?? o.teams_sinais;
      if (Array.isArray(teams)) source = teams;
    }
  }

  if (type === 'list' && source && typeof source === 'object' && !Array.isArray(source)) {
    const arr = firstNestedArray(source as Record<string, unknown>);
    if (arr) source = arr;
  }
  if (type === 'table' && source && typeof source === 'object' && !Array.isArray(source)) {
    const arr = firstNestedArray(source as Record<string, unknown>);
    if (arr) source = arr;
  }
  if (type === 'chart' && source && typeof source === 'object' && !Array.isArray(source)) {
    const arr = firstNestedArray(source as Record<string, unknown>);
    if (arr && !('labels' in (source as object))) source = arr;
  }

  if (type === 'metric' && source && typeof source === 'object' && !Array.isArray(source)) {
    const o = source as Record<string, unknown>;
    if (o.value === undefined) {
      // Prefer pending counts from buscar_kpis_sistema
      for (const key of [
        'total_pendencias',
        'ferias_pendentes',
        'reembolsos_pendentes',
        'compras_pendentes',
        'avaliacoes_pendentes',
        'epis_pendentes',
      ]) {
        if (typeof o[key] === 'number') {
          source = { value: o[key], label: key.replace(/_/g, ' ') };
          break;
        }
      }
    }
  }

  if (type === 'markdown') {
    return normalizeWidgetData(
      'markdown',
      typeof source === 'string'
        ? source
        : { content: '```json\n' + JSON.stringify(source, null, 2).slice(0, 6000) + '\n```' }
    );
  }

  const adapted =
    type === 'list' && Array.isArray(source)
      ? { items: source }
      : type === 'chart' && Array.isArray(source)
        ? { type: 'bar', items: source }
        : type === 'table' && Array.isArray(source)
          ? source
          : source;

  const normalized = normalizeWidgetData(type, adapted);

  // Clear empty-state copy for known domains
  if (
    normalized &&
    typeof normalized === 'object' &&
    Array.isArray((normalized as { items?: unknown[] }).items) &&
    (normalized as { items: unknown[] }).items.length === 0
  ) {
    const t = (opts?.widgetTitle || '').toLowerCase();
    let emptyMessage = (normalized as { emptyMessage?: string }).emptyMessage || 'Nenhum item';
    if (t.includes('email') || t.includes('e-mail')) emptyMessage = 'Nenhum e-mail pendente';
    else if (t.includes('teams') || t.includes('mensagem')) {
      emptyMessage = 'Nenhuma mensagem Teams pendente';
    }
    return { ...normalized, emptyMessage };
  }

  return normalized;
}

export function extractHtmlSandboxSrcdoc(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (typeof o.srcdoc === 'string') return o.srcdoc;
    if (typeof o.html === 'string') return o.html;
    if (typeof o.content === 'string') return o.content;
  }
  return '';
}

/** Wrap admin HTML for sandboxed iframe (no same-origin, capped CSP). */
export function wrapHtmlSandboxSrcdoc(rawHtml: string): string {
  const csp =
    "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; " +
    "img-src data: blob:; font-src data:; media-src 'none'; connect-src 'none'; " +
    "frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';";
  const body = String(rawHtml || '');
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"/>` +
    `<meta http-equiv="Content-Security-Policy" content="${csp}"/>` +
    `<style>html,body{margin:0;padding:8px;font-family:system-ui,sans-serif;}</style>` +
    `</head><body>${body}</body></html>`
  );
}
