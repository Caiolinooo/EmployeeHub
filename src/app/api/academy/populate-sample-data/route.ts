import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🌱 Populando dados de exemplo do ABZ Academy...');

    // 1. Criar categorias de exemplo
    const sampleCategories = [
      {
        name: 'Logística',
        description: 'Cursos sobre processos logísticos e supply chain',
        icon: 'TruckIcon',
        color: '#3B82F6',
        sort_order: 1
      },
      {
        name: 'Recursos Humanos',
        description: 'Treinamentos sobre gestão de pessoas e RH',
        icon: 'UserGroupIcon',
        color: '#10B981',
        sort_order: 2
      },
      {
        name: 'Tecnologia',
        description: 'Cursos sobre ferramentas e sistemas tecnológicos',
        icon: 'ComputerDesktopIcon',
        color: '#8B5CF6',
        sort_order: 3
      },
      {
        name: 'Compliance',
        description: 'Treinamentos sobre normas e regulamentações',
        icon: 'ShieldCheckIcon',
        color: '#F59E0B',
        sort_order: 4
      },
      {
        name: 'Desenvolvimento Pessoal',
        description: 'Cursos para crescimento profissional e pessoal',
        icon: 'AcademicCapIcon',
        color: '#EF4444',
        sort_order: 5
      }
    ];

    console.log('📝 Inserindo categorias...');
    const { data: categories, error: catError } = await supabaseAdmin
      .from('academy_categories')
      .upsert(sampleCategories, { onConflict: 'name' })
      .select();

    if (catError) {
      console.error('Erro ao inserir categorias:', catError);
      return NextResponse.json({
        error: 'Erro ao inserir categorias',
        details: catError.message
      }, { status: 500 });
    }

    console.log(`✅ ${categories?.length || 0} categorias inseridas`);

    // 2. Buscar um usuário admin para ser instrutor
    const { data: adminUser } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name')
      .eq('role', 'admin')
      .limit(1)
      .single();

    const instructorId = adminUser?.id;

    // 3. Criar cursos de exemplo
    const sampleCourses = [
      {
        title: 'Introdução à Logística Empresarial',
        description: 'Curso completo sobre os fundamentos da logística moderna, cobrindo desde conceitos básicos até estratégias avançadas de supply chain.',
        short_description: 'Aprenda os fundamentos da logística empresarial',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: '/images/courses/logistics-intro.jpg',
        duration: 3600, // 1 hora em segundos
        category_id: categories?.find(c => c.name === 'Logística')?.id,
        instructor_id: instructorId,
        difficulty_level: 'beginner',
        is_published: true,
        is_featured: true,
        tags: ['logística', 'supply chain', 'básico'],
        prerequisites: [],
        learning_objectives: [
          'Compreender os conceitos básicos de logística',
          'Identificar os principais processos logísticos',
          'Aplicar estratégias de otimização'
        ],
        sort_order: 1
      },
      {
        title: 'Gestão de Pessoas na Era Digital',
        description: 'Como liderar equipes e gerenciar pessoas em um ambiente de trabalho cada vez mais digital e remoto.',
        short_description: 'Liderança e gestão de equipes remotas',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: '/images/courses/people-management.jpg',
        duration: 2700, // 45 minutos
        category_id: categories?.find(c => c.name === 'Recursos Humanos')?.id,
        instructor_id: instructorId,
        difficulty_level: 'intermediate',
        is_published: true,
        is_featured: false,
        tags: ['rh', 'liderança', 'gestão', 'remoto'],
        prerequisites: [],
        learning_objectives: [
          'Desenvolver habilidades de liderança digital',
          'Gerenciar equipes remotas eficientemente',
          'Implementar ferramentas de colaboração'
        ],
        sort_order: 2
      },
      {
        title: 'Sistemas ERP: Implementação e Uso',
        description: 'Guia completo para implementação e utilização de sistemas ERP na empresa.',
        short_description: 'Domine os sistemas ERP empresariais',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: '/images/courses/erp-systems.jpg',
        duration: 4500, // 1h15min
        category_id: categories?.find(c => c.name === 'Tecnologia')?.id,
        instructor_id: instructorId,
        difficulty_level: 'advanced',
        is_published: true,
        is_featured: true,
        tags: ['erp', 'sistemas', 'tecnologia', 'implementação'],
        prerequisites: ['Conhecimentos básicos de informática'],
        learning_objectives: [
          'Compreender a arquitetura de sistemas ERP',
          'Planejar implementações de ERP',
          'Treinar usuários finais'
        ],
        sort_order: 3
      },
      {
        title: 'Compliance e Normas Regulatórias',
        description: 'Entenda as principais normas e regulamentações que afetam nossa indústria.',
        short_description: 'Normas e regulamentações essenciais',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: '/images/courses/compliance.jpg',
        duration: 1800, // 30 minutos
        category_id: categories?.find(c => c.name === 'Compliance')?.id,
        instructor_id: instructorId,
        difficulty_level: 'beginner',
        is_published: true,
        is_featured: false,
        tags: ['compliance', 'normas', 'regulamentação', 'legal'],
        prerequisites: [],
        learning_objectives: [
          'Conhecer as principais normas do setor',
          'Implementar práticas de compliance',
          'Evitar riscos regulatórios'
        ],
        sort_order: 4
      },
      {
        title: 'Desenvolvimento de Liderança',
        description: 'Desenvolva suas habilidades de liderança e torne-se um líder mais eficaz.',
        short_description: 'Torne-se um líder mais eficaz',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail_url: '/images/courses/leadership.jpg',
        duration: 5400, // 1h30min
        category_id: categories?.find(c => c.name === 'Desenvolvimento Pessoal')?.id,
        instructor_id: instructorId,
        difficulty_level: 'intermediate',
        is_published: true,
        is_featured: true,
        tags: ['liderança', 'desenvolvimento', 'soft skills', 'gestão'],
        prerequisites: ['Experiência em gestão de equipes'],
        learning_objectives: [
          'Desenvolver estilos de liderança eficazes',
          'Melhorar comunicação com equipes',
          'Implementar estratégias motivacionais'
        ],
        sort_order: 5
      }
    ];

    console.log('📚 Inserindo cursos...');
    const { data: courses, error: coursesError } = await supabaseAdmin
      .from('academy_courses')
      .upsert(sampleCourses, { onConflict: 'title' })
      .select();

    if (coursesError) {
      console.error('Erro ao inserir cursos:', coursesError);
      return NextResponse.json({
        error: 'Erro ao inserir cursos',
        details: coursesError.message
      }, { status: 500 });
    }

    console.log(`✅ ${courses?.length || 0} cursos inseridos`);

    // 4. Verificar se o card Academy existe
    const { data: academyCard, error: cardError } = await supabaseAdmin
      .from('cards')
      .select('*')
      .eq('id', 'academy')
      .single();

    if (cardError || !academyCard) {
      console.log('📝 Inserindo card Academy...');
      
      const academyCardData = {
        id: 'academy',
        title: 'ABZ Academy',
        description: 'Centro de treinamento e desenvolvimento profissional',
        href: '/academy',
        icon_name: 'FiPlay',
        color: 'bg-blue-600',
        hover_color: 'hover:bg-blue-700',
        external: false,
        enabled: true,
        order: 12,
        admin_only: false,
        manager_only: false,
        module_key: 'academy',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: insertCardError } = await supabaseAdmin
        .from('cards')
        .upsert(academyCardData, { onConflict: 'id' });

      if (insertCardError) {
        console.error('Erro ao inserir card Academy:', insertCardError);
      } else {
        console.log('✅ Card Academy inserido com sucesso!');
      }
    } else {
      console.log('✅ Card Academy já existe');
    }

    return NextResponse.json({
      success: true,
      message: 'Dados de exemplo do ABZ Academy populados com sucesso',
      data: {
        categories: categories?.length || 0,
        courses: courses?.length || 0,
        instructor: adminUser ? `${adminUser.first_name} ${adminUser.last_name}` : 'Não encontrado'
      }
    });

  } catch (error) {
    console.error('❌ Erro ao popular dados do Academy:', error);
    return NextResponse.json({
      error: 'Erro interno ao popular dados do Academy',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'API para popular dados de exemplo do ABZ Academy',
    description: 'Use POST para inserir categorias e cursos de exemplo',
    endpoints: {
      POST: 'Popula dados de exemplo do Academy'
    }
  });
}
