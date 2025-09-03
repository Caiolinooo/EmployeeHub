-- Criar tabelas para ABZ Academy

-- 1. Tabela de cursos
CREATE TABLE IF NOT EXISTS academy_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  video_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  duration INTEGER DEFAULT 0, -- em minutos
  category VARCHAR(100) DEFAULT 'Geral',
  difficulty VARCHAR(50) DEFAULT 'Iniciante', -- Iniciante, Intermediário, Avançado
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

-- 3. Tabela de progresso detalhado (opcional)
CREATE TABLE IF NOT EXISTS academy_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES academy_enrollments(id) ON DELETE CASCADE,
  lesson_id VARCHAR(100), -- ID da lição/seção do vídeo
  watched_duration INTEGER DEFAULT 0, -- em segundos
  completed BOOLEAN DEFAULT FALSE,
  last_position INTEGER DEFAULT 0, -- posição em segundos onde parou
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(enrollment_id, lesson_id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_academy_courses_category ON academy_courses(category);
CREATE INDEX IF NOT EXISTS idx_academy_courses_difficulty ON academy_courses(difficulty);
CREATE INDEX IF NOT EXISTS idx_academy_courses_active ON academy_courses(is_active);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_user ON academy_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_course ON academy_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_progress_enrollment ON academy_progress(enrollment_id);

-- Triggers para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_academy_courses_updated_at BEFORE UPDATE ON academy_courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_academy_progress_updated_at BEFORE UPDATE ON academy_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security)
ALTER TABLE academy_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_progress ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- Cursos: todos podem ver cursos ativos
CREATE POLICY "Cursos ativos são visíveis para todos" ON academy_courses
  FOR SELECT USING (is_active = true);

-- Cursos: apenas admins podem criar/editar
CREATE POLICY "Apenas admins podem gerenciar cursos" ON academy_courses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users_unified 
      WHERE id = auth.uid() 
      AND role IN ('ADMIN', 'MANAGER')
    )
  );

-- Matrículas: usuários podem ver suas próprias matrículas
CREATE POLICY "Usuários podem ver suas matrículas" ON academy_enrollments
  FOR SELECT USING (user_id = auth.uid());

-- Matrículas: usuários podem se matricular
CREATE POLICY "Usuários podem se matricular" ON academy_enrollments
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Matrículas: usuários podem atualizar seu progresso
CREATE POLICY "Usuários podem atualizar seu progresso" ON academy_enrollments
  FOR UPDATE USING (user_id = auth.uid());

-- Admins podem ver todas as matrículas
CREATE POLICY "Admins podem ver todas as matrículas" ON academy_enrollments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users_unified 
      WHERE id = auth.uid() 
      AND role IN ('ADMIN', 'MANAGER')
    )
  );

-- Progresso: usuários podem ver/atualizar seu próprio progresso
CREATE POLICY "Usuários podem gerenciar seu progresso" ON academy_progress
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM academy_enrollments 
      WHERE id = academy_progress.enrollment_id 
      AND user_id = auth.uid()
    )
  );

-- Inserir cursos de exemplo
INSERT INTO academy_courses (title, description, video_url, thumbnail_url, duration, category, difficulty, instructor, tags) VALUES
('Introdução à Logística', 'Curso básico sobre os fundamentos da logística empresarial', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', '/images/course-logistics.jpg', 45, 'Logística', 'Iniciante', 'Prof. João Silva', ARRAY['logística', 'básico', 'introdução']),
('Gestão de Estoque', 'Aprenda as melhores práticas para gestão de estoque', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', '/images/course-inventory.jpg', 60, 'Gestão', 'Intermediário', 'Prof. Maria Santos', ARRAY['estoque', 'gestão', 'controle']),
('Segurança no Trabalho', 'Normas e práticas de segurança no ambiente de trabalho', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', '/images/course-safety.jpg', 30, 'Segurança', 'Iniciante', 'Prof. Carlos Oliveira', ARRAY['segurança', 'trabalho', 'normas']),
('Liderança e Gestão de Equipes', 'Desenvolva suas habilidades de liderança', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', '/images/course-leadership.jpg', 90, 'Liderança', 'Avançado', 'Prof. Ana Costa', ARRAY['liderança', 'gestão', 'equipes']),
('Excel Avançado para Logística', 'Domine o Excel para análises logísticas', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', '/images/course-excel.jpg', 120, 'Tecnologia', 'Intermediário', 'Prof. Pedro Lima', ARRAY['excel', 'análise', 'dados']),
('Atendimento ao Cliente', 'Técnicas de excelência no atendimento', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', '/images/course-customer.jpg', 40, 'Atendimento', 'Iniciante', 'Prof. Lucia Fernandes', ARRAY['atendimento', 'cliente', 'comunicação'])
ON CONFLICT DO NOTHING;
