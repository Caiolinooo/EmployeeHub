'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import { 
  ArrowLeftIcon,
  BellIcon,
  CheckIcon,
  TrashIcon,
  EyeIcon,
  AcademicCapIcon,
  TrophyIcon,
  ClockIcon,
  BookOpenIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  action_url?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

const NotificationsPage: React.FC = () => {
  const router = useRouter();
  const { user, getToken } = useSupabaseAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadNotifications();
    } else {
      setLoading(false);
    }
  }, [user, filter]);

  const loadNotifications = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const unreadParam = filter === 'unread' ? '&unread_only=true' : '';
      const response = await fetch(`/api/academy/notifications?limit=50${unreadParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();

      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count);
      }
    } catch (error) {
      console.error({t('academy.erroAoCarregarNotificacoes')}, error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationIds: string[]) => {
    if (!user?.id) return;

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/academy/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          notification_ids: notificationIds
        })
      });

      if (response.ok) {
        await loadNotifications();
        setSelectedNotifications([]);
      }
    } catch (error) {
      console.error({t('academy.erroAoMarcarNotificacaoComoLida')}, error);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/academy/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mark_all_read: true
        })
      });

      if (response.ok) {
        await loadNotifications();
      }
    } catch (error) {
      console.error({t('academy.erroAoMarcarTodasAsNotificacoesComoLidas')}, error);
    }
  };

  const deleteNotifications = async (notificationIds: string[]) => {
    if (!user?.id) return;

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`/api/academy/notifications?notification_ids=${notificationIds.join(',')}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await loadNotifications();
        setSelectedNotifications([]);
      }
    } catch (error) {
      console.error({t('academy.erroAoExcluirNotificacoes')}, error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Marcar como lida se não estiver lida
    if (!notification.is_read) {
      await markAsRead([notification.id]);
    }

    // Navegar para a URL de ação se existir
    if (notification.action_url) {
      router.push(notification.action_url);
    }
  };

  const toggleSelectNotification = (notificationId: string) => {
    setSelectedNotifications(prev => 
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const selectAllNotifications = () => {
    if (selectedNotifications.length === notifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(notifications.map(n => n.id));
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_course':
        return <BookOpenIcon className="w-6 h-6 text-blue-500" />;
      case 'course_completed':
        return <TrophyIcon className="w-6 h-6 text-yellow-500" />;
      case 'study_reminder':
        return <ClockIcon className="w-6 h-6 text-orange-500" />;
      default:
        return <AcademicCapIcon className="w-6 h-6 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
      return `${diffMinutes} minuto${diffMinutes > 1 ? 's' : '{t('academy.atras')};
    } else if (diffHours < 24) {
      return `${diffHours} hora${diffHours > 1 ? 's' : '{t('academy.atras')};
    } else if (diffDays < 7) {
      return `${diffDays} dia${diffDays > 1 ? 's' : '{t('academy.atras')};
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <BellIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Acesso restrito</h3>
            <p className="mt-1 text-sm text-gray-500">
              Faça login para ver suas notificações.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/academy')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Voltar ao Academy
          </button>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <BellIcon className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Notificações</h1>
                <p className="text-gray-600 mt-1">
                  {unreadCount > 0 ? {t('academy.unreadcountNaoLidaunreadcount1')}s' : ''}` : {t('academy.todasAsNotificacoesLidas')}}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros e ações */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Filtros */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Todas ({notifications.length})
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    filter === 'unread'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Não lidas ({unreadCount})
                </button>
              </div>

              {/* Seleção */}
              {notifications.length > 0 && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedNotifications.length === notifications.length}
                    onChange={selectAllNotifications}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-600">
                    {selectedNotifications.length > 0 
                      ? `${selectedNotifications.length} selecionada${selectedNotifications.length > 1 ? 's' : ''}`
                      : 'Selecionar todas'
                    }
                  </span>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex items-center space-x-2">
              {selectedNotifications.length > 0 && (
                <>
                  <button
                    onClick={() => markAsRead(selectedNotifications)}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                  >
                    <CheckIcon className="w-4 h-4 mr-1" />
                    Marcar como lidas
                  </button>
                  <button
                    onClick={() => deleteNotifications(selectedNotifications)}
                    className="text-sm text-red-600 hover:text-red-700 flex items-center"
                  >
                    <TrashIcon className="w-4 h-4 mr-1" />
                    Excluir
                  </button>
                </>
              )}
              
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-green-600 hover:text-green-700 flex items-center"
                >
                  <CheckIcon className="w-4 h-4 mr-1" />
                  Marcar todas como lidas
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lista de notificações */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <BellIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {filter === 'unread' ? {t('academy.nenhumaNotificacaoNaoLida')} : {t('academy.nenhumaNotificacao')}}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter === 'unread' 
                ? {t('academy.todasAsSuasNotificacoesForamLidas')}
                : {t('academy.voceReceberaNotificacoesSobreNovosCursosEAtualizac')}
              }
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow ${
                  !notification.is_read ? 'border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start space-x-4">
                  <input
                    type="checkbox"
                    checked={selectedNotifications.includes(notification.id)}
                    onChange={() => toggleSelectNotification(notification.id)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className={`text-sm font-medium ${
                          !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {notification.title}
                        </h4>
                        <p className={`text-sm mt-1 ${
                          !notification.is_read ? 'text-gray-700' : 'text-gray-500'
                        }`}>
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {formatDate(notification.created_at)}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                        {notification.action_url && (
                          <EyeIcon className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default NotificationsPage;

