/**
 * API: /api/ia/kpi-boards
 * GET  — list boards (or ?active=1 / ?id=uuid with resolve)
 * POST — create board
 * PATCH — update / set active
 * DELETE — soft-delete owned board (?id=uuid)
 * Spec create/update enforced by role harness (html_sandbox ADMIN-only).
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestToken } from '@/lib/auth';
import {
  createKpiBoard,
  deleteAllUserBoards,
  deleteUserBoard,
  getActiveKpiBoard,
  getKpiBoard,
  listKpiBoards,
  setActiveKpiBoard,
  updateKpiBoard,
  type KpiBoardSpec,
} from '@/lib/ia/kpi-board';
import { getKpiBoardCapabilities } from '@/lib/ia/kpi-board-harness';
import {
  adaptToolResultToWidget,
  isEmptyWidgetData,
  normalizeWidgetData,
} from '@/lib/ia/kpi-board-shared';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function resolveWidgetData(
  spec: KpiBoardSpec,
  userId: string,
  userRole: string
): Promise<KpiBoardSpec> {
  const { executeToolCall } = await import('@/lib/ia/tools');
  const caps = getKpiBoardCapabilities(userRole);
  const allowedTools = new Set(caps.allowedDataTools as readonly string[]);
  const widgets = [];

  for (const w of spec.widgets) {
    if (w.type === 'html_sandbox') {
      // Never resolve dataSources into sandbox; strip if smuggled
      widgets.push({ ...w, dataSource: undefined });
      continue;
    }
    if (!w.dataSource) {
      // Still normalize static LLM snapshots so blank label/value shapes paint
      widgets.push({
        ...w,
        data: normalizeWidgetData(w.type, w.data),
      });
      continue;
    }
    const tool = w.dataSource.tool;
    if (!allowedTools.has(tool)) {
      widgets.push({
        ...w,
        data: w.data ?? { error: `dataSource bloqueado pelo harness (${tool})` },
      });
      continue;
    }
    try {
      const raw = await executeToolCall(tool, w.dataSource.args || {}, userRole, userId);
      let parsed: unknown = raw;
      try {
        parsed = JSON.parse(raw);
      } catch {
        /* keep string */
      }
      const adapted = adaptToolResultToWidget(w.type, parsed, {
        path: w.dataSource.path,
        widgetTitle: w.title,
      });
      // Prefer live tool result; only keep snapshot if it already has paint-able data
      // AND adapted came back empty (tool env failure) — then show snapshot or error.
      const adaptedEmpty = isEmptyWidgetData(w.type, adapted);
      const snapshotUseful = !isEmptyWidgetData(w.type, w.data);
      let data: unknown;
      if (w.type === 'markdown') {
        data = adapted;
      } else if (!adaptedEmpty) {
        data = adapted;
      } else if (snapshotUseful) {
        data = w.data;
      } else {
        data = adapted;
      }
      widgets.push({ ...w, data });
    } catch (err) {
      widgets.push({
        ...w,
        data: !isEmptyWidgetData(w.type, w.data)
          ? w.data
          : {
              error: err instanceof Error ? err.message : 'Falha ao resolver dataSource',
            },
      });
    }
  }

  return { ...spec, widgets };
}

export async function GET(request: NextRequest) {
  try {
    const tokenResult = verifyRequestToken(request);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const userId = tokenResult.payload.userId as string;
    const role = String(tokenResult.payload.role || 'USER');
    const id = request.nextUrl.searchParams.get('id');
    const active = request.nextUrl.searchParams.get('active') === '1';
    const resolve = request.nextUrl.searchParams.get('resolve') !== '0';

    let board = null;
    if (id) {
      board = await getKpiBoard(userId, id);
    } else if (active) {
      board = await getActiveKpiBoard(userId);
    } else {
      const boards = await listKpiBoards(userId, { limit: 30 });
      return NextResponse.json({ success: true, boards });
    }

    if (!board) {
      return NextResponse.json({ error: 'Quadro não encontrado' }, { status: 404 });
    }

    let spec = board.spec as KpiBoardSpec;
    // Defense: never surface html_sandbox to non-admin even if smuggled into JSONB
    const caps = getKpiBoardCapabilities(role);
    if (!caps.allowHtmlSandbox) {
      spec = {
        ...spec,
        widgets: (spec.widgets || []).filter((w) => w.type !== 'html_sandbox'),
      };
    }
    if (resolve) {
      spec = await resolveWidgetData(spec, userId, role);
    }

    return NextResponse.json({
      success: true,
      board: { ...board, spec },
    });
  } catch (err) {
    console.error('[API KPI Boards GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tokenResult = verifyRequestToken(request);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const userId = tokenResult.payload.userId as string;
    const role = String(tokenResult.payload.role || 'USER');
    const body = await request.json();
    const { board, error } = await createKpiBoard({
      userId,
      title: body.title || 'Quadro KPI',
      spec: body.spec,
      visibility: body.visibility,
      setActive: body.setActive !== false,
      role,
    });
    if (!board) {
      return NextResponse.json({ error: error || 'Falha ao criar' }, { status: 400 });
    }
    return NextResponse.json({ success: true, board });
  } catch (err) {
    console.error('[API KPI Boards POST]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const tokenResult = verifyRequestToken(request);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const userId = tokenResult.payload.userId as string;
    const role = String(tokenResult.payload.role || 'USER');
    const body = await request.json();
    const boardId = String(body.id || body.boardId || '');
    if (!boardId) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    if (body.setActive && body.spec === undefined && body.title === undefined) {
      const board = await setActiveKpiBoard(userId, boardId);
      if (!board) return NextResponse.json({ error: 'Quadro não encontrado' }, { status: 404 });
      return NextResponse.json({ success: true, board });
    }

    const { board, error } = await updateKpiBoard({
      userId,
      boardId,
      title: body.title,
      spec: body.spec,
      visibility: body.visibility,
      setActive: body.setActive,
      role,
    });
    if (!board) {
      return NextResponse.json({ error: error || 'Falha ao atualizar' }, { status: 400 });
    }
    return NextResponse.json({ success: true, board });
  } catch (err) {
    console.error('[API KPI Boards PATCH]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const tokenResult = verifyRequestToken(request);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const userId = tokenResult.payload.userId as string;
    const all = request.nextUrl.searchParams.get('all') === '1';
    const id =
      request.nextUrl.searchParams.get('id') ||
      request.nextUrl.searchParams.get('boardId') ||
      '';

    if (all) {
      const result = await deleteAllUserBoards(userId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        deleted: result.deleted,
        boards: result.boards,
      });
    }

    if (!id.trim()) {
      return NextResponse.json({ error: 'id obrigatório (ou all=1)' }, { status: 400 });
    }

    const result = await deleteUserBoard(userId, id.trim());
    if (!result.ok) {
      const status = result.error === 'Quadro não encontrado' ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({
      success: true,
      deleted: { id: result.board.id, title: result.board.title },
    });
  } catch (err) {
    console.error('[API KPI Boards DELETE]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
