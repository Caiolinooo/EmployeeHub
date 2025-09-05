import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateUser, canModerateContent, logAction } from '@/lib/api-auth';

// GET - Listar avaliações de um curso
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('course_id');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';

    if (!courseId) {
      return NextResponse.json({ error: 'course_id é obrigatório' }, { status: 400 });
    }

    // Buscar avaliações
    let query = supabaseAdmin
      .from('academy_ratings')
      .select(`
        *,
        user:users_unified(
          id,
          first_name,
          last_name,
          profile_data
        )
      `)
      .eq('course_id', courseId)
      .eq('is_active', true)
      .range(offset, offset + limit - 1);

    // Ordenação
    if (sortBy === 'rating') {
      query = query.order('rating', { ascending: sortOrder === 'asc' });
    } else if (sortBy === 'helpful_count') {
      query = query.order('helpful_count', { ascending: sortOrder === 'asc' });
    } else {
      query = query.order('created_at', { ascending: sortOrder === 'asc' });
    }

    const { data: ratings, error } = await query;

    if (error) {
      console.error('Erro ao buscar avaliações:', error);
      return NextResponse.json({ error: 'Erro ao buscar avaliações' }, { status: 500 });
    }

    // Buscar estatísticas do curso
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('academy_ratings')
      .select('rating')
      .eq('course_id', courseId)
      .eq('is_active', true);

    let ratingStats = {
      total_ratings: 0,
      average_rating: 0,
      rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };

    if (!statsError && stats) {
      ratingStats.total_ratings = stats.length;
      
      if (stats.length > 0) {
        const sum = stats.reduce((acc, r) => acc + r.rating, 0);
        ratingStats.average_rating = sum / stats.length;
        
        // Distribuição por estrelas
        stats.forEach(r => {
          ratingStats.rating_distribution[r.rating as keyof typeof ratingStats.rating_distribution]++;
        });
      }
    }

    return NextResponse.json({
      success: true,
      ratings: ratings || [],
      stats: ratingStats
    });

  } catch (error) {
    console.error('Erro na API de avaliações:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar nova avaliação
export async function POST(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = await authenticateUser(request);

    if (authError) {
      return authError;
    }
    if (!authUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const user = authUser as any;

    const body = await request.json();
    const { course_id, rating, review } = body;

    if (!course_id || !rating) {
      return NextResponse.json({ error: 'course_id e rating são obrigatórios' }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating deve ser entre 1 e 5' }, { status: 400 });
    }

    if (review && review.length > 2000) {
      return NextResponse.json({ error: 'Review não pode ter mais de 2000 caracteres' }, { status: 400 });
    }

    // Verificar se o curso existe e está publicado
    const { data: course, error: courseError } = await supabaseAdmin
      .from('academy_courses')
      .select('id, title, is_published')
      .eq('id', course_id)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });
    }

    if (!course.is_published) {
      return NextResponse.json({ error: 'Não é possível avaliar cursos não publicados' }, { status: 400 });
    }

    // Verificar se o usuário está matriculado no curso
    const { data: enrollment, error: enrollmentError } = await supabaseAdmin
      .from('academy_enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', course_id)
      .eq('is_active', true)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json({ error: 'Você precisa estar matriculado no curso para avaliá-lo' }, { status: 400 });
    }

    // Verificar se o usuário já avaliou este curso
    const { data: existingRating, error: existingError } = await supabaseAdmin
      .from('academy_ratings')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', course_id)
      .single();

    if (existingRating) {
      return NextResponse.json({ error: 'Você já avaliou este curso' }, { status: 400 });
    }

    // Criar avaliação
    const { data: newRating, error: createError } = await supabaseAdmin
      .from('academy_ratings')
      .insert({
        course_id,
        user_id: user.id,
        rating,
        review: review?.trim() || null,
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
      console.error('Erro ao criar avaliação:', createError);
      return NextResponse.json({ error: 'Erro ao criar avaliação' }, { status: 500 });
    }

    // Log da ação
    logAction(user, 'CREATE_RATING', 'rating', newRating.id, { 
      course_id, 
      rating,
      has_review: !!review 
    });

    console.log(`✅ Avaliação criada por ${user.first_name} ${user.last_name} no curso ${course.title} (${rating} estrelas)`);

    return NextResponse.json({
      success: true,
      message: 'Avaliação criada com sucesso',
      rating: newRating
    });

  } catch (error) {
    console.error('Erro ao criar avaliação:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT - Atualizar avaliação
export async function PUT(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = await authenticateUser(request);

    if (authError) {
      return authError;
    }
    if (!authUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const user = authUser as any;

    const body = await request.json();
    const { rating_id, rating, review, is_active } = body;

    if (!rating_id) {
      return NextResponse.json({ error: 'rating_id é obrigatório' }, { status: 400 });
    }

    // Buscar avaliação
    const { data: existingRating, error: ratingError } = await supabaseAdmin
      .from('academy_ratings')
      .select('*')
      .eq('id', rating_id)
      .single();

    if (ratingError || !existingRating) {
      return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 });
    }

    // Verificar permissões
    const canModerate = canModerateContent(user, 'rating');
    const isOwner = existingRating.user_id === user.id;

    if (!canModerate && !isOwner) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
    }

    // Preparar dados de atualização
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Apenas o dono pode editar rating e review
    if (isOwner) {
      if (rating !== undefined) {
        if (rating < 1 || rating > 5) {
          return NextResponse.json({ error: 'Rating deve ser entre 1 e 5' }, { status: 400 });
        }
        updateData.rating = rating;
      }

      if (review !== undefined) {
        if (review && review.length > 2000) {
          return NextResponse.json({ error: 'Review não pode ter mais de 2000 caracteres' }, { status: 400 });
        }
        updateData.review = review?.trim() || null;
        updateData.is_edited = true;
      }
    }

    // Moderadores podem ativar/desativar
    if (is_active !== undefined && canModerate) {
      updateData.is_active = is_active;
    }

    // Atualizar avaliação
    const { data: updatedRating, error: updateError } = await supabaseAdmin
      .from('academy_ratings')
      .update(updateData)
      .eq('id', rating_id)
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
      console.error('Erro ao atualizar avaliação:', updateError);
      return NextResponse.json({ error: 'Erro ao atualizar avaliação' }, { status: 500 });
    }

    // Log da ação
    const action = (rating !== undefined || review !== undefined) ? 'EDIT_RATING' : 'MODERATE_RATING';
    logAction(user, action, 'rating', rating_id, updateData);

    return NextResponse.json({
      success: true,
      message: 'Avaliação atualizada com sucesso',
      rating: updatedRating
    });

  } catch (error) {
    console.error('Erro ao atualizar avaliação:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Excluir avaliação
export async function DELETE(request: NextRequest) {
  try {
    const { user: authUser, error: authError } = await authenticateUser(request);

    if (authError) {
      return authError;
    }
    if (!authUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const user = authUser as any;

    const { searchParams } = new URL(request.url);
    const ratingId = searchParams.get('rating_id');

    if (!ratingId) {
      return NextResponse.json({ error: 'rating_id é obrigatório' }, { status: 400 });
    }

    // Buscar avaliação
    const { data: rating, error: ratingError } = await supabaseAdmin
      .from('academy_ratings')
      .select('*')
      .eq('id', ratingId)
      .single();

    if (ratingError || !rating) {
      return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 });
    }

    // Verificar permissões
    const canModerate = canModerateContent(user, 'rating');
    const isOwner = rating.user_id === user.id;

    if (!canModerate && !isOwner) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
    }

    // Soft delete - marcar como inativo
    const { error: deleteError } = await supabaseAdmin
      .from('academy_ratings')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', ratingId);

    if (deleteError) {
      console.error('Erro ao excluir avaliação:', deleteError);
      return NextResponse.json({ error: 'Erro ao excluir avaliação' }, { status: 500 });
    }

    // Log da ação
    logAction(user, 'DELETE_RATING', 'rating', ratingId);

    return NextResponse.json({
      success: true,
      message: 'Avaliação excluída com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir avaliação:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
