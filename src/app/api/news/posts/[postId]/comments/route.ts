import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET - Listar comentários do post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    console.log(`🔄 API News Comments - Listando comentários do post ${postId}`);

    // Verificar se o post existe
    const { data: post, error: postError } = await supabaseAdmin
      .from('news_posts')
      .select('id, title')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post não encontrado' },
        { status: 404 }
      );
    }

    // Buscar comentários principais (sem parent_id)
    const offset = (page - 1) * limit;
    const { data: comments, error: commentsError } = await supabaseAdmin
      .from('news_post_comments')
      .select(`
        *,
        user:users_unified!user_id (
          id,
          first_name,
          last_name,
          email,
          role
        ),
        replies:news_post_comments!parent_id (
          *,
          user:users_unified!user_id (
            id,
            first_name,
            last_name,
            email,
            role
          )
        )
      `)
      .eq('post_id', postId)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (commentsError) {
      console.error('Erro ao buscar comentários:', commentsError);
      return NextResponse.json(
        { error: 'Erro ao buscar comentários' },
        { status: 500 }
      );
    }

    // Buscar contagem total
    const { count: totalCount } = await supabaseAdmin
      .from('news_post_comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId)
      .is('parent_id', null);

    console.log(`✅ ${comments?.length || 0} comentários carregados`);

    return NextResponse.json({
      comments: comments || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
        hasNext: page * limit < (totalCount || 0),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Erro ao listar comentários:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar novo comentário
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;
  try {
    const { postId } = await params;
    const body = await request.json();
    const { content, parent_id } = body;

    if (body.user_id && body.user_id !== user.id) {
      return NextResponse.json({ error: 'user_id diverge do usuário autenticado' }, { status: 403 });
    }

    if (!content) {
      return NextResponse.json(
        { error: 'content é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`🔄 API News Comments - Criando comentário do usuário ${user.id} no post ${postId}`);

    // Verificar se o post existe
    const { data: post, error: postError } = await supabaseAdmin
      .from('news_posts')
      .select('id, title, comments_count, author_id')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post não encontrado' },
        { status: 404 }
      );
    }

    // Se for uma resposta, verificar se o comentário pai existe
    if (parent_id) {
      const { data: parentComment, error: parentError } = await supabaseAdmin
        .from('news_post_comments')
        .select('id, post_id')
        .eq('id', parent_id)
        .eq('post_id', postId)
        .single();

      if (parentError || !parentComment) {
        return NextResponse.json(
          { error: 'Comentário pai não encontrado' },
          { status: 404 }
        );
      }
    }

    // Criar o comentário
    const commentData = {
      post_id: postId,
      user_id: user.id,
      parent_id: parent_id || null,
      content,
      edited: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newComment, error: insertError } = await supabaseAdmin
      .from('news_post_comments')
      .insert(commentData)
      .select(`
        *,
        user:users_unified!user_id (
          id,
          first_name,
          last_name,
          email,
          role
        )
      `)
      .single();

    if (insertError) {
      console.error('Erro ao criar comentário:', insertError);
      return NextResponse.json(
        { error: 'Erro ao criar comentário' },
        { status: 500 }
      );
    }

    // Atualizar contador de comentários no post (apenas para comentários principais)
    if (!parent_id) {
      const { error: updateError } = await supabaseAdmin
        .from('news_posts')
        .update({ comments_count: post.comments_count + 1 })
        .eq('id', postId);

      if (updateError) {
        console.error('Erro ao atualizar contador de comentários:', updateError);
      }
    }

    console.log(`✅ Comentário criado por ${user.first_name} no post "${post.title}"`);

    // TODO: Criar notificação para o autor do post (se não for o próprio autor)
    // TODO: Criar notificação para o autor do comentário pai (se for uma resposta)
    // TODO: Atualizar estatísticas em tempo real via WebSocket

    return NextResponse.json(newComment, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar comentário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
