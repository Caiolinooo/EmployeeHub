import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { ChatChannel, ChannelSettings, ChannelPermissions, ChannelMetadata } from '@/types/chat';

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
    const type = url.searchParams.get('type');
    const department = url.searchParams.get('department');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('chat_channels')
      .select(`
        id,
        name,
        description,
        type,
        avatar,
        is_archived,
        created_by,
        created_at,
        updated_at,
        last_activity,
        member_count,
        unread_count,
        settings,
        permissions,
        metadata
      `)
      .eq('is_archived', false)
      .order('last_activity', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtrar por tipo se especificado
    if (type) {
      query = query.eq('type', type);
    }

    // Filtrar por departamento se especificado
    if (department) {
      query = query.eq('metadata->department', department);
    }

    // Filtrar canais que o usuário tem acesso
    query = query.or(`permissions->isPublic.eq.true,permissions->members.cs.["${payload.userId}"],permissions->viewers.cs.["${payload.userId}"],created_by.eq.${payload.userId}`);

    const { data: channels, error } = await query;

    if (error) {
      console.error('Erro ao buscar canais:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar canais'
      }, { status: 500 });
    }

    // Buscar contagem de mensagens não lidas para cada canal
    const channelsWithUnread = await Promise.all(
      (channels || []).map(async (channel) => {
        const { data: unreadCount } = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact' })
          .eq('channel_id', channel.id)
          .not('read_by', 'cs', `["${payload.userId}"]`)
          .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // últimos 7 dias

        return {
          ...channel,
          unreadCount: unreadCount?.length || 0
        };
      })
    );

    return NextResponse.json({
      success: true,
      channels: channelsWithUnread
    });

  } catch (error) {
    console.error('Erro na API de canais:', error);
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

    // Verificar permissões
    const { data: user } = await supabase
      .from('users_unified')
      .select('role, access_permissions')
      .eq('id', payload.userId)
      .single();

    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para criar canais'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      type = 'public',
      avatar,
      department,
      project,
      tags = [],
      category = 'general',
      isPublic = true,
      allowInvites = true,
      settings,
      initialMembers = []
    } = body;

    // Validar campos obrigatórios
    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'Nome do canal é obrigatório'
      }, { status: 400 });
    }

    // Configurações padrão do canal
    const defaultSettings: ChannelSettings = {
      allowFileUploads: true,
      allowVoiceMessages: true,
      allowVideoMessages: true,
      allowScreenShare: true,
      allowReactions: true,
      allowThreads: true,
      allowMentions: true,
      allowBots: false,
      messageRetentionDays: 365,
      maxFileSize: 50, // 50MB
      allowedFileTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/*'],
      moderationEnabled: false,
      autoDeleteMessages: false,
      requireApproval: false,
      slowMode: 0,
      ...settings
    };

    // Permissões padrão do canal
    const defaultPermissions: ChannelPermissions = {
      owner: payload.userId,
      admins: [],
      moderators: [],
      members: [payload.userId, ...initialMembers],
      viewers: [],
      blocked: [],
      roles: {},
      departments: {},
      isPublic,
      allowInvites,
      requireApproval: !isPublic
    };

    // Metadados do canal
    const channelMetadata: ChannelMetadata = {
      department,
      project,
      tags,
      category,
      priority: 'normal',
      status: 'active',
      externalIntegrations: [],
      customFields: {}
    };

    // Criar canal
    const { data: channel, error } = await supabase
      .from('chat_channels')
      .insert({
        name,
        description,
        type,
        avatar,
        is_archived: false,
        created_by: payload.userId,
        member_count: defaultPermissions.members.length,
        unread_count: 0,
        settings: defaultSettings,
        permissions: defaultPermissions,
        metadata: channelMetadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar canal:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao criar canal'
      }, { status: 500 });
    }

    // Adicionar membros ao canal
    if (initialMembers.length > 0) {
      const memberInserts = initialMembers.map(memberId => ({
        channel_id: channel.id,
        user_id: memberId,
        role: 'member',
        joined_at: new Date().toISOString()
      }));

      await supabase
        .from('chat_channel_members')
        .insert(memberInserts);
    }

    // Adicionar criador como membro
    await supabase
      .from('chat_channel_members')
      .insert({
        channel_id: channel.id,
        user_id: payload.userId,
        role: 'owner',
        joined_at: new Date().toISOString()
      });

    // Criar mensagem de sistema
    await supabase
      .from('chat_messages')
      .insert({
        channel_id: channel.id,
        sender_id: 'system',
        sender_name: 'Sistema',
        content: {
          system: {
            type: 'channel_created',
            data: {
              channelName: name,
              createdBy: user.name || 'Usuário'
            }
          }
        },
        type: 'system',
        status: 'sent',
        timestamp: new Date().toISOString(),
        is_system: true,
        reactions: [],
        mentions: [],
        attachments: [],
        metadata: {
          editHistory: [],
          deliveryStatus: [],
          priority: 'normal',
          tags: [],
          customFields: {},
          aiGenerated: false
        },
        reply_count: 0,
        read_by: []
      });

    // Log da ação
    await supabase
      .from('chat_audit_logs')
      .insert({
        channel_id: channel.id,
        action: 'create_channel',
        entity_type: 'channel',
        entity_id: channel.id,
        new_values: { name, type, isPublic },
        user_id: payload.userId,
        user_email: user.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      channel
    });

  } catch (error) {
    console.error('Erro ao criar canal:', error);
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
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID do canal é obrigatório'
      }, { status: 400 });
    }

    // Buscar canal existente
    const { data: existingChannel, error: fetchError } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingChannel) {
      return NextResponse.json({
        success: false,
        error: 'Canal não encontrado'
      }, { status: 404 });
    }

    // Verificar permissões (owner, admin ou admin do sistema)
    const { data: user } = await supabase
      .from('users_unified')
      .select('role')
      .eq('id', payload.userId)
      .single();

    const isOwner = existingChannel.created_by === payload.userId;
    const isChannelAdmin = existingChannel.permissions?.admins?.includes(payload.userId);
    const isSystemAdmin = user?.role === 'ADMIN';

    if (!isOwner && !isChannelAdmin && !isSystemAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para editar este canal'
      }, { status: 403 });
    }

    // Atualizar canal
    const { data: updatedChannel, error: updateError } = await supabase
      .from('chat_channels')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar canal:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao atualizar canal'
      }, { status: 500 });
    }

    // Log da ação
    await supabase
      .from('chat_audit_logs')
      .insert({
        channel_id: id,
        action: 'update_channel',
        entity_type: 'channel',
        entity_id: id,
        old_values: existingChannel,
        new_values: updateData,
        user_id: payload.userId,
        user_email: user?.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      channel: updatedChannel
    });

  } catch (error) {
    console.error('Erro ao atualizar canal:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID do canal é obrigatório'
      }, { status: 400 });
    }

    // Buscar canal existente
    const { data: existingChannel, error: fetchError } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingChannel) {
      return NextResponse.json({
        success: false,
        error: 'Canal não encontrado'
      }, { status: 404 });
    }

    // Verificar permissões (owner ou admin do sistema)
    const { data: user } = await supabase
      .from('users_unified')
      .select('role')
      .eq('id', payload.userId)
      .single();

    const isOwner = existingChannel.created_by === payload.userId;
    const isSystemAdmin = user?.role === 'ADMIN';

    if (!isOwner && !isSystemAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para excluir este canal'
      }, { status: 403 });
    }

    // Arquivar canal (soft delete)
    const { error: deleteError } = await supabase
      .from('chat_channels')
      .update({
        is_archived: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao arquivar canal:', deleteError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao arquivar canal'
      }, { status: 500 });
    }

    // Log da ação
    await supabase
      .from('chat_audit_logs')
      .insert({
        channel_id: id,
        action: 'delete_channel',
        entity_type: 'channel',
        entity_id: id,
        old_values: existingChannel,
        user_id: payload.userId,
        user_email: user?.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      message: 'Canal arquivado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao arquivar canal:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
