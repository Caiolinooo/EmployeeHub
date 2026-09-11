/**
 * KPI Quadro Branco v1 — board store (Zod-validated spec + role harness)
 * Widgets: metric | table | list | chart | markdown | html_sandbox (ADMIN)
 * dataSource refs allowlisted portal tools only — never secrets / free-form JS on parent origin.
 */
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import type { IADashboardLayout, IADashboardWidget } from '@/types/ia';
import {
  ACTIVE_BOARD_STORAGE_KEY,
  KPI_DATASOURCE_ALLOWLIST,
  KPI_WIDGET_TYPES,
  MAX_BOARD_TITLE,
  MAX_KPI_WIDGETS,
  boardSpecToLayout,
  normalizeWidgetData,
  type KpiBoardRow,
  type KpiBoardSpec,
  type KpiBoardVisibility,
  type KpiBoardWidget,
} from './kpi-board-shared';
import {
  assertBoardSpecAllowed,
  buildKpiHarnessPromptBlock,
  getKpiBoardCapabilities,
  normalizeKpiHarnessRole,
} from './kpi-board-harness';

export {
  ACTIVE_BOARD_STORAGE_KEY,
  KPI_DATASOURCE_ALLOWLIST,
  MAX_BOARD_TITLE,
  MAX_KPI_WIDGETS,
  boardSpecToLayout,
};
export type {
  KpiBoardRow,
  KpiBoardSpec,
  KpiBoardVisibility,
  KpiBoardWidget,
  KpiDataSourceTool,
} from './kpi-board-shared';

const secretLikeKey =
  /^(password|passwd|secret|token|api[_-]?key|authorization|bearer|connection[_-]?string|private[_-]?key)$/i;

function stripSecretKeys(value: unknown, depth = 0): unknown {
  if (depth > 6) return undefined;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./.test(value)) return '[redacted]';
    return value.slice(0, 4000);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => stripSecretKeys(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (secretLikeKey.test(k)) continue;
      out[k] = stripSecretKeys(v, depth + 1);
    }
    return out;
  }
  return undefined;
}

const dataSourceSchema = z.object({
  tool: z.enum(KPI_DATASOURCE_ALLOWLIST as unknown as [string, ...string[]]),
  args: z.record(z.unknown()).optional().default({}),
  path: z.string().max(120).optional(),
});

const widgetBaseSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(KPI_WIDGET_TYPES as unknown as [KpiBoardWidget['type'], ...KpiBoardWidget['type'][]]),
  title: z.string().max(120).optional().default(''),
  data: z.unknown().optional(),
  dataSource: dataSourceSchema.optional(),
  config: z.record(z.unknown()).optional(),
});

export const kpiBoardSpecSchema = z
  .object({
    version: z.literal(1).default(1),
    columns: z.number().int().min(1).max(4).optional().default(3),
    widgets: z.array(widgetBaseSchema).max(MAX_KPI_WIDGETS),
  })
  .superRefine((spec, ctx) => {
    if (!spec.widgets.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Board precisa de ao menos 1 widget',
        path: ['widgets'],
      });
    }
    for (let i = 0; i < spec.widgets.length; i++) {
      const w = spec.widgets[i];
      if (w.type === 'html_sandbox') {
        // html_sandbox uses data.srcdoc — dataSource not allowed
        if (w.dataSource) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Widget ${w.id}: html_sandbox não aceita dataSource`,
            path: ['widgets', i, 'dataSource'],
          });
        }
        continue;
      }
      if (w.data === undefined && !w.dataSource) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Widget ${w.id}: informe data ou dataSource`,
          path: ['widgets', i],
        });
      }
    }
  });

export function sanitizeBoardSpec(
  raw: unknown,
  role?: string | null
): { ok: true; spec: KpiBoardSpec } | { ok: false; error: string } {
  const cleaned = stripSecretKeys(raw);
  const parsed = kpiBoardSpecSchema.safeParse(cleaned);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const widgets = parsed.data.widgets.map((w) => ({
    ...w,
    data:
      w.data !== undefined
        ? normalizeWidgetData(w.type, stripSecretKeys(w.data))
        : undefined,
    dataSource: w.dataSource
      ? {
          tool: w.dataSource.tool,
          args: (stripSecretKeys(w.dataSource.args || {}) as Record<string, unknown>) || {},
          ...(w.dataSource.path ? { path: String(w.dataSource.path).slice(0, 120) } : {}),
        }
      : undefined,
    config: w.config ? (stripSecretKeys(w.config) as Record<string, unknown>) : undefined,
  }));
  const base: KpiBoardSpec = { version: 1, columns: parsed.data.columns, widgets };

  // When role is provided, enforce harness (server path). Client reads may omit role.
  if (role !== undefined && role !== null) {
    const harnessed = assertBoardSpecAllowed(base, role);
    if (!harnessed.ok) return { ok: false, error: harnessed.error };
    return { ok: true, spec: harnessed.spec };
  }
  return { ok: true, spec: base };
}

