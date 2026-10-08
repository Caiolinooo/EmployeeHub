import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { DEFAULT_TIPOS_EVENTO_ESCALA } from '@/lib/gestao-tripulantes/escala-tipos';
import { canWithGrant } from '@/lib/permission-gate';
import { GT_CONFIG_GRANT } from '@/lib/gestao-tripulantes/gt-route-auth';

export const dynamic = 'force-dynamic';

function requireAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || undefined;
  const token = extractTokenFromHeader(authHeader);
  if (!token) return { error: NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 }) };
  const payload = verifyToken(token);
  if (!payload) return { error: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) };
  return { payload };
}

async function requireAdminManager(userId: string | undefined, role: string | undefined) {
  if (!(await canWithGrant(userId, role, [GT_CONFIG_GRANT]))) {
    return NextResponse.json({ error: 'Acesso negado. Apenas ADMIN/MANAGER.' }, { status: 403 });
  }
  return null;
}

function normalizeCodigo(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '');
}

function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

/** GET — list event types (active by default; ?all=1 includes inactive). */
export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;

    const includeAll = request.nextUrl.searchParams.get('all') === '1';

    let query = supabaseAdmin
      .from('gt_tipos_evento_escala')
      .select('*')
      .order('ordem', { ascending: true });

    if (!includeAll) {
      query = query.eq('ativo', true);
    }

    const { data, error } = await query;

    if (error) {
      // Table may not exist yet — return seed defaults
      console.warn('[tipos-evento] fallback defaults:', error.message);
      return NextResponse.json({
        success: true,
        data: DEFAULT_TIPOS_EVENTO_ESCALA.map((t, i) => ({
          ...t,
          id: `default-${i}`,
        })),
        fallback: true,
      });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        data: DEFAULT_TIPOS_EVENTO_ESCALA.map((t, i) => ({
          ...t,
          id: `default-${i}`,
        })),
        fallback: true,
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('[tipos-evento GET]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — create custom event type (ADMIN/MANAGER). */
export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    const denied = await requireAdminManager(auth.payload?.userId, auth.payload?.role);
    if (denied) return denied;

    const body = await request.json();
    const codigo = normalizeCodigo(String(body.codigo || ''));
    const display_code = String(body.display_code || codigo).trim().toUpperCase().slice(0, 16);
    const label = String(body.label || '').trim();
    const bg_color = String(body.bg_color || '#e2efda').trim();
    const text_color = String(body.text_color || '#00b050').trim();
    const ordem = Number.isFinite(Number(body.ordem)) ? Number(body.ordem) : 100;
    const ativo = body.ativo !== false;
    const maps_to_db_tipo = body.maps_to_db_tipo ? String(body.maps_to_db_tipo).trim() : codigo;

    if (!codigo || codigo.length < 1) {
      return NextResponse.json({ error: 'Código inválido (use a-z, 0-9, _ ou -)' }, { status: 400 });
    }
    if (!label) {
      return NextResponse.json({ error: 'Label é obrigatório' }, { status: 400 });
    }
    if (!isValidHexColor(bg_color) || !isValidHexColor(text_color)) {
      return NextResponse.json({ error: 'Cores devem ser hex (#RGB ou #RRGGBB)' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('gt_tipos_evento_escala')
      .insert({
        codigo,
        display_code,
        label,
        bg_color,
        text_color,
        ordem,
        ativo,
        is_system: false,
        maps_to_db_tipo,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[tipos-evento POST]', error);
      if (error.code === '23505') {
        return NextResponse.json({ error: `Código "${codigo}" já existe` }, { status: 409 });
      }
      return NextResponse.json({ error: 'Erro ao criar tipo de evento' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('[tipos-evento POST]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
