import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAcademyAuth, withEditorAuth, logAcademyAction } from '@/lib/middleware/academy-auth';
import { canEditAcademy } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// GET - Listar categorias
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';

    let query = supabaseAdmin
      .from('academy_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: categories, error } = await query;

    if (error) {
      console.error('Erro ao buscar categorias:', error);
      return NextResponse.json({ error: 'Erro ao buscar categorias' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      categories: categories || []
    });

  } catch (error) {
    console.error('Erro na API de categorias:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar nova categoria
export const POST = withEditorAuth(async (request: NextRequest, user) => {
  try {

    const body = await request.json();
    const { name, description, icon, color, sort_order } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    // Criar categoria
    const { data: category, error: createError } = await supabaseAdmin
      .from('academy_categories')
      .insert({
        name,
        description,
        icon: icon || 'folder',
        color: color || '#0066CC',
        sort_order: sort_order || 0,
        is_active: true
      })
      .select()
      .single();

    if (createError) {
      console.error('Erro ao criar categoria:', createError);
      return NextResponse.json({ error: 'Erro ao criar categoria' }, { status: 500 });
    }

    // Log da ação
    await logAcademyAction(user, 'CREATE_CATEGORY', 'category', category.id, { name });

    console.log(`✅ Categoria criada: ${name} por ${user.first_name} ${user.last_name}`);

    return NextResponse.json({
      success: true,
      message: 'Categoria criada com sucesso',
      category
    });

  } catch (error) {
    console.error('Erro ao criar categoria:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
});

// PUT - Atualizar categoria
export async function PUT(request: NextRequest) {
  try {
    // Verificar autorização
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar token e obter usuário
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Buscar dados do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Verificar permissões
    if (!canEditAcademy(userData)) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, description, icon, color, sort_order, is_active } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'ID e nome são obrigatórios' }, { status: 400 });
    }

    // Atualizar categoria
    const { data: category, error: updateError } = await supabaseAdmin
      .from('academy_categories')
      .update({
        name,
        description,
        icon,
        color,
        sort_order,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar categoria:', updateError);
      return NextResponse.json({ error: 'Erro ao atualizar categoria' }, { status: 500 });
    }

    console.log(`✅ Categoria atualizada: ${name} por ${userData.first_name} ${userData.last_name}`);

    return NextResponse.json({
      success: true,
      message: 'Categoria atualizada com sucesso',
      category
    });

  } catch (error) {
    console.error('Erro ao atualizar categoria:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Excluir categoria
export async function DELETE(request: NextRequest) {
  try {
    // Verificar autorização
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar token e obter usuário
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Buscar dados do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Verificar permissões
    if (!canEditAcademy(userData)) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    // Verificar se há cursos usando esta categoria
    const { data: courses, error: coursesError } = await supabaseAdmin
      .from('academy_courses')
      .select('id')
      .eq('category_id', id)
      .limit(1);

    if (coursesError) {
      console.error('Erro ao verificar cursos:', coursesError);
      return NextResponse.json({ error: 'Erro ao verificar cursos' }, { status: 500 });
    }

    if (courses && courses.length > 0) {
      return NextResponse.json({ 
        error: 'Não é possível excluir categoria que possui cursos associados' 
      }, { status: 400 });
    }

    // Excluir categoria
    const { error: deleteError } = await supabaseAdmin
      .from('academy_categories')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao excluir categoria:', deleteError);
      return NextResponse.json({ error: 'Erro ao excluir categoria' }, { status: 500 });
    }

    console.log(`✅ Categoria excluída por ${userData.first_name} ${userData.last_name}`);

    return NextResponse.json({
      success: true,
      message: 'Categoria excluída com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir categoria:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
