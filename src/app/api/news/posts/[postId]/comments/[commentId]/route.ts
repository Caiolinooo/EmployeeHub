import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';
import { canWithGrant } from '@/lib/permission-gate';

export const dynamic = 'force-dynamic';

/** Autor do comentário OU moderação (ADMIN/MANAGER ou grant `news.comments.moderate`). */
async function authorizeComment(request: NextRequest, postId: string, commentId: string) {
    const { user, error } = await requireAuth(request);
    if (error) return { error };

    const { data: comment } = await supabaseAdmin
        .from('news_post_comments')
        .select('user_id, parent_id')
        .eq('id', commentId)
        .eq('post_id', postId)
        .maybeSingle();

    if (!comment) {
        return { error: NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 }) };
    }
    if (comment.user_id !== user.id && !(await canWithGrant(user.id, user.role, ['news.comments.moderate']))) {
        return { error: NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 }) };
    }
    return { comment: comment as { user_id: string; parent_id: string | null } };
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
    try {
        const { postId, commentId } = await params;
        const auth = await authorizeComment(request, postId, commentId);
        if (auth.error) return auth.error;

        const body = await request.json();
        const { content } = body;

        if (!content) {
            return NextResponse.json(
                { error: 'Conteúdo é obrigatório' },
                { status: 400 }
            );
        }

        console.log(`🔄 API News Comments - Editando comentário ${commentId} do post ${postId}`);

        const { data: updatedComment, error } = await supabaseAdmin
            .from('news_post_comments')
            .update({
                content,
                edited: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', commentId)
            .eq('post_id', postId)
            .select()
            .single();

        if (error) {
            console.error('Erro ao editar comentário:', error);
            return NextResponse.json({ error: 'Erro ao editar comentário' }, { status: 500 });
        }

        return NextResponse.json(updatedComment);
    } catch (error) {
        console.error('Erro interno:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
    try {
        const { postId, commentId } = await params;
        const auth = await authorizeComment(request, postId, commentId);
        if (auth.error) return auth.error;
        const { comment } = auth;

        console.log(`🔄 API News Comments - Excluindo comentário ${commentId} do post ${postId}`);

        const { error: deleteError } = await supabaseAdmin
            .from('news_post_comments')
            .delete()
            .eq('id', commentId)
            .eq('post_id', postId);

        if (deleteError) {
            console.error('Erro ao excluir comentário:', deleteError);
            return NextResponse.json({ error: 'Erro ao excluir comentário' }, { status: 500 });
        }

        // Se for um comentário principal, diminui a contagem
        if (!comment.parent_id) {
            const { data: post } = await supabaseAdmin
                .from('news_posts')
                .select('comments_count')
                .eq('id', postId)
                .single();

            if (post && post.comments_count > 0) {
                await supabaseAdmin
                    .from('news_posts')
                    .update({ comments_count: post.comments_count - 1 })
                    .eq('id', postId);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erro interno:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
