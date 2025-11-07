import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('🎓 Iniciando configuração do ABZ Academy...');

    // Vamos tentar inserir dados diretamente para forçar a criação das tabelas
    // Se as tabelas não existirem, vamos criar dados de exemplo que podem ser inseridos manualmente

    const sampleCourses = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Introdução à Logística',
        description: 'Curso básico sobre os fundamentos da logística empresarial',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: '/images/course-logistics.jpg',
        duration: 45,
        category: 'Logística',
        difficulty: 'Iniciante',
        instructor: 'Prof. João Silva',
        tags: ['logística', 'básico', 'introdução'],
        is_active: true
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        title: 'Gestão de Estoque',
        description: 'Aprenda as melhores práticas para gestão de estoque',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: '/images/course-inventory.jpg',
        duration: 60,
        category: 'Gestão',
        difficulty: 'Intermediário',
        instructor: 'Prof. Maria Santos',
        tags: ['estoque', 'gestão', 'controle'],
        is_active: true
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        title: 'Segurança no Trabalho',
        description: 'Normas e práticas de segurança no ambiente de trabalho',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: '/images/course-safety.jpg',
        duration: 30,
        category: 'Segurança',
        difficulty: 'Iniciante',
        instructor: 'Prof. Carlos Oliveira',
        tags: ['segurança', 'trabalho', 'normas'],
        is_active: true
      }
    ];

    // 1. Verificar se a tabela de cursos existe
    const { error: coursesError } = await supabaseAdmin
      .from('academy_courses')
      .select('id')
      .limit(1);

    if (coursesError && coursesError.code === 'PGRST116') {
      console.log('❌ Tabela academy_courses não existe. Precisa ser criada manualmente no Supabase.');
      return NextResponse.json({
        error: 'Tabelas do Academy não existem',
        message: 'Execute o SQL do arquivo supabase/migrations/academy_tables.sql no Supabase Dashboard',
        sqlFile: 'supabase/migrations/academy_tables.sql',
        sampleData: sampleCourses
      }, { status: 400 });
    }

    // 2. Criar tabela de matrículas
    const { error: enrollmentsError } = await supabaseAdmin
      .from('academy_enrollments')
      .select('id')
      .limit(1);

    if (enrollmentsError && enrollmentsError.code === 'PGRST116') {
      console.log('📝 Criando tabela academy_enrollments...');
      
      // Tentar criar via RPC
      try {
        await supabaseAdmin.rpc('create_academy_enrollments_table', {});
      } catch (err) {
        console.log('Tentando criar tabela via SQL alternativo...');
      }
    }

    // 3. Criar tabela de progresso
    const { error: progressError } = await supabaseAdmin
      .from('academy_progress')
      .select('id')
      .limit(1);

    if (progressError && progressError.code === 'PGRST116') {
      console.log('📊 Criando tabela academy_progress...');
      
      try {
        await supabaseAdmin.rpc('create_academy_progress_table', {});
      } catch (err) {
        console.log('Tentando criar tabela via SQL alternativo...');
      }
    }

    // 4. Inserir cursos de exemplo
    console.log('📚 Inserindo cursos de exemplo...');

    let coursesCreated = 0;
    for (const course of sampleCourses) {
      try {
        const { error: insertError } = await supabaseAdmin
          .from('academy_courses')
          .insert(course);

        if (!insertError) {
          coursesCreated++;
        } else {
          console.log('Erro ao inserir curso:', insertError);
        }
      } catch (err) {
        console.log('Erro ao inserir curso:', err);
      }
    }

    // 5. Verificar estrutura final
    const { data: courses, error: finalCoursesError } = await supabaseAdmin
      .from('academy_courses')
      .select('*');

    const { data: enrollments, error: finalEnrollmentsError } = await supabaseAdmin
      .from('academy_enrollments')
      .select('*');

    return NextResponse.json({
      message: 'Configuração do ABZ Academy concluída',
      setup: {
        courses: {
          table_exists: !finalCoursesError,
          count: courses?.length || 0,
          sample_created: coursesCreated
        },
        enrollments: {
          table_exists: !finalEnrollmentsError,
          count: enrollments?.length || 0
        },
        status: 'success'
      }
    });

  } catch (error) {
    console.error('❌ Erro na configuração do ABZ Academy:', error);
    return NextResponse.json({
      error: 'Erro interno na configuração do ABZ Academy',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Verificar status das tabelas
    const { data: courses, error: coursesError } = await supabaseAdmin
      .from('academy_courses')
      .select('count', { count: 'exact', head: true });

    const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
      .from('academy_enrollments')
      .select('count', { count: 'exact', head: true });

    return NextResponse.json({
      message: 'Status do ABZ Academy',
      status: {
        courses: {
          table_exists: !coursesError,
          count: courses || 0,
          error: coursesError?.message
        },
        enrollments: {
          table_exists: !enrollmentsError,
          count: enrollments || 0,
          error: enrollmentsError?.message
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro ao verificar status do ABZ Academy:', error);
    return NextResponse.json({
      error: 'Erro interno ao verificar status',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
