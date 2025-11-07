import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAcademyAuth } from '@/lib/middleware/academy-auth';

export const dynamic = 'force-dynamic';

// GET - Listar matrículas do usuário ou todas (para admins)
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await withAcademyAuth(request, { requireAuth: true });
    
    if (authError) {
      return authError;
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('course_id');
    const userId = searchParams.get('user_id');
    const status = searchParams.get('status'); // active, completed, all
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabaseAdmin
      .from('academy_enrollments')
      .select(`
        *,
        course:academy_courses(
          id,
          title,
          description,
          short_description,
          thumbnail_url,
          duration,
          difficulty_level,
          category:academy_categories(
            id,
            name,
            color,
            icon
          ),
          instructor:users_unified(
            id,
            first_name,
            last_name
          )
        ),
        user:users_unified(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .order('enrolled_at', { ascending: false });

    // Filtros
    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    // Se não for admin, só pode ver suas próprias matrículas
    if (!user?.canEditAcademy) {
      query = query.eq('user_id', user?.id);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }

    // Filtro por status
    if (status === 'completed') {
      query = query.not('completed_at', 'is', null);
    } else if (status === 'active') {
      query = query.is('completed_at', null).eq('is_active', true);
    } else if (status !== 'all') {
      query = query.eq('is_active', true);
    }

    // Paginação
    query = query.range(offset, offset + limit - 1);

    const { data: enrollments, error } = await query;

    if (error) {
      console.error('Erro ao buscar matrículas:', error);
      return NextResponse.json({ error: 'Erro ao buscar matrículas' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      enrollments: enrollments || []
    });

  } catch (error) {
    console.error('Erro na API de matrículas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar nova matrícula
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await withAcademyAuth(request, { requireAuth: true });
    
    if (authError) {
      return authError;
    }

    const body = await request.json();
    const { course_id, user_id } = body;

    if (!course_id) {
      return NextResponse.json({ error: 'ID do curso é obrigatório' }, { status: 400 });
    }

    // Se não for admin, só pode matricular a si mesmo
    const targetUserId = user?.canEditAcademy && user_id ? user_id : user?.id;

    // Verificar se o curso existe e está publicado
    const { data: course, error: courseError } = await supabaseAdmin
      .from('academy_courses')
      .select('id, title, is_published')
      .eq('id', course_id)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });
    }

    if (!course.is_published && !user?.canEditAcademy) {
      return NextResponse.json({ error: 'Curso não está disponível para matrícula' }, { status: 403 });
    }

    // Verificar se já existe matrícula
    const { data: existingEnrollment, error: checkError } = await supabaseAdmin
      .from('academy_enrollments')
      .select('id, is_active')
      .eq('user_id', targetUserId)
      .eq('course_id', course_id)
      .single();

    if (existingEnrollment) {
      if (existingEnrollment.is_active) {
        return NextResponse.json({ error: 'Usuário já está matriculado neste curso' }, { status: 409 });
      } else {
        // Reativar matrícula existente
        const { data: reactivated, error: reactivateError } = await supabaseAdmin
          .from('academy_enrollments')
          .update({ is_active: true, enrolled_at: new Date().toISOString() })
          .eq('id', existingEnrollment.id)
          .select()
          .single();

        if (reactivateError) {
          console.error('Erro ao reativar matrícula:', reactivateError);
          return NextResponse.json({ error: 'Erro ao reativar matrícula' }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: 'Matrícula reativada com sucesso',
          enrollment: reactivated
        });
      }
    }

    // Criar nova matrícula
    const enrollmentData = {
      user_id: targetUserId,
      course_id: course_id,
      enrolled_at: new Date().toISOString(),
      is_active: true
    };

    const { data: enrollment, error: createError } = await supabaseAdmin
      .from('academy_enrollments')
      .insert(enrollmentData)
      .select(`
        *,
        course:academy_courses(
          id,
          title,
          description,
          thumbnail_url,
          duration,
          difficulty_level
        )
      `)
      .single();

    if (createError) {
      console.error('Erro ao criar matrícula:', createError);
      return NextResponse.json({ error: 'Erro ao criar matrícula' }, { status: 500 });
    }

    // Criar registro de progresso inicial
    const progressData = {
      user_id: targetUserId,
      course_id: course_id,
      enrollment_id: enrollment.id,
      progress_percentage: 0,
      time_watched: 0,
      last_position: 0,
      completed: false
    };

    const { error: progressError } = await supabaseAdmin
      .from('academy_progress')
      .insert(progressData);

    if (progressError) {
      console.warn('Erro ao criar progresso inicial:', progressError);
      // Não falhar a matrícula por causa do progresso
    }

    return NextResponse.json({
      success: true,
      message: 'Matrícula realizada com sucesso',
      enrollment
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar matrícula:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Cancelar matrícula
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await withAcademyAuth(request, { requireAuth: true });
    
    if (authError) {
      return authError;
    }

    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollment_id');
    const courseId = searchParams.get('course_id');
    const userId = searchParams.get('user_id');

    if (!enrollmentId && (!courseId || !userId)) {
      return NextResponse.json({ 
        error: 'ID da matrícula ou combinação curso_id + user_id é obrigatória' 
      }, { status: 400 });
    }

    let query: any = supabaseAdmin.from('academy_enrollments');

    if (enrollmentId) {
      query = query.eq('id', enrollmentId);
    } else {
      query = query.eq('course_id', courseId).eq('user_id', userId);
    }

    // Se não for admin, só pode cancelar suas próprias matrículas
    if (!user?.canEditAcademy) {
      query = query.eq('user_id', user?.id);
    }

    const { data: enrollment, error: findError } = await query.select('*').single();

    if (findError || !enrollment) {
      return NextResponse.json({ error: 'Matrícula não encontrada' }, { status: 404 });
    }

    // Desativar matrícula ao invés de deletar
    const { error: updateError } = await supabaseAdmin
      .from('academy_enrollments')
      .update({ is_active: false })
      .eq('id', enrollment.id);

    if (updateError) {
      console.error('Erro ao cancelar matrícula:', updateError);
      return NextResponse.json({ error: 'Erro ao cancelar matrícula' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Matrícula cancelada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao cancelar matrícula:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
