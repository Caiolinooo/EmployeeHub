'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'react-hot-toast';
import {
  FiMessageSquare,
  FiUsers,
  FiSettings,
  FiSearch,
  FiPlus,
  FiMoreVertical,
  FiSend,
  FiPaperclip,
  FiSmile,
  FiPhone,
  FiVideo,
  FiMic,
  FiImage,
  FiFile,
  FiHash,
  FiLock,
  FiGlobe,
  FiUserPlus,
  FiEdit,
  FiTrash2,

  FiCopy,
  FiDownload,
  FiEye,
  FiEyeOff,
  FiVolume2,
  FiVolumeX,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiStar,
  FiArchive,
  FiRefreshCw,
  FiArrowLeft
} from 'react-icons/fi';
import { ChatChannel, ChatMessage, ChatUser, UserPresence } from '@/types/chat';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';


// Helper to map DB (snake_case) to client ChatMessage (camelCase)
function mapDbMessageToClient(m: any): ChatMessage {
  return {
    id: m.id,
    channelId: m.channel_id,
    threadId: m.thread_id ?? undefined,
    parentMessageId: m.parent_message_id ?? undefined,
    senderId: m.sender_id,
    senderName: m.sender_name,
    senderAvatar: m.sender_avatar || undefined,
    content: m.content,
    type: m.type,
    status: m.status,
    timestamp: m.timestamp,
    editedAt: m.edited_at ?? undefined,
    deletedAt: m.deleted_at ?? undefined,
    reactions: m.reactions || [],

    mentions: m.mentions || [],
    attachments: m.attachments || [],
    metadata: m.metadata || { editHistory: [], deliveryStatus: [], priority: 'normal', tags: [], customFields: {}, aiGenerated: false },
    isSystem: m.is_system || false,
    isPinned: m.is_pinned || false,
    isImportant: m.is_important || false,
    replyCount: m.reply_count || 0,
    readBy: m.read_by || []
  };
}

