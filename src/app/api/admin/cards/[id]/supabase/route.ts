import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - Obter um card específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`API de admin/cards/${params.id} Supabase - Recebendo requisição GET`);

    // Verificar autenticação
    const authHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      console.log('Token não fornecido');
      return NextResponse.json(
        { error: 'Não autorizado. Token não fornecido.' },
        { status: 401 }
      );
    }

    // Verificar se o token é válido
    let payload;
    try {
      payload = verifyToken(token);
      if (!payload) {
        console.log('Token inválido ou expirado');
        return NextResponse.json(
          { error: 'Token inválido ou expirado' },
          { status: 401 }
        );
      }
    } catch (tokenError) {
      console.error('Erro ao verificar token:', tokenError);
      return NextResponse.json(
        { error: 'Erro ao verificar token de autenticação' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é administrador
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, email, phone_number')
      .eq('id', payload.userId)
      .single();

    if (userError) {
      console.error('Erro ao buscar usuário:', userError);
      return NextResponse.json(
        { error: 'Erro ao verificar permissões de administrador' },
        { status: 500 }
      );
    }

    // Definir o administrador principal
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';

    // Verificar se o usuário é o administrador principal ou tem papel de ADMIN
    const isAdmin = user.role === 'ADMIN' || user.email === adminEmail || user.phone_number === adminPhone;

    if (!isAdmin) {
      console.log('Usuário não é administrador. Acesso negado.');
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem acessar esta API.' },
        { status: 403 }
      );
    }

    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const id = await Promise.resolve(params.id);
    console.log(`Buscando card com ID: ${id}`);

    // Buscar o card
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

    // Mapear para o formato esperado pelo frontend
    const formattedCard = {
      id: card.id,
      title: card.title,
      description: card.description,
      href: card.href,
      icon: card.icon,
      color: card.color,
      hoverColor: card.hover_color,
      external: card.external || false,
      enabled: card.enabled !== false,
      order: card.order,
      adminOnly: card.admin_only || false,
      managerOnly: card.manager_only || false,
      allowedRoles: card.allowed_roles || [],
      allowedUserIds: card.allowed_user_ids || [],
    };

    console.log('Card encontrado:', formattedCard.id);
    return NextResponse.json(formattedCard);
  } catch (error) {
    console.error('Erro ao obter card:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
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
    console.log(`API de admin/cards/${params.id} Supabase - Recebendo requisição PUT`);

    // Verificar autenticação
    const authHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      console.log('Token não fornecido');
      return NextResponse.json(
        { error: 'Não autorizado. Token não fornecido.' },
        { status: 401 }
      );
    }

    // Verificar se o token é válido
    let payload;
    try {
      payload = verifyToken(token);
      if (!payload) {
        console.log('Token inválido ou expirado');
        return NextResponse.json(
          { error: 'Token inválido ou expirado' },
          { status: 401 }
        );
      }
    } catch (tokenError) {
      console.error('Erro ao verificar token:', tokenError);
      return NextResponse.json(
        { error: 'Erro ao verificar token de autenticação' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é administrador
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, email, phone_number')
      .eq('id', payload.userId)
      .single();

    if (userError) {
      console.error('Erro ao buscar usuário:', userError);
      return NextResponse.json(
        { error: 'Erro ao verificar permissões de administrador' },
        { status: 500 }
      );
    }

    // Definir o administrador principal
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';

    // Verificar se o usuário é o administrador principal ou tem papel de ADMIN
    const isAdmin = user.role === 'ADMIN' || user.email === adminEmail || user.phone_number === adminPhone;

    if (!isAdmin) {
      console.log('Usuário não é administrador. Acesso negado.');
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem atualizar cards.' },
        { status: 403 }
      );
    }

    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const id = await Promise.resolve(params.id);
    const body = await request.json();
    console.log(`Atualizando card com ID: ${id}`);

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

    // Atualizar o card
    const { data: updatedCard, error } = await supabaseAdmin
      .from('cards')
      .update({
        title: body.title,
        description: body.description || '',
        href: body.href,
        icon: body.icon || 'FiGrid',
        color: body.color || 'blue',
        hover_color: body.hoverColor || 'blue',
        enabled: body.enabled !== undefined ? body.enabled : true,
        order: body.order || 0,
        admin_only: body.adminOnly || false,
        manager_only: body.managerOnly || false,
        external: body.external || false,
        allowed_roles: body.allowedRoles || [],
        allowed_user_ids: body.allowedUserIds || [],
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar card:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar card', details: error.message },
        { status: 500 }
      );
    }

    // Mapear para o formato esperado pelo frontend
    const formattedCard = {
      id: updatedCard.id,
      title: updatedCard.title,
      description: updatedCard.description,
      href: updatedCard.href,
      icon: updatedCard.icon,
      color: updatedCard.color,
      hoverColor: updatedCard.hover_color,
      external: updatedCard.external || false,
      enabled: updatedCard.enabled !== false,
      order: updatedCard.order,
      adminOnly: updatedCard.admin_only || false,
      managerOnly: updatedCard.manager_only || false,
      allowedRoles: updatedCard.allowed_roles || [],
      allowedUserIds: updatedCard.allowed_user_ids || [],
    };

    console.log('Card atualizado com sucesso:', formattedCard.id);
    return NextResponse.json(formattedCard);
  } catch (error) {
    console.error('Erro ao atualizar card:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
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
    console.log(`API de admin/cards/${params.id} Supabase - Recebendo requisição DELETE`);

    // Verificar autenticação
    const authHeader = request.headers.get('authorization') || '';
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      console.log('Token não fornecido');
      return NextResponse.json(
        { error: 'Não autorizado. Token não fornecido.' },
        { status: 401 }
      );
    }

    // Verificar se o token é válido
    let payload;
    try {
      payload = verifyToken(token);
      if (!payload) {
        console.log('Token inválido ou expirado');
        return NextResponse.json(
          { error: 'Token inválido ou expirado' },
          { status: 401 }
        );
      }
    } catch (tokenError) {
      console.error('Erro ao verificar token:', tokenError);
      return NextResponse.json(
        { error: 'Erro ao verificar token de autenticação' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é administrador
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, email, phone_number')
      .eq('id', payload.userId)
      .single();

    if (userError) {
      console.error('Erro ao buscar usuário:', userError);
      return NextResponse.json(
        { error: 'Erro ao verificar permissões de administrador' },
        { status: 500 }
      );
    }

    // Definir o administrador principal
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';

    // Verificar se o usuário é o administrador principal ou tem papel de ADMIN
    const isAdmin = user.role === 'ADMIN' || user.email === adminEmail || user.phone_number === adminPhone;

    if (!isAdmin) {
      console.log('Usuário não é administrador. Acesso negado.');
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem excluir cards.' },
        { status: 403 }
      );
    }

    // Garantir que params seja await antes de acessar suas propriedades
    // Usar Promise.resolve para garantir que params.id seja tratado como uma Promise
    const id = await Promise.resolve(params.id);
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
      console.error('Erro ao excluir card:', error);
      return NextResponse.json(
        { error: 'Erro ao excluir card', details: error.message },
        { status: 500 }
      );
    }

    console.log('Card excluído com sucesso');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir card:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
