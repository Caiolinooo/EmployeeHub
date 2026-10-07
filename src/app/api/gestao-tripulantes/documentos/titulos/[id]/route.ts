import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';
import { canEditGtDocuments } from '@/lib/gestao-tripulantes/documento-permissions';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/gestao-tripulantes/documentos/titulos/[id]  { titulo?, ordem?, ativo? }
 * DELETE — soft (ativo=false). DELETE real apenas para ADMIN.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError) return authError;
    if (!user || !(await canEditGtDocuments(user))) {
      return NextResponse.json({ error: 'Sem permissão para gerenciar títulos de documentos' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const updateData: Record<string, any> = {};
    if (body?.titulo !== undefined) {
      const titulo = String(body.titulo || '').trim();
      if (!titulo) return NextResponse.json({ error: 'titulo não pode ser vazio' }, { status: 400 });
      updateData.titulo = titulo;
    }
    if (body?.ordem !== undefined) updateData.ordem = Number(body.ordem) || 0;
    if (body?.ativo !== undefined) updateData.ativo = Boolean(body.ativo);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    }
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('gt_documento_titulos')
      .update(updateData)
      .eq('id', id)
      .select('id, tipo_documento, titulo, ativo, ordem')
      .maybeSingle();

    if (error) {
      console.error('Erro ao atualizar título:', error);
      return NextResponse.json({ error: 'Erro ao atualizar título' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Título não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erro em PUT titulos/[id]:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    if (authError) return authError;
    if (!user || !(await canEditGtDocuments(user))) {
      return NextResponse.json({ error: 'Sem permissão para gerenciar títulos de documentos' }, { status: 403 });
    }

    const { id } = await context.params;
    const isAdmin = (user.role || '').toUpperCase() === 'ADMIN';

    if (isAdmin) {
      const { error } = await supabaseAdmin.from('gt_documento_titulos').delete().eq('id', id);
      if (error) {
        console.error('Erro ao excluir título:', error);
        return NextResponse.json({ error: 'Erro ao excluir título' }, { status: 500 });
      }
    } else {
      // Soft-delete para não-ADMIN: preserva histórico e permite reativar
      const { error } = await supabaseAdmin
        .from('gt_documento_titulos')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('Erro ao desativar título:', error);
        return NextResponse.json({ error: 'Erro ao desativar título' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro em DELETE titulos/[id]:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
