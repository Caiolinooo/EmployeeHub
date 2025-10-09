import { createClient } from '@supabase/supabase-js';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  type: 'group' | 'direct' | 'announcement';
  private: boolean;
  created_at: string;
  created_by: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  attachments: any[];
  reply_to?: string;
  edited_at?: string;
  created_at: string;
  user?: {
    name: string;
    avatar?: string;
  };
}

export interface ChatMember {
  id: string;
  channel_id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  joined_at: string;
  last_read_at: string;
}

export class ChatSystem {
  private static instance: ChatSystem;
  private io: SocketIOServer | null = null;
  private connectedUsers = new Map<string, { socketId: string; userId: string }>();

  static getInstance(): ChatSystem {
    if (!ChatSystem.instance) {
      ChatSystem.instance = new ChatSystem();
    }
    return ChatSystem.instance;
  }

  // Inicializar Socket.IO
  initializeSocketIO(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.io.on('connection', (socket) => {
      console.log('Usuário conectado:', socket.id);

      // Autenticação do usuário
      socket.on('authenticate', async (token: string) => {
        try {
          const { data: { user }, error } = await supabase.auth.getUser(token);
          if (error || !user) {
            socket.emit('auth_error', 'Token inválido');
            return;
          }

          this.connectedUsers.set(socket.id, { socketId: socket.id, userId: user.id });
          socket.userId = user.id;
          
          // Entrar nos canais do usuário
          const channels = await this.getUserChannels(user.id);
          channels.forEach(channel => {
            socket.join(`channel_${channel.id}`);
          });

          socket.emit('authenticated', { userId: user.id });
          console.log(`Usuário ${user.id} autenticado`);
        } catch (error) {
          socket.emit('auth_error', 'Erro na autenticação');
        }
      });

      // Enviar mensagem
      socket.on('send_message', async (data: {
        channelId: string;
        content: string;
        messageType?: string;
        replyTo?: string;
      }) => {
        try {
          if (!socket.userId) {
            socket.emit('error', 'Usuário não autenticado');
            return;
          }

          const message = await this.sendMessage({
            channel_id: data.channelId,
            user_id: socket.userId,
            content: data.content,
            message_type: data.messageType || 'text',
            reply_to: data.replyTo
          });

          // Enviar para todos os membros do canal
          this.io?.to(`channel_${data.channelId}`).emit('new_message', message);
        } catch (error) {
          socket.emit('error', 'Erro ao enviar mensagem');
        }
      });

      // Entrar em canal
      socket.on('join_channel', async (channelId: string) => {
        try {
          if (!socket.userId) return;

          const isMember = await this.isChannelMember(channelId, socket.userId);
          if (isMember) {
            socket.join(`channel_${channelId}`);
            socket.emit('joined_channel', channelId);
          } else {
            socket.emit('error', 'Acesso negado ao canal');
          }
        } catch (error) {
          socket.emit('error', 'Erro ao entrar no canal');
        }
      });

      // Sair do canal
      socket.on('leave_channel', (channelId: string) => {
        socket.leave(`channel_${channelId}`);
        socket.emit('left_channel', channelId);
      });

      // Marcar como lido
      socket.on('mark_as_read', async (channelId: string) => {
        try {
          if (!socket.userId) return;
          await this.markAsRead(channelId, socket.userId);
        } catch (error) {
          console.error('Erro ao marcar como lido:', error);
        }
      });

      // Usuário digitando
      socket.on('typing_start', (channelId: string) => {
        socket.to(`channel_${channelId}`).emit('user_typing', {
          userId: socket.userId,
          channelId
        });
      });

      socket.on('typing_stop', (channelId: string) => {
        socket.to(`channel_${channelId}`).emit('user_stopped_typing', {
          userId: socket.userId,
          channelId
        });
      });

      // Desconexão
      socket.on('disconnect', () => {
        this.connectedUsers.delete(socket.id);
        console.log('Usuário desconectado:', socket.id);
      });
    });
  }

  // Criar canal
  async createChannel(data: {
    name: string;
    description?: string;
    type: ChatChannel['type'];
    private: boolean;
    created_by: string;
  }): Promise<ChatChannel> {
    const { data: channel, error } = await supabase
      .from('chat_channels')
      .insert([data])
      .select()
      .single();

    if (error) throw new Error(`Erro ao criar canal: ${error.message}`);

    // Adicionar criador como admin
    await supabase.from('chat_channel_members').insert([{
      channel_id: channel.id,
      user_id: data.created_by,
      role: 'admin'
    }]);

    return channel;
  }

  // Enviar mensagem
  async sendMessage(data: {
    channel_id: string;
    user_id: string;
    content: string;
    message_type: string;
    reply_to?: string;
    attachments?: any[];
  }): Promise<ChatMessage> {
    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert([{
        ...data,
        attachments: data.attachments || []
      }])
      .select(`
        *,
        user:users_unified(name, avatar)
      `)
      .single();

    if (error) throw new Error(`Erro ao enviar mensagem: ${error.message}`);

    return message;
  }

