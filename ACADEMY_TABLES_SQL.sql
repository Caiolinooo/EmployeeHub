-- ============================================
-- ABZ ACADEMY - DATABASE TABLES
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Academy Categories
CREATE TABLE IF NOT EXISTS academy_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
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
  enrollment_id UUID REFERENCES academy_enrollments(id) ON DELETE CASCADE,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  last_watched_position INTEGER DEFAULT 0,
  total_watch_time INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Academy Comments
CREATE TABLE IF NOT EXISTS academy_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES academy_courses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES academy_comments(id) ON DELETE CASCADE,
  is_approved BOOLEAN DEFAULT true,
  is_pinned BOOLEAN DEFAULT false,
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Academy Ratings
CREATE TABLE IF NOT EXISTS academy_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES academy_courses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  is_approved BOOLEAN DEFAULT true,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_academy_courses_category ON academy_courses(category_id);
CREATE INDEX IF NOT EXISTS idx_academy_courses_instructor ON academy_courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_academy_courses_published ON academy_courses(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_user ON academy_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_course ON academy_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_progress_enrollment ON academy_progress(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_academy_comments_course ON academy_comments(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_ratings_course ON academy_ratings(course_id);

-- Insert default categories
INSERT INTO academy_categories (name, description, icon, color, sort_order) VALUES
('Tecnologia', 'Cursos relacionados a tecnologia e programação', 'code', '#0066CC', 1),
('Negócios', 'Cursos sobre gestão, liderança e estratégia', 'briefcase', '#28A745', 2),
('Comunicação', 'Cursos de comunicação e apresentação', 'message-circle', '#FD7E14', 3),
('Desenvolvimento Pessoal', 'Cursos de crescimento pessoal e soft skills', 'user', '#6F42C1', 4),
('Segurança', 'Cursos sobre segurança e compliance', 'shield', '#DC3545', 5),
('Processos', 'Cursos sobre processos internos da empresa', 'settings', '#6C757D', 6)
ON CONFLICT (name) DO NOTHING;
