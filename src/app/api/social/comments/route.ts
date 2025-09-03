import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser } from '@/lib/auth';

// GET - Listar comentários de um post
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    
    if (authError) {
      return authError;
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('post_id');
    const parentId = searchParams.get('parent_id');
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

    let query = supabaseAdmin
      .from('social_comments')
      .select(`
        *,
        user:users_unified(
          id,
          first_name,
          last_name,
          email,
          profile_photo_url
        ),
        replies:social_comments(
          id,
          content,
          created_at,
          user:users_unified(
            id,
            first_name,
            last_name,
            profile_photo_url
          )
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    // Filtrar por comentário pai (para buscar respostas)
    if (parentId) {
      query = query.eq('parent_id', parentId);
    } else {
      // Buscar apenas comentários principais (sem pai)
      query = query.is('parent_id', null);
    }

    // Paginação
    query = query.range(offset, offset + limit - 1);

    const { data: comments, error: commentsError } = await query;

    if (commentsError) {
      console.error('Erro ao buscar comentários:', commentsError);
      return NextResponse.json({ error: 'Erro ao buscar comentários' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      comments: comments || [],
      pagination: {
        limit,
        offset,
        hasMore: comments?.length === limit
      }
    });

  } catch (error) {
    console.error('Erro ao buscar comentários:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar comentário
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    
    if (authError) {
      return authError;
    }

    const body = await request.json();
    const { post_id, content, parent_id } = body;

    if (!post_id) {
      return NextResponse.json({ error: 'ID do post é obrigatório' }, { status: 400 });
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Conteúdo do comentário é obrigatório' }, { status: 400 });
    }

    if (content.length > 500) {
      return NextResponse.json({ error: 'Comentário muito longo (máximo 500 caracteres)' }, { status: 400 });
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

    // Se é uma resposta, verificar se o comentário pai existe
    if (parent_id) {
      const { data: parentComment, error: parentError } = await supabaseAdmin
        .from('social_comments')
        .select('id, user_id')
        .eq('id', parent_id)
        .eq('post_id', post_id)
        .single();

      if (parentError || !parentComment) {
        return NextResponse.json({ error: 'Comentário pai não encontrado' }, { status: 404 });
      }
    }

    const commentData = {
      post_id: post_id,
      user_id: user?.id,
      content: content.trim(),
      parent_id: parent_id || null
    };

    const { data: comment, error: createError } = await supabaseAdmin
      .from('social_comments')
      .insert(commentData)
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
      console.error('Erro ao criar comentário:', createError);
      return NextResponse.json({ error: 'Erro ao criar comentário' }, { status: 500 });
    }

    // Criar notificação para o autor do post (se não for ele mesmo)
    if (post.user_id !== user?.id) {
      await supabaseAdmin
        .from('social_notifications')
        .insert({
          user_id: post.user_id,
          from_user_id: user?.id,
          type: 'comment',
          post_id: post_id,
          comment_id: comment.id,
          message: `${user?.first_name} ${user?.last_name} comentou em seu post`
        });
    }

    // Se é uma resposta, notificar o autor do comentário pai
    if (parent_id) {
      const { data: parentComment } = await supabaseAdmin
        .from('social_comments')
        .select('user_id')
        .eq('id', parent_id)
        .single();

      if (parentComment && parentComment.user_id !== user?.id && parentComment.user_id !== post.user_id) {
        await supabaseAdmin
          .from('social_notifications')
          .insert({
            user_id: parentComment.user_id,
            from_user_id: user?.id,
            type: 'comment',
            post_id: post_id,
            comment_id: comment.id,
            message: `${user?.first_name} ${user?.last_name} respondeu seu comentário`
          });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Comentário criado com sucesso',
      comment
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar comentário:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT - Editar comentário
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    
    if (authError) {
      return authError;
    }

    const body = await request.json();
    const { comment_id, content } = body;

    if (!comment_id) {
      return NextResponse.json({ error: 'ID do comentário é obrigatório' }, { status: 400 });
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Conteúdo do comentário é obrigatório' }, { status: 400 });
    }

    // Verificar se o comentário existe e pertence ao usuário
    const { data: existingComment, error: findError } = await supabaseAdmin
      .from('social_comments')
      .select('*')
      .eq('id', comment_id)
      .eq('user_id', user?.id)
      .single();

    if (findError || !existingComment) {
      return NextResponse.json({ error: 'Comentário não encontrado ou sem permissão' }, { status: 404 });
    }

    const { data: updatedComment, error: updateError } = await supabaseAdmin
      .from('social_comments')
      .update({
        content: content.trim(),
        is_edited: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', comment_id)
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
      console.error('Erro ao atualizar comentário:', updateError);
      return NextResponse.json({ error: 'Erro ao atualizar comentário' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Comentário atualizado com sucesso',
      comment: updatedComment
    });

  } catch (error) {
    console.error('Erro ao atualizar comentário:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Deletar comentário
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    
    if (authError) {
      return authError;
    }

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('comment_id');

    if (!commentId) {
      return NextResponse.json({ error: 'ID do comentário é obrigatório' }, { status: 400 });
    }

    // Verificar se o comentário existe e pertence ao usuário (ou se é admin)
    let query = supabaseAdmin
      .from('social_comments')
      .select('*')
      .eq('id', commentId);

    if (user?.role !== 'admin') {
      query = query.eq('user_id', user?.id);
    }

    const { data: comment, error: findError } = await query.single();

    if (findError || !comment) {
      return NextResponse.json({ error: 'Comentário não encontrado ou sem permissão' }, { status: 404 });
    }

    // Deletar comentário e suas respostas
    const { error: deleteError } = await supabaseAdmin
      .from('social_comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      console.error('Erro ao deletar comentário:', deleteError);
      return NextResponse.json({ error: 'Erro ao deletar comentário' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Comentário deletado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar comentário:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
