/**
 * API: /api/ia/knowledge-base
 * CRUD para a base de conhecimento da IA
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestToken } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
import {
  listAllKnowledge,
  addKnowledge,
  updateKnowledge,
  deactivateKnowledge,
  deleteKnowledge,
  searchKnowledge,
  getKBStats,
} from '@/lib/ia/knowledge-base';

/**
 * GET — Listar entradas + stats
 */
export async function GET(request: NextRequest) {
  try {
    const tokenResult = verifyRequestToken(request);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const userId = tokenResult.payload.userId;
    const { data: profile } = await supabaseAdmin.from('users_unified').select('role').eq('id', userId).single();
    const userRole = profile?.role || 'USER';

    const url = request.nextUrl;
    const action = url.searchParams.get('action') || 'list';
    const scope = url.searchParams.get('scope') || undefined;
    const category = url.searchParams.get('category') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    if (action === 'stats') {
      const stats = await getKBStats();
      return NextResponse.json({ stats });
    }

    if (action === 'search' && search) {
      const results = await searchKnowledge(search, {
        userId,
        userRole,
        limit,
      });
      return NextResponse.json({ entries: results, total: results.length });
    }

    // Admin pode ver tudo, outros veem apenas entradas acessíveis
    if (userRole === 'ADMIN') {
      const result = await listAllKnowledge({ scope, category, limit, offset });
      return NextResponse.json(result);
    }

    // Não-admin: retornar apenas entradas que o usuário pode ver
    const result = await listAllKnowledge({ scope, category, limit, offset, isActive: true });
    const filtered = result.entries.filter(entry => {
      if (entry.access_level === 'all') return true;
      if (entry.allowed_roles?.length > 0 && !entry.allowed_roles.includes(userRole)) return false;
      if (entry.scope === 'user' && entry.scope_id !== userId) return false;
      return true;
    });

    return NextResponse.json({ entries: filtered, total: filtered.length });
  } catch (err) {
    console.error('[KB API] GET Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * POST — Criar nova entrada
 */
export async function POST(request: NextRequest) {
  try {
    const tokenResult = verifyRequestToken(request);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const userId = tokenResult.payload.userId;
    const { data: profile } = await supabaseAdmin.from('users_unified').select('role').eq('id', userId).single();
    const userRole = profile?.role || 'USER';

    // Verificar permissão para escrita
    if (
      !['ADMIN', 'GERENTE'].includes(userRole) &&
      !(await canWithGrant(userId, userRole, ['ia-assistant.knowledge.manage'], 'none'))
    ) {
      return NextResponse.json({ error: 'Sem permissão para criar entradas' }, { status: 403 });
    }

    const body = await request.json();
    const entry = await addKnowledge(body, userId);

    if (!entry) {
      return NextResponse.json({ error: 'Erro ao criar entrada' }, { status: 500 });
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    console.error('[KB API] POST Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * PUT — Atualizar entrada
 */
export async function PUT(request: NextRequest) {
  try {
    const tokenResult = verifyRequestToken(request);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const userId = tokenResult.payload.userId;
    const { data: profile } = await supabaseAdmin.from('users_unified').select('role').eq('id', userId).single();
    const userRole = profile?.role || 'USER';

    if (
      !['ADMIN', 'GERENTE'].includes(userRole) &&
      !(await canWithGrant(userId, userRole, ['ia-assistant.knowledge.manage'], 'none'))
    ) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    const success = await updateKnowledge(id, updates, userId);
    return NextResponse.json({ success });
  } catch (err) {
    console.error('[KB API] PUT Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * DELETE — Remover entrada
 */
export async function DELETE(request: NextRequest) {
  try {
    const tokenResult = verifyRequestToken(request);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const userId = tokenResult.payload.userId;
    const { data: profile } = await supabaseAdmin.from('users_unified').select('role').eq('id', userId).single();
    const userRole = profile?.role || 'USER';

    if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Apenas ADMIN pode deletar' }, { status: 403 });
    }

    const { id, permanent } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    const success = permanent ? await deleteKnowledge(id) : await deactivateKnowledge(id);
    return NextResponse.json({ success });
  } catch (err) {
    console.error('[KB API] DELETE Error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