/** Convert GenerativeDashboard / render_dashboard layout → BoardSpec */
export function layoutToBoardSpec(
  layout: IADashboardLayout | Record<string, unknown>,
  role?: string | null
): KpiBoardSpec | null {
  const widgetsRaw =
    (layout as IADashboardLayout)?.widgets || (layout as { widgets?: unknown[] }).widgets;
  if (!Array.isArray(widgetsRaw) || widgetsRaw.length === 0) return null;

  const caps = getKpiBoardCapabilities(role);
  const allowed = new Set(caps.allowedWidgetTypes);

  const widgets = widgetsRaw.slice(0, caps.maxWidgets).map(
    (w: IADashboardWidget | Record<string, unknown>, i: number) => {
      const type = String((w as IADashboardWidget).type || 'metric');
      const asType = allowed.has(type as KpiBoardWidget['type'])
        ? (type as KpiBoardWidget['type'])
        : 'metric';
      const rawData = stripSecretKeys((w as IADashboardWidget).data);
      return {
        id: String((w as IADashboardWidget).id || `w${i + 1}`),
        type: asType,
        title: String((w as IADashboardWidget).title || ''),
        data: rawData !== undefined ? normalizeWidgetData(asType, rawData) : undefined,
        config: (w as IADashboardWidget).config
          ? (stripSecretKeys((w as IADashboardWidget).config) as Record<string, unknown>)
          : undefined,
      };
    }
  );

  const columns =
    Number((layout as IADashboardLayout).columns) ||
    (widgets.length > 2 ? 3 : Math.max(1, widgets.length));
  const result = sanitizeBoardSpec(
    {
      version: 1,
      columns: Math.min(4, Math.max(1, columns)),
      widgets,
    },
    role ?? 'USER'
  );
  return result.ok ? result.spec : null;
}

function normalizeBoardTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Resolve owned board by id and/or fuzzy title (owner only). */
export async function findUserBoard(
  userId: string,
  opts: { id?: string; titulo?: string }
): Promise<KpiBoardRow | null> {
  const id = String(opts.id || '').trim();
  if (id) {
    const byId = await getKpiBoard(userId, id);
    if (byId) return byId;
  }

  const titulo = String(opts.titulo || '').trim();
  if (!titulo) return null;

  const needle = normalizeBoardTitle(titulo);
  if (!needle) return null;

  const boards = await listKpiBoards(userId, { limit: 50 });
  const exact = boards.find((b) => normalizeBoardTitle(b.title) === needle);
  if (exact) return exact;

  const partial = boards.filter((b) => {
    const t = normalizeBoardTitle(b.title);
    return t.includes(needle) || needle.includes(t);
  });
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    // Prefer shortest title distance / active board
    const active = partial.find((b) => b.is_active);
    return active || partial[0];
  }
  return null;
}

export async function listKpiBoards(
  userId: string,
  opts?: { limit?: number }
): Promise<KpiBoardRow[]> {
  const { data, error } = await supabaseAdmin
    .from('ia_kpi_boards')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(opts?.limit ?? 20);

  if (error) {
    console.warn('[KpiBoard] list error:', error.message);
    return [];
  }
  return (data || []) as KpiBoardRow[];
}

export async function getKpiBoard(userId: string, boardId: string): Promise<KpiBoardRow | null> {
  const { data, error } = await supabaseAdmin
    .from('ia_kpi_boards')
    .select('*')
    .eq('user_id', userId)
    .eq('id', boardId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.warn('[KpiBoard] get error:', error.message);
    return null;
  }
  return data as KpiBoardRow | null;
}

export async function getActiveKpiBoard(userId: string): Promise<KpiBoardRow | null> {
  const { data, error } = await supabaseAdmin
    .from('ia_kpi_boards')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.warn('[KpiBoard] getActive error:', error.message);
    return null;
  }
  if (data) return data as KpiBoardRow;

  const list = await listKpiBoards(userId, { limit: 1 });
  return list[0] || null;
}

/**
 * Soft-delete owned board (`deleted_at` + `is_active=false`).
 * Only the owner (userId) can delete — ADMIN deleting others is out of scope.
 */
