import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Função para obter o cliente Supabase de forma lazy
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase credentials are not configured');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting Academy tables migration...');
    const supabaseAdmin = getSupabaseAdmin();

    // Create Academy Categories table
    const { error: categoriesError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
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
      `
    });

    if (categoriesError) {
      console.error('Error creating categories table:', categoriesError);
    } else {
      console.log('✅ Academy categories table created');
    }

    // Create Academy Courses table
    const { error: coursesError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
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
      `
    });

    if (coursesError) {
      console.error('Error creating courses table:', coursesError);
    } else {
      console.log('✅ Academy courses table created');
    }

    // Create Academy Enrollments table
    const { error: enrollmentsError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
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
      `
    });

    if (enrollmentsError) {
      console.error('Error creating enrollments table:', enrollmentsError);
    } else {
      console.log('✅ Academy enrollments table created');
    }

    // Create Academy Progress table
    const { error: progressError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS academy_progress (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          enrollment_id UUID REFERENCES academy_enrollments(id) ON DELETE CASCADE,
          progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
          last_watched_position INTEGER DEFAULT 0,
          total_watch_time INTEGER DEFAULT 0,
          last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (progressError) {
      console.error('Error creating progress table:', progressError);
    } else {
      console.log('✅ Academy progress table created');
    }

    // Create Academy Comments table
    const { error: commentsError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
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
      `
    });

    if (commentsError) {
      console.error('Error creating comments table:', commentsError);
    } else {
      console.log('✅ Academy comments table created');
    }

    // Create Academy Ratings table
    const { error: ratingsError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
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
      `
    });

    if (ratingsError) {
      console.error('Error creating ratings table:', ratingsError);
    } else {
      console.log('✅ Academy ratings table created');
    }

    // Insert default categories
    const { error: insertError } = await supabaseAdmin
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
      console.error('Error inserting default categories:', insertError);
    } else {
      console.log('✅ Default categories inserted');
    }

    // Verify tables were created
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .like('table_name', 'academy_%');

    if (tablesError) {
      console.error('Error verifying tables:', tablesError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to verify tables creation',
        details: tablesError 
      }, { status: 500 });
    }

    console.log('📋 Academy tables created:', tables?.map(t => t.table_name));

    return NextResponse.json({ 
      success: true, 
      message: 'Academy tables created successfully',
      tables: tables?.map(t => t.table_name) || []
    });

  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Migration failed',
      details: error 
    }, { status: 500 });
  }
}
