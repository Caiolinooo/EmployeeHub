import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { UserPresence } from '@/types/chat';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const url = new URL(request.url);
    const channelId = url.searchParams.get('channelId');
    const status = url.searchParams.get('status');

    // Buscar presença de usuários
    let query = supabase
      .from('chat_user_presence')
      .select(`
        user_id,
        status,
        status_message,
        last_seen,
        current_channel,
        is_typing,
        device
      `)
      .order('last_seen', { ascending: false });

    // Filtrar por status se especificado
    if (status) {
      query = query.eq('status', status);
    }

    const { data: presenceData, error } = await query;

    if (error) {
      console.error('Erro ao buscar presença:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar presença'
      }, { status: 500 });
    }

    // Buscar informações dos usuários
    const userIds = presenceData?.map(p => p.user_id) || [];
    const { data: users } = await supabase
      .from('users_unified')
      .select('id, name, email, avatar')
      .in('id', userIds);

    const userMap = users?.reduce((acc: any, u: any) => {
      acc[u.id] = u;
      return acc;
    }, {}) || {};

    // Se channelId foi especificado, filtrar apenas membros do canal
    let filteredPresence = presenceData || [];
    
    if (channelId) {
      const { data: channelMembers } = await supabase
        .from('chat_channel_members')
        .select('user_id')
        .eq('channel_id', channelId);

      const memberIds = channelMembers?.map(m => m.user_id) || [];
      filteredPresence = filteredPresence.filter(p => memberIds.includes(p.user_id));
    }

    // Criar objetos de presença completos
    const presence: UserPresence[] = filteredPresence.map(p => ({
      userId: p.user_id,
      status: p.status || 'offline',
      statusMessage: p.status_message,
      lastSeen: p.last_seen,
      currentChannel: p.current_channel,
      isTyping: p.is_typing || false,
      device: p.device || 'web'
    }));

    // Simular alguns usuários online para demonstração
    const simulatedPresence: UserPresence[] = [
      {
        userId: 'user_1',
        status: 'online',
        statusMessage: 'Trabalhando no projeto',
        lastSeen: new Date().toISOString(),
        isTyping: false,
        device: 'desktop'
      },
      {
        userId: 'user_2',
        status: 'away',
        statusMessage: 'Em reunião',
        lastSeen: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutos atrás
        isTyping: false,
        device: 'mobile'
      },
      {
        userId: 'user_3',
        status: 'busy',
        statusMessage: 'Não perturbe',
        lastSeen: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutos atrás
        isTyping: false,
        device: 'web'
      }
    ];

    // Combinar presença real com simulada
    const allPresence = [...presence, ...simulatedPresence];

    return NextResponse.json({
      success: true,
      presence: allPresence
    });

  } catch (error) {
    console.error('Erro na API de presença:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const body = await request.json();
    const {
      status,
      statusMessage,
      currentChannel,
      isTyping = false,
      device = 'web'
    } = body;

    // Validar status
    const validStatuses = ['online', 'away', 'busy', 'offline', 'invisible'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({
        success: false,
        error: 'Status inválido'
      }, { status: 400 });
    }

    // Atualizar ou criar presença do usuário
    const { data: presence, error } = await supabase
      .from('chat_user_presence')
      .upsert({
        user_id: payload.userId,
        status: status || 'online',
        status_message: statusMessage,
        last_seen: new Date().toISOString(),
        current_channel: currentChannel,
        is_typing: isTyping,
        device
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar presença:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao atualizar presença'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      presence
    });

  } catch (error) {
    console.error('Erro ao atualizar presença:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const body = await request.json();
    const { action, channelId, isTyping } = body;

    switch (action) {
      case 'typing':
        // Atualizar indicador de digitação
        await supabase
          .from('chat_user_presence')
          .upsert({
            user_id: payload.userId,
            current_channel: channelId,
            is_typing: isTyping,
            last_seen: new Date().toISOString()
          });

        // Simular broadcast para outros usuários do canal
        // Em produção, isso seria feito via WebSocket
        
        return NextResponse.json({
          success: true,
          message: 'Indicador de digitação atualizado'
        });

      case 'heartbeat':
        // Atualizar última atividade
        await supabase
          .from('chat_user_presence')
          .upsert({
            user_id: payload.userId,
            last_seen: new Date().toISOString(),
            current_channel: channelId
          });

        return NextResponse.json({
          success: true,
          message: 'Heartbeat atualizado'
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Ação inválida'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Erro na ação de presença:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
