import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { canEditAcademy } from '@/lib/permissions';
import { notifyNewCourse } from '@/app/api/academy/notifications/route';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

// GET - Listar cursos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');
    const published = searchParams.get('published');
    const featured = searchParams.get('featured');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabaseAdmin
      .from('academy_courses')
      .select(`
        *,
        category:academy_categories(id, name, color, icon),
        instructor:users_unified(id, first_name, last_name, email)
      `)
      .order('created_at', { ascending: false });

    // Filtros
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (published === 'true') {
      query = query.eq('is_published', true);
    } else if (published === 'false') {
      query = query.eq('is_published', false);
    }

    if (featured === 'true') {
      query = query.eq('is_featured', true);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Paginação
    query = query.range(offset, offset + limit - 1);

    const { data: courses, error } = await query;

    if (error) {
      console.error('Erro ao buscar cursos:', error);
      return NextResponse.json({ error: 'Erro ao buscar cursos' }, { status: 500 });
    }

    // Buscar estatísticas de cada curso
    const coursesWithStats = await Promise.all(
      (courses || []).map(async (course) => {
        // Contar matrículas
        const { count: enrollmentCount } = await supabaseAdmin
          .from('academy_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id)
          .eq('is_active', true);

        // Contar avaliações e calcular média
        const { data: ratings } = await supabaseAdmin
          .from('academy_ratings')
          .select('rating')
          .eq('course_id', course.id)
          .eq('is_approved', true);

        const averageRating = ratings && ratings.length > 0
          ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
          : 0;

        return {
          ...course,
          stats: {
            enrollments: enrollmentCount || 0,
            ratings_count: ratings?.length || 0,
            average_rating: Math.round(averageRating * 10) / 10
          }
        };
      })
    );

    return NextResponse.json({
      success: true,
      courses: coursesWithStats,
      pagination: {
        limit,
        offset,
        total: coursesWithStats.length
      }
    });

  } catch (error) {
    console.error('Erro na API de cursos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar novo curso
export async function POST(request: NextRequest) {
  try {
    // Verificar autorização (suporta JWT personalizado e token do Supabase)
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    // Tentar verificar como JWT personalizado primeiro
    let resolvedUserId: string | null = null;
    const payload = verifyToken(token);
    if (payload && (payload.userId || (payload as any).sub)) {
      resolvedUserId = (payload.userId as string) || ((payload as any).sub as string);
    } else {
      // Fallback: tentar como token do Supabase
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (!authError && user) {
        resolvedUserId = user.id;
      }
    }

    if (!resolvedUserId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Buscar dados do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('id', resolvedUserId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Verificar permissões
    if (!canEditAcademy(userData)) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      description,
      short_description,
      video_url,
      thumbnail_url,
      duration,
      category_id,
      difficulty_level,
      tags,
      prerequisites,
      learning_objectives,
      is_published,
      is_featured
    } = body;

    if (!title || !description) {
      return NextResponse.json({ error: 'Título e descrição são obrigatórios' }, { status: 400 });
    }

    // Criar curso
    const { data: course, error: createError } = await supabaseAdmin
      .from('academy_courses')
      .insert({
        title,
        description,
        short_description,
        video_url,
        thumbnail_url,
        duration: duration || 0,
        category_id: category_id || null,
        instructor_id: resolvedUserId,
        difficulty_level: difficulty_level || 'beginner',
        tags: tags || [],
        prerequisites: prerequisites || [],
        learning_objectives: learning_objectives || [],
        is_published: is_published || false,
        is_featured: is_featured || false,
        sort_order: 0,
        view_count: 0
      })
      .select(`
        *,
        category:academy_categories(id, name, color, icon),
        instructor:users_unified(id, first_name, last_name, email)
      `)
      .single();

    if (createError) {
      console.error('Erro ao criar curso:', createError);
      return NextResponse.json({ error: 'Erro ao criar curso' }, { status: 500 });
    }

    console.log(`✅ Curso criado: ${title} por ${userData.first_name} ${userData.last_name}`);

    return NextResponse.json({
      success: true,
      message: 'Curso criado com sucesso',
      course
    });

  } catch (error) {
    console.error('Erro ao criar curso:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT - Atualizar curso
export async function PUT(request: NextRequest) {
  try {
    // Verificar autorização
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verificar token e obter usuário
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Buscar dados do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Verificar permissões
    if (!canEditAcademy(userData)) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    // Verificar se o curso existe
    const { data: existingCourse, error: courseError } = await supabaseAdmin
      .from('academy_courses')
      .select('id, instructor_id')
      .eq('id', id)
      .single();

    if (courseError || !existingCourse) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });
    }

    // Verificar se o usuário é o instrutor ou admin
    if (existingCourse.instructor_id !== user.id && userData.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Apenas o instrutor ou admin pode editar este curso' }, { status: 403 });
    }

    // Atualizar curso
    const { data: course, error: updateError } = await supabaseAdmin
      .from('academy_courses')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        category:academy_categories(id, name, color, icon),
        instructor:users_unified(id, first_name, last_name, email)
      `)
      .single();

    if (updateError) {
      console.error('Erro ao atualizar curso:', updateError);
      return NextResponse.json({ error: 'Erro ao atualizar curso' }, { status: 500 });
    }

    console.log(`✅ Curso atualizado: ${course.title} por ${userData.first_name} ${userData.last_name}`);

    return NextResponse.json({
      success: true,
      message: 'Curso atualizado com sucesso',
      course
    });

  } catch (error) {
    console.error('Erro ao atualizar curso:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Excluir curso
export async function DELETE(request: NextRequest) {
  try {
    // Verificar autorização
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verificar token e obter usuário
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Buscar dados do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Verificar permissões
    if (!canEditAcademy(userData)) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    // Verificar se o curso existe
    const { data: existingCourse, error: courseError } = await supabaseAdmin
      .from('academy_courses')
      .select('id, title, instructor_id')
      .eq('id', id)
      .single();

    if (courseError || !existingCourse) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });
    }

    // Verificar se o usuário é o instrutor ou admin
    if (existingCourse.instructor_id !== user.id && userData.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Apenas o instrutor ou admin pode excluir este curso' }, { status: 403 });
    }

    // Excluir curso (cascata irá excluir matrículas, progresso, comentários, etc.)
    const { error: deleteError } = await supabaseAdmin
      .from('academy_courses')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao excluir curso:', deleteError);
      return NextResponse.json({ error: 'Erro ao excluir curso' }, { status: 500 });
    }

    console.log(`✅ Curso excluído: ${existingCourse.title} por ${userData.first_name} ${userData.last_name}`);

    return NextResponse.json({
      success: true,
      message: 'Curso excluído com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir curso:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
