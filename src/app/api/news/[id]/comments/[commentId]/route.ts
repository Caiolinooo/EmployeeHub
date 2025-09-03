import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const { id: newsId, commentId } = params;
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
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const { id: newsId, commentId } = params;

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

