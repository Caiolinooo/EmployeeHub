import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - Obter todos os cards (para administração)
export async function GET(request: NextRequest) {
  try {
    console.log('API de admin/cards Supabase - Recebendo requisição GET');

    // Verificar autenticação
    const authHeader = request.headers.get('authorization') || '';
    console.log('Cabeçalho de autorização:', authHeader ? 'Presente' : 'Ausente');

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
      console.log('Token válido para usuário:', payload.userId);
    } catch (tokenError) {
      console.error('Erro ao verificar token:', tokenError);
      return NextResponse.json(
        { error: 'Erro ao verificar token de autenticação' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é administrador
    console.log('Verificando se o usuário é administrador');

    // Verificar se o usuário existe no Supabase
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

    console.log('Usuário é administrador. Buscando todos os cards...');

    // Buscar todos os cards
    const { data: cards, error } = await supabaseAdmin
      .from('cards')
      .select('*')
      .order('order', { ascending: true });

    if (error) {
      console.error('Erro ao buscar cards:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar cards', details: error.message },
        { status: 500 }
      );
    }

    // Mapear para o formato esperado pelo frontend
    const formattedCards = cards.map(card => ({
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
    }));

    console.log(`Retornando ${formattedCards.length} cards para o administrador`);

    // Definir cabeçalhos para evitar cache
    const headers = new Headers();
    headers.append('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.append('Pragma', 'no-cache');
    headers.append('Expires', '0');

    return NextResponse.json(formattedCards, { headers });
  } catch (error) {
    console.error('Erro ao obter cards para administração:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST - Criar um novo card
export async function POST(request: NextRequest) {
  try {
    console.log('API de admin/cards Supabase - Recebendo requisição POST');

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
        { error: 'Acesso negado. Apenas administradores podem criar cards.' },
        { status: 403 }
      );
    }

    // Obter dados do corpo da requisição
    const body = await request.json();
    console.log('Dados recebidos para criação de card:', body);

    // Validar dados
    if (!body.title || !body.href) {
      return NextResponse.json(
        { error: 'Título e link são obrigatórios' },
        { status: 400 }
      );
    }

    // Criar o card
    const { data: card, error } = await supabaseAdmin
      .from('cards')
      .insert({
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
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar card:', error);
      return NextResponse.json(
        { error: 'Erro ao criar card', details: error.message },
        { status: 500 }
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

    console.log('Card criado com sucesso:', formattedCard.id);
    return NextResponse.json(formattedCard, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar card:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// PUT - Atualizar todos os cards (ordenação em massa)
export async function PUT(request: NextRequest) {
  try {
    console.log('API de admin/cards Supabase - Recebendo requisição PUT');

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

    // Obter dados do corpo da requisição
    const body = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Formato inválido. Esperado um array de cards.' },
        { status: 400 }
      );
    }

    console.log(`Atualizando ${body.length} cards...`);

    // Atualizar cada card
    const updates = body.map(card => {
      return supabaseAdmin
        .from('cards')
        .update({
          order: card.order,
          enabled: card.enabled
        })
        .eq('id', card.id);
    });

    // Executar todas as atualizações
    await Promise.all(updates);

    console.log('Cards atualizados com sucesso');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar cards:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
