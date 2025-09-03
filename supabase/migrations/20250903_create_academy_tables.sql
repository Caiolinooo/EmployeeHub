-- Migration: Create ABZ Academy Tables
-- Created: 2025-09-03
-- Description: Creates all necessary tables for the ABZ Academy learning management system

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Academy Categories Table
CREATE TABLE IF NOT EXISTS academy_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(100), -- Icon name for UI
  color VARCHAR(7) DEFAULT '#0066CC', -- Hex color for category
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Academy Courses Table
CREATE TABLE IF NOT EXISTS academy_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  short_description VARCHAR(500), -- For course cards
  video_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  duration INTEGER DEFAULT 0, -- Duration in seconds
  category_id UUID REFERENCES academy_categories(id) ON DELETE SET NULL,
  instructor_id UUID REFERENCES users_unified(id) ON DELETE SET NULL,
  difficulty_level VARCHAR(20) DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  tags TEXT[], -- Array of tags for search
  prerequisites TEXT[], -- Array of prerequisite course IDs or skills
  learning_objectives TEXT[], -- What students will learn
  sort_order INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Academy Enrollments Table
CREATE TABLE IF NOT EXISTS academy_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Academy Progress Table
CREATE TABLE IF NOT EXISTS academy_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID REFERENCES academy_enrollments(id) ON DELETE CASCADE,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  last_watched_position INTEGER DEFAULT 0, -- Position in seconds
  total_watch_time INTEGER DEFAULT 0, -- Total time watched in seconds
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Academy Comments Table
CREATE TABLE IF NOT EXISTS academy_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES academy_courses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES academy_comments(id) ON DELETE CASCADE, -- For nested comments
  is_approved BOOLEAN DEFAULT true,
  is_pinned BOOLEAN DEFAULT false,
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Academy Ratings Table
CREATE TABLE IF NOT EXISTS academy_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Academy Comment Likes Table (for comment interactions)
CREATE TABLE IF NOT EXISTS academy_comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID REFERENCES academy_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- Academy Course Bookmarks Table
CREATE TABLE IF NOT EXISTS academy_bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
  course_id UUID REFERENCES academy_courses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_academy_courses_category ON academy_courses(category_id);
CREATE INDEX IF NOT EXISTS idx_academy_courses_instructor ON academy_courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_academy_courses_published ON academy_courses(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_academy_courses_featured ON academy_courses(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_user ON academy_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_course ON academy_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_progress_enrollment ON academy_progress(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_academy_comments_course ON academy_comments(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_comments_user ON academy_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_comments_parent ON academy_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_academy_ratings_course ON academy_ratings(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_ratings_user ON academy_ratings(user_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_academy_categories_updated_at BEFORE UPDATE ON academy_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_academy_courses_updated_at BEFORE UPDATE ON academy_courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_academy_progress_updated_at BEFORE UPDATE ON academy_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_academy_comments_updated_at BEFORE UPDATE ON academy_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_academy_ratings_updated_at BEFORE UPDATE ON academy_ratings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default categories
INSERT INTO academy_categories (name, description, icon, color, sort_order) VALUES
('Tecnologia', 'Cursos relacionados a tecnologia e programação', 'code', '#0066CC', 1),
('Negócios', 'Cursos sobre gestão, liderança e estratégia', 'briefcase', '#28A745', 2),
('Comunicação', 'Cursos de comunicação e apresentação', 'message-circle', '#FD7E14', 3),
('Desenvolvimento Pessoal', 'Cursos de crescimento pessoal e soft skills', 'user', '#6F42C1', 4),
('Segurança', 'Cursos sobre segurança e compliance', 'shield', '#DC3545', 5),
('Processos', 'Cursos sobre processos internos da empresa', 'settings', '#6C757D', 6)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security
ALTER TABLE academy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Categories: Everyone can read, only admins and academy editors can modify
CREATE POLICY "Everyone can view academy categories" ON academy_categories FOR SELECT USING (true);
CREATE POLICY "Academy editors can manage categories" ON academy_categories FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users_unified 
    WHERE id = auth.uid() 
    AND (
      role = 'ADMIN' 
      OR (access_permissions->'features'->>'academy_editor')::boolean = true
    )
  )
);

-- Courses: Everyone can read published courses, editors can manage all
CREATE POLICY "Everyone can view published courses" ON academy_courses FOR SELECT USING (
  is_published = true OR 
  EXISTS (
    SELECT 1 FROM users_unified 
    WHERE id = auth.uid() 
    AND (
      role = 'ADMIN' 
      OR (access_permissions->'features'->>'academy_editor')::boolean = true
    )
  )
);

CREATE POLICY "Academy editors can manage courses" ON academy_courses FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users_unified 
    WHERE id = auth.uid() 
    AND (
      role = 'ADMIN' 
      OR (access_permissions->'features'->>'academy_editor')::boolean = true
    )
  )
);

-- Enrollments: Users can manage their own enrollments
CREATE POLICY "Users can manage their own enrollments" ON academy_enrollments FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Academy editors can view all enrollments" ON academy_enrollments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users_unified 
    WHERE id = auth.uid() 
    AND (
      role = 'ADMIN' 
      OR (access_permissions->'features'->>'academy_editor')::boolean = true
    )
  )
);

-- Progress: Users can manage their own progress
CREATE POLICY "Users can manage their own progress" ON academy_progress FOR ALL USING (
  EXISTS (
    SELECT 1 FROM academy_enrollments 
    WHERE id = enrollment_id AND user_id = auth.uid()
  )
);

-- Comments: Users can manage their own comments, editors can moderate
CREATE POLICY "Users can view approved comments" ON academy_comments FOR SELECT USING (is_approved = true);
CREATE POLICY "Users can manage their own comments" ON academy_comments FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Academy editors can moderate comments" ON academy_comments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users_unified 
    WHERE id = auth.uid() 
    AND (
      role = 'ADMIN' 
      OR (access_permissions->'features'->>'academy_editor')::boolean = true
    )
  )
);

-- Ratings: Users can manage their own ratings
CREATE POLICY "Users can view approved ratings" ON academy_ratings FOR SELECT USING (is_approved = true);
CREATE POLICY "Users can manage their own ratings" ON academy_ratings FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Academy editors can moderate ratings" ON academy_ratings FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users_unified 
    WHERE id = auth.uid() 
    AND (
      role = 'ADMIN' 
      OR (access_permissions->'features'->>'academy_editor')::boolean = true
    )
  )
);

-- Comment likes: Users can manage their own likes
CREATE POLICY "Users can manage their own comment likes" ON academy_comment_likes FOR ALL USING (user_id = auth.uid());

-- Bookmarks: Users can manage their own bookmarks
CREATE POLICY "Users can manage their own bookmarks" ON academy_bookmarks FOR ALL USING (user_id = auth.uid());

COMMENT ON TABLE academy_categories IS 'Categories for organizing academy courses';
COMMENT ON TABLE academy_courses IS 'Main courses table for the academy system';
COMMENT ON TABLE academy_enrollments IS 'User enrollments in courses';
COMMENT ON TABLE academy_progress IS 'User progress tracking for enrolled courses';
COMMENT ON TABLE academy_comments IS 'Comments on courses with nested support';
COMMENT ON TABLE academy_ratings IS 'User ratings and reviews for courses';
COMMENT ON TABLE academy_comment_likes IS 'Likes on comments';
COMMENT ON TABLE academy_bookmarks IS 'User bookmarks for courses';
