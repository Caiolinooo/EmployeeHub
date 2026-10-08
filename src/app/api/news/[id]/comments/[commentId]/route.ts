import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { canWithGrant } from '@/lib/permission-gate';

export const dynamic = 'force-dynamic';

/** Autor do comentário OU moderação (ADMIN/MANAGER ou grant `news.comments.moderate`). */
async function authorizeComment(request: NextRequest, newsId: string, commentId: string): Promise<NextResponse | null> {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const { data: comment } = await supabaseAdmin
    .from('news_comments')
    .select('user_id')
    .eq('id', commentId)
    .eq('news_id', newsId)
    .maybeSingle();

  if (!comment) return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
  if (comment.user_id !== user.id && !(await canWithGrant(user.id, user.role, ['news.comments.moderate']))) {
    return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
  }
  return null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id: newsId, commentId } = await params;
    const denied = await authorizeComment(request, newsId, commentId);
    if (denied) return denied;

    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Conteúdo é obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('news_comments')
      .update({ content: content.trim(), edited: true, updated_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('news_id', newsId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Erro ao atualizar comentário' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Erro ao editar comentário:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id: newsId, commentId } = await params;
    const denied = await authorizeComment(request, newsId, commentId);
    if (denied) return denied;

    const { error } = await supabaseAdmin
      .from('news_comments')
      .delete()
      .eq('id', commentId)
      .eq('news_id', newsId);

    if (error) {
      return NextResponse.json({ error: 'Erro ao excluir comentário' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir comentário:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
