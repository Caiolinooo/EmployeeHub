import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { canEditAcademy } from '@/lib/permissions';

import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { canWithGrant } from '@/lib/permission-gate';

export const dynamic = 'force-dynamic';

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
      is_featured,
      instructor_signature_url
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
        instructor_signature_url: instructor_signature_url || null,
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
    if (
      existingCourse.instructor_id !== resolvedUserId &&
      !(await canWithGrant(resolvedUserId, userData.role, ['academy.update_any'], 'admin'))
    ) {
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

// DELETE - Excluir curso (com limpeza cascata completa)
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    // Verificar se o curso existe
    const { data: existingCourse, error: courseError } = await supabaseAdmin
      .from('academy_courses')
      .select('id, title, instructor_id, instructor_signature_url')
      .eq('id', id)
      .single();

    if (courseError || !existingCourse) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });
    }

    // Verificar se o usuário é o instrutor ou admin
    if (
      existingCourse.instructor_id !== resolvedUserId &&
      !(await canWithGrant(resolvedUserId, userData.role, ['academy.delete_any'], 'admin'))
    ) {
      return NextResponse.json({ error: 'Apenas o instrutor ou admin pode excluir este curso' }, { status: 403 });
    }

    // ========================
    // LIMPEZA CASCATA COMPLETA
    // ========================
    const cleanup: Record<string, { deleted: number; errors: string[] }> = {};

    // 1. Buscar IDs dos módulos do curso
    const { data: courseModules } = await supabaseAdmin
      .from('academy_modules')
      .select('id')
      .eq('course_id', id);
    const moduleIds = (courseModules || []).map(m => m.id);

    // 2. Buscar IDs das matrículas do curso
    const { data: courseEnrollments } = await supabaseAdmin
      .from('academy_enrollments')
      .select('id, completed_at')
      .eq('course_id', id);
    const allEnrollmentIds = (courseEnrollments || []).map(e => e.id);
    // Separar matrículas incompletas (para deletar) das concluídas (preservar para certificados, a não ser que deleteCertificates seja true)
    const incompleteEnrollmentIds = (courseEnrollments || []).filter(e => !e.completed_at).map(e => e.id);
    const completedEnrollmentIds = (courseEnrollments || []).filter(e => e.completed_at).map(e => e.id);

    // ========================
    // LIMPEZA DE CERTIFICADOS (MODO TESTE/OPCIONAL)
    // ========================
    const deleteCertificates = searchParams.get('deleteCertificates') === 'true';
    if (deleteCertificates && completedEnrollmentIds.length > 0) {
      // Find all certificate issues for the complete enrollments
      const { data: certIssues } = await supabaseAdmin
        .from('certificate_issues')
        .select('id, pdf_path')
        .in('enrollment_id', completedEnrollmentIds);

      const certPaths = (certIssues || []).map(c => c.pdf_path).filter(Boolean);

      // Remove physical PDFs from bucket
      if (certPaths.length > 0) {
        const { error: storageErr } = await supabaseAdmin.storage
          .from('certificates')
          .remove(certPaths);
        if (storageErr) console.error('Failed to remove certificate PDFs from bucket:', storageErr);
      }

      // Delete certificate issue records
      const { error: certErr, count: certCount } = await supabaseAdmin
        .from('certificate_issues')
        .delete({ count: 'exact' })
        .in('enrollment_id', completedEnrollmentIds);

      cleanup['certificate_issues'] = { deleted: certCount || 0, errors: certErr ? [certErr.message] : [] };
    }

    // 3. Deletar respostas (academy_answers) — por course_id
    const { error: answersErr, count: answersCount } = await supabaseAdmin
      .from('academy_answers')
      .delete({ count: 'exact' })
      .eq('course_id', id);
    cleanup['academy_answers'] = { deleted: answersCount || 0, errors: answersErr ? [answersErr.message] : [] };

    // 4. Deletar opções de questões (academy_question_options) — via module questions
    if (moduleIds.length > 0) {
      // Buscar question IDs dos módulos
      const { data: moduleQuestions } = await supabaseAdmin
        .from('academy_questions')
        .select('id')
        .in('module_id', moduleIds);
      const questionIds = (moduleQuestions || []).map(q => q.id);

      if (questionIds.length > 0) {
        const { error: optErr, count: optCount } = await supabaseAdmin
          .from('academy_question_options')
          .delete({ count: 'exact' })
          .in('question_id', questionIds);
        cleanup['academy_question_options'] = { deleted: optCount || 0, errors: optErr ? [optErr.message] : [] };
      }

      // 5. Deletar questões (academy_questions)
      const { error: questErr, count: questCount } = await supabaseAdmin
        .from('academy_questions')
        .delete({ count: 'exact' })
        .in('module_id', moduleIds);
      cleanup['academy_questions'] = { deleted: questCount || 0, errors: questErr ? [questErr.message] : [] };
    }

    // 6. Deletar progresso de módulos (academy_module_progress)
    if (allEnrollmentIds.length > 0) {
      const { error: modProgErr, count: modProgCount } = await supabaseAdmin
        .from('academy_module_progress')
        .delete({ count: 'exact' })
        .in('enrollment_id', allEnrollmentIds);
      cleanup['academy_module_progress'] = { deleted: modProgCount || 0, errors: modProgErr ? [modProgErr.message] : [] };
    }

    // 7. Deletar módulos (academy_modules)
    if (moduleIds.length > 0) {
      const { error: modErr, count: modCount } = await supabaseAdmin
        .from('academy_modules')
        .delete({ count: 'exact' })
        .in('id', moduleIds);
      cleanup['academy_modules'] = { deleted: modCount || 0, errors: modErr ? [modErr.message] : [] };
    }

    // 8. Deletar progresso geral (academy_progress) — via enrollment_ids
    if (allEnrollmentIds.length > 0) {
      const { error: progErr, count: progCount } = await supabaseAdmin
        .from('academy_progress')
        .delete({ count: 'exact' })
        .in('enrollment_id', allEnrollmentIds);
      cleanup['academy_progress'] = { deleted: progCount || 0, errors: progErr ? [progErr.message] : [] };
    }

    // 9. Deletar avaliações (academy_ratings)
    const { error: ratErr, count: ratCount } = await supabaseAdmin
      .from('academy_ratings')
      .delete({ count: 'exact' })
      .eq('course_id', id);
    cleanup['academy_ratings'] = { deleted: ratCount || 0, errors: ratErr ? [ratErr.message] : [] };

    // 10. Deletar comentários (academy_comments)
    const { error: comErr, count: comCount } = await supabaseAdmin
      .from('academy_comments')
      .delete({ count: 'exact' })
      .eq('course_id', id);
    cleanup['academy_comments'] = { deleted: comCount || 0, errors: comErr ? [comErr.message] : [] };

    // 11. Deletar matrículas
    if (deleteCertificates) {
      // Se estamos apagando os certificados, podemos apagar TODAS as matrículas
      if (allEnrollmentIds.length > 0) {
        const { error: enrErr, count: enrCount } = await supabaseAdmin
          .from('academy_enrollments')
          .delete({ count: 'exact' })
          .in('id', allEnrollmentIds);
        cleanup['academy_enrollments_all'] = { deleted: enrCount || 0, errors: enrErr ? [enrErr.message] : [] };
      }
    } else {
      // Comportamento normal: preservar matrículas concluídas para os certificados exibirem e deletar só as incompletas
      if (incompleteEnrollmentIds.length > 0) {
        const { error: enrErr, count: enrCount } = await supabaseAdmin
          .from('academy_enrollments')
          .delete({ count: 'exact' })
          .in('id', incompleteEnrollmentIds);
        cleanup['academy_enrollments_incomplete'] = { deleted: enrCount || 0, errors: enrErr ? [enrErr.message] : [] };
      }

      // 12. Desativar matrículas concluídas (manter para referência do certificado)
      if (completedEnrollmentIds.length > 0) {
        await supabaseAdmin
          .from('academy_enrollments')
          .update({ is_active: false })
          .in('id', completedEnrollmentIds);
        cleanup['academy_enrollments_deactivated'] = { deleted: completedEnrollmentIds.length, errors: [] };
      }
    }

    // 13. Limpar assinatura do storage (se existir)
    if (existingCourse.instructor_signature_url &&
      existingCourse.instructor_signature_url !== 'PASSKEY_SIGNED' &&
      existingCourse.instructor_signature_url.includes('academy-signatures')) {
      try {
        const sigPath = existingCourse.instructor_signature_url.split('academy-signatures/').pop();
        if (sigPath) {
          await supabaseAdmin.storage.from('academy-signatures').remove([sigPath]);
        }
      } catch (e) {
        console.warn('Falha ao remover assinatura do storage:', e);
      }
    }

    // 14. Deletar o curso
    const { error: deleteError } = await supabaseAdmin
      .from('academy_courses')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao excluir curso:', deleteError);
      return NextResponse.json({ error: 'Erro ao excluir curso' }, { status: 500 });
    }

    console.log(`✅ Curso excluído: ${existingCourse.title} por ${userData.first_name} ${userData.last_name}`);
    console.log('📋 Limpeza realizada:', JSON.stringify(cleanup, null, 2));

    return NextResponse.json({
      success: true,
      message: 'Curso excluído com sucesso',
      cleanup
    });

  } catch (error) {
    console.error('Erro ao excluir curso:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
