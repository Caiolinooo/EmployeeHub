'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { resilientApiCall, logError } from '@/lib/apiRetry';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  read_at: string | null;
  action_url: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  expires_at: string | null;
}

interface NotificationsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  pagination: NotificationsPagination | null;
  loadNotifications: (page?: number, reset?: boolean) => Promise<void>;
  createNotification: (notification: Partial<Notification>) => Promise<boolean>;
  markAsRead: (notificationId: string) => Promise<boolean>;
  markAllAsRead: (type?: string) => Promise<boolean>;
  refreshNotifications: () => Promise<void>;
  retryCount: number;
  lastUpdated: Date | null;
}

export function useNotifications(userId?: string): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<NotificationsPagination | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const mountedRef = useRef(true);

  // Carregar notificações com retry
  const loadNotifications = useCallback(async (page: number = 1, reset: boolean = false) => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      user_id: userId,
      page: page.toString(),
      limit: '20'
    });

    const result = await resilientApiCall(
      async () => {
        const response = await fetch(`/api/notifications?${params}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
      },
      {
        maxRetries: 3,
        delay: 1000,
        timeout: 15000,
        useCircuitBreaker: true
      }
    );

    if (!mountedRef.current) return;

    if (result.success && result.data) {
      const data = result.data;

      if (reset) {
        setNotifications(data.notifications || []);
      } else {
        setNotifications(prev => [...prev, ...(data.notifications || [])]);
      }

      setUnreadCount(data.unreadCount || 0);
      setPagination(data.pagination || null);
      setLastUpdated(new Date());
      setRetryCount(result.attempts - 1);

      console.log(`📱 ${data.notifications?.length || 0} notificações carregadas (tentativa ${result.attempts})`);
    } else {
      const errorMessage = result.error?.message || 'Erro ao carregar notificações';
      setError(errorMessage);
      setRetryCount(result.attempts - 1);

      logError('useNotifications - loadNotifications', result.error, {
        userId,
        page,
        attempts: result.attempts
      });
    }

    setLoading(false);
  }, [userId]);

  // Criar nova notificação
  const createNotification = useCallback(async (notificationData: Partial<Notification>): Promise<boolean> => {
    if (!userId) return false;

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          ...notificationData
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao criar notificação');
      }

      const newNotification = await response.json();
      
      // Adicionar à lista local
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);

      return true;
    } catch (err) {
      console.error('Erro ao criar notificação:', err);
      return false;
    }
  }, [userId]);

  // Marcar notificação como lida
  const markAsRead = useCallback(async (notificationId: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!response.ok) {
        throw new Error('Erro ao marcar notificação como lida');
      }

      // Atualizar estado local
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, read_at: new Date().toISOString() }
            : notif
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));

      return true;
    } catch (err) {
      console.error('Erro ao marcar notificação como lida:', err);
      return false;
    }
  }, [userId]);

  // Marcar todas as notificações como lidas
  const markAllAsRead = useCallback(async (type?: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          user_id: userId,
          type 
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao marcar todas as notificações como lidas');
      }

      const data = await response.json();

      // Atualizar estado local
      setNotifications(prev => 
        prev.map(notif => 
          (!type || notif.type === type) && !notif.read_at
            ? { ...notif, read_at: new Date().toISOString() }
            : notif
        )
      );
      
      setUnreadCount(data.newUnreadCount);

      return true;
    } catch (err) {
      console.error('Erro ao marcar todas as notificações como lidas:', err);
      return false;
    }
  }, [userId]);

  // Atualizar notificações
  const refreshNotifications = useCallback(async () => {
    await loadNotifications(1, true);
  }, [loadNotifications]);

  // Carregar notificações automaticamente quando userId mudar
  useEffect(() => {
    if (userId) {
      loadNotifications(1, true);
    }
  }, [userId, loadNotifications]);

  // Polling para atualizações automáticas (a cada 30 segundos)
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      refreshNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [userId, refreshNotifications]);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    pagination,
    loadNotifications,
    createNotification,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    retryCount,
    lastUpdated
  };
}
