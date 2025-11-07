import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST - Curtir/Descurtir post
export async function POST(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const postId = params.postId;
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`🔄 API News Like - Processando like do usuário ${user_id} no post ${postId}`);

    // Verificar se o post existe
    const { data: post, error: postError } = await supabaseAdmin
      .from('news_posts')
      .select('id, title, likes_count')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o usuário existe
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se já existe um like
    const { data: existingLike, error: likeCheckError } = await supabaseAdmin
      .from('news_post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user_id)
      .single();

    let isLiked = false;
    let newLikesCount = post.likes_count;

    if (existingLike) {
      // Remover like (descurtir)
      const { error: deleteError } = await supabaseAdmin
        .from('news_post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user_id);

      if (deleteError) {
        console.error('Erro ao remover like:', deleteError);
        return NextResponse.json(
          { error: 'Erro ao remover like' },
          { status: 500 }
        );
      }

      newLikesCount = Math.max(0, post.likes_count - 1);
      isLiked = false;
      console.log(`👎 Like removido do post "${post.title}" pelo usuário ${user.first_name}`);

    } else {
      // Adicionar like (curtir)
      const { error: insertError } = await supabaseAdmin
        .from('news_post_likes')
        .insert({
          post_id: postId,
          user_id: user_id,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Erro ao adicionar like:', insertError);
        return NextResponse.json(
          { error: 'Erro ao adicionar like' },
          { status: 500 }
        );
      }

      newLikesCount = post.likes_count + 1;
      isLiked = true;
      console.log(`👍 Like adicionado ao post "${post.title}" pelo usuário ${user.first_name}`);
    }

    // Atualizar contador de likes no post
    const { error: updateError } = await supabaseAdmin
      .from('news_posts')
      .update({ likes_count: newLikesCount })
      .eq('id', postId);

    if (updateError) {
      console.error('Erro ao atualizar contador de likes:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar contador de likes' },
        { status: 500 }
      );
    }

    // TODO: Criar notificação para o autor do post (se não for o próprio autor)
    // TODO: Atualizar estatísticas em tempo real via WebSocket

    return NextResponse.json({
      success: true,
      isLiked,
      likesCount: newLikesCount,
      message: isLiked ? 'Post curtido com sucesso' : 'Like removido com sucesso'
    });

  } catch (error) {
    console.error('Erro ao processar like:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// GET - Verificar se usuário curtiu o post e obter lista de likes
export async function GET(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const postId = params.postId;
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const include_users = searchParams.get('include_users') === 'true';

    console.log(`🔄 API News Like - Verificando likes do post ${postId}`);

    // Verificar se o post existe
    const { data: post, error: postError } = await supabaseAdmin
      .from('news_posts')
      .select('id, likes_count')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post não encontrado' },
        { status: 404 }
      );
    }

    const result: any = {
      likesCount: post.likes_count,
      isLiked: false
    };

    // Verificar se o usuário específico curtiu (se user_id fornecido)
    if (user_id) {
      const { data: userLike } = await supabaseAdmin
        .from('news_post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user_id)
        .single();

      result.isLiked = !!userLike;
    }

    // Incluir lista de usuários que curtiram (se solicitado)
    if (include_users) {
      const { data: likes, error: likesError } = await supabaseAdmin
        .from('news_post_likes')
        .select(`
          id,
          created_at,
          user:users_unified!user_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (!likesError) {
        result.likes = likes || [];
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Erro ao verificar likes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
