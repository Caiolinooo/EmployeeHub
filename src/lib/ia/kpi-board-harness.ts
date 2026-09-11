/**
 * KPI Quadro Branco — role-based harness (server-side enforcement).
 * Soft prompts alone are NOT enough; tools/API must call assertBoardSpecAllowed.
 */
import {
  KPI_DATASOURCE_ALLOWLIST,
  MAX_HTML_SANDBOX_BYTES,
  MAX_KPI_WIDGETS,
  type KpiBoardSpec,
  type KpiDataSourceTool,
  type KpiWidgetType,
  extractHtmlSandboxSrcdoc,
} from './kpi-board-shared';

export { extractHtmlSandboxSrcdoc, wrapHtmlSandboxSrcdoc } from './kpi-board-shared';

export type KpiHarnessRole = 'ADMIN' | 'MANAGER' | 'USER';

export type KpiContentPolicy = 'admin_free' | 'work_only' | 'work_own_only';

export interface KpiBoardCapabilities {
  allowHtmlSandbox: boolean;
  allowExperimental: boolean;
  maxWidgets: number;
  allowedWidgetTypes: readonly KpiWidgetType[];
  allowedDataTools: readonly KpiDataSourceTool[];
  requireWorkRelated: boolean;
  contentPolicy: KpiContentPolicy;
  maxHtmlSandboxBytes: number;
  maxMarkdownChars: number;
}

/** USER: only personal / own-scope data tools */
const USER_DATA_TOOLS = [
  'buscar_dados_usuario',
  'buscar_reembolsos',
  'buscar_ferias',
  'buscar_epis',
  'buscar_cursos_disponiveis',
  'buscar_progresso_academy',
  'meus_emails',
  'meu_calendario',
  'minhas_conversas_teams',
] as const satisfies readonly KpiDataSourceTool[];

/** MANAGER: team/ops/HR/finance tools (execution still RBAC-scoped) */
const MANAGER_DATA_TOOLS = [
  ...USER_DATA_TOOLS,
  'analisar_kpis_negocio',
  'buscar_sinais_kpi_comunicacao',
  'buscar_tripulantes',
  'buscar_documentos_vencidos',
  'buscar_escalas',
] as const satisfies readonly KpiDataSourceTool[];

const WORK_WIDGET_TYPES = [
  'metric',
  'table',
  'list',
  'chart',
  'markdown',
] as const satisfies readonly KpiWidgetType[];

const ADMIN_WIDGET_TYPES = [
  ...WORK_WIDGET_TYPES,
  'html_sandbox',
] as const satisfies readonly KpiWidgetType[];

const HTML_SANDBOX_MAX_BYTES = MAX_HTML_SANDBOX_BYTES;
const MARKDOWN_MAX_CHARS_USER = 4_000;
const MARKDOWN_MAX_CHARS_MANAGER = 8_000;
const MARKDOWN_MAX_CHARS_ADMIN = 16_000;

/** Off-topic / game patterns — reject for non-admin */
const NON_ADMIN_BLOCKLIST: RegExp[] = [
  /\bminigame\b/i,
  /\bmini[\s_-]?jogo\b/i,
  /\bjogo\b/i,
  /\bgame\b/i,
  /\bsnake\b/i,
  /\btetris\b/i,
  /\bpong\b/i,
  /\bfreefire\b/i,
  /\bfree[\s_-]?fire\b/i,
  /\bflappy\b/i,
  /\bcandy[\s_-]?crush\b/i,
  /\bcanvas\s+game\b/i,
  /\brequestanimationframe\b/i,
  /\bkeydown.*arrow/i,
  /\bspace\s*invader/i,
  /\basteroid\b/i,
  /\bbreakout\b/i,
  /\bpac[\s_-]?man\b/i,
  /\b2048\b/i,
  /\bentretenimento\b/i,
  /\bdivers[aã]o\b/i,
];

const SCRIPTISH_MARKDOWN = /<\s*script\b|javascript\s*:|on\w+\s*=|<\s*iframe\b|<\s*object\b|<\s*embed\b|<\s*link\b|<\s*meta\b/i;

export function normalizeKpiHarnessRole(role: string | null | undefined): KpiHarnessRole {
  const r = String(role || 'USER').toUpperCase().trim();
  if (r === 'ADMIN') return 'ADMIN';
  if (r === 'MANAGER' || r === 'GERENTE') return 'MANAGER';
  return 'USER';
}