  // Obter mensagens do canal
  async getChannelMessages(channelId: string, limit = 50, offset = 0): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        user:users_unified(name, avatar),
        reply_message:chat_messages!reply_to(content, user:users_unified(name))
      `)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Erro ao buscar mensagens: ${error.message}`);
    return data || [];
  }

  // Obter canais do usuário
  async getUserChannels(userId: string): Promise<ChatChannel[]> {
    const { data, error } = await supabase
      .from('chat_channels')
      .select(`
        *,
        chat_channel_members!inner(user_id)
      `)
      .eq('chat_channel_members.user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw new Error(`Erro ao buscar canais: ${error.message}`);
    return data || [];
  }

  // Adicionar membro ao canal
  async addChannelMember(channelId: string, userId: string, role: ChatMember['role'] = 'member'): Promise<void> {
    const { error } = await supabase
      .from('chat_channel_members')
      .insert([{
        channel_id: channelId,
        user_id: userId,
        role
      }]);

    if (error) throw new Error(`Erro ao adicionar membro: ${error.message}`);

    // Notificar via Socket.IO
    this.notifyChannelUpdate(channelId, 'member_added', { userId, role });
  }

  // Remover membro do canal
  async removeChannelMember(channelId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_channel_members')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', userId);

    if (error) throw new Error(`Erro ao remover membro: ${error.message}`);

    // Notificar via Socket.IO
    this.notifyChannelUpdate(channelId, 'member_removed', { userId });
  }

  // Verificar se é membro do canal
  async isChannelMember(channelId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('chat_channel_members')
      .select('id')
      .eq('channel_id', channelId)
      .eq('user_id', userId)
      .single();

    return !error && !!data;
  }

  // Marcar mensagens como lidas
  async markAsRead(channelId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_channel_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('channel_id', channelId)
      .eq('user_id', userId);

    if (error) throw new Error(`Erro ao marcar como lido: ${error.message}`);
  }

  // Obter membros do canal
  async getChannelMembers(channelId: string): Promise<ChatMember[]> {
    const { data, error } = await supabase
      .from('chat_channel_members')
      .select(`
        *,
        user:users_unified(name, email, avatar)
      `)
      .eq('channel_id', channelId)
      .order('joined_at', { ascending: true });

    if (error) throw new Error(`Erro ao buscar membros: ${error.message}`);
    return data || [];
  }

  // Obter mensagens não lidas
  async getUnreadCount(userId: string): Promise<{ [channelId: string]: number }> {
    const { data, error } = await supabase
      .rpc('get_unread_messages_count', { user_id: userId });

    if (error) throw new Error(`Erro ao buscar não lidas: ${error.message}`);
    
    const unreadCounts: { [channelId: string]: number } = {};
    data?.forEach((item: any) => {
      unreadCounts[item.channel_id] = item.unread_count;
    });

    return unreadCounts;
  }

  // Notificar atualização do canal
  private notifyChannelUpdate(channelId: string, event: string, data: any): void {
    this.io?.to(`channel_${channelId}`).emit('channel_update', {
      channelId,
      event,
      data
    });
  }

  // Buscar mensagens
  async searchMessages(query: string, channelId?: string, userId?: string): Promise<ChatMessage[]> {
    let searchQuery = supabase
      .from('chat_messages')
      .select(`
        *,
        user:users_unified(name, avatar)
      `)
      .textSearch('content', query)
      .order('created_at', { ascending: false })
      .limit(50);

    if (channelId) {
      searchQuery = searchQuery.eq('channel_id', channelId);
    }

    if (userId) {
      // Filtrar apenas canais que o usuário tem acesso
      const userChannels = await this.getUserChannels(userId);
      const channelIds = userChannels.map(c => c.id);
      searchQuery = searchQuery.in('channel_id', channelIds);
    }

    const { data, error } = await searchQuery;
    if (error) throw new Error(`Erro na busca: ${error.message}`);
    return data || [];
  }

  // Editar mensagem
  async editMessage(messageId: string, content: string, userId: string): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from('chat_messages')
      .update({
        content,
        edited_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('user_id', userId)
      .select(`
        *,
        user:users_unified(name, avatar)
      `)
      .single();

    if (error) throw new Error(`Erro ao editar mensagem: ${error.message}`);

    // Notificar edição
    this.io?.to(`channel_${data.channel_id}`).emit('message_edited', data);

    return data;
  }

  // Deletar mensagem
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const { data: message, error: fetchError } = await supabase
      .from('chat_messages')
      .select('channel_id')
      .eq('id', messageId)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw new Error('Mensagem não encontrada');

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId)
      .eq('user_id', userId);

    if (error) throw new Error(`Erro ao deletar mensagem: ${error.message}`);

    // Notificar deleção
    this.io?.to(`channel_${message.channel_id}`).emit('message_deleted', { messageId });
  }
}

export default ChatSystem.getInstance();