export async function deleteUserBoard(
  userId: string,
  boardId: string
): Promise<{ ok: true; board: KpiBoardRow } | { ok: false; error: string }> {
  const existing = await getKpiBoard(userId, boardId);
  if (!existing) return { ok: false, error: 'Quadro não encontrado' };

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('ia_kpi_boards')
    .update({
      deleted_at: now,
      is_active: false,
      updated_at: now,
    })
    .eq('id', boardId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .select()
    .maybeSingle();

  if (error) {
    console.warn('[KpiBoard] delete error:', error.message);
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: 'Quadro não encontrado' };
  return { ok: true, board: data as KpiBoardRow };
}

/** Soft-delete all owned (non-deleted) boards. */
export async function deleteAllUserBoards(
  userId: string
): Promise<{ ok: true; deleted: number; boards: { id: string; title: string }[] } | { ok: false; error: string }> {
  const boards = await listKpiBoards(userId, { limit: 100 });
  if (!boards.length) {
    return { ok: true, deleted: 0, boards: [] };
  }

  const now = new Date().toISOString();
  const ids = boards.map((b) => b.id);
  const { error } = await supabaseAdmin
    .from('ia_kpi_boards')
    .update({
      deleted_at: now,
      is_active: false,
      updated_at: now,
    })
    .eq('user_id', userId)
    .in('id', ids)
    .is('deleted_at', null);

  if (error) {
    console.warn('[KpiBoard] deleteAll error:', error.message);
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    deleted: boards.length,
    boards: boards.map((b) => ({ id: b.id, title: b.title })),
  };
}

async function clearActiveFlags(userId: string): Promise<void> {
  await supabaseAdmin
    .from('ia_kpi_boards')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_active', true);
}

export async function createKpiBoard(input: {
  userId: string;
  title: string;
  spec: unknown;
  visibility?: KpiBoardVisibility;
  setActive?: boolean;
  role?: string | null;
}): Promise<{ board: KpiBoardRow | null; error?: string }> {
  const title = (input.title || 'Quadro KPI').trim().slice(0, MAX_BOARD_TITLE);
  const role = input.role ?? 'USER';
  const sanitized = sanitizeBoardSpec(input.spec, role);
  if (!sanitized.ok) return { board: null, error: sanitized.error };

  if (normalizeKpiHarnessRole(role) !== 'ADMIN') {
    const titleProbe = assertBoardSpecAllowed(
      {
        version: 1,
        columns: 1,
        widgets: [{ id: 't', type: 'markdown', title, data: { content: title } }],
      },
      role,
      input.userId
    );
    if (!titleProbe.ok) return { board: null, error: titleProbe.error };
  }

  const setActive = input.setActive !== false;
  if (setActive) await clearActiveFlags(input.userId);

  const { data, error } = await supabaseAdmin
    .from('ia_kpi_boards')
    .insert({
      user_id: input.userId,
      title: title || 'Quadro KPI',
      spec: sanitized.spec,
      revision: 1,
      visibility: input.visibility || 'private',
      is_active: setActive,
    })
    .select()
    .single();

  if (error) {
    console.warn('[KpiBoard] create error:', error.message);
    return { board: null, error: error.message };
  }
  return { board: data as KpiBoardRow };
}

export async function updateKpiBoard(input: {
  userId: string;
  boardId: string;
  title?: string;
  spec?: unknown;
  visibility?: KpiBoardVisibility;
  setActive?: boolean;
  role?: string | null;
}): Promise<{ board: KpiBoardRow | null; error?: string }> {
  const existing = await getKpiBoard(input.userId, input.boardId);
  if (!existing) return { board: null, error: 'Quadro não encontrado' };

  const role = input.role ?? 'USER';
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    revision: (existing.revision || 1) + 1,
  };

  if (input.title !== undefined) {
    const title = String(input.title).trim().slice(0, MAX_BOARD_TITLE) || existing.title;
    if (normalizeKpiHarnessRole(role) !== 'ADMIN') {
      const titleProbe = assertBoardSpecAllowed(
        {
          version: 1,
          columns: 1,
          widgets: [{ id: 't', type: 'markdown', title, data: { content: title } }],
        },
        role,
        input.userId
      );
      if (!titleProbe.ok) return { board: null, error: titleProbe.error };
    }
    patch.title = title;
  }
  if (input.visibility) patch.visibility = input.visibility;
  if (input.spec !== undefined) {
    const sanitized = sanitizeBoardSpec(input.spec, role);
    if (!sanitized.ok) return { board: null, error: sanitized.error };
    patch.spec = sanitized.spec;
  }
  if (input.setActive) {
    await clearActiveFlags(input.userId);
    patch.is_active = true;
  }

  const { data, error } = await supabaseAdmin
    .from('ia_kpi_boards')
    .update(patch)
    .eq('id', input.boardId)
    .eq('user_id', input.userId)
    .select()
    .single();

  if (error) {
    console.warn('[KpiBoard] update error:', error.message);
    return { board: null, error: error.message };
  }
  return { board: data as KpiBoardRow };
}