export function getKpiBoardCapabilities(role: string | null | undefined): KpiBoardCapabilities {
  const harnessRole = normalizeKpiHarnessRole(role);
  switch (harnessRole) {
    case 'ADMIN':
      return {
        allowHtmlSandbox: true,
        allowExperimental: true,
        maxWidgets: MAX_KPI_WIDGETS,
        allowedWidgetTypes: ADMIN_WIDGET_TYPES,
        allowedDataTools: KPI_DATASOURCE_ALLOWLIST,
        requireWorkRelated: false,
        contentPolicy: 'admin_free',
        maxHtmlSandboxBytes: HTML_SANDBOX_MAX_BYTES,
        maxMarkdownChars: MARKDOWN_MAX_CHARS_ADMIN,
      };
    case 'MANAGER':
      return {
        allowHtmlSandbox: false,
        allowExperimental: false,
        maxWidgets: 16,
        allowedWidgetTypes: WORK_WIDGET_TYPES,
        allowedDataTools: MANAGER_DATA_TOOLS,
        requireWorkRelated: true,
        contentPolicy: 'work_only',
        maxHtmlSandboxBytes: 0,
        maxMarkdownChars: MARKDOWN_MAX_CHARS_MANAGER,
      };
    case 'USER':
      return {
        allowHtmlSandbox: false,
        allowExperimental: false,
        maxWidgets: 8,
        allowedWidgetTypes: WORK_WIDGET_TYPES,
        allowedDataTools: USER_DATA_TOOLS,
        requireWorkRelated: true,
        contentPolicy: 'work_own_only',
        maxHtmlSandboxBytes: 0,
        maxMarkdownChars: MARKDOWN_MAX_CHARS_USER,
      };
    default: {
      const _exhaustive: never = harnessRole;
      throw new Error(`Unknown harness role: ${String(_exhaustive)}`);
    }
  }
}

function collectStrings(value: unknown, out: string[], depth = 0): void {
  if (depth > 8 || out.length > 200) return;
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 100)) collectStrings(item, out, depth + 1);
    return;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectStrings(v, out, depth + 1);
    }
  }
}

export function findBlocklistHit(text: string): string | null {
  for (const re of NON_ADMIN_BLOCKLIST) {
    if (re.test(text)) return re.source;
  }
  return null;
}

export type AssertBoardResult =
  | { ok: true; spec: KpiBoardSpec }
  | { ok: false; error: string; code: 'HARNESS_REJECT' | 'VALIDATION' };

/**
 * Validate Zod-sanitized (or raw) board spec against role capabilities.
 * Rejects html_sandbox smuggling, games/off-topic for non-admin, scripted markdown, oversized content.
 */
export function assertBoardSpecAllowed(
  spec: KpiBoardSpec,
  role: string | null | undefined,
  _userId?: string
): AssertBoardResult {
  const caps = getKpiBoardCapabilities(role);
  const harnessRole = normalizeKpiHarnessRole(role);

  if (!spec?.widgets?.length) {
    return { ok: false, error: 'Board precisa de ao menos 1 widget', code: 'VALIDATION' };
  }

  if (spec.widgets.length > caps.maxWidgets) {
    return {
      ok: false,
      error: `Harness (${harnessRole}): máximo ${caps.maxWidgets} widgets (recebido ${spec.widgets.length}).`,
      code: 'HARNESS_REJECT',
    };
  }

  const allowedTypes = new Set(caps.allowedWidgetTypes);
  const allowedTools = new Set(caps.allowedDataTools as readonly string[]);

  for (let i = 0; i < spec.widgets.length; i++) {
    const w = spec.widgets[i];
    const path = `widgets[${i}] (${w.id})`;

    if (!allowedTypes.has(w.type)) {
      return {
        ok: false,
        error:
          w.type === 'html_sandbox'
            ? `Harness: widget html_sandbox só é permitido para ADMIN (rejeitado em ${path}).`
            : `Harness (${harnessRole}): tipo de widget "${w.type}" não permitido em ${path}.`,
        code: 'HARNESS_REJECT',
      };
    }

    if (w.dataSource) {
      const tool = String(w.dataSource.tool || '');
      if (!allowedTools.has(tool)) {
        return {
          ok: false,
          error: `Harness (${harnessRole}): dataSource tool "${tool}" fora do allowlist do papel em ${path}.`,
          code: 'HARNESS_REJECT',
        };
      }
    }

    if (w.type === 'html_sandbox') {
      if (!caps.allowHtmlSandbox) {
        return {
          ok: false,
          error: `Harness: html_sandbox bloqueado para ${harnessRole}.`,
          code: 'HARNESS_REJECT',
        };
      }
      const srcdoc = extractHtmlSandboxSrcdoc(w.data);
      const bytes = new TextEncoder().encode(srcdoc).length;
      if (!srcdoc.trim()) {
        return {
          ok: false,
          error: `Widget html_sandbox ${w.id}: informe data.srcdoc (HTML).`,
          code: 'VALIDATION',
        };
      }
      if (bytes > caps.maxHtmlSandboxBytes) {
        return {
          ok: false,
          error: `Widget html_sandbox ${w.id}: HTML excede ${caps.maxHtmlSandboxBytes} bytes (${bytes}).`,
          code: 'HARNESS_REJECT',
        };
      }
    }

    if (w.type === 'markdown') {
      const content =
        typeof w.data === 'string'
          ? w.data
          : w.data && typeof w.data === 'object' && 'content' in (w.data as object)
            ? String((w.data as { content?: string }).content || '')
            : '';
      if (content.length > caps.maxMarkdownChars) {
        return {
          ok: false,
          error: `Markdown ${w.id}: máximo ${caps.maxMarkdownChars} caracteres.`,
          code: 'HARNESS_REJECT',
        };
      }
      if (caps.requireWorkRelated && SCRIPTISH_MARKDOWN.test(content)) {
        return {
          ok: false,
          error: `Harness: markdown em ${path} contém tags/scripts proibidos.`,
          code: 'HARNESS_REJECT',
        };
      }
    }
  }

  if (caps.requireWorkRelated) {
    const strings: string[] = [];
    if (typeof (spec as { title?: string }).title === 'string') {
      strings.push((spec as { title?: string }).title!);
    }
    collectStrings(spec, strings);
    const blob = strings.join('\n');
    const hit = findBlocklistHit(blob);
    if (hit) {
      return {
        ok: false,
        error:
          `Harness (${harnessRole}): conteúdo fora de escopo profissional (padrão bloqueado). ` +
          `Use widgets de trabalho (métricas/tabelas/gráficos) com dados do portal. ` +
          `Jogos/HTML livre só para ADMIN via html_sandbox.`,
        code: 'HARNESS_REJECT',
      };
    }
  }

  // Normalize html_sandbox data shape for storage
  const widgets = spec.widgets.map((w) => {
    if (w.type !== 'html_sandbox') return w;
    const srcdoc = extractHtmlSandboxSrcdoc(w.data);
    return {
      ...w,
      data: { srcdoc },
      dataSource: undefined,
    };
  });

  return {
    ok: true,
    spec: {
      version: 1,
      columns: spec.columns || 3,
      widgets,
    },
  };
}

