import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET - Listar categorias de notícias
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enabled_only = searchParams.get('enabled_only') !== 'false';

    console.log('🔄 API News Categories - Listando categorias');

    let query = supabaseAdmin
      .from('news_categories')
      .select('*')
      .order('name');

    if (enabled_only) {
      query = query.eq('enabled', true);
    }

    const { data: categories, error } = await query;

    if (error) {
      console.error('Erro ao buscar categorias:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar categorias' },
        { status: 500 }
      );
    }

    console.log(`✅ ${categories?.length || 0} categorias carregadas`);
    return NextResponse.json(categories || []);

  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar nova categoria
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, color, icon, enabled = true } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Nome é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`🔄 API News Categories - Criando categoria: ${name}`);

    const categoryData = {
      name,
      description: description || '',
      color: color || '#3B82F6',
      icon: icon || 'FiRss',
      enabled,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newCategory, error: insertError } = await supabaseAdmin
      .from('news_categories')
      .insert(categoryData)
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'Já existe uma categoria com este nome' },
          { status: 409 }
        );
      }
      
      console.error('Erro ao criar categoria:', insertError);
      return NextResponse.json(
        { error: 'Erro ao criar categoria' },
        { status: 500 }
      );
    }

    console.log(`✅ Categoria criada: ${newCategory.name}`);
    return NextResponse.json(newCategory, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar categoria:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
