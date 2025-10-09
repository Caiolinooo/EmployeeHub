import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET - Obter todos os cards
export async function GET(request: NextRequest) {
  try {
    // Runtime check to ensure this only runs during actual HTTP requests
    if (typeof window !== 'undefined') {
      return NextResponse.json(
        { error: 'Esta rota só pode ser executada no servidor' },
        { status: 500 }
      );
    }

    // Check if we're in a static generation context
    if (!request || !request.headers) {
      return NextResponse.json(
        { error: 'Rota não disponível durante geração estática' },
        { status: 503 }
      );
    }

    console.log('API de cards Supabase - Recebendo requisição GET');

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

    // Verificar se o usuário existe no Supabase
    console.log('Buscando usuário no Supabase com ID:', payload.userId);
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, email, phone_number')
      .eq('id', payload.userId)
      .single();

    if (userError) {
      console.error('Erro ao buscar usuário:', userError);
      // Não retornar erro aqui, pois o usuário pode ter acesso mesmo sem estar na tabela users
    }

    // Definir o administrador principal
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';

    // Verificar se o usuário é o administrador principal
    const isMainAdmin = user?.email === adminEmail || user?.phone_number === adminPhone;

    console.log('Buscando cards no Supabase...');

    // Buscar todos os cards
    const { data: cards, error } = await supabaseAdmin
      .from('Card')
      .select('*')
      .order('order', { ascending: true });

    if (error) {
      console.error('Erro ao buscar cards:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar cards', details: error.message },
        { status: 500 }
      );
    }

    // Filtrar cards com base nas permissões do usuário
    const userRole = user?.role || 'USER';
    const isAdmin = userRole === 'ADMIN' || isMainAdmin;
    const isManager = userRole === 'MANAGER';

    const filteredCards = cards.filter(card => {
      // Se o card estiver desabilitado, não mostrar
      if (!card.enabled) return false;

      // Se o card for apenas para admin e o usuário não for admin, não mostrar
      if (card.adminOnly && !isAdmin) return false;

      // Se o card for apenas para gerentes e o usuário não for gerente nem admin, não mostrar
      if (card.managerOnly && !(isManager || isAdmin)) return false;

      // Se o card tiver roles permitidas e o usuário não estiver nelas, não mostrar (exceto se for admin)
      if (card.allowedRoles && card.allowedRoles.length > 0) {
        if (!isAdmin && !card.allowedRoles.includes(userRole.toLowerCase())) {
          return false;
        }
      }

      // Se o card tiver IDs de usuários permitidos e o usuário não estiver neles, não mostrar (exceto se for admin)
      if (card.allowedUserIds && card.allowedUserIds.length > 0) {
        if (!isAdmin && !card.allowedUserIds.includes(payload.userId)) {
          return false;
        }
      }

      return true;
    });

    console.log(`Retornando ${filteredCards.length} cards de ${cards.length} totais`);

    // Mapear para o formato esperado pelo frontend
    const formattedCards = filteredCards.map(card => ({
      id: card.id,
      title: card.title,
      description: card.description,
      href: card.href,
      icon: card.icon,
      iconName: card.iconName || card.icon,
      color: card.color,
      hoverColor: card.hoverColor,
      external: card.external || false,
      enabled: card.enabled !== false,
      order: card.order,
      adminOnly: card.adminOnly || false,
      managerOnly: card.managerOnly || false,
      allowedRoles: card.allowedRoles || [],
      allowedUserIds: card.allowedUserIds || [],
      moduleKey: card.moduleKey,
      titleEn: card.titleEn,
      descriptionEn: card.descriptionEn,
      category: card.category,
      tags: card.tags || []
    }));

    // Definir cabeçalhos para evitar cache
    const headers = new Headers();
    headers.append('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.append('Pragma', 'no-cache');
    headers.append('Expires', '0');

    return NextResponse.json(formattedCards, { headers });
  } catch (error) {
    console.error('Erro ao obter cards:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST - Obter cards com dados do usuário no body
export async function POST(request: NextRequest) {
  try {
    console.log('API de cards Supabase - Recebendo requisição POST');

    // Obter dados do body
    const body = await request.json();
    const { userId, userRole, userEmail, userPhone } = body;

    console.log('Dados recebidos:', { userId, userRole, userEmail, userPhone });

    if (!userId) {
      console.log('UserId não fornecido');
      return NextResponse.json(
        { error: 'UserId é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se o usuário existe no Supabase
    console.log('Buscando usuário no Supabase com ID:', userId);
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, email, phone_number')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Erro ao buscar usuário:', userError);
      // Usar dados do body como fallback
    }

    // Definir o administrador principal
    const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';

    // Verificar se o usuário é o administrador principal
    const isMainAdmin = (user?.email || userEmail) === adminEmail ||
                       (user?.phone_number || userPhone) === adminPhone;

    console.log('Buscando cards no Supabase...');

    // Buscar todos os cards
    const { data: cards, error } = await supabaseAdmin
      .from('Card')
      .select('*')
      .order('order', { ascending: true });

    if (error) {
      console.error('Erro ao buscar cards:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar cards', details: error.message },
        { status: 500 }
      );
    }

    // Filtrar cards com base nas permissões do usuário
    const finalUserRole = user?.role || userRole || 'USER';
    const isAdmin = finalUserRole === 'ADMIN' || finalUserRole === 'admin' || isMainAdmin;
    const isManager = finalUserRole === 'MANAGER' || finalUserRole === 'manager';

    const filteredCards = cards.filter(card => {
      // Se o card estiver desabilitado, não mostrar
      if (!card.enabled) return false;

      // Se o card for apenas para admin e o usuário não for admin, não mostrar
      if (card.adminOnly && !isAdmin) return false;

      // Se o card for apenas para gerentes e o usuário não for gerente nem admin, não mostrar
      if (card.managerOnly && !(isManager || isAdmin)) return false;

      // Se o card tiver roles permitidas e o usuário não estiver nelas, não mostrar (exceto se for admin)
      if (card.allowedRoles && card.allowedRoles.length > 0) {
        if (!isAdmin && !card.allowedRoles.includes(finalUserRole.toLowerCase())) {
          return false;
        }
      }

      // Se o card tiver IDs de usuários permitidos e o usuário não estiver neles, não mostrar (exceto se for admin)
      if (card.allowedUserIds && card.allowedUserIds.length > 0) {
        if (!isAdmin && !card.allowedUserIds.includes(userId)) {
          return false;
        }
      }

      return true;
    });

    console.log(`Retornando ${filteredCards.length} cards de ${cards.length} totais`);

    // Mapear para o formato esperado pelo frontend
    const formattedCards = filteredCards.map(card => ({
      id: card.id,
      title: card.title,
      description: card.description,
      href: card.href,
      icon: card.icon,
      iconName: card.iconName || card.icon,
      color: card.color,
      hoverColor: card.hoverColor,
      external: card.external || false,
      enabled: card.enabled !== false,
      order: card.order,
      adminOnly: card.adminOnly || false,
      managerOnly: card.managerOnly || false,
      allowedRoles: card.allowedRoles || [],
      allowedUserIds: card.allowedUserIds || [],
      moduleKey: card.moduleKey,
      titleEn: card.titleEn,
      descriptionEn: card.descriptionEn,
      category: card.category,
      tags: card.tags || []
    }));

    // Definir cabeçalhos para evitar cache
    const headers = new Headers();
    headers.append('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.append('Pragma', 'no-cache');
    headers.append('Expires', '0');

    return NextResponse.json(formattedCards, { headers });
  } catch (error) {
    console.error('Erro ao obter cards via POST:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
