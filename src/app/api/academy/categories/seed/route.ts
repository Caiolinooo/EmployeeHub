import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withEditorAuth } from '@/lib/middleware/academy-auth';

export const dynamic = 'force-dynamic';

const DEFAULT_CATEGORIES = [
  { name: 'Tecnologia', description: 'Cursos de tecnologia e programação', icon: 'code', color: '#0066CC', sort_order: 1 },
  { name: 'Negócios', description: 'Gestão, liderança e estratégia', icon: 'briefcase', color: '#28A745', sort_order: 2 },
  { name: 'Comunicação', description: 'Comunicação e apresentação', icon: 'message-circle', color: '#FD7E14', sort_order: 3 },
  { name: 'Desenvolvimento Pessoal', description: 'Crescimento pessoal e soft skills', icon: 'user', color: '#6F42C1', sort_order: 4 },
  { name: 'Segurança', description: 'Segurança e compliance', icon: 'shield', color: '#DC3545', sort_order: 5 },
  { name: 'Processos', description: 'Processos internos da empresa', icon: 'settings', color: '#6C757D', sort_order: 6 }
];

export const POST = withEditorAuth(async () => {
  try {
    // Verificar se já existem categorias
    const { data: existing, error: listError } = await supabaseAdmin
      .from('academy_categories')
      .select('id')
      .limit(1);

    if (listError) {
      console.error('Erro ao verificar categorias:', listError);
      return NextResponse.json({ error: 'Erro ao verificar categorias' }, { status: 500 });
    }

    if (existing && existing.length > 0) {
      return NextResponse.json({ success: true, message: 'Categorias já existem', action: 'noop' });
    }

    const { data, error } = await supabaseAdmin
      .from('academy_categories')
      .insert(DEFAULT_CATEGORIES)
      .select();

    if (error) {
      console.error('Erro ao inserir categorias:', error);
      return NextResponse.json({ error: 'Erro ao inserir categorias' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Categorias padrão criadas', categories: data });
  } catch (error) {
    console.error('Erro ao criar categorias padrão:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
});

