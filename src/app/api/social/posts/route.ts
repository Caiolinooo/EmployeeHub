import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// GET - Listar posts do feed
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    
    if (authError) {
      return authError;
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const userId = searchParams.get('user_id');
    const hashtag = searchParams.get('hashtag');

    let query = supabaseAdmin
      .from('social_posts')
      .select(`
        *,
        user:users_unified(
          id,
          first_name,
          last_name,
          email,
          profile_photo_url
        ),
        likes:social_likes(count),
        comments:social_comments(count),
        user_likes:social_likes(user_id)
      `)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    // Filtros
    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (hashtag) {
      query = query.contains('hashtags', [hashtag]);
    }

    // Paginação
    query = query.range(offset, offset + limit - 1);

    const { data: posts, error } = await query;

    if (error) {
      console.error('Erro ao buscar posts:', error);
      return NextResponse.json({ error: 'Erro ao buscar posts' }, { status: 500 });
    }

    // Processar dados para incluir contadores e status de like
    const processedPosts = posts?.map(post => ({
      ...post,
      likes_count: post.likes?.[0]?.count || 0,
      comments_count: post.comments?.[0]?.count || 0,
      user_liked: post.user_likes?.some((like: any) => like.user_id === user?.id) || false
    })) || [];

    return NextResponse.json({
      success: true,
      posts: processedPosts,
      pagination: {
        limit,
        offset,
        hasMore: posts?.length === limit
      }
    });

  } catch (error) {
    console.error('Erro na API de posts:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar novo post
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    
    if (authError) {
      return authError;
    }

    const body = await request.json();
    const { content, image_url, image_urls, hashtags, mentions, visibility } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Conteúdo é obrigatório' }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: 'Conteúdo muito longo (máximo 2000 caracteres)' }, { status: 400 });
    }

    // Processar hashtags do conteúdo
    const hashtagRegex = /#(\w+)/g;
    const contentHashtags = [];
    let match;
    while ((match = hashtagRegex.exec(content)) !== null) {
      contentHashtags.push(match[1]);
    }

    // Combinar hashtags do conteúdo com hashtags explícitas
    const allHashtags = [...new Set([...contentHashtags, ...(hashtags || [])])];

    // Processar menções do conteúdo
    const mentionRegex = /@(\w+)/g;
    const contentMentions = [];
    while ((match = mentionRegex.exec(content)) !== null) {
      // Buscar usuário por nome/email
      const { data: mentionedUser } = await supabaseAdmin
        .from('users_unified')
        .select('id')
        .or(`first_name.ilike.%${match[1]}%,last_name.ilike.%${match[1]}%,email.ilike.%${match[1]}%`)
        .limit(1)
        .single();
      
      if (mentionedUser) {
        contentMentions.push(mentionedUser.id);
      }
    }

    // Combinar menções do conteúdo com menções explícitas
    const allMentions = [...new Set([...contentMentions, ...(mentions || [])])];

    const postData = {
      user_id: user?.id,
      content: content.trim(),
      image_url: image_url || null,
      image_urls: image_urls || null,
      hashtags: allHashtags.length > 0 ? allHashtags : null,
      mentions: allMentions.length > 0 ? allMentions : null,
      visibility: visibility || 'public'
    };

    const { data: post, error: createError } = await supabaseAdmin
      .from('social_posts')
      .insert(postData)
      .select(`
        *,
        user:users_unified(
          id,
          first_name,
          last_name,
          email,
          profile_photo_url
        )
      `)
      .single();

    if (createError) {
      console.error('Erro ao criar post:', createError);
      return NextResponse.json({ error: 'Erro ao criar post' }, { status: 500 });
    }

    // Criar notificações para usuários mencionados
    if (allMentions.length > 0) {
      const notifications = allMentions.map(mentionedUserId => ({
        user_id: mentionedUserId,
        from_user_id: user?.id,
        type: 'mention',
        post_id: post.id,
        message: `${user?.first_name} ${user?.last_name} mencionou você em um post`
      }));

      await supabaseAdmin
        .from('social_notifications')
        .insert(notifications);
    }

    return NextResponse.json({
      success: true,
      message: 'Post criado com sucesso',
      post: {
        ...post,
        likes_count: 0,
        comments_count: 0,
        user_liked: false
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar post:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT - Editar post
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    
    if (authError) {
      return authError;
    }

    const body = await request.json();
    const { post_id, content, image_url, image_urls, hashtags, visibility } = body;

    if (!post_id) {
      return NextResponse.json({ error: 'ID do post é obrigatório' }, { status: 400 });
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Conteúdo é obrigatório' }, { status: 400 });
    }

    // Verificar se o post existe e pertence ao usuário
    const { data: existingPost, error: findError } = await supabaseAdmin
      .from('social_posts')
      .select('*')
      .eq('id', post_id)
      .eq('user_id', user?.id)
      .single();

    if (findError || !existingPost) {
      return NextResponse.json({ error: 'Post não encontrado ou sem permissão' }, { status: 404 });
    }

    // Processar hashtags
    const hashtagRegex = /#(\w+)/g;
    const contentHashtags = [];
    let match;
    while ((match = hashtagRegex.exec(content)) !== null) {
      contentHashtags.push(match[1]);
    }

    const allHashtags = [...new Set([...contentHashtags, ...(hashtags || [])])];

    const updateData = {
      content: content.trim(),
      image_url: image_url || null,
      image_urls: image_urls || null,
      hashtags: allHashtags.length > 0 ? allHashtags : null,
      visibility: visibility || existingPost.visibility,
      updated_at: new Date().toISOString()
    };

    const { data: updatedPost, error: updateError } = await supabaseAdmin
      .from('social_posts')
      .update(updateData)
      .eq('id', post_id)
      .select(`
        *,
        user:users_unified(
          id,
          first_name,
          last_name,
          email,
          profile_photo_url
        )
      `)
      .single();

    if (updateError) {
      console.error('Erro ao atualizar post:', updateError);
      return NextResponse.json({ error: 'Erro ao atualizar post' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Post atualizado com sucesso',
      post: updatedPost
    });

  } catch (error) {
    console.error('Erro ao atualizar post:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Deletar post
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    
    if (authError) {
      return authError;
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('post_id');

    if (!postId) {
      return NextResponse.json({ error: 'ID do post é obrigatório' }, { status: 400 });
    }

    // Verificar se o post existe e pertence ao usuário (ou se é admin)
    let query = supabaseAdmin
      .from('social_posts')
      .select('*')
      .eq('id', postId);

    if (user?.role !== 'admin') {
      query = query.eq('user_id', user?.id);
    }

    const { data: post, error: findError } = await query.single();

    if (findError || !post) {
      return NextResponse.json({ error: 'Post não encontrado ou sem permissão' }, { status: 404 });
    }

    // Arquivar ao invés de deletar
    const { error: deleteError } = await supabaseAdmin
      .from('social_posts')
      .update({ is_archived: true })
      .eq('id', postId);

    if (deleteError) {
      console.error('Erro ao deletar post:', deleteError);
      return NextResponse.json({ error: 'Erro ao deletar post' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Post deletado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar post:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
