import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET - Listar notificações do usuário
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type');
    const unread_only = searchParams.get('unread_only') === 'true';

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`🔄 API Notifications - Listando notificações do usuário ${user_id}`);

    // Construir query
    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (type) {
      query = query.eq('type', type);
    }

    if (unread_only) {
      query = query.is('read_at', null);
    }

    // Filtrar notificações não expiradas
    query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    // Aplicar paginação
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Erro ao buscar notificações:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar notificações' },
        { status: 500 }
      );
    }

    // Buscar contagem total e não lidas
    const { count: totalCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    const { count: unreadCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .is('read_at', null)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    console.log(`✅ ${notifications?.length || 0} notificações carregadas (${unreadCount} não lidas)`);

    return NextResponse.json({
      notifications: notifications || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
        hasNext: page * limit < (totalCount || 0),
        hasPrev: page > 1
      },
      unreadCount: unreadCount || 0
    });

  } catch (error) {
    console.error('Erro ao listar notificações:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar nova notificação
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      type,
      title,
      message,
      data = {},
      action_url,
      priority = 'normal',
      expires_at
    } = body;

    if (!user_id || !type || !title) {
      return NextResponse.json(
        { error: 'user_id, type e title são obrigatórios' },
        { status: 400 }
      );
    }

    console.log(`🔄 API Notifications - Criando notificação para usuário ${user_id}: ${title}`);

    // Verificar se o usuário existe
    const { data: user, error: userError } = await supabaseAdmin
      .from('users_unified')
      .select('id, first_name, last_name')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Criar notificação
    const notificationData = {
      user_id,
      type,
      title,
      message: message || '',
      data: JSON.stringify(data),
      action_url: action_url || null,
      priority,
      expires_at: expires_at || null,
      created_at: new Date().toISOString()
    };

    const { data: newNotification, error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar notificação:', insertError);
      return NextResponse.json(
        { error: 'Erro ao criar notificação' },
        { status: 500 }
      );
    }

    console.log(`✅ Notificação criada: ${newNotification.title} para ${user.first_name}`);

    // TODO: Enviar notificação em tempo real via WebSocket
    // TODO: Enviar push notification se configurado

    return NextResponse.json(newNotification, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
