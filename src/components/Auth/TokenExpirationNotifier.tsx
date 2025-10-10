'use client';

import React, { useState, useEffect } from 'react';
import { getToken } from '@/lib/tokenStorage';
import { refreshTokenNow } from '@/lib/tokenRefreshManager';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { FiClock, FiRefreshCw, FiX } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

// Tempo antes da expiração para mostrar aviso (5 minutos)
const WARNING_TIME = 5 * 60 * 1000;

// Tempo antes da expiração para mostrar aviso crítico (2 minutos)
const CRITICAL_TIME = 2 * 60 * 1000;

interface TokenExpirationNotifierProps {
  onSessionExpired?: () => void;
}

export default function TokenExpirationNotifier({
  const { t } = useI18n();
 onSessionExpired }: TokenExpirationNotifierProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [showCritical, setShowCritical] = useState(false);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const checkTokenExpiration = () => {
      const token = getToken();
      if (!token) {
        setShowWarning(false);
        setShowCritical(false);
        return;
      }

      try {
        const parts = token.split('.');
        if (parts.length !== 3) {
          return;
        }

        const payload = JSON.parse(atob(parts[1]));
        if (!payload.exp) {
          return;
        }

        const expiryTime = payload.exp * 1000;
        const currentTime = Date.now();
        const timeLeft = expiryTime - currentTime;

        setTimeUntilExpiry(timeLeft);

        if (timeLeft <= 0) {
          // Token já expirou
          setShowWarning(false);
          setShowCritical(false);
          onSessionExpired?.();
          return;
        }

        if (timeLeft <= CRITICAL_TIME) {
          setShowCritical(true);
          setShowWarning(false);
        } else if (timeLeft <= WARNING_TIME) {
          setShowWarning(true);
          setShowCritical(false);
        } else {
          setShowWarning(false);
          setShowCritical(false);
        }
      } catch (error) {
        console.error(t('components.erroAoVerificarExpiracaoDoToken'), error);
      }
    };

    // Verificar imediatamente
    checkTokenExpiration();

    // Verificar a cada 30 segundos
    const interval = setInterval(checkTokenExpiration, 30000);

    // Escutar evento de refresh de token
    const handleTokenRefreshed = () => {
      setShowWarning(false);
      setShowCritical(false);
      setIsRefreshing(false);
      toast.success(t('components.sessaoRenovadaComSucesso'));
    };

    window.addEventListener('tokenRefreshed', handleTokenRefreshed);

    return () => {
      clearInterval(interval);
      window.removeEventListener('tokenRefreshed', handleTokenRefreshed);
    };
  }, [onSessionExpired]);

  const handleRefreshToken = async () => {
    setIsRefreshing(true);
    try {
      const success = await refreshTokenNow();
      if (success) {
        setShowWarning(false);
        setShowCritical(false);
        toast.success(t('components.sessaoRenovadaComSucesso'));
      } else {
        toast.error(t('components.erroAoRenovarSessaoFacaLoginNovamente'));
        onSessionExpired?.();
      }
    } catch (error) {
      console.error('Erro ao renovar token:', error);
      toast.error(t('components.erroAoRenovarSessaoFacaLoginNovamente'));
      onSessionExpired?.();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDismiss = () => {
    setShowWarning(false);
    setShowCritical(false);
  };

  const formatTimeLeft = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!showWarning && !showCritical) {
    return null;
  }

  const isCritical = showCritical;
  const bgColor = isCritical ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200';
  const textColor = isCritical ? 'text-red-800' : 'text-yellow-800';
  const iconColor = isCritical ? 'text-red-600' : 'text-yellow-600';
  const buttonColor = isCritical ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700';

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg border shadow-lg ${bgColor}`}>
      <div className="flex items-start space-x-3">
        <FiClock className={`w-5 h-5 mt-0.5 ${iconColor}`} />
        <div className="flex-1">
          <h3 className={`font-medium ${textColor}`}>
            {isCritical ? {t('components.sessaoExpirando')} : {t('components.sessaoExpiraEmBreve')}}
          </h3>
          <p className={`text-sm mt-1 ${textColor}`}>
            {isCritical 
              ? `Sua sessão expira em ${formatTimeLeft(timeUntilExpiry)}. Renove agora para não perder seu trabalho.`
              : `Sua sessão expira em ${formatTimeLeft(timeUntilExpiry)}. Deseja renovar?`
            }
          </p>
          <div className="flex items-center space-x-2 mt-3">
            <Button
              onClick={handleRefreshToken}
              disabled={isRefreshing}
              className={`text-white text-sm px-3 py-1 h-auto ${buttonColor}`}
              size="sm"
            >
              {isRefreshing ? (
                <>
                  <FiRefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  Renovando...
                </>
              ) : (
                <>
                  <FiRefreshCw className="w-3 h-3 mr-1" />
                  Renovar Sessão
                </>
              )}
            </Button>
            {!isCritical && (
              <Button
                onClick={handleDismiss}
                variant="ghost"
                size="sm"
                className={`text-sm px-2 py-1 h-auto ${textColor} hover:bg-opacity-20`}
              >
                <FiX className="w-3 h-3 mr-1" />
                Dispensar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
