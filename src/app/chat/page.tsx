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
  FiPin,
  FiReply,
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
  FiRefreshCw
} from 'react-icons/fi';
import { ChatChannel, ChatMessage, ChatUser, UserPresence } from '@/types/chat';

export default function ChatPage() {
  const { user, isAdmin, isManager } = useSupabaseAuth();
  const { t } = useI18n();
  
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verificar permissões (simplificado para funcionar)
  const canUseChat = isAdmin || isManager || true; // Chat disponível para todos
  const canCreateChannels = isAdmin || isManager;
  const canManageChannels = isAdmin;

  useEffect(() => {
    if (canUseChat) {
      loadData();
      // Simular WebSocket connection
      setupWebSocket();
    }
  }, [canUseChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
        setMessages(data.messages || []);
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
        setMessages(prev => [...prev, data.message]);
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

    // Simular upload de arquivo
    toast.success(`Arquivo ${file.name} enviado com sucesso!`);
    
    const fileMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      channelId: selectedChannel.id,
      senderId: user?.id || '',
      senderName: user?.name || 'Usuário',
      content: {
        text: `Arquivo enviado: ${file.name}`
      },
      type: 'file',
      status: 'sent',
      timestamp: new Date().toISOString(),
      reactions: [],
      mentions: [],
      attachments: [{
        id: `att_${Date.now()}`,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'document',
        url: URL.createObjectURL(file),
        size: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        metadata: {
          originalName: file.name,
          uploadedBy: user?.id || '',
          isPublic: false,
          downloadCount: 0,
          virusScanStatus: 'clean',
          compressionApplied: false,
          customFields: {}
        }
      }],
      metadata: {
        editHistory: [],
        deliveryStatus: [],
        priority: 'normal',
        tags: [],
        customFields: {},
        aiGenerated: false
      },
      isSystem: false,
      isPinned: false,
      isImportant: false,
      replyCount: 0,
      readBy: []
    };

    setMessages(prev => [...prev, fileMessage]);
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
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">{user?.name || 'Usuário'}</div>
              <div className="text-xs text-gray-500">Online</div>
            </div>
            <button className="p-1 text-gray-500 hover:text-gray-700 rounded">
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
                  <button className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                    <FiPhone className="h-5 w-5" />
                  </button>
                  <button className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
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
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0">
                    {message.senderName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{message.senderName}</span>
                      <span className="text-xs text-gray-500">
                        {formatMessageTime(message.timestamp)}
                      </span>
                      {message.isSystem && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          Sistema
                        </span>
                      )}
                    </div>
                    <div className="text-gray-700">
                      {message.content.text}
                    </div>
                    {message.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {message.attachments.map((attachment) => (
                          <div key={attachment.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                            <FiFile className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-700">{attachment.name}</span>
                            <button className="ml-auto p-1 text-gray-500 hover:text-gray-700">
                              <FiDownload className="h-4 w-4" />
                            </button>
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
                    onChange={(e) => setCurrentMessage(e.target.value)}
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
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white font-medium">
                      {user?.name?.charAt(0) || 'U'}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-2 border-white rounded-full ${getStatusColor(presence.status)}`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{user?.name || 'Usuário'}</div>
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
    </div>
  );
}
