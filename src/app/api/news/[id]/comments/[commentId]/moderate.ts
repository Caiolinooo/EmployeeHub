import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

// Moderation endpoint to enforce server-side permission
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') ?? undefined);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only admins/managers should have comments.moderate via ACL; here we accept ADMIN as hard guard
    if ((payload as any).role !== 'ADMIN') {
      // Optionally, we could check ACL table here for comments.moderate
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

