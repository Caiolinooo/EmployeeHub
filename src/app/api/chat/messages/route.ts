import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';
import { ChatMessage, MessageContent, MessageMetadata } from '@/types/chat';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const url = new URL(request.url);
    const channelId = url.searchParams.get('channelId');
    const threadId = url.searchParams.get('threadId');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const before = url.searchParams.get('before'); // timestamp
    const after = url.searchParams.get('after'); // timestamp

    if (!channelId) {
      return NextResponse.json({
        success: false,
        error: 'ID do canal é obrigatório'
      }, { status: 400 });
    }

    // Verificar se usuário tem acesso ao canal
    const { data: channel } = await supabase
      .from('chat_channels')
      .select('permissions')
      .eq('id', channelId)
      .single();

    if (!channel) {
      return NextResponse.json({
        success: false,
        error: 'Canal não encontrado'
      }, { status: 404 });
    }

    const hasAccess = channel.permissions?.isPublic ||
                     channel.permissions?.members?.includes(authResult.payload.userId) ||
                     channel.permissions?.viewers?.includes(authResult.payload.userId);

    if (!hasAccess) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para acessar este canal'
      }, { status: 403 });
    }

    let query = supabase
      .from('chat_messages')
      .select(`
        id,
        channel_id,
        thread_id,
        parent_message_id,
        sender_id,
        sender_name,
        sender_avatar,
        content,
        type,
        status,
        timestamp,
        edited_at,
        deleted_at,
        reactions,
        mentions,
        attachments,
        metadata,
        is_system,
        is_pinned,
        is_important,
        reply_count,
        read_by
      `)
      .eq('channel_id', channelId)
      .is('deleted_at', null)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtrar por thread se especificado
    if (threadId) {
      query = query.eq('thread_id', threadId);
    } else {
      query = query.is('thread_id', null);
    }

    // Filtrar por período se especificado
    if (before) {
      query = query.lt('timestamp', before);
    }
    if (after) {
      query = query.gt('timestamp', after);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar mensagens'
      }, { status: 500 });
    }

    // Reverter ordem para mostrar mensagens mais antigas primeiro
    const orderedMessages = (messages || []).reverse();

    return NextResponse.json({
      success: true,
      messages: orderedMessages
    });

  } catch (error) {
    console.error('Erro na API de mensagens:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const body = await request.json();
    const {
      channelId,
      threadId,
      parentMessageId,
      content,
      type = 'text',
      mentions = [],
      attachments = [],
      isImportant = false,
      metadata = {}
    } = body;

    // Validar campos obrigatórios
    if (!channelId || !content) {
      return NextResponse.json({
        success: false,
        error: 'Canal e conteúdo são obrigatórios'
      }, { status: 400 });
    }

    // Verificar se usuário tem acesso ao canal
    const { data: channel } = await supabase
      .from('chat_channels')
      .select('permissions, settings')
      .eq('id', channelId)
      .single();

    if (!channel) {
      return NextResponse.json({
        success: false,
        error: 'Canal não encontrado'
      }, { status: 404 });
    }

    const canSendMessages = channel.permissions?.isPublic ||
                           channel.permissions?.members?.includes(authResult.payload.userId);

    if (!canSendMessages) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para enviar mensagens neste canal'
      }, { status: 403 });
    }

    // Buscar informações do usuário
    const { data: user } = await supabase
      .from('users_unified')
      .select('name, email, avatar')
      .eq('id', authResult.payload.userId)
      .single();

    // Processar menções
    const processedMentions = mentions.map((mention: any) => ({
      id: `mention_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: mention.type || 'user',
      targetId: mention.targetId,
      targetName: mention.targetName,
      startIndex: mention.startIndex || 0,
      endIndex: mention.endIndex || 0
    }));

    // Processar anexos
    const processedAttachments = attachments.map((attachment: any) => ({
      id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: attachment.name,
      type: attachment.type,
      url: attachment.url,
      thumbnailUrl: attachment.thumbnailUrl,
      size: attachment.size,
      mimeType: attachment.mimeType,
      width: attachment.width,
      height: attachment.height,
      duration: attachment.duration,
      uploadedAt: new Date().toISOString(),
      metadata: {
        originalName: attachment.name,
        uploadedBy: authResult.payload.userId,
        isPublic: false,
        downloadCount: 0,
        virusScanStatus: 'clean',
        compressionApplied: false,
        customFields: {}
      }
    }));

    // Metadados da mensagem
    const messageMetadata: MessageMetadata = {
      editHistory: [],
      deliveryStatus: [],
      priority: 'normal',
      tags: [],
      customFields: {},
      aiGenerated: false,
      ...metadata
    };

    // Criar mensagem
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({
        id: messageId,
        channel_id: channelId,
        thread_id: threadId,
        parent_message_id: parentMessageId,
        sender_id: authResult.payload.userId,
        sender_name: user?.name || 'Usuário',
        sender_avatar: user?.avatar,
        content,
        type,
        status: 'sent',
        timestamp: new Date().toISOString(),
        reactions: [],
        mentions: processedMentions,
        attachments: processedAttachments,
        metadata: messageMetadata,
        is_system: false,
        is_pinned: false,
        is_important: isImportant,
        reply_count: 0,
        read_by: [authResult.payload.userId]
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar mensagem:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao criar mensagem'
      }, { status: 500 });
    }

    // Atualizar última atividade do canal
    await supabase
      .from('chat_channels')
      .update({
        last_activity: new Date().toISOString()
      })
      .eq('id', channelId);

    // Se é uma resposta, incrementar contador de replies
    if (parentMessageId) {
      await supabase
        .from('chat_messages')
        .update({
          reply_count: supabase.raw('reply_count + 1')
        })
        .eq('id', parentMessageId);
    }

    // Processar notificações para menções
    if (processedMentions.length > 0) {
      const notificationPromises = processedMentions.map(async (mention) => {
        if (mention.type === 'user' && mention.targetId !== authResult.payload.userId) {
          await supabase
            .from('chat_notifications')
            .insert({
              user_id: mention.targetId,
              type: 'mention',
              title: `Menção em #${channel.name || 'canal'}`,
              message: `${user?.name || 'Usuário'} mencionou você`,
              channel_id: channelId,
              message_id: messageId,
              sender_id: authResult.payload.userId,
              is_read: false,
              created_at: new Date().toISOString(),
              metadata: {
                channelName: channel.name,
                messagePreview: typeof content === 'string' ? content.substring(0, 100) : 'Mensagem'
              }
            });
        }
      });

      await Promise.all(notificationPromises);
    }

    // Log da ação
    await supabase
      .from('chat_audit_logs')
      .insert({
        channel_id: channelId,
        action: 'send_message',
        entity_type: 'message',
        entity_id: messageId,
        new_values: { type, hasAttachments: attachments.length > 0, hasMentions: mentions.length > 0 },
        user_id: authResult.payload.userId,
        user_email: user?.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      message
    });

  } catch (error) {
    console.error('Erro ao criar mensagem:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyToken(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    const body = await request.json();
    const { id, content, reason } = body;

    if (!id || !content) {
      return NextResponse.json({
        success: false,
        error: 'ID da mensagem e conteúdo são obrigatórios'
      }, { status: 400 });
    }

    // Buscar mensagem existente
    const { data: existingMessage, error: fetchError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingMessage) {
      return NextResponse.json({
        success: false,
        error: 'Mensagem não encontrada'
      }, { status: 404 });
    }

    // Verificar permissões (apenas o autor pode editar)
    if (existingMessage.sender_id !== authResult.payload.userId) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para editar esta mensagem'
      }, { status: 403 });
    }

    // Verificar se mensagem pode ser editada (não muito antiga)
    const messageAge = Date.now() - new Date(existingMessage.timestamp).getTime();
    const maxEditTime = 24 * 60 * 60 * 1000; // 24 horas

    if (messageAge > maxEditTime) {
      return NextResponse.json({
        success: false,
        error: 'Mensagem muito antiga para ser editada'
      }, { status: 400 });
    }

    // Adicionar ao histórico de edições
    const editHistory = existingMessage.metadata?.editHistory || [];
    editHistory.push({
      editedAt: new Date().toISOString(),
      editedBy: authResult.payload.userId,
      previousContent: existingMessage.content,
      reason
    });

    // Atualizar mensagem
    const { data: updatedMessage, error: updateError } = await supabase
      .from('chat_messages')
      .update({
        content,
        edited_at: new Date().toISOString(),
        metadata: {
          ...existingMessage.metadata,
          editHistory
        }
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar mensagem:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao atualizar mensagem'
      }, { status: 500 });
    }

    // Log da ação
    await supabase
      .from('chat_audit_logs')
      .insert({
        channel_id: existingMessage.channel_id,
        action: 'edit_message',
        entity_type: 'message',
        entity_id: id,
        old_values: { content: existingMessage.content },
        new_values: { content, reason },
        user_id: authResult.payload.userId,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      message: updatedMessage
    });

  } catch (error) {
    console.error('Erro ao atualizar mensagem:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verificar autenticação
    const authResult = await verifyToken(request);
    if (!authResult.valid || !authResult.payload) {
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
        error: 'ID da mensagem é obrigatório'
      }, { status: 400 });
    }

    // Buscar mensagem existente
    const { data: existingMessage, error: fetchError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingMessage) {
      return NextResponse.json({
        success: false,
        error: 'Mensagem não encontrada'
      }, { status: 404 });
    }

    // Verificar permissões (autor ou admin do canal/sistema)
    const { data: user } = await supabase
      .from('users_unified')
      .select('role')
      .eq('id', authResult.payload.userId)
      .single();

    const isAuthor = existingMessage.sender_id === authResult.payload.userId;
    const isSystemAdmin = user?.role === 'ADMIN';

    // Verificar se é admin do canal
    const { data: channel } = await supabase
      .from('chat_channels')
      .select('permissions')
      .eq('id', existingMessage.channel_id)
      .single();

    const isChannelAdmin = channel?.permissions?.admins?.includes(authResult.payload.userId);

    if (!isAuthor && !isChannelAdmin && !isSystemAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Sem permissão para excluir esta mensagem'
      }, { status: 403 });
    }

    // Soft delete - marcar como deletada
    const { error: deleteError } = await supabase
      .from('chat_messages')
      .update({
        deleted_at: new Date().toISOString(),
        content: { text: '[Mensagem deletada]' },
        status: 'deleted'
      })
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao deletar mensagem:', deleteError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao deletar mensagem'
      }, { status: 500 });
    }

    // Log da ação
    await supabase
      .from('chat_audit_logs')
      .insert({
        channel_id: existingMessage.channel_id,
        action: 'delete_message',
        entity_type: 'message',
        entity_id: id,
        old_values: existingMessage,
        user_id: authResult.payload.userId,
        user_email: user?.email,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
        success: true
      });

    return NextResponse.json({
      success: true,
      message: 'Mensagem deletada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar mensagem:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
