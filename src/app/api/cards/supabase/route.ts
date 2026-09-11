import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { SYSTEM_MODULES } from '@/constants/modules';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Icon Map for System Modules
const ICON_MAP: Record<string, string> = {
  'dashboard': 'FiGrid',
  'noticias': 'FiRss',
  'calendario': 'FiCalendar',
  'ponto': 'FiClock',
  'contracheque': 'FiFileText',
  'reembolso': 'FiDollarSign',
  'kpi': 'FiTrendingUp',
  'avaliacao': 'FiBarChart2',
  'manual': 'FiBook',
  'procedimentos': 'FiList',
  'politicas': 'FiShield',
  'biblioteca': 'FiFolder',
  'academy': 'FiAward',
  'ajuda': 'FiAlertCircle',
  'compras': 'FiShoppingCart',
  'chat': 'FiMessageSquare',
  'wkradar': 'FiActivity',
  'contatos': 'FiPhone',
  'emergencia': 'FiAlertTriangle',
  'guia_offshore': 'FiCompass',
  'integracao-erp': 'FiDatabase',
  'contratos': 'FiFileText',
  'gestao-tripulantes': 'FiUsers',
  'e-social': 'FiBriefcase',
  'dp': 'FiBriefcase'
};

// Helper to merge cards
const mergeCards = (dbCards: any[], systemModules: typeof SYSTEM_MODULES) => {
  // Create a set of existing keys from DB cards (both id and module_key)
  const existingKeys = new Set<string>();

  dbCards.forEach(c => {
    if (c.id) existingKeys.add(c.id);
    if (c.module_key) existingKeys.add(c.module_key);
  });

  // Create "Virtual" cards from System Modules that aren't in DB
  const virtualCards = systemModules
    .filter(m => !existingKeys.has(m.id))
    .map(m => ({
      id: m.id, // Use key as ID
      title: m.label,
      description: m.description,
      href: m.href,
      icon_name: ICON_MAP[m.id] || 'FiBox',
      color: 'bg-blue-500 text-white', // Default color
      hover_color: 'bg-blue-600',
      client_route: true,
      external: false,
      enabled: m.visible !== false,
      order: 99, // Put at end
      admin_only: false,
      manager_only: false,
      allowed_roles: [],
      allowed_user_ids: [],
      module_key: m.id,
      title_en: m.label, // Fallback
      description_en: m.description,
      category: m.category,
      tags: []
    }));

  return [...dbCards, ...virtualCards];
};

// Common filtering logic
const filterCards = (cards: any[], user: any, userId: string) => {
  const userRole = user?.role || 'USER';
  // Define admin logic based on role or specific email/phone (reused from existing logic)
  const adminEmail = process.env.ADMIN_EMAIL || (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '');
  const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
  const isMainAdmin = user?.email === adminEmail || user?.phone_number === adminPhone;
  const isAdmin = userRole === 'ADMIN' || isMainAdmin || userRole === 'admin';
  const isManager = userRole === 'MANAGER' || userRole === 'manager';

  return cards.filter(card => {
    // Se o card estiver desabilitado, não mostrar
    if (!card.enabled) return false;

    // Se o card for apenas para admin e o usuário não for admin, não mostrar
    if (card.admin_only && !isAdmin) return false;

    // Se o card for apenas para gerentes e o usuário não for gerente nem admin, não mostrar
    if (card.manager_only && !(isManager || isAdmin)) return false;

    // Se o card tiver roles permitidas e o usuário não estiver nelas, não mostrar (exceto se for admin)
    if (card.allowed_roles && card.allowed_roles.length > 0) {
      const userRoleLower = userRole.toLowerCase();
      // Check if userRole matches any allowed role (case insensitive)
      const hasRole = card.allowed_roles.some((r: string) => r.toLowerCase() === userRoleLower);

      if (!isAdmin && !hasRole) {
        return false;
      }
    }

    // Se o card tiver IDs de usuários permitidos e o usuário não estiver neles, não mostrar (exceto se for admin)
    if (card.allowed_user_ids && card.allowed_user_ids.length > 0) {
      if (!isAdmin && !card.allowed_user_ids.includes(userId)) {
        return false;
      }
    }

    return true;
  });
};

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
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        { error: 'Não autorizado. Token não fornecido.' },
        { status: 401 }
      );
    }

    let payload;
    try {
      payload = verifyToken(token);
      if (!payload) {
        return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 401 });
      }
    } catch (tokenError) {
      return NextResponse.json({ error: 'Erro ao verificar token de autenticação' }, { status: 401 });
    }

    // Verificar usuário
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, email, phone_number')
      .eq('id', payload.userId)
      .single();

    if (userError) {
      console.error('Erro ao buscar usuário:', userError);
    }

    // Buscar cards do DB
    const { data: dbCards, error } = await supabaseAdmin
      .from('cards')
      .select('*')
      .order('order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Erro ao buscar cards', details: error.message }, { status: 500 });
    }

    // Merge DB cards with System Modules
    const allCards = mergeCards(dbCards || [], SYSTEM_MODULES);

    // Filter
    const filteredCards = filterCards(allCards, user, payload.userId);

    console.log(`Retornando ${filteredCards.length} cards (Combined)`);

    // Mapear para o formato esperado pelo frontend
    const formattedCards = filteredCards.map(card => ({
      id: card.id,
      title: card.title,
      description: card.description,
      href: card.href,
      icon: card.icon_name,
      iconName: card.icon_name,
      color: card.color,
      hoverColor: card.hover_color,
      external: card.external || false,
      enabled: card.enabled !== false,
      order: card.order,
      adminOnly: card.admin_only || false,
      managerOnly: card.manager_only || false,
      allowedRoles: card.allowed_roles || [],
      allowedUserIds: card.allowed_user_ids || [],
      moduleKey: card.module_key,
      titleEn: card.title_en,
      descriptionEn: card.description_en,
      category: card.category,
      tags: card.tags || []
    }));

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

    const body = await request.json();
    const { userId, userRole, userEmail, userPhone } = body;

    if (!userId) {
      return NextResponse.json({ error: 'UserId é obrigatório' }, { status: 400 });
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, role, email, phone_number')
      .eq('id', userId)
      .single();

    // Use passed details if user fetch fails or just to supplement
    const effectiveUser = user || { id: userId, role: userRole, email: userEmail, phone_number: userPhone };

    const { data: dbCards, error } = await supabaseAdmin
      .from('cards')
      .select('*')
      .order('order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Erro ao buscar cards', details: error.message }, { status: 500 });
    }

    // Merge
    const allCards = mergeCards(dbCards || [], SYSTEM_MODULES);

    // Filter
    const filteredCards = filterCards(allCards, effectiveUser, userId);

    console.log(`Retornando ${filteredCards.length} cards (Combined POST)`);

    const formattedCards = filteredCards.map(card => ({
      id: card.id,
      title: card.title,
      description: card.description,
      href: card.href,
      icon: card.icon_name,
      iconName: card.icon_name,
      color: card.color,
      hoverColor: card.hover_color,
      external: card.external || false,
      enabled: card.enabled !== false,
      order: card.order,
      adminOnly: card.admin_only || false,
      managerOnly: card.manager_only || false,
      allowedRoles: card.allowed_roles || [],
      allowedUserIds: card.allowed_user_ids || [],
      moduleKey: card.module_key,
      titleEn: card.title_en,
      descriptionEn: card.description_en,
      category: card.category,
      tags: card.tags || []
    }));

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
