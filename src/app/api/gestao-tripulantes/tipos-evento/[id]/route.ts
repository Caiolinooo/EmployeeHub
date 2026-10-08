import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';
import { GT_CONFIG_GRANT } from '@/lib/gestao-tripulantes/gt-route-auth';

export const dynamic = 'force-dynamic';

async function requireAdminManager(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || undefined;
  const token = extractTokenFromHeader(authHeader);
  if (!token) return { error: NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 }) };
  const payload = verifyToken(token);
  if (!payload) return { error: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) };
  if (!(await canWithGrant(payload.userId, payload.role, [GT_CONFIG_GRANT]))) {
    return { error: NextResponse.json({ error: 'Acesso negado. Apenas ADMIN/MANAGER.' }, { status: 403 }) };
  }
  return { payload };
}

function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

/** PUT — update type (label/colors/order/active). System codes cannot change codigo. */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminManager(request);
    if (auth.error) return auth.error;

    const { id } = await context.params;
    const body = await request.json();

    const { data: existing, error: findErr } = await supabaseAdmin
      .from('gt_tipos_evento_escala')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findErr || !existing) {
      return NextResponse.json({ error: 'Tipo de evento não encontrado' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.label !== undefined) {
      const label = String(body.label).trim();
      if (!label) return NextResponse.json({ error: 'Label não pode ser vazio' }, { status: 400 });
      updates.label = label;
    }
    if (body.display_code !== undefined) {
      updates.display_code = String(body.display_code).trim().toUpperCase().slice(0, 16);
    }
    if (body.bg_color !== undefined) {
      const bg = String(body.bg_color).trim();
      if (!isValidHexColor(bg)) return NextResponse.json({ error: 'bg_color inválida' }, { status: 400 });
      updates.bg_color = bg;
    }
    if (body.text_color !== undefined) {
      const tc = String(body.text_color).trim();
      if (!isValidHexColor(tc)) return NextResponse.json({ error: 'text_color inválida' }, { status: 400 });
      updates.text_color = tc;
    }
    if (body.ordem !== undefined) {
      updates.ordem = Number(body.ordem) || 0;
    }
    if (body.ativo !== undefined) {
      updates.ativo = Boolean(body.ativo);
    }
    if (body.maps_to_db_tipo !== undefined) {
      updates.maps_to_db_tipo = body.maps_to_db_tipo ? String(body.maps_to_db_tipo).trim() : null;
    }

    // Allow renaming codigo only for non-system types
    if (body.codigo !== undefined && !existing.is_system) {
      const codigo = String(body.codigo).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '');
      if (!codigo) return NextResponse.json({ error: 'Código inválido' }, { status: 400 });
      updates.codigo = codigo;
    }

    const { data, error } = await supabaseAdmin
      .from('gt_tipos_evento_escala')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('[tipos-evento PUT]', error);
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Código já existe' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Erro ao atualizar tipo de evento' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('[tipos-evento PUT]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE — soft-disable system types; hard-delete custom types. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminManager(request);
    if (auth.error) return auth.error;

    const { id } = await context.params;

    const { data: existing, error: findErr } = await supabaseAdmin
      .from('gt_tipos_evento_escala')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findErr || !existing) {
      return NextResponse.json({ error: 'Tipo de evento não encontrado' }, { status: 404 });
    }

    if (existing.is_system) {
      const { data, error } = await supabaseAdmin
        .from('gt_tipos_evento_escala')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ error: 'Erro ao desativar tipo de sistema' }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        data,
        message: 'Tipo de sistema desativado (soft-delete).',
      });
    }

    const { error } = await supabaseAdmin
      .from('gt_tipos_evento_escala')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[tipos-evento DELETE]', error);
      return NextResponse.json({ error: 'Erro ao excluir tipo de evento' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Tipo de evento removido.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('[tipos-evento DELETE]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
