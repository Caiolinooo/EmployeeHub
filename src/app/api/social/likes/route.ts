import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/auth';

// POST - Curtir/Descurtir post
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    
    if (authError) {
      return authError;
    }

    const body = await request.json();
    const { post_id } = body;

    if (!post_id) {
      return NextResponse.json({ error: 'ID do post é obrigatório' }, { status: 400 });
    }

    // Verificar se o post existe
    const { data: post, error: postError } = await supabaseAdmin
      .from('social_posts')
      .select('id, user_id')
      .eq('id', post_id)
      .eq('is_archived', false)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 });
    }

    // Verificar se já curtiu
    const { data: existingLike, error: likeError } = await supabaseAdmin
      .from('social_likes')
      .select('id')
      .eq('post_id', post_id)
      .eq('user_id', user?.id)
      .single();

    if (existingLike) {
      // Descurtir - remover like
      const { error: deleteError } = await supabaseAdmin
        .from('social_likes')
        .delete()
        .eq('id', existingLike.id);

      if (deleteError) {
        console.error('Erro ao remover like:', deleteError);
        return NextResponse.json({ error: 'Erro ao remover like' }, { status: 500 });
      }

      // Buscar contagem atualizada
      const { count } = await supabaseAdmin
        .from('social_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post_id);

      return NextResponse.json({
        success: true,
        message: 'Like removido com sucesso',
        liked: false,
        likes_count: count || 0
      });

    } else {
      // Curtir - adicionar like
      const { data: newLike, error: createError } = await supabaseAdmin
        .from('social_likes')
        .insert({
          post_id: post_id,
          user_id: user?.id
        })
        .select()
        .single();

      if (createError) {
        console.error('Erro ao criar like:', createError);
        return NextResponse.json({ error: 'Erro ao curtir post' }, { status: 500 });
      }

      // Criar notificação para o autor do post (se não for ele mesmo)
      if (post.user_id !== user?.id) {
        await supabaseAdmin
          .from('social_notifications')
          .insert({
            user_id: post.user_id,
            from_user_id: user?.id,
            type: 'like',
            post_id: post_id,
            message: `${user?.first_name} ${user?.last_name} curtiu seu post`
          });
      }

      // Buscar contagem atualizada
      const { count } = await supabaseAdmin
        .from('social_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post_id);

      return NextResponse.json({
        success: true,
        message: 'Post curtido com sucesso',
        liked: true,
        likes_count: count || 0
      });
    }

  } catch (error) {
    console.error('Erro na API de likes:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// GET - Listar usuários que curtiram um post
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    
    if (authError) {
      return authError;
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('post_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!postId) {
      return NextResponse.json({ error: 'ID do post é obrigatório' }, { status: 400 });
    }

    // Verificar se o post existe
    const { data: post, error: postError } = await supabaseAdmin
      .from('social_posts')
      .select('id')
      .eq('id', postId)
      .eq('is_archived', false)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 });
    }

    // Buscar likes com informações dos usuários
    const { data: likes, error: likesError } = await supabaseAdmin
      .from('social_likes')
      .select(`
        id,
        created_at,
        user:users_unified(
          id,
          first_name,
          last_name,
          email,
          profile_photo_url
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (likesError) {
      console.error('Erro ao buscar likes:', likesError);
      return NextResponse.json({ error: 'Erro ao buscar likes' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      likes: likes || [],
      pagination: {
        limit,
        offset,
        hasMore: likes?.length === limit
      }
    });

  } catch (error) {
    console.error('Erro ao buscar likes:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
