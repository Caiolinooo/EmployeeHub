// Simple script to create Academy tables using direct SQL
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const createTables = async () => {
  console.log('🎓 Creating Academy tables...');

  try {
    // First, let's create categories table using upsert
    console.log('📝 Creating academy_categories...');
    
    // Try to insert a test record to see if table exists
    const { data: testData, error: testError } = await supabase
      .from('academy_categories')
      .select('id')
      .limit(1);

    if (testError && testError.code === 'PGRST116') {
      console.log('❌ Academy tables do not exist. Need to create them manually in Supabase dashboard.');
      console.log('📋 Please execute the following SQL in your Supabase SQL editor:');
      console.log(`
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
      `);
      
      return false;
    }

    if (testData) {
      console.log('✅ Academy tables already exist!');
      
      // Insert default categories if they don't exist
      const { error: insertError } = await supabase
        .from('academy_categories')
        .upsert([
          { name: 'Tecnologia', description: 'Cursos relacionados a tecnologia e programação', icon: 'code', color: '#0066CC', sort_order: 1 },
          { name: 'Negócios', description: 'Cursos sobre gestão, liderança e estratégia', icon: 'briefcase', color: '#28A745', sort_order: 2 },
          { name: 'Comunicação', description: 'Cursos de comunicação e apresentação', icon: 'message-circle', color: '#FD7E14', sort_order: 3 },
          { name: 'Desenvolvimento Pessoal', description: 'Cursos de crescimento pessoal e soft skills', icon: 'user', color: '#6F42C1', sort_order: 4 },
          { name: 'Segurança', description: 'Cursos sobre segurança e compliance', icon: 'shield', color: '#DC3545', sort_order: 5 },
          { name: 'Processos', description: 'Cursos sobre processos internos da empresa', icon: 'settings', color: '#6C757D', sort_order: 6 }
        ], { 
          onConflict: 'name',
          ignoreDuplicates: true 
        });

      if (insertError) {
        console.error('❌ Error inserting categories:', insertError);
      } else {
        console.log('✅ Default categories ensured');
      }

      return true;
    }

  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
};

// Run the script
createTables().then(success => {
  if (success) {
    console.log('🎉 Academy setup completed!');
  } else {
    console.log('⚠️ Please create tables manually using the SQL provided above');
  }
});
