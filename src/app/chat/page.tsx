'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRestoreFocus } from '@/hooks/useRestoreFocus';
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
  FiArrowLeft,
  FiMenu,
  FiX
} from 'react-icons/fi';
import { ChatChannel, ChatMessage, ChatUser, UserPresence, ChatServer } from '@/types/chat';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import VideoCall from '@/components/chat/VideoCall';
import CreateChannelModal from '@/components/chat/CreateChannelModal';
import ChatSettingsModal from '@/components/chat/ChatSettingsModal';
import StatusSelector, { StatusType } from '@/components/chat/StatusSelector';
import CreateServerModal from '@/components/chat/CreateServerModal';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import ServerSettingsModal from '@/components/chat/ServerSettingsModal';
import DMList from '@/components/chat/DMList';
import StartDMModal from '@/components/chat/StartDMModal';


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

  const [servers, setServers] = useState<ChatServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<ChatServer | null>(null);
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
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [showServerSettingsModal, setShowServerSettingsModal] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false); // Mobile sidebar toggle
  const [userStatus, setUserStatus] = useState<StatusType>(
    ((profile as any)?.status as StatusType) || 'online'
  );
  const [isLocalMuted, setIsLocalMuted] = useState(false);

  // Track if initial status was set from profile
  const initialStatusSetRef = useRef(false);

  // Sync status with profile only on first load
  useEffect(() => {
    if ((profile as any)?.status && !initialStatusSetRef.current) {
      setUserStatus((profile as any).status as StatusType);
      initialStatusSetRef.current = true;
    }
  }, [profile]);

  // DM State
  const [dmConversations, setDmConversations] = useState<any[]>([]);
  const [selectedDM, setSelectedDM] = useState<any>(null);
  const [showStartDMModal, setShowStartDMModal] = useState(false);
  const [showDMSection, setShowDMSection] = useState(false);
  const { markTrigger, restoreFocus } = useRestoreFocus();
  const closeSettings = useCallback(() => {
    setShowSettings(false);
    restoreFocus();
  }, [restoreFocus]);
  const closeCreateChannel = useCallback(() => {
    setShowCreateChannel(false);
    restoreFocus();
  }, [restoreFocus]);
  const closeCreateServer = useCallback(() => {
    setShowCreateServerModal(false);
    restoreFocus();
  }, [restoreFocus]);
  const closeServerSettings = useCallback(() => {
    setShowServerSettingsModal(false);
    restoreFocus();
  }, [restoreFocus]);
  const closeStartDM = useCallback(() => {
    setShowStartDMModal(false);
    restoreFocus();
  }, [restoreFocus]);

  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    type: 'deleteServer' | 'deleteChannel';
    id: string;
    message: string;
  }>({
    isOpen: false,
    type: 'deleteServer',
    id: '',
    message: ''
  });

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

        // Avoid duplicates - don't add if message already exists or if it's from current user (already added locally)
        setMessages(prev => {
          if (prev.some(msg => msg.id === m.id)) return prev;

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
          return [...prev, newMsg];
        });
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

    // Real-time subscription for user status changes
    const statusSub = supabase
      .channel('realtime:users_unified_status')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users_unified'
      }, (payload: any) => {
        // Update the user in local state when status changes
        const updatedUser = payload.new;
        if (updatedUser?.id && updatedUser?.status) {
          setUsers(prev => prev.map(u =>
            u.id === updatedUser.id
              ? { ...u, status: updatedUser.status } as any
              : u
          ));
        }
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channelSub); } catch { }
      try { supabase.removeChannel(presenceSub); } catch { }
      try { supabase.removeChannel(statusSub); } catch { }
    };
  }, [selectedChannel?.id]);


  // Fallback polling for presence and user status updates
  useEffect(() => {
    if (!selectedChannel?.id) return;
    const id = setInterval(() => {
      loadOnlineUsers();
      loadUsers(); // Reload users to get updated status
    }, 10000); // 10 seconds - for status updates
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
    } catch { }
  }, []);

  const savePrefs = (newPrefs: { typing: boolean; sound: boolean }) => {
    try {
      setPrefTyping(newPrefs.typing);
      setPrefSound(newPrefs.sound);
      localStorage.setItem('chat_prefs', JSON.stringify(newPrefs));
      toast.success('Preferências salvas');
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
        loadServers(),
        // loadChannels(), // Will depend on selectedServer
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

  const loadServers = async () => {
    try {
      const response = await fetch('/api/chat/servers', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setServers(data.servers || []);
        if (data.servers?.length > 0 && !selectedServer) {
          setSelectedServer(data.servers[0]);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar servidores:', error);
    }
  };

  useEffect(() => {
    if (selectedServer) {
      loadChannels(selectedServer.id);
    }
  }, [selectedServer]);

  const loadChannels = async (serverId?: string) => {
    try {
      let url = '/api/chat/channels';
      if (serverId) url += `?serverId=${serverId}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels || []);

        // Selecionar primeiro canal se não houver seleção
        if (!selectedChannel && data.channels?.length > 0) {
          // Priorize 'geral' or first text channel
          const general = data.channels.find((c: ChatChannel) => c.name === 'geral');
          const first = general || data.channels[0];
          setSelectedChannel(first);
          if (first.type !== 'voice') {
            loadMessages(first.id);
          }
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
        // Add locally - Realtime deduplication will prevent duplicates if Realtime also works
        setMessages(prev => {
          if (prev.some(m => m.id === mapped.id)) return prev;
          return [...prev, mapped];
        });
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


  const handleCreateChannel = async (data: any) => {
    if (!selectedServer) return;

    try {
      const response = await fetch('/api/chat/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const resData = await response.json();
        setChannels(prev => [...prev, resData.channel]);
        toast.success('Canal criado com sucesso!');
        setShowCreateChannel(false);
      } else {
        const err = await response.json();
        toast.error(err.error || 'Erro ao criar canal');
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
      // Add locally with deduplication
      setMessages(prev => {
        if (prev.some(m => m.id === mapped.id)) return prev;
        return [...prev, mapped];
      });
      toast.success('Arquivo enviado!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar arquivo');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };



  const handleCreateServer = async (name: string) => {
    try {
      const response = await fetch('/api/chat/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name, is_public: true })
      });
      const data = await response.json();
      if (data.success) {
        setServers(prev => [data.server, ...prev]);
        setSelectedServer(data.server);
        toast.success('Servidor criado com sucesso!');
      } else {
        toast.error('Erro ao criar servidor');
      }
    } catch (error) {
      console.error('Erro ao criar servidor:', error);
      toast.error('Erro ao criar servidor');
    }
  };

  const handleConfirmDeleteServer = async () => {
    const serverId = confirmationModal.id;
    try {
      const response = await fetch(`/api/chat/servers?id=${serverId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setServers(prev => prev.filter(s => s.id !== serverId));
        if (selectedServer?.id === serverId) {
          setSelectedServer(null);
          setChannels([]);
          setMessages([]);
        }
        toast.success('Servidor excluído');
      } else {
        toast.error('Erro ao excluir servidor');
      }
    } catch (error) {
      console.error('Erro ao excluir servidor:', error);
      toast.error('Erro ao excluir servidor');
    } finally {
      setConfirmationModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const deleteServer = async (serverId: string) => {
    setConfirmationModal({
      isOpen: true,
      type: 'deleteServer',
      id: serverId,
      message: 'Tem certeza que deseja excluir este servidor? Esta ação não pode ser desfeita.'
    });
  };

  const handleConfirmDeleteChannel = async () => {
    const channelId = confirmationModal.id;
    try {
      const response = await fetch(`/api/chat/channels?id=${channelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setChannels(prev => prev.filter(c => c.id !== channelId));
        if (selectedChannel?.id === channelId) {
          setSelectedChannel(null);
          setMessages([]);
        }
        toast.success('Canal excluído');
      } else {
        toast.error('Erro ao excluir canal');
      }
    } catch (error) {
      console.error('Erro ao excluir canal:', error);
      toast.error('Erro ao excluir canal');
    } finally {
      setConfirmationModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const deleteChannel = async (channelId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    setConfirmationModal({
      isOpen: true,
      type: 'deleteChannel',
      id: channelId,
      message: 'Tem certeza que deseja excluir este canal?'
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // DM Functions
  const handleStartDMConversation = async (targetUserId: string) => {
    try {
      // Check if conversation already exists
      const { data: existing } = await supabase
        .from('chat_dm_participants')
        .select('conversation_id')
        .eq('user_id', user?.id);

      if (existing) {
        for (const conv of existing) {
          const { data: otherParticipant } = await supabase
            .from('chat_dm_participants')
            .select('user_id')
            .eq('conversation_id', conv.conversation_id)
            .eq('user_id', targetUserId)
            .single();

          if (otherParticipant) {
            // Conversation exists, select it
            setSelectedDM({ id: conv.conversation_id, participants: [] });
            setSelectedServer(null);
            setSelectedChannel(null);
            return;
          }
        }
      }

      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from('chat_dm_conversations')
        .insert({})
        .select()
        .single();

      if (convError) throw convError;

      // Add participants
      await supabase.from('chat_dm_participants').insert([
        { conversation_id: newConv.id, user_id: user?.id },
        { conversation_id: newConv.id, user_id: targetUserId }
      ]);

      // Select the new conversation
      setSelectedDM({ id: newConv.id, participants: [] });
      setSelectedServer(null);
      setSelectedChannel(null);
      toast.success('Conversa iniciada!');
    } catch (error) {
      console.error('Error starting DM:', error);
      toast.error('Erro ao iniciar conversa');
    }
  };

  const loadDMConversations = async () => {
    try {
      const { data: participations } = await supabase
        .from('chat_dm_participants')
        .select('conversation_id')
        .eq('user_id', user?.id);

      if (!participations?.length) return;

      const convIds = participations.map(p => p.conversation_id);

      // Get all participants for these conversations
      const { data: allParticipants } = await supabase
        .from('chat_dm_participants')
        .select(`
          conversation_id,
          user_id,
          users_unified (id, first_name, last_name, email, drive_photo_url, status)
        `)
        .in('conversation_id', convIds);

      // Group by conversation
      const conversations = convIds.map(convId => {
        const participants = allParticipants
          ?.filter(p => p.conversation_id === convId)
          .map(p => ({
            id: (p.users_unified as any)?.id,
            name: `${(p.users_unified as any)?.first_name || ''} ${(p.users_unified as any)?.last_name || ''}`.trim() || (p.users_unified as any)?.email,
            avatar: (p.users_unified as any)?.drive_photo_url,
            status: (p.users_unified as any)?.status || 'offline'
          })) || [];

        return {
          id: convId,
          participants,
          unreadCount: 0
        };
      });

      setDmConversations(conversations);
    } catch (error) {
      console.error('Error loading DMs:', error);
    }
  };

  // Load DMs on mount
  useEffect(() => {
    if (user?.id) {
      loadDMConversations();
    }
  }, [user?.id]);

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
      case 'dnd':
        return 'bg-red-500';
      case 'invisible':
      case 'offline':
      default:
        return 'bg-gray-500';
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

  /* -------------------------------------------------------------------------- */
  /*                            Server Update Logic                             */
  /* -------------------------------------------------------------------------- */

  const handleUpdateServer = async (serverId: string, data: any) => {
    try {
      const response = await fetch(`/api/chat/servers/${serverId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Falha ao atualizar servidor');

      const { server: updatedServer } = await response.json();

      setServers(prev => prev.map(s => s.id === serverId ? { ...s, ...updatedServer } : s));
      if (selectedServer?.id === serverId) {
        setSelectedServer(prev => prev ? { ...prev, ...updatedServer } : null);
      }
      toast.success('Servidor atualizado com sucesso!');
      setShowServerSettingsModal(false);
    } catch (error) {
      console.error('Erro ao atualizar servidor:', error);
      toast.error('Erro ao atualizar servidor');
    }
  };


  /* -------------------------------------------------------------------------- */
  /*                               Renderização                                 */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="h-screen flex overflow-hidden text-slate-200 font-sans relative" style={{ backgroundColor: '#0f1117' }}>

      {/* Mobile Overlay */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 bg-black/80 z-40 md:hidden"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Sidebar Container (Server + Channel) - Mobile Responsive */}
      <div className={`fixed inset-y-0 left-0 z-50 flex h-full transition-transform duration-300 md:relative md:translate-x-0 ${showMobileSidebar ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>

        {/* 1. Server List (Leftmost) */}
        <div className="w-[72px] bg-[#090a0e] border-r border-white/5 flex flex-col items-center py-4 gap-3 shrink-0 overflow-y-auto no-scrollbar">
          {servers.map((server) => (
            <div key={server.id} className="relative group flex items-center justify-center w-full px-3">
              {selectedServer?.id === server.id && (
                <div className="absolute left-0 w-1 h-10 bg-indigo-500 rounded-r-lg transition-all shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              )}
              <button
                onClick={() => {
                  setSelectedServer(server);
                  setSelectedChannel(null);
                  setSelectedDM(null);
                  setMessages([]); // Clear messages when switching server
                  // Don't close sidebar here, user might want to pick a channel
                }}
                className={`
                      w-12 h-12 rounded-[24px] group-hover:rounded-[16px] transition-all duration-300 overflow-hidden flex items-center justify-center font-semibold text-sm relative
                      ${selectedServer?.id === server.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                    : 'bg-zinc-800/80 text-zinc-400 hover:bg-indigo-500 hover:text-white hover:shadow-lg hover:shadow-indigo-500/20'}
                   `}
                title={server.name}
              >
                {server.icon_url ? (
                  <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" />
                ) : (
                  server.name.substring(0, 2).toUpperCase()
                )}
              </button>
            </div>
          ))}

          <div className="w-8 h-[2px] bg-white/5 rounded-full my-1" />

          <button
            onClick={(event) => {
              markTrigger(event.currentTarget);
              setShowCreateServerModal(true);
              setShowMobileSidebar(false);
            }}
            className="w-12 h-12 rounded-[24px] bg-zinc-800/50 hover:bg-green-600 hover:rounded-[16px] transition-all duration-300 flex items-center justify-center text-green-500 hover:text-white group border border-dashed border-zinc-700 hover:border-transparent"
            title="Criar novo servidor"
          >
            <FiPlus className="w-6 h-6 transition-transform group-hover:scale-110" />
          </button>
        </div>

        {/* 2. Channel Sidebar */}
        <div className="w-64 bg-[#111319] flex flex-col shrink-0">
          {/* Server Header */}
          <div className="h-14 border-b border-white/5 flex items-center px-4 justify-between font-bold text-slate-200 shadow-sm hover:bg-white/5 transition-colors cursor-pointer group">
            <span className="truncate">{selectedServer?.name || 'Selecione um servidor'}</span>
            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              {/* Mobile Close Button */}
              <button
                className="md:hidden p-1.5 text-zinc-400 hover:text-white"
                onClick={() => setShowMobileSidebar(false)}
              >
                <FiX className="w-5 h-5" />
              </button>

              {selectedServer && (isAdmin || selectedServer.created_by === user?.id) && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markTrigger(e.currentTarget);
                      setShowServerSettingsModal(true);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-all"
                    title="Configurações do Servidor"
                  >
                    <FiSettings className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Channel Categories & List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar">
            {/* Text Channels */}
            <div>
              <div className="flex items-center justify-between px-2 mb-2 text-[11px] font-bold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors cursor-pointer group">
                <span>Canais de Texto</span>
                {isAdmin && selectedServer && (
                  <button
                    type="button"
                    className="cursor-pointer hover:text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all p-0 bg-transparent border-0"
                    onClick={(event) => {
                      markTrigger(event.currentTarget);
                      setShowCreateChannel(true);
                    }}
                    aria-label="Criar canal de texto"
                  >
                    <FiPlus />
                  </button>
                )}
              </div>
              <div className="space-y-[2px]">
                {channels
                  .filter(c => c.type !== 'voice')
                  .map(channel => (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setSelectedChannel(channel);
                        loadMessages(channel.id);
                        setShowMobileSidebar(false); // Close on selection
                      }}
                      className={`w-full flex items-center px-2.5 py-1.5 rounded-md mx-0 group transition-all duration-200 ${selectedChannel?.id === channel.id
                        ? 'bg-indigo-500/10 text-white font-medium shadow-[inset_2px_0_0_0_#6366f1]'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                        }`}
                    >
                      <FiHash className={`w-4 h-4 mr-2 ${selectedChannel?.id === channel.id ? 'text-indigo-400' : 'text-zinc-500'}`} />
                      <span className="truncate flex-1 text-left text-sm">{channel.name}</span>
                      {channel.unreadCount > 0 && (
                        <div className="bg-red-500 text-white text-[10px] px-1.5 h-4 flex items-center justify-center rounded-full mr-1 font-bold shadow-md">{channel.unreadCount}</div>
                      )}
                      {(isAdmin || isManager) && (
                        <div
                          onClick={(e) => deleteChannel(channel.id, e)}
                          className="p-1 text-zinc-500 hover:text-red-400 rounded opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all"
                          title="Excluir Canal"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  ))}
              </div>
            </div>

            {/* Direct Messages Section */}
            <div className="border-t border-white/5 pt-4">
              <div className="flex items-center justify-between px-2 mb-2 text-[11px] font-bold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors cursor-pointer group">
                <span>Mensagens Diretas</span>
                <button
                  type="button"
                  className="cursor-pointer hover:text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all p-0 bg-transparent border-0"
                  onClick={(event) => {
                    markTrigger(event.currentTarget);
                    setShowStartDMModal(true);
                  }}
                  aria-label="Nova conversa"
                >
                  <FiPlus />
                </button>
              </div>
              <div className="space-y-[2px] max-h-40 overflow-y-auto">
                {dmConversations.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-zinc-600 italic">
                    Nenhuma conversa ainda
                  </div>
                ) : (
                  dmConversations.map(conv => {
                    const otherUser = conv.participants.find((p: any) => p.id !== user?.id) || conv.participants[0];
                    return (
                      <button
                        key={conv.id}
                        onClick={() => {
                          setSelectedDM(conv);
                          setSelectedServer(null);
                          setSelectedChannel(null);
                          setShowMobileSidebar(false);
                        }}
                        className={`w-full flex items-center px-2.5 py-1.5 rounded-md group transition-all duration-200 ${selectedDM?.id === conv.id
                          ? 'bg-indigo-500/10 text-white font-medium shadow-[inset_2px_0_0_0_#6366f1]'
                          : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                          }`}
                      >
                        <div className="relative w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center overflow-hidden mr-2 shrink-0">
                          {otherUser?.avatar ? (
                            <img src={otherUser.avatar} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <span className="text-[10px] font-bold text-white">{(otherUser?.name || '?').charAt(0)}</span>
                          )}
                          <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-[#111319] ${otherUser?.status === 'online' ? 'bg-green-500' :
                            otherUser?.status === 'away' ? 'bg-yellow-500' :
                              otherUser?.status === 'dnd' ? 'bg-red-500' : 'bg-gray-500'
                            }`}></div>
                        </div>
                        <span className="truncate flex-1 text-left text-sm">{otherUser?.name || 'Usuário'}</span>
                        {conv.unreadCount > 0 && (
                          <div className="w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center shrink-0 ml-1">
                            <span className="text-[9px] font-bold text-white">{conv.unreadCount}</span>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Voice Channels */}
            <div>
              <div className="flex items-center justify-between px-2 mb-2 text-[11px] font-bold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors cursor-pointer group">
                <span>Canais de Voz</span>
                {isAdmin && selectedServer && (
                  <button
                    type="button"
                    className="cursor-pointer hover:text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all p-0 bg-transparent border-0"
                    onClick={(event) => {
                      markTrigger(event.currentTarget);
                      setShowCreateChannel(true);
                    }}
                    aria-label="Criar canal de voz"
                  >
                    <FiPlus />
                  </button>
                )}
              </div>
              <div className="space-y-[2px]">
                {channels
                  .filter(c => c.type === 'voice')
                  .map(channel => (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setSelectedChannel(channel);
                        setShowMobileSidebar(false);
                      }}
                      className={`w-full flex items-center px-2.5 py-1.5 rounded-md mx-0 group transition-all duration-200 ${selectedChannel?.id === channel.id
                        ? 'bg-indigo-500/10 text-white font-medium shadow-[inset_2px_0_0_0_#6366f1]'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                        }`}
                    >
                      <FiVolume2 className={`w-4 h-4 mr-2 ${selectedChannel?.id === channel.id ? 'text-indigo-400' : 'text-zinc-500'}`} />
                      <span className="truncate flex-1 text-left text-sm">{channel.name}</span>
                      {(isAdmin || isManager) && (
                        <div
                          onClick={(e) => deleteChannel(channel.id, e)}
                          className="p-1 text-zinc-500 hover:text-red-400 rounded opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all"
                          title="Excluir Canal"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* User Status Footer */}
          <div className="p-3 bg-[#0c0e12] flex items-center gap-3 border-t border-white/5">
            <div className="relative w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center overflow-hidden shrink-0 border border-white/10">
              {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" alt="" /> : <span className="text-sm font-bold text-white">{displayName.charAt(0)}</span>}
              <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-[#0c0e12] rounded-full ${userStatus === 'online' ? 'bg-green-500' :
                userStatus === 'away' ? 'bg-yellow-500' :
                  userStatus === 'dnd' ? 'bg-red-500' : 'bg-gray-500'
                }`}></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-200 truncate">{displayName}</div>
              <StatusSelector
                userId={user?.id || ''}
                currentStatus={userStatus}
                onStatusChange={setUserStatus}
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsLocalMuted(!isLocalMuted)}
                className={`p-1.5 rounded-md transition-colors ${isLocalMuted ? 'bg-red-500/20 text-red-400' : 'hover:bg-white/10 text-zinc-400 hover:text-white'}`}
                title={isLocalMuted ? 'Ativar áudio' : 'Desativar áudio'}
              >
                {isLocalMuted ? <FiVolumeX className="w-4 h-4" /> : <FiVolume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                aria-label="Configurações do Chat"
                onClick={(event) => {
                  markTrigger(event.currentTarget);
                  setShowSettings(true);
                }}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-zinc-400 hover:text-white"
              >
                <FiSettings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#313338] relative">
        {selectedChannel ? (
          selectedChannel.type === 'voice' ? (
            // Voice Channel View
            // Voice Channel View
            <VideoCall
              channelId={selectedChannel.id}
              onLeave={() => setSelectedChannel(null)}
              initialVideoEnabled={false}
            />
          ) : (
            // Text Channel View (Chat)
            <>
              {/* Chat Header */}
              <div className="bg-[#313338] border-b border-[#26272D] px-6 py-3 flex items-center justify-between shrink-0 shadow-sm z-10 transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="md:hidden mr-2">
                    <button
                      onClick={() => setShowMobileSidebar(true)}
                      className="p-1.5 text-zinc-400 hover:text-white"
                    >
                      <FiMenu className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="text-zinc-400">{getChannelIcon(selectedChannel)}</div>
                  <div>
                    <h2 className="font-bold text-slate-100 flex items-center gap-2 text-base">
                      {selectedChannel.name}
                    </h2>
                    <p className="text-xs text-zinc-400 flex items-center gap-2">
                      {selectedChannel.description || `${selectedChannel.memberCount || 0} membros`}
                      {typingUsers.length > 0 && (
                        <span className="text-indigo-400 animate-pulse font-medium">
                          • {typingUsers.join(', ')} digitando...
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link href="/dashboard" className="mr-2 text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 text-sm font-medium transition-colors">
                    <FiArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Voltar</span>
                  </Link>
                  <div className="h-6 w-[1px] bg-zinc-700 mx-1"></div>
                  <button
                    onClick={() => { setCallType('audio'); setShowCallModal(true); }}
                    className="p-2 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
                    title="Chamada de voz"
                  >
                    <FiPhone className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => { setCallType('video'); setShowCallModal(true); }}
                    className="p-2 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
                    title="Chamada de vídeo"
                  >
                    <FiVideo className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setShowUserList(!showUserList)}
                    className={`p-2 rounded-lg transition-colors ${showUserList ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                    title="Lista de membros"
                  >
                    <FiUsers className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#313338]">
                {messages.map((message, index) => {
                  const isSequential = index > 0 && messages[index - 1].senderId === message.senderId && (new Date(message.timestamp).getTime() - new Date(messages[index - 1].timestamp).getTime() < 5 * 60 * 1000);

                  return (
                    <div key={message.id} className={`flex gap-4 group ${isSequential ? 'mt-1' : 'mt-6'}`}>
                      {!isSequential ? (
                        message.senderAvatar ? (
                          <img
                            src={message.senderAvatar}
                            alt={message.senderName || 'Usuário'}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0 cursor-pointer hover:shadow-lg transition-shadow"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0 select-none text-lg">
                            {message.senderName?.charAt(0) || 'U'}
                          </div>
                        )
                      ) : (
                        <div className="w-10 flex-shrink-0 text-xs text-zinc-600 opacity-0 group-hover:opacity-100 text-right pr-2 pt-1 select-none">
                          {formatMessageTime(message.timestamp).split(' ')[0]} {/* Simplified time */}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        {!isSequential && (
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-semibold text-slate-100 hover:underline cursor-pointer transition-colors">{message.senderName || 'Usuário'}</span>
                            <span className="text-xs text-zinc-500 font-medium">
                              {formatMessageTime(message.timestamp)}
                            </span>
                            {message.isSystem && (
                              <span className="text-[10px] uppercase font-bold bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30">
                                SYSTEM
                              </span>
                            )}
                          </div>
                        )}

                        <div className={`text-zinc-300 whitespace-pre-wrap leading-relaxed tracking-wide ${message.isSystem ? 'italic text-zinc-500' : ''}`}>
                          {(() => {
                            // Handle various content formats
                            let content: any = message.content;

                            // If it's a string that looks like JSON, parse it
                            if (typeof content === 'string') {
                              const str = content as string;
                              if (str.startsWith('{') || str.startsWith('[')) {
                                try {
                                  content = JSON.parse(str);
                                } catch {
                                  return str; // Return as-is if not valid JSON
                                }
                              } else {
                                return str; // Plain string
                              }
                            }

                            // Now content should be an object
                            return content?.text || content?.message || '';
                          })()}
                        </div>

                        {/* Attachments */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-w-2xl">
                            {message.attachments.map((att) => (
                              <div key={att.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                {att.type === 'image' && (
                                  <a href={att.url} target="_blank" rel="noopener noreferrer">
                                    <img src={att.url} alt={att.name} className="w-full h-48 object-cover hover:opacity-90 transition-opacity" />
                                  </a>
                                )}
                                {att.type === 'video' && (
                                  <video src={att.url} controls className="w-full max-h-48" />
                                )}
                                {att.type === 'audio' && (
                                  <audio src={att.url} controls className="w-full p-2" />
                                )}
                                {att.type !== 'image' && att.type !== 'video' && att.type !== 'audio' && (
                                  <div className="p-3 flex items-center gap-3 hover:bg-gray-50">
                                    <FiFile className="h-8 w-8 text-blue-500" />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-gray-900 truncate">{att.name}</div>
                                      <div className="text-xs text-gray-500">{Math.round((att.size || 0) / 1024)} KB</div>
                                    </div>
                                    <a href={att.url} download className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50">
                                      <FiDownload className="h-4 w-4" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reactions & Actions */}
                        <div className="mt-1 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {(isAdmin || isManager || message.senderId === (user?.id || '')) && (
                            <button
                              onClick={() => deleteMessage(message.id)}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Excluir
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="bg-[#313338] px-4 pb-6 pt-2">
                <div className="bg-[#383a40] rounded-lg p-2 flex items-end gap-2 relative shadow-sm hover:shadow-md transition-shadow">
                  <button
                    onClick={handleFileUpload}
                    className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded-full flex-shrink-0 transition-colors"
                    title="Anexar arquivo"
                  >
                    <FiPlus className="h-5 w-5" />
                  </button>

                  <div className="flex-1 max-h-60 overflow-y-auto custom-scrollbar">
                    <textarea
                      ref={messageInputRef}
                      value={currentMessage}
                      onChange={handleInputChange}
                      onKeyPress={handleKeyPress}
                      placeholder={`Conversar em #${selectedChannel.name}`}
                      className="w-full bg-transparent border-0 focus:ring-0 text-slate-100 resize-none py-2 placeholder-zinc-500"
                      rows={1}
                      style={{ minHeight: '40px' }}
                    />
                  </div>

                  <div className="flex items-center">
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 text-zinc-400 hover:text-yellow-500 hover:bg-zinc-700 rounded-full transition-colors"
                    >
                      <FiSmile className="h-5 w-5" />
                    </button>
                    {currentMessage.trim() && (
                      <button
                        onClick={sendMessage}
                        className="p-2 text-indigo-400 hover:bg-indigo-500/20 rounded-full ml-1 transition-all"
                      >
                        <FiSend className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-zinc-500 mt-2 flex justify-between px-1 font-medium">
                  <span>Markdown suportado</span>
                  {/* <span>{currentMessage.length}/2000</span> */}
                </div>

                {/* Emoji Picker Popover */}
                {showEmojiPicker && (
                  <div className="absolute bottom-20 right-8 bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-20 w-64">
                    <div className="text-xs font-semibold text-gray-500 mb-2 px-1">EMOJIS</div>
                    <div className="grid grid-cols-6 gap-1">
                      {['👍', '👎', '😀', '😂', '🥰', '🎉', '🔥', '❤️', '🤔', '👀', '🚀', '💯'].map(e => (
                        <button
                          key={e}
                          className="h-8 w-8 flex items-center justify-center hover:bg-gray-100 rounded text-xl"
                          onClick={() => {
                            setCurrentMessage(prev => prev + e);
                            setShowEmojiPicker(false);
                            messageInputRef.current?.focus();
                          }}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 select-none bg-[#313338]">
            <div className="w-24 h-24 bg-zinc-800/50 rounded-full flex items-center justify-center mb-6 shadow-xl border border-white/5">
              <FiHash className="w-12 h-12 text-zinc-400" />
            </div>
            <h3 className="text-2xl font-bold text-zinc-300 mb-3">Bem-vindo ao Chat</h3>
            <p className="max-w-md text-center text-zinc-400 leading-relaxed">
              Selecione um servidor e um canal para começar a colaborar com sua equipe com estilo e eficiência.
            </p>
          </div>
        )}
      </div>


      {/* Right Sidebar - Users */}
      {/* User List Sidebar */}
      {showUserList && (
        <div className={`
        fixed inset-y-0 right-0 w-60 bg-[#111319] border-l border-white/5 flex flex-col shrink-0 z-40 transition-transform duration-300
        lg:relative
      `}>
          <div className="h-14 border-b border-white/5 flex items-center px-4 shrink-0 shadow-sm">
            <button
              onClick={() => setShowUserList(!showUserList)}
              className="p-1.5 hover:bg-white/10 rounded transition-colors mr-2 lg:hidden"
              title="Fechar lista de membros"
            >
              <FiX className="w-4 h-4 text-zinc-400" />
            </button>
            <h3 className="font-bold text-xs text-zinc-400 uppercase tracking-wider">Membros Online</h3>
            <p className="text-xs text-zinc-500 ml-auto">{onlineUsers.length} online</p>
          </div>
          <div className="p-3 space-y-2 overflow-y-auto custom-scrollbar flex-1">
            {(() => {
              // Deduplicate and Group Users
              const uniqueOnlineUserIds = Array.from(new Set(onlineUsers.map(p => p.userId)));
              const uniqueOnlineUsers = uniqueOnlineUserIds
                .map(id => users.find(u => u.id === id))
                .filter(Boolean) as ChatUser[];

              const groupedUsers = uniqueOnlineUsers.reduce((acc, user) => {
                const role = user.role || 'MEMBER';
                if (!acc[role]) acc[role] = [];
                acc[role].push(user);
                return acc;
              }, {} as Record<string, ChatUser[]>);

              const roleOrder = ['ADMIN', 'MANAGER', 'USER', 'MEMBER'];
              const roleLabels: Record<string, string> = {
                'ADMIN': 'Administradores',
                'MANAGER': 'Gerentes',
                'USER': 'Membros',
                'MEMBER': 'Membros'
              };

              return Object.keys(groupedUsers)
                .sort((a, b) => {
                  const idxA = roleOrder.indexOf(a) !== -1 ? roleOrder.indexOf(a) : 99;
                  const idxB = roleOrder.indexOf(b) !== -1 ? roleOrder.indexOf(b) : 99;
                  return idxA - idxB;
                })
                .map(role => (
                  <div key={role} className="mb-4">
                    <h3 className="font-bold text-xs text-zinc-500 uppercase tracking-wider mb-2 px-2">
                      {roleLabels[role] || role} — {groupedUsers[role].length}
                    </h3>
                    {groupedUsers[role].map(user => {
                      // Use status from user object (from users_unified table)
                      const userStatus = (user as any).status || 'online';
                      const userDisplayName = user.name || user.email;
                      const userAvatar = user.avatar || null;

                      return (
                        <div key={user.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group">
                          <div className="relative">
                            {userAvatar ? (
                              <img
                                src={userAvatar}
                                alt={userDisplayName}
                                className="w-8 h-8 rounded-full object-cover border border-white/10"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center text-white font-medium text-xs">
                                {userDisplayName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-[#2b2d31] rounded-full ${getStatusColor(userStatus)}`}></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium text-sm truncate ${userStatus === 'online' ? 'text-slate-200' : 'text-zinc-400'} group-hover:text-white transition-colors`}>{userDisplayName}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ));
            })()}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1e1f22] w-full max-w-5xl h-[70vh] rounded-lg shadow-2xl overflow-hidden flex flex-col border border-white/10">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-[#2b2d31]">
              <div className="font-semibold text-slate-200">
                {callType === 'audio' ? 'Chamada de voz' : 'Chamada de vídeo'} • {selectedChannel.name}
              </div>
              <button
                onClick={() => setShowCallModal(false)}
                className="text-zinc-400 hover:text-white px-3 py-1.5 rounded hover:bg-white/10 transition-colors"
              >
                Fechar
              </button>
            </div>
            <div className="flex-1 bg-black">
              <VideoCall
                channelId={selectedChannel.id}
                onLeave={() => setShowCallModal(false)}
                initialVideoEnabled={callType === 'video'}
              // Use callType to determine initial video state
              />
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <ChatSettingsModal
        isOpen={showSettings}
        onClose={closeSettings}
        prefs={{ typing: prefTyping, sound: prefSound }}
        onSave={savePrefs}
      />

      {/* Create Channel Modal */}
      {selectedServer && (
        <CreateChannelModal
          isOpen={showCreateChannel}
          onClose={closeCreateChannel}
          onCreate={handleCreateChannel}
          serverId={selectedServer.id}
        />
      )}

      <CreateServerModal
        isOpen={showCreateServerModal}
        onClose={closeCreateServer}
        onCreate={handleCreateServer}
      />

      {/* Modal de Confirmação */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        onClose={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => {
          if (confirmationModal.type === 'deleteServer') handleConfirmDeleteServer();
          else if (confirmationModal.type === 'deleteChannel') handleConfirmDeleteChannel();
        }}
        title={confirmationModal.type === 'deleteServer' ? 'Excluir Servidor' : 'Excluir Canal'}
        message={confirmationModal.message}
        confirmText="Excluir"
        confirmButtonClass="bg-red-500 hover:bg-red-600 focus:ring-red-500"
      />

      {/* Modal de Configurações do Servidor */}
      {selectedServer && (
        <ServerSettingsModal
          isOpen={showServerSettingsModal}
          onClose={closeServerSettings}
          server={selectedServer}
          onUpdate={handleUpdateServer}
          onDelete={(id) => {
            setShowServerSettingsModal(false);
            setConfirmationModal({
              isOpen: true,
              type: 'deleteServer',
              id,
              message: `Tem certeza que deseja excluir o servidor "${selectedServer.name}"? Esta ação não pode ser desfeita e apagará todos os canais e mensagens.`
            });
          }}
        />
      )}

      {/* Start DM Modal */}
      <StartDMModal
        isOpen={showStartDMModal}
        onClose={closeStartDM}
        currentUserId={user?.id || ''}
        onStartConversation={handleStartDMConversation}
      />
    </div>
  );
}
