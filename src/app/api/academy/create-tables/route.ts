import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Criando tabelas do Academy...');

    // Inserir cursos de exemplo para testar se a tabela existe
    const sampleCourses = [
      {
        title: 'Introdução à Logística',
        description: 'Curso básico sobre os fundamentos da logística empresarial',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: '/images/course-logistics.jpg',
        duration: 45,
        category: 'Logística',
        difficulty: 'Iniciante',
        instructor: 'Prof. João Silva',
        tags: ['logística', 'básico', 'introdução']
      },
      {
        title: 'Gestão de Estoque',
        description: 'Aprenda as melhores práticas para gestão de estoque',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: '/images/course-inventory.jpg',
        duration: 60,
        category: 'Gestão',
        difficulty: 'Intermediário',
        instructor: 'Prof. Maria Santos',
        tags: ['estoque', 'gestão', 'controle']
      },
      {
        title: 'Segurança no Trabalho',
        description: 'Normas e práticas de segurança no ambiente de trabalho',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: '/images/course-safety.jpg',
        duration: 30,
        category: 'Segurança',
        difficulty: 'Iniciante',
        instructor: 'Prof. Carlos Oliveira',
        tags: ['segurança', 'trabalho', 'normas']
      },
      {
        title: 'Liderança e Gestão de Equipes',
        description: 'Desenvolva suas habilidades de liderança',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: '/images/course-leadership.jpg',
        duration: 90,
        category: 'Liderança',
        difficulty: 'Avançado',
        instructor: 'Prof. Ana Costa',
        tags: ['liderança', 'gestão', 'equipes']
      },
      {
        title: 'Excel Avançado para Logística',
        description: 'Domine o Excel para análises logísticas',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: '/images/course-excel.jpg',
        duration: 120,
        category: 'Tecnologia',
        difficulty: 'Intermediário',
        instructor: 'Prof. Pedro Lima',
        tags: ['excel', 'análise', 'dados']
      },
      {
        title: 'Atendimento ao Cliente',
        description: 'Técnicas de excelência no atendimento',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: '/images/course-customer.jpg',
        duration: 40,
        category: 'Atendimento',
        difficulty: 'Iniciante',
        instructor: 'Prof. Lucia Fernandes',
        tags: ['atendimento', 'cliente', 'comunicação']
      }
    ];

    // Tentar inserir cursos - se a tabela não existir, retornar instruções
    const { data: insertedCourses, error: insertError } = await supabaseAdmin
      .from('academy_courses')
      .insert(sampleCourses)
      .select();

    if (insertError && insertError.code === 'PGRST116') {
      return NextResponse.json({
        error: 'Tabelas do Academy não existem',
        message: 'Execute o SQL do arquivo supabase/migrations/academy_tables.sql no Supabase Dashboard',
        sqlFile: 'supabase/migrations/academy_tables.sql',
        instructions: [
          '1. Acesse o Supabase Dashboard',
          '2. Vá para SQL Editor',
          '3. Execute o conteúdo do arquivo supabase/migrations/academy_tables.sql',
          '4. Tente novamente esta API'
        ],
        sql: `
-- Criar tabelas para ABZ Academy

-- 1. Tabela de cursos
CREATE TABLE IF NOT EXISTS academy_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  video_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  duration INTEGER DEFAULT 0,
  category VARCHAR(100) DEFAULT 'Geral',
  difficulty VARCHAR(50) DEFAULT 'Iniciante',
  instructor VARCHAR(255),
  tags TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de matrículas
CREATE TABLE IF NOT EXISTS academy_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES academy_courses(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  completed_at TIMESTAMP WITH TIME ZONE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- 3. Tabela de progresso detalhado
CREATE TABLE IF NOT EXISTS academy_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES academy_enrollments(id) ON DELETE CASCADE,
  lesson_id VARCHAR(100),
  watched_duration INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  last_position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(enrollment_id, lesson_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_academy_courses_category ON academy_courses(category);
CREATE INDEX IF NOT EXISTS idx_academy_courses_difficulty ON academy_courses(difficulty);
CREATE INDEX IF NOT EXISTS idx_academy_courses_active ON academy_courses(is_active);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_user ON academy_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_course ON academy_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_progress_enrollment ON academy_progress(enrollment_id);

-- RLS
ALTER TABLE academy_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_progress ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Cursos ativos são visíveis para todos" ON academy_courses
  FOR SELECT USING (is_active = true);

CREATE POLICY "Apenas admins podem gerenciar cursos" ON academy_courses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users_unified 
      WHERE id = auth.uid() 
      AND role IN ('ADMIN', 'MANAGER')
    )
  );

CREATE POLICY "Usuários podem ver suas matrículas" ON academy_enrollments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Usuários podem se matricular" ON academy_enrollments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários podem atualizar seu progresso" ON academy_enrollments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins podem ver todas as matrículas" ON academy_enrollments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users_unified 
      WHERE id = auth.uid() 
      AND role IN ('ADMIN', 'MANAGER')
    )
  );

CREATE POLICY "Usuários podem gerenciar seu progresso" ON academy_progress
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM academy_enrollments 
      WHERE id = academy_progress.enrollment_id 
      AND user_id = auth.uid()
    )
  );
        `
      }, { status: 400 });
    }

    if (insertError) {
      console.error('Erro ao inserir cursos:', insertError);
      return NextResponse.json({
        error: 'Erro ao inserir cursos de exemplo',
        details: insertError
      }, { status: 500 });
    }

    console.log(`✅ ${insertedCourses?.length || 0} cursos de exemplo inseridos`);

    return NextResponse.json({
      message: 'Tabelas do ABZ Academy configuradas com sucesso',
      coursesInserted: insertedCourses?.length || 0,
      courses: insertedCourses
    });

  } catch (error) {
    console.error('❌ Erro ao criar tabelas do Academy:', error);
    return NextResponse.json({
      error: 'Erro interno ao criar tabelas do Academy',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'API para criar tabelas do ABZ Academy',
    description: 'Use POST para criar as tabelas e inserir dados de exemplo',
    endpoints: {
      POST: 'Cria as tabelas do Academy e insere cursos de exemplo'
    }
  });
}
