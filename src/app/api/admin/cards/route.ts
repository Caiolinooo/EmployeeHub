import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { isAdminFromRequest } from '@/lib/auth';
import dashboardCards from '@/data/cards';
import { IconType } from 'react-icons';
import * as Icons from 'react-icons/fi';

export const dynamic = 'force-dynamic';

// Função para converter cards hardcoded para o formato do banco de dados
function convertHardcodedCards() {
  return dashboardCards.map(card => {
    // Obter o nome do ícone a partir do objeto do ícone
    let iconName = 'FiGrid';

    // Verificar se o ícone é um componente válido
    if (card.icon && typeof card.icon === 'function') {
      // Tentar obter o displayName do componente ou usar o nome da função
      iconName = (card.icon as any).displayName || card.icon.name || 'FiGrid';

      // Garantir que o nome do ícone esteja no formato correto (PascalCase)
      if (!iconName.startsWith('Fi')) {
        iconName = `Fi${iconName}`;
      }
    }

    return {
      id: card.id,
      title: card.title,
      description: card.description,
      href: card.href,
      icon: iconName,
      color: card.color,
      hover_color: card.hoverColor,
      external: card.external,
      enabled: card.enabled,
      order: card.order,
      admin_only: card.adminOnly || false,
      manager_only: card.managerOnly || false,
      allowed_roles: card.allowedRoles || null,
      allowed_user_ids: card.allowedUserIds || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  });
}

// Função para converter cards do banco de dados para o formato da aplicação
function convertDatabaseCards(dbCards: any[]) {
  return dbCards.map(card => {
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
  });
}

// GET - Obter todos os cards
export async function GET(request: NextRequest) {
  try {
    // Verificar se o usuário é administrador
    const adminCheck = await isAdminFromRequest(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 403 }
      );
    }

    console.log('Buscando cards...');

    try {
      // Buscar todos os cards usando Supabase
      const { data: cards, error } = await supabaseAdmin
        .from('cards')
        .select('*')
        .order('order', { ascending: true });

      if (error) {
        console.error('Erro ao buscar cards do Supabase:', error);

        // Se o erro for relacionado à tabela não existir, usar os cards hardcoded
        if (error.message.includes('does not exist') || error.code === '42P01') {
          console.log('Tabela cards não existe, usando cards hardcoded...');
          const hardcodedCards = convertHardcodedCards();
          return NextResponse.json(hardcodedCards);
        }

        throw error;
      }

      console.log(`Encontrados ${cards?.length || 0} cards no banco de dados`);

      // Se não houver cards no banco de dados, usar os hardcoded
      if (!cards || cards.length === 0) {
        console.log('Nenhum card encontrado no banco de dados, usando cards hardcoded...');
        const hardcodedCards = convertHardcodedCards();
        return NextResponse.json(hardcodedCards);
      }

      // Converter os cards do banco de dados para o formato da aplicação
      const formattedCards = convertDatabaseCards(cards);
      return NextResponse.json(formattedCards);
    } catch (error) {
      console.error('Erro ao buscar cards:', error);

      // Usar cards hardcoded como fallback
      console.log('Usando cards hardcoded como fallback...');
      const hardcodedCards = convertHardcodedCards();
      console.log('Cards hardcoded convertidos:', hardcodedCards.length);
      return NextResponse.json(hardcodedCards);
    }
  } catch (error) {
    console.error('Erro ao obter cards:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Criar um novo card
export async function POST(request: NextRequest) {
  try {
    // Verificar se o usuário é administrador
    const adminCheck = await isAdminFromRequest(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 403 }
      );
    }

    // Obter dados do corpo da requisição
    const body = await request.json();

    // Validar dados
    if (!body.title || !body.href) {
      return NextResponse.json(
        { error: 'Título e link são obrigatórios' },
        { status: 400 }
      );
    }

    // Criar o card usando Supabase
    const { data: card, error } = await supabaseAdmin
      .from('cards')
      .insert({
        id: body.id || `card-${Date.now()}`, // Usar ID fornecido ou gerar novo
        title: body.title,
        title_en: body.titleEn || body.title_en || body.title, // Suportar ambos os formatos
        description: body.description || '',
        description_en: body.descriptionEn || body.description_en || body.description || '',
        href: body.href,
        icon_name: body.iconName || body.icon_name || body.icon || 'FiGrid',
        color: body.color || 'bg-abz-blue',
        hover_color: body.hoverColor || body.hover_color || 'hover:bg-abz-blue-dark',
        enabled: body.enabled !== undefined ? body.enabled : true,
        order: body.order || 0,
        admin_only: body.adminOnly || body.admin_only || false,
        manager_only: body.managerOnly || body.manager_only || false,
        external: body.external || false,
        module_key: body.moduleKey || body.module_key || null,
        category: body.category || null,
        tags: body.tags || [],
        allowed_roles: body.allowedRoles || body.allowed_roles || [],
        allowed_user_ids: body.allowedUserIds || body.allowed_user_ids || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar card no Supabase:', error);
      return NextResponse.json(
        { error: `Erro ao criar card: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar card:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
}

// PUT - Atualizar um card existente
export async function PUT(request: NextRequest) {
  try {
    // Verificar se o usuário é administrador
    const adminCheck = await isAdminFromRequest(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 403 }
      );
    }

    // Obter dados do corpo da requisição
    const body = await request.json();

    // Validar dados
    if (!body.id || !body.title || !body.href) {
      return NextResponse.json(
        { error: 'ID, título e link são obrigatórios' },
        { status: 400 }
      );
    }

    // Atualizar o card usando Supabase
    const { data: card, error } = await supabaseAdmin
      .from('cards')
      .update({
        title: body.title,
        description: body.description || '',
        href: body.href,
        icon: body.icon || 'FiGrid',
        color: body.color || 'blue',
        hover_color: body.hoverColor || 'blue', // Nota: Supabase usa snake_case
        enabled: body.enabled !== undefined ? body.enabled : true,
        order: body.order || 0,
        admin_only: body.adminOnly || false, // Nota: Supabase usa snake_case
        external: body.external || false,
        updated_at: new Date().toISOString()
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar card no Supabase:', error);
      return NextResponse.json(
        { error: `Erro ao atualizar card: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(card);
  } catch (error) {
    console.error('Erro ao atualizar card:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
}