export async function setActiveKpiBoard(
  userId: string,
  boardId: string
): Promise<KpiBoardRow | null> {
  const existing = await getKpiBoard(userId, boardId);
  if (!existing) return null;
  await clearActiveFlags(userId);
  const { data, error } = await supabaseAdmin
    .from('ia_kpi_boards')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', boardId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) {
    console.warn('[KpiBoard] setActive error:', error.message);
    return null;
  }
  return data as KpiBoardRow;
}

/** Persist render_dashboard layout as board (create or update active) */
export async function upsertBoardFromDashboardLayout(input: {
  userId: string;
  layout: IADashboardLayout | Record<string, unknown>;
  title?: string;
  role?: string | null;
}): Promise<KpiBoardRow | null> {
  const role = input.role ?? 'USER';
  const spec = layoutToBoardSpec(input.layout, role);
  if (!spec) return null;

  const title =
    input.title ||
    (typeof (input.layout as { title?: string }).title === 'string'
      ? (input.layout as { title?: string }).title
      : null) ||
    `Dashboard ${new Date().toLocaleDateString('pt-BR')}`;

  const active = await getActiveKpiBoard(input.userId);
  if (active && active.title.startsWith('Dashboard ')) {
    const { board } = await updateKpiBoard({
      userId: input.userId,
      boardId: active.id,
      title: title!,
      spec,
      setActive: true,
      role,
    });
    return board;
  }

  const { board } = await createKpiBoard({
    userId: input.userId,
    title: title!,
    spec,
    setActive: true,
    role,
  });
  return board;
}

export function buildOpenKpiBoardCommands(boardId: string, title?: string) {
  return [
    {
      action: 'OPEN_KPI_BOARD' as const,
      target: boardId,
      label: title ? `Abrindo quadro: ${title}` : 'Abrindo quadro KPI',
      value: { boardId },
    },
    {
      action: 'NAVIGATE' as const,
      target: '/kpi',
      label: 'Abrindo /kpi',
    },
  ];
}

/** Brief index for Companion / Chat system prompts */
export async function buildKpiBoardsPromptBlock(
  userId: string,
  role?: string | null
): Promise<string> {
  const boards = await listKpiBoards(userId, { limit: 8 });
  const harness = buildKpiHarnessPromptBlock(role);
  const caps = getKpiBoardCapabilities(role);
  const harnessRole = normalizeKpiHarnessRole(role);

  const forbid =
    harnessRole === 'ADMIN'
      ? `PROIBIDO: dump HTML fora do portal / “salve como .html”. Correto para demos/minigames: widget html_sandbox + abrir /kpi.\n`
      : `PROIBIDO: jogos, HTML/JS livre, “não consigo injetar”, dump HTML, “salve como .html”. Correto: widgets de trabalho + tools + /kpi.\n`;

  const deleteHint =
    `Excluir: \`excluir_quadro_kpi\` (id e/ou titulo fuzzy) ou \`excluir_todos_quadros_kpi\` quando o usuário pedir apagar/limpar/remover quadros. ` +
    `NUNCA diga que exclusão é indisponível. Só o dono pode excluir os próprios quadros.\n`;

  if (!boards.length) {
    return (
      `\n\n## Quadros KPI (quadro branco)\n` +
      harness +
      forbid +
      deleteHint +
      `Nenhum quadro salvo. Use \`criar_quadro_kpi\` ou \`render_dashboard\` para montar widgets (${caps.allowedWidgetTypes.join('/')}) e depois \`abrir_quadro_kpi\`.\n` +
      `dataSource só com tools allowlisted do seu papel.\n`
    );
  }

  const lines = boards.map(
    (b) =>
      `- ${b.is_active ? '[ATIVO] ' : ''}${b.title} (id=${b.id}, rev=${b.revision}, widgets=${
        Array.isArray((b.spec as KpiBoardSpec)?.widgets)
          ? (b.spec as KpiBoardSpec).widgets.length
          : '?'
      })`
  );

  return (
    `\n\n## Quadros KPI (quadro branco)\n` +
    harness +
    forbid +
    deleteHint +
    `Quadros persistidos do usuário. Use \`listar_quadros_kpi\` / \`atualizar_quadro_kpi\` / \`abrir_quadro_kpi\` / \`excluir_quadro_kpi\`.\n` +
    `Após criar/atualizar, chame \`abrir_quadro_kpi\` (ou navegar_portal kpi) para abrir /kpi.\n` +
    lines.join('\n') +
    `\n`
  );
}
