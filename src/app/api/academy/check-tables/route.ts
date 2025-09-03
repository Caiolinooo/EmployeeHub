import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('🔍 Verificando status das tabelas do ABZ Academy...');

    const tables = [
      'academy_categories',
      'academy_courses', 
      'academy_enrollments',
      'academy_progress',
      'academy_comments',
      'academy_ratings'
    ];

    const results: Record<string, any> = {};

    for (const table of tables) {
      try {
        console.log(`📋 Verificando tabela ${table}...`);
        
        // Tentar buscar dados da tabela
        const { data, error, count } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`❌ Erro na tabela ${table}:`, error.message);
          results[table] = {
            exists: false,
            error: error.message,
            code: error.code,
            count: 0
          };
        } else {
          console.log(`✅ Tabela ${table} OK - ${count} registros`);
          results[table] = {
            exists: true,
            count: count || 0,
            status: 'OK'
          };
        }
      } catch (err) {
        console.log(`❌ Erro ao verificar tabela ${table}:`, err);
        results[table] = {
          exists: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
          count: 0
        };
      }
    }

    // Verificar se pelo menos uma tabela existe
    const existingTables = Object.keys(results).filter(table => results[table].exists);
    const missingTables = Object.keys(results).filter(table => !results[table].exists);

    console.log(`📊 Resumo: ${existingTables.length} tabelas existem, ${missingTables.length} estão faltando`);

    return NextResponse.json({
      success: true,
      message: 'Verificação das tabelas do ABZ Academy concluída',
      summary: {
        total: tables.length,
        existing: existingTables.length,
        missing: missingTables.length,
        existingTables,
        missingTables
      },
      tables: results,
      sqlToCreate: missingTables.length > 0 ? `
-- SQL para criar as tabelas faltantes do ABZ Academy
-- Execute este SQL no Supabase SQL Editor:

-- Academy Categories
CREATE TABLE IF NOT EXISTS academy_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(100),
  color VARCHAR(7) DEFAULT '#0066CC',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Academy Courses
CREATE TABLE IF NOT EXISTS academy_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  short_description VARCHAR(500),
  video_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  duration INTEGER DEFAULT 0,
  category_id UUID REFERENCES academy_categories(id) ON DELETE SET NULL,
  instructor_id UUID REFERENCES users_unified(id) ON DELETE SET NULL,
  difficulty_level VARCHAR(20) DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  tags TEXT[],
  prerequisites TEXT[],
  learning_objectives TEXT[],
  sort_order INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Academy Enrollments
CREATE TABLE IF NOT EXISTS academy_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  course_id UUID REFERENCES academy_courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  certificate_url VARCHAR(500),
  certificate_issued_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, course_id)
);

-- Academy Progress
CREATE TABLE IF NOT EXISTS academy_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  course_id UUID REFERENCES academy_courses(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES academy_enrollments(id) ON DELETE CASCADE,
  progress_percentage DECIMAL(5,2) DEFAULT 0.00,
  time_watched INTEGER DEFAULT 0,
  last_position INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Academy Comments
CREATE TABLE IF NOT EXISTS academy_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  course_id UUID REFERENCES academy_courses(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  parent_id UUID REFERENCES academy_comments(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Academy Ratings
CREATE TABLE IF NOT EXISTS academy_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  course_id UUID REFERENCES academy_courses(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_academy_courses_category ON academy_courses(category_id);
CREATE INDEX IF NOT EXISTS idx_academy_courses_instructor ON academy_courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_academy_courses_published ON academy_courses(is_published);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_user ON academy_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_course ON academy_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_progress_user ON academy_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_progress_course ON academy_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_comments_course ON academy_comments(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_ratings_course ON academy_ratings(course_id);
      ` : null
    });

  } catch (error) {
    console.error('❌ Erro ao verificar tabelas do Academy:', error);
    return NextResponse.json({
      error: 'Erro interno ao verificar tabelas do Academy',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({
    message: 'Use GET para verificar o status das tabelas do ABZ Academy'
  });
}
