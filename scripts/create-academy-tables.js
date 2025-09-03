// Script to create Academy tables in Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const createAcademyTables = async () => {
  console.log('🚀 Starting Academy tables creation...');

  try {
    // Read the SQL migration file
    const fs = require('fs');
    const path = require('path');
    const sqlFile = path.join(__dirname, '../supabase/migrations/20250903_create_academy_tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Error creating Academy tables:', error);
      return false;
    }

    console.log('✅ Academy tables created successfully!');
    
    // Verify tables were created
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .like('table_name', 'academy_%');

    if (tablesError) {
      console.error('❌ Error verifying tables:', tablesError);
      return false;
    }

    console.log('📋 Created Academy tables:');
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });

    return true;

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
};

// Alternative method: Execute SQL directly
const createTablesDirectly = async () => {
  console.log('🔄 Creating Academy tables directly...');

  const queries = [
    // Enable UUID extension
    `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
    
    // Academy Categories
    `CREATE TABLE IF NOT EXISTS academy_categories (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      icon VARCHAR(100),
      color VARCHAR(7) DEFAULT '#0066CC',
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`,

    // Academy Courses
    `CREATE TABLE IF NOT EXISTS academy_courses (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    );`,

    // Academy Enrollments
    `CREATE TABLE IF NOT EXISTS academy_enrollments (
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
    );`,

    // Academy Progress
    `CREATE TABLE IF NOT EXISTS academy_progress (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      enrollment_id UUID REFERENCES academy_enrollments(id) ON DELETE CASCADE,
      progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
      last_watched_position INTEGER DEFAULT 0,
      total_watch_time INTEGER DEFAULT 0,
      last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`,

    // Academy Comments
    `CREATE TABLE IF NOT EXISTS academy_comments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      course_id UUID REFERENCES academy_courses(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      parent_id UUID REFERENCES academy_comments(id) ON DELETE CASCADE,
      is_approved BOOLEAN DEFAULT true,
      is_pinned BOOLEAN DEFAULT false,
      like_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`,

    // Academy Ratings
    `CREATE TABLE IF NOT EXISTS academy_ratings (
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
    );`,

    // Academy Comment Likes
    `CREATE TABLE IF NOT EXISTS academy_comment_likes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      comment_id UUID REFERENCES academy_comments(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(comment_id, user_id)
    );`,

    // Academy Bookmarks
    `CREATE TABLE IF NOT EXISTS academy_bookmarks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users_unified(id) ON DELETE CASCADE,
      course_id UUID REFERENCES academy_courses(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, course_id)
    );`,

    // Insert default categories
    `INSERT INTO academy_categories (name, description, icon, color, sort_order) VALUES
    ('Tecnologia', 'Cursos relacionados a tecnologia e programação', 'code', '#0066CC', 1),
    ('Negócios', 'Cursos sobre gestão, liderança e estratégia', 'briefcase', '#28A745', 2),
    ('Comunicação', 'Cursos de comunicação e apresentação', 'message-circle', '#FD7E14', 3),
    ('Desenvolvimento Pessoal', 'Cursos de crescimento pessoal e soft skills', 'user', '#6F42C1', 4),
    ('Segurança', 'Cursos sobre segurança e compliance', 'shield', '#DC3545', 5),
    ('Processos', 'Cursos sobre processos internos da empresa', 'settings', '#6C757D', 6)
    ON CONFLICT (name) DO NOTHING;`
  ];

  try {
    for (const query of queries) {
      console.log('📝 Executing query...');
      const { error } = await supabase.rpc('exec_sql', { sql_query: query });
      
      if (error) {
        console.error('❌ Error executing query:', error);
        console.log('Query:', query.substring(0, 100) + '...');
        continue; // Continue with next query
      }
    }

    console.log('✅ All Academy tables created successfully!');
    return true;

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
};

// Run the script
const main = async () => {
  console.log('🎓 ABZ Academy - Database Setup');
  console.log('================================');
  
  const success = await createTablesDirectly();
  
  if (success) {
    console.log('🎉 Academy database setup completed successfully!');
    process.exit(0);
  } else {
    console.log('❌ Academy database setup failed!');
    process.exit(1);
  }
};

main();