export default function ChatPage() {
  const { user, profile, isAdmin, isManager } = useSupabaseAuth();
  const { t } = useI18n();


  const displayName = (() => {
    const p = profile as any;
    const name = `${p?.first_name || ''} ${p?.last_name || ''}`.trim();
    return name || (user as any)?.name || (user as any)?.email || 'Usuário';
  })();
  const avatarUrl = (profile as any)?.drive_photo_url || (profile as any)?.avatar || null;

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserList, setShowUserList] = useState(true);
  const [showChannelInfo, setShowChannelInfo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video'>('video');
  const [prefTyping, setPrefTyping] = useState<boolean>(true);
  const [prefSound, setPrefSound] = useState<boolean>(false);


  const fileInputRef = useRef<HTMLInputElement>(null);

  // Typing indicator control
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const notifyTyping = async (typing: boolean) => {
    try {
      if (!selectedChannel || !prefTyping) return;
      await fetch('/api/chat/presence', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'typing', channelId: selectedChannel.id, isTyping: typing })
      });
    } catch (e) {
      // silencioso
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCurrentMessage(value);

    // auto-resize
    if (messageInputRef.current) {
      messageInputRef.current.style.height = 'auto';
      const newHeight = Math.min(messageInputRef.current.scrollHeight, 128);
      messageInputRef.current.style.height = `${newHeight}px`;
    }

    // typing indicator with debounce
    setIsTyping(true);
    const now = Date.now();
    if (now - lastTypingSentRef.current > 4000) {
      lastTypingSentRef.current = now;
      notifyTyping(true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      notifyTyping(false);
    }, 1200);

  };

  // Realtime subscriptions: messages and presence
  useEffect(() => {
    if (!selectedChannel?.id) return;

    const channelSub = supabase
      .channel(`realtime:chat_messages:${selectedChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${selectedChannel.id}`
      }, (payload: any) => {
        const m = payload.new;
        if (!m) return;
        const newMsg: ChatMessage = {
          id: m.id,
          channelId: m.channel_id,
          threadId: m.thread_id ?? undefined,
          parentMessageId: m.parent_message_id ?? undefined,
          senderId: m.sender_id,
          senderName: m.sender_name,
          senderAvatar: m.sender_avatar || undefined,
          content: m.content,
          type: m.type,
          status: m.status,
          timestamp: m.timestamp,
          editedAt: m.edited_at ?? undefined,
          deletedAt: m.deleted_at ?? undefined,
          reactions: m.reactions || [],
          mentions: m.mentions || [],
          attachments: m.attachments || [],
          metadata: m.metadata || { editHistory: [], deliveryStatus: [], priority: 'normal', tags: [], customFields: {}, aiGenerated: false },
          isSystem: m.is_system || false,
          isPinned: m.is_pinned || false,
          isImportant: m.is_important || false,
          replyCount: m.reply_count || 0,
          readBy: m.read_by || []
        };
        setMessages(prev => [...prev, newMsg]);
      })
      .subscribe();

    const presenceSub = supabase
      .channel('realtime:chat_user_presence')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_user_presence'
      }, () => {
        loadOnlineUsers();
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channelSub); } catch {}
      try { supabase.removeChannel(presenceSub); } catch {}
    };
  }, [selectedChannel?.id]);


  // Fallback polling (garante updates mesmo se Realtime nao estiver ativo nas tabelas)
  useEffect(() => {
    if (!selectedChannel?.id) return;
    const id = setInterval(() => {
      loadOnlineUsers();
      loadMessages(selectedChannel.id!);
    }, 5000);
    return () => clearInterval(id);
  }, [selectedChannel?.id]);

  // Derive typing users display from presence + users
  useEffect(() => {
    if (!selectedChannel) { setTypingUsers([]); return; }
    const names = onlineUsers
      .filter(p => p.isTyping && (!p.currentChannel || p.currentChannel === selectedChannel.id))
      .map(p => {
        const u = users.find(u => u.id === p.userId);
        return u?.name || 'Usuário';
      });
    setTypingUsers(names);
  }, [onlineUsers, users, selectedChannel?.id]);


  // Verificar permissões (simplificado para funcionar)
  const canUseChat = isAdmin || isManager || true; // Chat disponível para todos
  const canCreateChannels = true; // permitir a criação de canais por qualquer usuário autenticado
  const canManageChannels = isAdmin;

  useEffect(() => {
    try {
      const raw = localStorage.getItem('chat_prefs');
      if (raw) {
        const p = JSON.parse(raw);
        setPrefTyping(p?.typing ?? true);
        setPrefSound(p?.sound ?? false);
      }
    } catch {}
  }, []);

  const savePrefs = () => {
    try {
      localStorage.setItem('chat_prefs', JSON.stringify({ typing: prefTyping, sound: prefSound }));
      toast.success('Preferncias salvas');
      setShowSettings(false);
    } catch {
      setShowSettings(false);
    }
  };


  useEffect(() => {

    if (canUseChat) {
      loadData();
      // Conexão em tempo real via Supabase Realtime ativa
    }
  }, [canUseChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!canUseChat) return;
    const token = localStorage.getItem('token');

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/chat/presence', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'heartbeat',
            channelId: selectedChannel?.id
          })
        });
      } catch (e) {
        // silencioso
      }
    };

    // envia um imediatamente e depois a cada 30s
    sendHeartbeat();
    const id = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(id);
  }, [canUseChat, selectedChannel?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadChannels(),
        loadUsers(),
        loadOnlineUsers()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do chat');
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async () => {
    try {
      const response = await fetch('/api/chat/channels', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels || []);

        // Selecionar primeiro canal se não houver seleção
        if (!selectedChannel && data.channels?.length > 0) {
          setSelectedChannel(data.channels[0]);
          loadMessages(data.channels[0].id);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar canais:', error);
    }
  };

  const loadMessages = async (channelId: string) => {
    try {
      const response = await fetch(`/api/chat/channels/${channelId}/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const mapped = (data.messages || []).map((m: any) => mapDbMessageToClient(m));
        setMessages(mapped);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/chat/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const loadOnlineUsers = async () => {
    try {
      const response = await fetch('/api/chat/presence', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOnlineUsers(data.presence || []);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários online:', error);
    }
  };

  const setupWebSocket = () => {
    // Simular conexão WebSocket para demonstração
    console.log('WebSocket connection established');

    // Simular recebimento de mensagens
    const interval = setInterval(() => {
      if (Math.random() > 0.95) { // 5% de chance a cada segundo
        simulateIncomingMessage();
      }
    }, 1000);

    return () => clearInterval(interval);
  };

  const simulateIncomingMessage = () => {
    if (!selectedChannel) return;

    const simulatedMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      channelId: selectedChannel.id,
      senderId: 'system',
      senderName: 'Sistema',
      content: {
        text: 'Esta é uma mensagem simulada para demonstração do chat em tempo real.'
      },
      type: 'text',
      status: 'sent',
      timestamp: new Date().toISOString(),
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
      isSystem: true,
      isPinned: false,
      isImportant: false,
      replyCount: 0,
      readBy: []
    };

    setMessages(prev => [...prev, simulatedMessage]);
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || !selectedChannel) return;

    const messageData = {
      channelId: selectedChannel.id,
      content: {
        text: currentMessage.trim()
      },
      type: 'text'
    };

    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(messageData)
      });

      if (response.ok) {
        const data = await response.json();
        const mapped = mapDbMessageToClient(data.message);
        setMessages(prev => [...prev, mapped]);
        setCurrentMessage('');

        // Reset textarea height
        if (messageInputRef.current) {
          messageInputRef.current.style.height = 'auto';
        }
      } else {
        toast.error('Erro ao enviar mensagem');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem');
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const res = await fetch(`/api/chat/messages?id=${encodeURIComponent(messageId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
        toast.success('Mensagem apagada');
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j?.error || 'Falha ao apagar mensagem');
      }
    } catch (e) {
      toast.error('Erro ao apagar mensagem');
      console.error(e);
    }
  };


  const createChannel = async () => {
    const channelName = prompt('Nome do canal:');
    if (!channelName) return;

    try {
      const response = await fetch('/api/chat/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: channelName,
          type: 'public',
          description: `Canal ${channelName} criado automaticamente`
        })
      });

      if (response.ok) {
        const data = await response.json();
        setChannels(prev => [...prev, data.channel]);
        toast.success('Canal criado com sucesso!');
      } else {
        toast.error('Erro ao criar canal');
      }
    } catch (error) {
      console.error('Erro ao criar canal:', error);
      toast.error('Erro ao criar canal');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChannel) return;

    try {
      const bucket = 'chat-attachments';
      const path = `${selectedChannel.id}/${Date.now()}_${file.name}`;
      const { data: up, error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(up!.path);
      const publicUrl = pub.publicUrl;

      const mime = file.type || '';
      let attType: 'image' | 'video' | 'audio' | 'document' | 'other' = 'other';
      if (mime.startsWith('image/')) attType = 'image';
      else if (mime.startsWith('video/')) attType = 'video';
      else if (mime.startsWith('audio/')) attType = 'audio';
      else if (mime === 'application/pdf' || mime.startsWith('application/') || mime.startsWith('text/')) attType = 'document';

      const attachment = {
        id: `att_${Date.now()}`,
        name: file.name,
        type: attType,
        url: publicUrl,
        size: file.size,
        mimeType: mime,
        uploadedAt: new Date().toISOString(),
        metadata: {
          originalName: file.name,
          uploadedBy: user?.id || '',
          isPublic: true,
          downloadCount: 0,
          virusScanStatus: 'clean',
          compressionApplied: false,
          customFields: {}
        }
      };

      const messageData = {
        channelId: selectedChannel.id,
        content: { text: file.name },
        type: attType === 'image' || attType === 'video' || attType === 'audio' ? attType : 'file',
        attachments: [attachment]
      };

      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(messageData)
      });

      if (!response.ok) throw new Error('Falha ao salvar mensagem');
      const data = await response.json();
      const mapped = mapDbMessageToClient(data.message);
      setMessages(prev => [...prev, mapped]);
      toast.success('Arquivo enviado!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar arquivo');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getChannelIcon = (channel: ChatChannel) => {
    switch (channel.type) {
      case 'private':
        return <FiLock className="h-4 w-4" />;
      case 'direct':
        return <FiMessageSquare className="h-4 w-4" />;
      case 'department':
        return <FiUsers className="h-4 w-4" />;
      default:
        return <FiHash className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'busy':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
  };

  if (!canUseChat) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FiAlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-gray-600">Você não tem permissão para acessar o chat</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex">
      {/* Sidebar - Canais */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-1 text-gray-500 hover:text-gray-700">
              <FiArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline text-sm">Voltar</span>
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">Chat Interno</h1>
            {canCreateChannels && (
              <button
                onClick={createChannel}
                className="p-1 text-gray-500 hover:text-gray-700 rounded"
              >
                <FiPlus className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Search */}
          <div className="mt-3 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Buscar canais..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Canais */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
              Canais
            </div>
            {channels
              .filter(channel =>
                channel.name.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => {
                    setSelectedChannel(channel);
                    loadMessages(channel.id);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-gray-100 ${
                    selectedChannel?.id === channel.id ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  {getChannelIcon(channel)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{channel.name}</div>
                    {channel.unreadCount > 0 && (
                      <div className="text-xs text-gray-500">
                        {channel.unreadCount} não lidas
                      </div>
                    )}
                  </div>
                  {channel.unreadCount > 0 && (
                    <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                      {channel.unreadCount}
                    </div>
                  )}
                </button>
              ))}
          </div>
        </div>

        {/* User Status */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName || 'Usuário'} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                  {displayName.charAt(0) || 'U'}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">{displayName || 'Usuário'}</div>
              <div className="text-xs text-gray-500">Online</div>
            </div>
            <button onClick={() => setShowSettings(true)} className="p-1 text-gray-500 hover:text-gray-700 rounded">
              <FiSettings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChannel ? (
          <>
            {/* Chat Header */}
                  <Link href="/dashboard" className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mr-2">
                    <FiArrowLeft className="h-5 w-5" />
                    <span className="hidden sm:inline">Voltar</span>
                  </Link>
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getChannelIcon(selectedChannel)}
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedChannel.name}</h2>
                    <p className="text-sm text-gray-500">
                      {selectedChannel.memberCount} membros
                      {typingUsers.length > 0 && (
                        <span className="ml-2">
                          • {typingUsers.join(', ')} digitando...
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setCallType('audio'); setShowCallModal(true); }}
                    className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                  >
                    <FiPhone className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => { setCallType('video'); setShowCallModal(true); }}
                    className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                  >
                    <FiVideo className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setShowUserList(!showUserList)}
                    className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                  >
                    <FiUsers className="h-5 w-5" />
                  </button>
                  <button className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                    <FiMoreVertical className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="flex gap-3">
                  {message.senderAvatar ? (
                    <img
                      src={message.senderAvatar}
                      alt={message.senderName || 'Usuário'}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0">
                      {message.senderName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{message.senderName || 'Usuário'}</span>
                      <span className="text-xs text-gray-500">
                        {formatMessageTime(message.timestamp)}
                      </span>
                      {message.isSystem && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          Sistema
                        </span>
                      )}
                      {(isAdmin || isManager || message.senderId === (user?.id || '')) && (
                        <button
                          onClick={() => deleteMessage(message.id)}
                          title="Apagar mensagem"
                          className="ml-auto p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="text-gray-700">
                      {message.content.text}
                    </div>
                    {message.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {message.attachments.map((att) => (
                          <div key={att.id} className="p-2 bg-gray-50 rounded-lg">
                            {att.type === 'image' && (
                              <img src={att.url} alt={att.name} className="max-h-64 rounded" />
                            )}
                            {att.type === 'video' && (
                              <video src={att.url} controls className="max-h-72 rounded" />
                            )}
                            {att.type === 'audio' && (
                              <audio src={att.url} controls className="w-full" />
                            )}
                            {att.type !== 'image' && att.type !== 'video' && att.type !== 'audio' && (
                              <div className="flex items-center gap-2">
                                <FiFile className="h-4 w-4 text-gray-500" />
                                <a href={att.url} target="_blank" className="text-sm text-blue-600 hover:underline">{att.name}</a>
                                <a href={att.url} download className="ml-auto p-1 text-gray-500 hover:text-gray-700"><FiDownload className="h-4 w-4" /></a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {message.reactions.length > 0 && (
                      <div className="mt-2 flex gap-1">
                        {message.reactions.map((reaction) => (
                          <button
                            key={reaction.id}
                            className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs hover:bg-gray-200"
                          >
                            <span>{reaction.emoji}</span>
                            <span>{reaction.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-end gap-3">
                <button
                  onClick={handleFileUpload}
                  className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  <FiPaperclip className="h-5 w-5" />
                </button>
                <div className="flex-1 relative">
                  <textarea
                    ref={messageInputRef}
                    value={currentMessage}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    placeholder="Digite sua mensagem..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
                    rows={1}
                    style={{ minHeight: '48px' }}
                  />
                </div>
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  <FiSmile className="h-5 w-5" />
                </button>
                <button
                  onClick={sendMessage}
                  disabled={!currentMessage.trim()}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiSend className="h-5 w-5" />
                </button>
              </div>
            </div>
            {showEmojiPicker && (
              <div className="px-6 pb-4">
                <div className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm inline-block">
                  <div className="grid grid-cols-8 gap-1 text-xl">
                    {['😀','😃','😄','😁','😆','😅','😂','😊','😍','😘','😜','🤩','🤔','👍','👏','🙏','💯','🔥','🎉','📷','🎵'].map(e => (
                      <button key={e} type="button" className="hover:bg-gray-100 rounded" onClick={() => { setCurrentMessage(prev => prev + e); setShowEmojiPicker(false); messageInputRef.current?.focus(); }}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FiMessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Selecione um canal</h3>
              <p className="text-gray-600">Escolha um canal da lista para começar a conversar</p>
            </div>
          </div>

        )}
      </div>

      {/* Right Sidebar - Users */}
      {showUserList && (
        <div className="w-64 bg-white border-l border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Usuários Online</h3>
            <p className="text-sm text-gray-500">{onlineUsers.length} online</p>
          </div>
          <div className="p-2 space-y-1">
            {onlineUsers.map((presence) => {
              const user = users.find(u => u.id === presence.userId);
              return (
                <div key={presence.userId} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50">
                  <div className="relative">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName || 'Usuário'}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white font-medium">
                        {displayName.charAt(0) || 'U'}
                      </div>
                    )}
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-2 border-white rounded-full ${getStatusColor(presence.status)}`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{displayName || 'Usuário'}</div>
                    {user?.role && <div className="text-xs text-gray-500">{user.role}</div>}
                    <div className="text-xs text-gray-500 capitalize">{presence.status}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
      />

      {showCallModal && selectedChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">



          <div className="bg-white w-full max-w-5xl h-[70vh] rounded-lg shadow-lg overflow-hidden flex flex-col">
            <div className="px-4 py-2 border-b flex items-center justify-between">
              <div className="font-medium text-gray-900">
                {callType === 'audio' ? 'Chamada de voz' : 'Chamada de vídeo'} • {selectedChannel.name}
              </div>
              <button
                onClick={() => setShowCallModal(false)}
                className="text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
              >
                Fechar
              </button>
            </div>
            <div className="flex-1 bg-black">
              <iframe
                title="ABZ Meet"
                src={`https://meet.jit.si/abz-${selectedChannel.id}#config.startWithVideoMuted=${callType==='audio'}&config.prejoinConfig.enabled=false&userInfo.displayName=${encodeURIComponent(displayName || 'Usuario')}`}
                className="w-full h-full border-0"
                allow="camera; microphone; fullscreen; display-capture"
              />
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg">
            <div className="px-4 py-3 border-b font-medium text-gray-900">Configurações do Chat</div>
            <div className="p-4 space-y-4">
              <label className="flex items-center gap-3">
                <input type="checkbox" className="h-4 w-4" checked={prefTyping} onChange={e => setPrefTyping(e.target.checked)} />
                <span>Mostrar indicador de digitação</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" className="h-4 w-4" checked={prefSound} onChange={e => setPrefSound(e.target.checked)} />
                <span>Som de novas mensagens</span>
              </label>
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <button onClick={() => setShowSettings(false)} className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded">Cancelar</button>
              <button onClick={savePrefs} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salvar</button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
