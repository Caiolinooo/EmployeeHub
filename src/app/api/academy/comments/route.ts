import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser, canModerateContent, logAction } from '@/lib/api-auth';

// GET - Listar comentários de um curso
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('course_id');
    const parentId = searchParams.get('parent_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!courseId) {
      return NextResponse.json({ error: 'course_id é obrigatório' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('academy_comments')
      .select(`
        *,
        user:users_unified(
          id,
          first_name,
          last_name,
          profile_data
        ),
        replies:academy_comments!parent_id(
          *,
          user:users_unified(
            id,
            first_name,
            last_name,
            profile_data
          )
        )
      `)
      .eq('course_id', courseId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Se parent_id for fornecido, buscar apenas respostas
    if (parentId) {
      query = query.eq('parent_id', parentId);
    } else {
      // Buscar apenas comentários principais (sem parent_id)
      query = query.is('parent_id', null);
    }

    const { data: comments, error } = await query;

    if (error) {
      console.error('Erro ao buscar comentários:', error);
      return NextResponse.json({ error: 'Erro ao buscar comentários' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      comments: comments || []
    });

  } catch (error) {
    console.error('Erro na API de comentários:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar novo comentário
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    
    if (authError) {
      return authError;
    }

    const body = await request.json();
    const { course_id, content, parent_id } = body;

    if (!course_id || !content) {
      return NextResponse.json({ error: 'course_id e content são obrigatórios' }, { status: 400 });
    }

    if (content.trim().length < 3) {
      return NextResponse.json({ error: 'Comentário deve ter pelo menos 3 caracteres' }, { status: 400 });
    }

    if (content.length > 1000) {
      return NextResponse.json({ error: 'Comentário não pode ter mais de 1000 caracteres' }, { status: 400 });
    }

    // Verificar se o curso existe
    const { data: course, error: courseError } = await supabaseAdmin
      .from('academy_courses')
      .select('id, title, is_published')
      .eq('id', course_id)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });
    }

    if (!course.is_published) {
      return NextResponse.json({ error: 'Não é possível comentar em cursos não publicados' }, { status: 400 });
    }

    // Se for uma resposta, verificar se o comentário pai existe
    if (parent_id) {
      const { data: parentComment, error: parentError } = await supabaseAdmin
        .from('academy_comments')
        .select('id, course_id')
        .eq('id', parent_id)
        .eq('is_active', true)
        .single();

      if (parentError || !parentComment) {
        return NextResponse.json({ error: 'Comentário pai não encontrado' }, { status: 404 });
      }

      if (parentComment.course_id !== course_id) {
        return NextResponse.json({ error: 'Comentário pai não pertence ao mesmo curso' }, { status: 400 });
      }
    }

    // Criar comentário
    const { data: comment, error: createError } = await supabaseAdmin
      .from('academy_comments')
      .insert({
        course_id,
        user_id: user.id,
        content: content.trim(),
        parent_id: parent_id || null,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        user:users_unified(
          id,
          first_name,
          last_name,
          profile_data
        )
      `)
      .single();

    if (createError) {
      console.error('Erro ao criar comentário:', createError);
      return NextResponse.json({ error: 'Erro ao criar comentário' }, { status: 500 });
    }

    // Log da ação
    logAction(user, 'CREATE_COMMENT', 'comment', comment.id, { 
      course_id, 
      parent_id,
      content_length: content.length 
    });

    console.log(`✅ Comentário criado por ${user.first_name} ${user.last_name} no curso ${course.title}`);

    return NextResponse.json({
      success: true,
      message: 'Comentário criado com sucesso',
      comment
    });

  } catch (error) {
    console.error('Erro ao criar comentário:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT - Atualizar comentário
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    
    if (authError) {
      return authError;
    }

    const body = await request.json();
    const { comment_id, content, is_active } = body;

    if (!comment_id) {
      return NextResponse.json({ error: 'comment_id é obrigatório' }, { status: 400 });
    }

    // Buscar comentário
    const { data: comment, error: commentError } = await supabaseAdmin
      .from('academy_comments')
      .select('*')
      .eq('id', comment_id)
      .single();

    if (commentError || !comment) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }

    // Verificar permissões
    const canModerate = canModerateContent(user, 'comment');
    const isOwner = comment.user_id === user.id;

    if (!canModerate && !isOwner) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
    }

    // Preparar dados de atualização
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Apenas o dono pode editar o conteúdo
    if (content !== undefined && isOwner) {
      if (content.trim().length < 3) {
        return NextResponse.json({ error: 'Comentário deve ter pelo menos 3 caracteres' }, { status: 400 });
      }
      if (content.length > 1000) {
        return NextResponse.json({ error: 'Comentário não pode ter mais de 1000 caracteres' }, { status: 400 });
      }
      updateData.content = content.trim();
      updateData.is_edited = true;
    }

    // Moderadores podem ativar/desativar
    if (is_active !== undefined && canModerate) {
      updateData.is_active = is_active;
    }

    // Atualizar comentário
    const { data: updatedComment, error: updateError } = await supabaseAdmin
      .from('academy_comments')
      .update(updateData)
      .eq('id', comment_id)
      .select(`
        *,
        user:users_unified(
          id,
          first_name,
          last_name,
          profile_data
        )
      `)
      .single();

    if (updateError) {
      console.error('Erro ao atualizar comentário:', updateError);
      return NextResponse.json({ error: 'Erro ao atualizar comentário' }, { status: 500 });
    }

    // Log da ação
    const action = content !== undefined ? 'EDIT_COMMENT' : 'MODERATE_COMMENT';
    logAction(user, action, 'comment', comment_id, updateData);

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

// DELETE - Excluir comentário
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateUser(request);
    
    if (authError) {
      return authError;
    }

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('comment_id');

    if (!commentId) {
      return NextResponse.json({ error: 'comment_id é obrigatório' }, { status: 400 });
    }

    // Buscar comentário
    const { data: comment, error: commentError } = await supabaseAdmin
      .from('academy_comments')
      .select('*')
      .eq('id', commentId)
      .single();

    if (commentError || !comment) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }

    // Verificar permissões
    const canModerate = canModerateContent(user, 'comment');
    const isOwner = comment.user_id === user.id;

    if (!canModerate && !isOwner) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
    }

    // Soft delete - marcar como inativo
    const { error: deleteError } = await supabaseAdmin
      .from('academy_comments')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId);

    if (deleteError) {
      console.error('Erro ao excluir comentário:', deleteError);
      return NextResponse.json({ error: 'Erro ao excluir comentário' }, { status: 500 });
    }

    // Também desativar respostas se for um comentário pai
    if (!comment.parent_id) {
      await supabaseAdmin
        .from('academy_comments')
        .update({
          is_active: false,
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('parent_id', commentId);
    }

    // Log da ação
    logAction(user, 'DELETE_COMMENT', 'comment', commentId);

    return NextResponse.json({
      success: true,
      message: 'Comentário excluído com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir comentário:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
