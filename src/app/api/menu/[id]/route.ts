import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET - Obter um item de menu pelo ID
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { params } = context;
  try {
    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const id = await Promise.resolve(params.id);

    const { data: menuItem, error } = await supabaseAdmin
      .from('menu_items')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !menuItem) {
      return NextResponse.json(
        { error: 'Item de menu não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(menuItem);
  } catch (error) {
    console.error('Erro ao obter item de menu:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar um item de menu
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const id = await Promise.resolve(params.id);
    const body = await request.json();
    const { href, label, icon, external, enabled, order, adminOnly } = body;

    // Validar os dados de entrada
    if (!href || !label || !icon || order === undefined) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o item de menu existe
    const { data: existingMenuItem, error: findError } = await supabaseAdmin
      .from('menu_items')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existingMenuItem) {
      return NextResponse.json(
        { error: 'Item de menu não encontrado' },
        { status: 404 }
      );
    }

    // Atualizar o item de menu
    const { data: updatedMenuItem, error: updateError } = await supabaseAdmin
      .from('menu_items')
      .update({
        href,
        label,
        icon,
        external: external || false,
        enabled: enabled !== false,
        order,
        adminOnly: adminOnly || false,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao atualizar item de menu' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedMenuItem);
  } catch (error) {
    console.error('Erro ao atualizar item de menu:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir um item de menu
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const id = await Promise.resolve(params.id);

    // Verificar se o item de menu existe
    const { data: existingMenuItem, error: findError } = await supabaseAdmin
      .from('menu_items')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existingMenuItem) {
      return NextResponse.json(
        { error: 'Item de menu não encontrado' },
        { status: 404 }
      );
    }

    // Excluir o item de menu
    const { error: deleteError } = await supabaseAdmin
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Erro ao excluir item de menu' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Item de menu excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir item de menu:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
