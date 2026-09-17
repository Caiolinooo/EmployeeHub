'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiBell, FiX, FiCheck, FiCheckCircle, FiClock, FiHeart, FiMessageCircle, FiAlertCircle, FiInfo, FiClipboard } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { useNotifications } from '@/hooks/useNotifications';
import NotificationBanner from './NotificationBanner';
import NotificationItem from './NotificationItem';

const isVerboseDebugEnabled = (): boolean => {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') return false;
  try {
    return localStorage.getItem('abz:debug') === '1';
  } catch {
    return false;
  }
};
const debugLog = (...args: unknown[]) => {
  if (isVerboseDebugEnabled()) {
    console.log(...args);
  }
};

interface NotificationHUDProps {
  userId: string;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxVisible?: number;
  showBanner?: boolean;
  evaluationPendingCount?: number;
  className?: string;
}

const NotificationHUD: React.FC<NotificationHUDProps> = ({
  userId,
  position = 'top-right',
  maxVisible = 5,
  showBanner = true,
  evaluationPendingCount = 0,
  className
}) => {
  const { t, locale, version } = useI18n();

  // Se não houver userId, não carregar nada
  const safeUserId = userId || '';

  const {
    notifications,
    unreadCount,
    loading,
    error,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    pagination
  } = useNotifications(safeUserId);

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const prevUnreadRef = useRef<number>(0);

  useEffect(() => {
    debugLog('🔍 NotificationHUD Render:', {
      userId,
      notificationsLength: notifications.length,
      unreadCount,
      loading,
      isOpen
    });
  }, [userId, notifications, unreadCount, loading, isOpen]);

  // Chime curto "ABZ" com WebAudio
  const playABZChime = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      master.connect(ctx.destination);

      const notes = [
        { t: 0.00, freq: 440 },
        { t: 0.28, freq: 494 },
        { t: 0.56, freq: 659 }
      ];

      notes.forEach(({ t, freq }) => {
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g = ctx.createGain();
        o1.type = 'sine';
        o2.type = 'triangle';
        o1.frequency.setValueAtTime(freq, now + t);
        o2.frequency.setValueAtTime(freq * 2, now + t);

        g.gain.setValueAtTime(0.0001, now + t);
        g.gain.exponentialRampToValueAtTime(0.12, now + t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.35);

        o1.connect(g); o2.connect(g); g.connect(master);
        o1.start(now + t); o2.start(now + t);
        o1.stop(now + t + 0.38); o2.stop(now + t + 0.38);
      });

      const oZ = ctx.createOscillator();
      const gZ = ctx.createGain();
      oZ.type = 'sine';
      oZ.frequency.setValueAtTime(740, now + 0.88);
      oZ.frequency.exponentialRampToValueAtTime(660, now + 1.1);
      gZ.gain.setValueAtTime(0.0001, now + 0.88);
      gZ.gain.exponentialRampToValueAtTime(0.08, now + 0.91);
      gZ.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      oZ.connect(gZ); gZ.connect(master);
      oZ.start(now + 0.88); oZ.stop(now + 1.22);
    } catch { }
  };

  // Aviso sonoro quando contador aumenta
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      playABZChime();
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // Shortcut: when dropdown open, press "r" to marcar todas como lidas
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        markAllAsRead();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, markAllAsRead]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Obter ícone por tipo de notificação
  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = `w-4 h-4 ${priority === 'urgent' ? 'text-red-500' :
      priority === 'high' ? 'text-orange-500' :
        priority === 'low' ? 'text-gray-400' : 'text-blue-500'
      }`;

    switch (type) {
      case 'evaluation': return <FiClipboard className={iconClass} />;
      case 'news_post': return <FiInfo className={iconClass} />;
      case 'comment': return <FiMessageCircle className={iconClass} />;
      case 'like': return <FiHeart className={iconClass} />;
      case 'reminder': return <FiClock className={iconClass} />;
      case 'system': return <FiAlertCircle className={iconClass} />;
      default: return <FiBell className={iconClass} />;
    }
  };

  // Formatar tempo relativo
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return locale === 'pt-BR' ? 'Agora' : 'Now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  // Posicionamento do dropdown
  const getPositionClasses = () => {
    switch (position) {
      case 'top-left': return 'top-12 left-0';
      case 'bottom-right': return 'bottom-12 right-0';
      case 'bottom-left': return 'bottom-12 left-0';
      default: return 'top-12 right-0';
    }
  };

  const handleLoadMore = () => {
    if (pagination?.hasNext) {
      loadNotifications(pagination.page + 1, false);
    }
  };

  // Estado para o banner
  const [bannerNotification, setBannerNotification] = useState<any | null>(null);
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [shownNotifications, setShownNotifications] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`shown-notifications-${userId}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    }
    return new Set();
  });

  // Detectar novas notificações para mostrar no banner e tocar som
  // FIX: Limitar a notificações criadas na última hora para evitar spam de banners antigos
  useEffect(() => {
    if (notifications.length === 0) {
      debugLog('🔔 [Banner] Nenhuma notificação disponível');
      return;
    }

    const now = new Date();
    const ONE_HOUR_MS = 60 * 60 * 1000; // 1 hora em milissegundos

    // Ordenar por data (mais recente primeiro) com ID como desempate para estabilidade
    const sorted = [...notifications].sort((a, b) => {
      const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (timeDiff !== 0) return timeDiff;
      // Desempate por ID para evitar flip-flopping quando timestamps são iguais
      return b.id.localeCompare(a.id);
    });

    const latest = sorted[0];
    const latestAge = now.getTime() - new Date(latest.created_at).getTime();
    const isRecent = latestAge < ONE_HOUR_MS;

    debugLog('🔔 [Banner] Avaliando notificação:', {
      id: latest.id,
      title: latest.title,
      created_at: latest.created_at,
      ageMinutes: Math.floor(latestAge / 60000),
      isRecent,
      isRead: !!latest.read_at,
      alreadyShown: shownNotifications.has(latest.id)
    });

    // Verificar todas as condições para mostrar o banner:
    // 1. Não foi lida
    // 2. Não foi mostrada antes
    // 3. É MUITO RECENTE (criada nos últimos 30 segundos) - Para evitar spam ao recarregar a página
    // O "isRecent" original de 1 hora era muito longo para banners. Banners devem ser "live".

    // Se a notificação for mais velha que 30s, assumimos que aconteceu enquanto o user não estava olhando,
    // então ela vai pro HUD (sininho), mas não explode um banner na cara.
    const isBrandNew = latestAge < 30 * 1000;

    if (latest && !latest.read_at && !shownNotifications.has(latest.id)) {
      if (isBrandNew) {
        debugLog('🔔 [Banner] ✅ Mostrando banner (LIVE):', latest.title);
        playABZChime();

        if (showBanner) {
          setBannerNotification(latest);
          setIsBannerVisible(true);
        }
      } else {
        debugLog('🔔 [Banner] ⏭️ Silenciando banner (muito antigo):', latestAge / 1000, 's');
      }

      // Sempre marcar como "processada" para não cair no loop novamente
      setShownNotifications(prev => {
        const newSet = new Set([...prev, latest.id]);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`shown-notifications-${userId}`, JSON.stringify([...newSet]));
        }
        return newSet;
      });
    }

  }, [notifications, showBanner, userId, shownNotifications]);

  // Recarregar histórico de mostradas se mudar usuário
  useEffect(() => {
    if (userId && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`shown-notifications-${userId}`);
      if (stored) {
        setShownNotifications(new Set(JSON.parse(stored)));
      } else {
        setShownNotifications(new Set());
      }
    }
  }, [userId]);

  // Sem userId: renderiza nada. O guard fica DEPOIS de todos os hooks —
  // hooks precisam rodar na mesma ordem em toda render (rules-of-hooks).
  if (!userId) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Banner de Notificação */}
      <NotificationBanner
        userId={userId}
        notification={bannerNotification}
        isVisible={isBannerVisible}
        onClose={() => setIsBannerVisible(false)}
        triggerElement={bellRef.current}
      />

      {/* Botão de Notificações */}
      <button
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        className={className || "relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"}
        aria-label={t('components.notificacoes')}
        title={unreadCount > 0 || evaluationPendingCount > 0 ? `${unreadCount} notificações, ${evaluationPendingCount} avaliações pendentes` : t('components.notificacoes')}
      >
        <FiBell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 z-10">
            {!isOpen && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
            )}
            <span className="relative inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold shadow-lg min-w-[20px]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </span>
        )}
        {evaluationPendingCount > 0 && (
          <span className="absolute -bottom-1 -right-1 h-5 w-5 z-10">
            {!isOpen && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping"></span>
            )}
            <span className="relative inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-600 text-white text-xs font-bold shadow-lg min-w-[20px]">
              {evaluationPendingCount > 99 ? '99+' : evaluationPendingCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown de Notificações */}
      {isOpen && (
        <div className={`absolute ${getPositionClasses()} w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">{t('notifications.title')}</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => loadNotifications()}
                className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600 transition-colors"
                title="Atualizar"
                disabled={loading}
              >
                <FiClock className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {t('notifications.markAllAsRead')}
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
                aria-label={t('common.close')}
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista de Notificações */}
          <div className="max-h-80 overflow-y-auto">
            {error ? (
              <div className="p-8 text-center text-red-500">
                <FiAlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="font-medium">Erro ao carregar</p>
                <p className="text-xs mt-1">{error}</p>
                <button
                  onClick={() => loadNotifications()}
                  className="mt-3 text-xs bg-red-50 text-red-600 px-3 py-1 rounded hover:bg-red-100"
                >
                  Tentar novamente
                </button>
              </div>
            ) : loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p>Carregando notificações...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FiBell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>{t('notifications.noNotifications')}</p>
              </div>
            ) : (
              <>
                {notifications.slice(0, maxVisible).map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={markAsRead}
                    onClick={(n) => {
                      if (n.link || n.action_url) {
                        window.location.href = n.link || n.action_url!;
                      }
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(NotificationHUD);
