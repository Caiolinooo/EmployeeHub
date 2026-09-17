import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { ChatChannel, ChannelSettings, ChannelPermissions, ChannelMetadata } from '@/types/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    const admin = await getSupabaseAdmin();

    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const department = url.searchParams.get('department');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = admin
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

    // Filtrar por servidor se especificado
    const serverId = url.searchParams.get('serverId');
    if (serverId) {
      query = query.eq('server_id', serverId);
    } else {
      // Se não tem serverId, assumimos comportamento legado ou DMs.
    }

    // Filtrar por tipo se especificado
    if (type) {
      query = query.eq('type', type);
    }

    // Filtrar por departamento se especificado
    if (department) {
      query = query.eq('metadata->department', department);
    }

    // Filtrar canais que o usuário tem acesso
    // Nota: Admin vê tudo. Usuários veem públicos + seus departamentos + suas roles + canais onde são membros explícitos.

    // Buscar info do usuário para filtragem
    const { data: user } = await admin
      .from('users_unified')
      .select('role, department')
      .eq('id', payload.userId)
      .single();

    const isAdmin = user?.role === 'ADMIN';

    let channels: unknown[] | undefined;
    let error: { message: string } | null = null;

    if (!isAdmin) {
      // Construir filtro complexo para não-admins
      // Logic: 
      // isPublic = true
      // OR properties->members contains userId
      // OR properties->departments contains user.department
      // OR properties->roles contains user.role
      // OR created_by = userId

      const userDepartment = user?.department || 'none';
      const userRole = user?.role || 'none';

      // Supabase query builder limitations makes complex ORs hard with JSONB.
      // We will fetch slightly more and filter in memory if needed, OR use a raw query (rpc) if performance is critical.
      // For now, let's try a best-effort PostgREST filter.
      // PostgREST doesn't easily support "jsonb_array_change OR jsonb_array_change".

      // Let's rely on a simplified strategy:
      // Fetch all non-archived channels for the server. 
      // Then filter in memory. This is okay for < 1000 channels.

      // Note: We already have 'query' built up top.
      const { data: allChannels, error: allErr } = await query;

      if (allErr) throw allErr;

      const filtered = allChannels?.filter((ch: any) => {
        const p = ch.permissions || {};

        // 1. Owner
        if (ch.created_by === payload.userId) return true;

        // 2. Public
        if (p.isPublic) return true;

        // 3. Member Explicit
        if (p.members?.includes(payload.userId)) return true;

        // 4. Department
        if (p.departments && p.departments[userDepartment]) return true;

        // 5. Role
        if (p.roles && p.roles[userRole]) return true;

        return false;
      });

      // Replace the standard fetch result with our filtered list
      channels = filtered;

    } else {
      // Admin sees all
      const { data: fetched, error: err } = await query;
      channels = fetched || [];
      error = err;
    }

    if (error) {
      console.error('Erro ao buscar canais:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar canais'
      }, { status: 500 });
    }

    // Buscar contagem de mensagens não lidas para cada canal
    const channelsWithUnread = await Promise.all(
      (channels || []).map(async (channel: any) => {
        const { data: unreadCount } = await admin
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
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const admin = await getSupabaseAdmin();

    // Verificar permissões: APENAS ADMIN
    const { data: user } = await admin
      .from('users_unified')
      .select('role, email, first_name, last_name')
      .eq('id', payload.userId)
      .single();

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Apenas administradores podem criar canais'
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      type = 'public',
      avatar,
      department, // Target department
      targetRole, // Target role
      accessLevel = 'public', // 'public', 'department', 'role', 'private'
      serverId,
      initialMembers = []
    } = body;

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'Nome do canal é obrigatório'
      }, { status: 400 });
    }

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
      maxFileSize: 50,
      allowedFileTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/*'],
      moderationEnabled: false,
      autoDeleteMessages: false,
      requireApproval: false,
      slowMode: 0
    };

    // Configure Permissions based on Access Level
    const permissions: ChannelPermissions = {
      owner: payload.userId,
      admins: [payload.userId],
      moderators: [],
      members: [payload.userId, ...initialMembers],
      viewers: [],
      blocked: [],
      roles: {},
      departments: {},
      isPublic: accessLevel === 'public',
      allowInvites: accessLevel === 'public',
      requireApproval: false
    };

    if (accessLevel === 'department' && department) {
      permissions.departments = { [department]: 'member' };
    }

    if (accessLevel === 'role' && targetRole) {
      permissions.roles = { [targetRole]: 'member' };
    }

    const channelMetadata: ChannelMetadata = {
      department: accessLevel === 'department' ? department : undefined,
      category: 'general',
      priority: 'normal',
      status: 'active',
      tags: [],
      externalIntegrations: [],
      customFields: {}
    };

    const { data: channel, error } = await admin
      .from('chat_channels')
      .insert({
        name,
        description,
        type,
        server_id: serverId,
        avatar,
        is_archived: false,
        created_by: payload.userId,
        member_count: permissions.members.length,
        unread_count: 0,
        settings: defaultSettings,
        permissions,
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

    // Add initial members
    if (initialMembers.length > 0) {
      const memberInserts = initialMembers.map((memberId: string) => ({
        channel_id: channel.id,
        user_id: memberId,
        role: 'member',
        joined_at: new Date().toISOString()
      }));

      await admin.from('chat_channel_members').insert(memberInserts);
    }

    // Add owner
    await admin.from('chat_channel_members').insert({
      channel_id: channel.id,
      user_id: payload.userId,
      role: 'owner',
      joined_at: new Date().toISOString()
    });

    await admin
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
              createdBy: ((user.first_name || '') + ' ' + (user.last_name || '')).trim() || user.email || 'Usuário'
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

    await admin
      .from('chat_audit_logs')
      .insert({
        channel_id: channel.id,
        action: 'create_channel',
        entity_type: 'channel',
        entity_id: channel.id,
        new_values: { name, type, isPublic: accessLevel === 'public' },
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
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const admin = await getSupabaseAdmin();

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID do canal é obrigatório'
      }, { status: 400 });
    }

    const { data: existingChannel, error: fetchError } = await admin
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

    const { data: user } = await admin
      .from('users_unified')
      .select('role, email')
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

    const { data: updatedChannel, error: updateError } = await admin
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

    await admin
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
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const admin = await getSupabaseAdmin();

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID do canal é obrigatório'
      }, { status: 400 });
    }

    const { data: existingChannel, error: fetchError } = await admin
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

    const { data: user } = await admin
      .from('users_unified')
      .select('role, email')
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

    const { error: deleteError } = await admin
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

    await admin
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
