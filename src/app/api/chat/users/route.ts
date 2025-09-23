import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

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
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('users_unified')
      .select(`
        id,
        name,
        email,
        avatar,
        role,
        department,
        position,
        created_at,
        last_login
      `)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    // Filtrar por busca se especificado
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, error } = await query;

    if (error) {
      console.error('Erro ao buscar usuários:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar usuários'
      }, { status: 500 });
    }

    // Se channelId foi especificado, filtrar apenas membros do canal
    let filteredUsers = users || [];
    
    if (channelId) {
      const { data: channelMembers } = await supabase
        .from('chat_channel_members')
        .select('user_id')
        .eq('channel_id', channelId);

      const memberIds = channelMembers?.map(m => m.user_id) || [];
      filteredUsers = filteredUsers.filter(user => memberIds.includes(user.id));
    }

    // Buscar status de presença para cada usuário
    const userIds = filteredUsers.map(u => u.id);
    const { data: presenceData } = await supabase
      .from('chat_user_presence')
      .select('user_id, status, status_message, last_seen')
      .in('user_id', userIds);

    const presenceMap = presenceData?.reduce((acc: any, p: any) => {
      acc[p.user_id] = p;
      return acc;
    }, {}) || {};

    // Enriquecer usuários com dados de presença
    const enrichedUsers = filteredUsers.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      status: presenceMap[user.id]?.status || 'offline',
      statusMessage: presenceMap[user.id]?.status_message,
      lastSeen: presenceMap[user.id]?.last_seen || user.last_login,
      timezone: 'America/Sao_Paulo', // Padrão
      preferences: {
        theme: 'light',
        language: 'pt-BR',
        notifications: {
          desktop: true,
          mobile: true,
          email: false,
          sound: true,
          mentions: true,
          directMessages: true,
          channelMessages: false,
          keywords: [],
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            timezone: 'America/Sao_Paulo'
          },
          frequency: 'immediate'
        },
        privacy: {
          showOnlineStatus: true,
          showLastSeen: true,
          allowDirectMessages: 'everyone',
          allowMentions: 'everyone',
          showReadReceipts: true,
          showTypingIndicator: true,
          allowFileSharing: true,
          allowVoiceCalls: true,
          allowVideoCalls: true
        },
        accessibility: {
          fontSize: 'medium',
          highContrast: false,
          reduceMotion: false,
          screenReader: false,
          keyboardNavigation: false,
          colorBlindSupport: false
        }
      },
      permissions: {
        canCreateChannels: user.role === 'ADMIN' || user.role === 'MANAGER',
        canDeleteMessages: user.role === 'ADMIN',
        canEditMessages: true,
        canPinMessages: user.role === 'ADMIN' || user.role === 'MANAGER',
        canManageUsers: user.role === 'ADMIN',
        canManageChannels: user.role === 'ADMIN',
        canUploadFiles: true,
        canUseVoice: true,
        canUseVideo: true,
        canShareScreen: true,
        canCreatePolls: true,
        canCreateEvents: user.role === 'ADMIN' || user.role === 'MANAGER',
        canUseBots: user.role === 'ADMIN' || user.role === 'MANAGER',
        canManageIntegrations: user.role === 'ADMIN',
        maxFileSize: 50, // MB
        maxChannels: user.role === 'ADMIN' ? -1 : 10,
        maxDirectMessages: -1
      },
      statistics: {
        messagesCount: 0,
        channelsJoined: 0,
        filesShared: 0,
        reactionsGiven: 0,
        reactionsReceived: 0,
        mentionsGiven: 0,
        mentionsReceived: 0,
        voiceMinutes: 0,
        videoMinutes: 0,
        screenShareMinutes: 0,
        joinedAt: user.created_at,
        lastActiveAt: presenceMap[user.id]?.last_seen || user.last_login,
        averageResponseTime: 0,
        favoriteChannels: [],
        blockedUsers: []
      }
    }));

    // Filtrar por status se especificado
    let finalUsers = enrichedUsers;
    if (status) {
      finalUsers = enrichedUsers.filter(user => user.status === status);
    }

    return NextResponse.json({
      success: true,
      users: finalUsers
    });

  } catch (error) {
    console.error('Erro na API de usuários do chat:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
