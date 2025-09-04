import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const tokenHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(tokenHeader);
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // TODO: Integrate ACL check for 'comments.moderate'. For now, allow ADMIN or GERENTE.
    const role = (payload as any).role?.toLowerCase?.() || '';
    if (!(role === 'admin' || role === 'gerente')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
    console.error('Erro ao moderar comentário:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

