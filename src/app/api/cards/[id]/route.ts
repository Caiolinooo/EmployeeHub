import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET - Obter um card pelo ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { params } = context;
  try {
    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const { id } = await params;

    const { data: card, error } = await supabaseAdmin
      .from('cards')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !card) {
      return NextResponse.json(
        { error: 'Card não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(card);
  } catch (error) {
    console.error('Erro ao obter card:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar um card
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { params } = context;
  try {
    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const { id } = await params;
    const body = await request.json();
    const {
      title, description, href, icon, color, hoverColor, external, enabled, order,
      adminOnly, managerOnly, allowedRoles, allowedUserIds, titleEn, descriptionEn
    } = body;

    // Validar os dados de entrada
    if (!title || !description || !href || !icon || !color || !hoverColor || order === undefined) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o card existe
    const { data: existingCard, error: existingError } = await supabaseAdmin
      .from('cards')
      .select('*')
      .eq('id', id)
      .single();

    if (existingError || !existingCard) {
      return NextResponse.json(
        { error: 'Card não encontrado' },
        { status: 404 }
      );
    }

    // Preparar os dados para atualização
    const updateData: any = {
      title,
      description,
      href,
      icon,
      color,
      hoverColor,
      external: external || false,
      enabled: enabled !== false,
      order,
      // Campos de tradução
      titleEn: titleEn || '',
      // Campos de controle de acesso
      adminOnly: adminOnly || false,
      managerOnly: managerOnly || false,
      allowedRoles: allowedRoles || [],
      allowedUserIds: allowedUserIds || [],
    };

    // Adicionar descriptionEn apenas se for fornecido
    if (descriptionEn !== undefined) {
      try {
        updateData.descriptionEn = descriptionEn || '';
      } catch (error) {
        console.warn('Campo descriptionEn não existe no banco de dados:', error);
        // Ignorar o erro e continuar sem o campo descriptionEn
      }
    }

    // Atualizar o card
    const { data: updatedCard, error: updateError } = await supabaseAdmin
      .from('cards')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao atualizar card' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedCard);
  } catch (error) {
    console.error('Erro ao atualizar card:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir um card
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Garantir que params seja await antes de acessar suas propriedades
    const resolvedParams = await params;
    const id = resolvedParams.id;

    // Verificar se o card existe
    const { data: existingCard, error: existingError } = await supabaseAdmin
      .from('cards')
      .select('*')
      .eq('id', id)
      .single();

    if (existingError || !existingCard) {
      return NextResponse.json(
        { error: 'Card não encontrado' },
        { status: 404 }
      );
    }

    // Excluir o card
    const { error: deleteError } = await supabaseAdmin
      .from('cards')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Erro ao excluir card' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Card excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir card:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
