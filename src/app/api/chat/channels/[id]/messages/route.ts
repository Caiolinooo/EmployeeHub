import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const channelId = params.id;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const before = url.searchParams.get('before'); // timestamp
    const after = url.searchParams.get('after'); // timestamp

    // Verificar se usuário tem acesso ao canal
    const { data: channel } = await supabase
      .from('chat_channels')
      .select('permissions, name')
      .eq('id', channelId)
      .single();

    if (!channel) {
      return NextResponse.json({
        success: false,
        error: 'Canal não encontrado'
      }, { status: 404 });
    }

    const hasAccess = channel.permissions?.isPublic ||
                     channel.permissions?.members?.includes(payload.userId) ||
                     channel.permissions?.viewers?.includes(payload.userId);

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
      .is('thread_id', null) // Apenas mensagens principais, não replies
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtrar por período se especificado
    if (before) {
      query = query.lt('timestamp', before);
    }
    if (after) {
      query = query.gt('timestamp', after);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('Erro ao buscar mensagens do canal:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar mensagens do canal'
      }, { status: 500 });
    }

    // Reverter ordem para mostrar mensagens mais antigas primeiro
    const orderedMessages = (messages || []).reverse();

    // Marcar mensagens como lidas
    // TODO: Implementar funcionalidade de read_by

    return NextResponse.json({
      success: true,
      messages: orderedMessages,
      channelName: channel.name
    });

  } catch (error) {
    console.error('Erro na API de mensagens do canal:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}