/** Prompt snippet injected by role (Companion + context-builder + boards block). */
export function buildKpiHarnessPromptBlock(role: string | null | undefined): string {
  const caps = getKpiBoardCapabilities(role);
  const harnessRole = normalizeKpiHarnessRole(role);

  switch (harnessRole) {
    case 'ADMIN':
      return (
        `\n### Harness KPI (ADMIN — liberdade máxima)\n` +
        `- Você pode alterar livremente o quadro KPI do usuário (sandbox HTML permitido).\n` +
        `- Widgets: ${caps.allowedWidgetTypes.join('|')} (max ${caps.maxWidgets}).\n` +
        `- Pedidos de minigame/HTML/demo: use widget \`html_sandbox\` com \`data.srcdoc\` no quadro + \`abrir_quadro_kpi\` (iframe sandboxed em /kpi). NUNCA “salve .html” / dump fora do portal.\n` +
        `- html_sandbox: sandbox=allow-scripts SEM allow-same-origin; sem acesso a cookies/localStorage do portal.\n`
      );
    case 'MANAGER':
      return (
        `\n### Harness KPI (MANAGER — somente trabalho)\n` +
        `- Somente conteúdo profissional/trabalho; use tools de board; recuse jogos e HTML livre.\n` +
        `- Widgets: ${caps.allowedWidgetTypes.join('|')} (max ${caps.maxWidgets}). Sem html_sandbox.\n` +
        `- dataSource só: ${caps.allowedDataTools.join(', ')}.\n` +
        `- Se pedirem minigame/HTML/JS: recuse com mensagem do harness e ofereça quadro de KPIs da equipe/ops.\n` +
        `- NUNCA diga “não consigo injetar” + dump HTML; NUNCA peça salvar .html.\n`
      );
    case 'USER':
      return (
        `\n### Harness KPI (USER — somente dados próprios)\n` +
        `- Somente conteúdo profissional sobre os dados que o usuário pode acessar; recuse jogos e HTML livre.\n` +
        `- Widgets: ${caps.allowedWidgetTypes.join('|')} (max ${caps.maxWidgets}). Sem html_sandbox.\n` +
        `- dataSource só: ${caps.allowedDataTools.join(', ')}.\n` +
        `- Não invente dashboards cross-org além do RBAC. Minigame → recusar + oferecer quadro de pendências próprias.\n` +
        `- NUNCA “salve .html” / dump HTML fora do portal.\n`
      );
    default: {
      const _exhaustive: never = harnessRole;
      return String(_exhaustive);
    }
  }
}

export const HARNESS_REFUSE_MINIGAME_MSG =
  'O harness do quadro KPI permite apenas conteúdo profissional para o seu perfil. ' +
  'Posso montar um quadro com métricas, tabelas ou gráficos dos seus dados no portal — sem jogos ou HTML livre.';
