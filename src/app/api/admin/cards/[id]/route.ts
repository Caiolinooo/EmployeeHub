import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { isAdminFromRequest } from '@/lib/auth';
import * as Icons from 'react-icons/fi';
import { IconType } from 'react-icons';

export const dynamic = 'force-dynamic';

// Função para converter cards do banco de dados para o formato da aplicação
function convertDatabaseCard(card: any) {
  // Converter o nome do ícone para o componente do ícone
  let icon: IconType = Icons.FiGrid;

  if (card.icon && typeof card.icon === 'string') {
    // Garantir que o nome do ícone esteja no formato correto (PascalCase)
    // Se o nome não começar com 'Fi', adicionar o prefixo
    const iconName = card.icon.startsWith('Fi') ? card.icon : `Fi${card.icon}`;

    // Verificar se o ícone existe no objeto Icons
    if (Icons[iconName as keyof typeof Icons]) {
      icon = Icons[iconName as keyof typeof Icons];
    } else {
      console.warn(`Ícone não encontrado: ${iconName}, usando FiGrid como fallback`);
      icon = Icons.FiGrid;
    }
  }

  return {
    id: card.id,
    title: card.title,
    description: card.description,
    href: card.href,
    icon: icon,
    color: card.color,
    hoverColor: card.hover_color,
    external: card.external,
    enabled: card.enabled,
    order: card.order,
    adminOnly: card.admin_only,
    managerOnly: card.manager_only,
    allowedRoles: card.allowed_roles,
    allowedUserIds: card.allowed_user_ids
  };
}

// GET - Obter um card específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar se o usuário é administrador
    const adminCheck = await isAdminFromRequest(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 403 }
      );
    }

    // Garantir que params seja await antes de acessar suas propriedades
    const resolvedParams = await params;
    const id = resolvedParams.id;

    console.log(`Buscando card com ID: ${id}`);

    // Buscar o card usando Supabase
    const { data: card, error } = await supabaseAdmin
      .from('cards')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar card:', error);
      return NextResponse.json(
        { error: 'Card não encontrado' },
        { status: 404 }
      );
    }

    // Converter o card para o formato da aplicação
    const formattedCard = convertDatabaseCard(card);

    return NextResponse.json(formattedCard);
  } catch (error) {
    console.error('Erro ao obter card:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
}

// PUT - Atualizar um card existente
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar se o usuário é administrador
    const adminCheck = await isAdminFromRequest(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 403 }
      );
    }

    // Garantir que params seja await antes de acessar suas propriedades
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await request.json();

    console.log(`Atualizando card com ID: ${id}`, body);

    // Verificar se o card existe
    const { data: existingCard, error: checkError } = await supabaseAdmin
      .from('cards')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError) {
      console.error('Erro ao verificar existência do card:', checkError);
      return NextResponse.json(
        { error: 'Card não encontrado' },
        { status: 404 }
      );
    }

    // Preparar os dados para atualização
    // Verificar se o ícone é um objeto (componente React) e extrair o nome
    let iconName = 'FiGrid';
    if (body.icon) {
      if (typeof body.icon === 'string') {
        iconName = body.icon.startsWith('Fi') ? body.icon : `Fi${body.icon}`;
      } else if (typeof body.icon === 'object' && body.icon.displayName) {
        iconName = body.icon.displayName;
      }
    }

    console.log(`Ícone para atualização: ${iconName}`);

    // Atualizar o card usando Supabase
    const { data: updatedCard, error } = await supabaseAdmin
      .from('cards')
      .update({
        title: body.title,
        description: body.description || '',
        href: body.href,
        icon: iconName,
        color: body.color || 'blue',
        hover_color: body.hoverColor || 'blue', // Nota: Supabase usa snake_case
        enabled: body.enabled !== undefined ? body.enabled : true,
        order: body.order || 0,
        admin_only: body.adminOnly !== undefined ? body.adminOnly : false, // Nota: Supabase usa snake_case
        manager_only: body.managerOnly !== undefined ? body.managerOnly : false,
        external: body.external !== undefined ? body.external : false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar card no Supabase:', error);
      return NextResponse.json(
        { error: `Erro ao atualizar card: ${error.message}` },
        { status: 500 }
      );
    }

    // Converter o card atualizado para o formato da aplicação
    const formattedCard = convertDatabaseCard(updatedCard);

    console.log('Card atualizado com sucesso:', formattedCard.id);
    return NextResponse.json(formattedCard);
  } catch (error) {
    console.error('Erro ao atualizar card:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE - Excluir um card
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar se o usuário é administrador
    const adminCheck = await isAdminFromRequest(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 403 }
      );
    }

    // Garantir que params seja await antes de acessar suas propriedades
    const resolvedParams = await params;
    const id = resolvedParams.id;

    console.log(`Excluindo card com ID: ${id}`);

    // Verificar se o card existe
    const { data: existingCard, error: checkError } = await supabaseAdmin
      .from('cards')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError) {
      console.error('Erro ao verificar existência do card:', checkError);
      return NextResponse.json(
        { error: 'Card não encontrado' },
        { status: 404 }
      );
    }

    // Excluir o card
    const { error } = await supabaseAdmin
      .from('cards')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir card no Supabase:', error);
      return NextResponse.json(
        { error: `Erro ao excluir card: ${error.message}` },
        { status: 500 }
      );
    }

    console.log(`Card ID ${id} excluído com sucesso`);
    return NextResponse.json({ success: true, message: 'Card excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir card:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
}
