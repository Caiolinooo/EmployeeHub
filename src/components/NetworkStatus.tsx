'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FiWifi, 
  FiWifiOff, 
  FiAlertTriangle, 
  FiRefreshCw,
  FiCheckCircle,
  FiXCircle
} from 'react-icons/fi';
import { apiCircuitBreaker } from '@/lib/apiRetry';
import { useI18n } from '@/contexts/I18nContext';

interface NetworkStatusProps {
  className?: string;
  showDetails?: boolean;
}

interface ConnectionStatus {
  online: boolean;
  apiHealthy: boolean;
  lastCheck: Date;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  failures: number;
}

export default function NetworkStatus({ className = '', showDetails = false }: NetworkStatusProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<ConnectionStatus>({
    online: true,
    apiHealthy: true,
    lastCheck: new Date(),
    circuitBreakerState: 'closed',
    failures: 0
  });
  const [isChecking, setIsChecking] = useState(false);

  // Verificar status da API
  const checkApiHealth = async () => {
    setIsChecking(true);
    
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-cache'
      });
      
      const healthy = response.ok;
      const circuitState = apiCircuitBreaker.getState();
      
      setStatus(prev => ({
        ...prev,
        apiHealthy: healthy,
        lastCheck: new Date(),
        circuitBreakerState: circuitState.state,
        failures: circuitState.failures
      }));
      
    } catch (error) {
      console.warn('Health check failed:', error);
      const circuitState = apiCircuitBreaker.getState();
      
      setStatus(prev => ({
        ...prev,
        apiHealthy: false,
        lastCheck: new Date(),
        circuitBreakerState: circuitState.state,
        failures: circuitState.failures
      }));
    } finally {
      setIsChecking(false);
    }
  };

  // Verificar status da conexão
  useEffect(() => {
    const updateOnlineStatus = () => {
      setStatus(prev => ({
        ...prev,
        online: navigator.onLine
      }));
    };

    // Listeners para mudanças de conectividade
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Check inicial
    updateOnlineStatus();
    checkApiHealth();

    // Check periódico da API
    const interval = setInterval(checkApiHealth, 30000); // 30 segundos

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(interval);
    };
  }, []);

  // Determinar status geral
  const getOverallStatus = () => {
    if (!status.online) return 'offline';
    if (!status.apiHealthy || status.circuitBreakerState === 'open') return 'degraded';
    if (status.circuitBreakerState === 'half-open') return 'recovering';
    return 'healthy';
  };

  const overallStatus = getOverallStatus();

  // Não mostrar se tudo está funcionando bem e não é para mostrar detalhes
  if (!showDetails && overallStatus === 'healthy') {
    return null;
  }

  const getStatusIcon = () => {
    switch (overallStatus) {
      case 'offline':
        return <FiWifiOff className="h-4 w-4 text-red-500" />;
      case 'degraded':
        return <FiXCircle className="h-4 w-4 text-red-500" />;
      case 'recovering':
        return <FiAlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'healthy':
        return <FiCheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <FiWifi className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusMessage = () => {
    switch (overallStatus) {
      case 'offline':
        return t('components.semConexaoComAInternet');
      case 'degraded':
        return 'Problemas de conectividade detectados';
      case 'recovering':
        return 'Reconectando...';
      case 'healthy':
        return t('components.conexaoEstavel');
      default:
        return 'Status desconhecido';
    }
  };

  const getStatusColor = () => {
    switch (overallStatus) {
      case 'offline':
      case 'degraded':
        return 'border-red-200 bg-red-50';
      case 'recovering':
        return 'border-yellow-200 bg-yellow-50';
      case 'healthy':
        return 'border-green-200 bg-green-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  if (!showDetails && overallStatus === 'healthy') {
    return null;
  }

  return (
    <Card className={`${getStatusColor()} ${className}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="text-sm font-medium text-gray-900">
              {getStatusMessage()}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            {showDetails && (
              <span className="text-xs text-gray-500">
                {status.lastCheck.toLocaleTimeString()}
              </span>
            )}
            
            <Button
              onClick={checkApiHealth}
              disabled={isChecking}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
            >
              <FiRefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {showDetails && (
          <div className="mt-3 space-y-2 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Conexão Internet:</span>
              <span className={status.online ? 'text-green-600' : 'text-red-600'}>
                {status.online ? 'Online' : 'Offline'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>API Status:</span>
              <span className={status.apiHealthy ? 'text-green-600' : 'text-red-600'}>
                {status.apiHealthy ? t('components.saudavel') : 'Com problemas'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span>Circuit Breaker:</span>
              <span className={
                status.circuitBreakerState === 'closed' ? 'text-green-600' :
                status.circuitBreakerState === 'half-open' ? 'text-yellow-600' : 'text-red-600'
              }>
                {status.circuitBreakerState === 'closed' ? 'Fechado' :
                 status.circuitBreakerState === 'half-open' ? 'Meio-aberto' : 'Aberto'}
              </span>
            </div>
            
            {status.failures > 0 && (
              <div className="flex justify-between">
                <span>Falhas recentes:</span>
                <span className="text-red-600">{status.failures}</span>
              </div>
            )}
            
            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                {overallStatus === 'offline' && t('components.verifiqueSuaConexaoComAInternet', 'Verifique sua conexão com a internet')}
                {overallStatus === 'degraded' && t('components.algumasFuncionalidadesPodemEstarLentas', 'Algumas funcionalidades podem estar lentas.')}
                {overallStatus === 'recovering' && t('components.tentandoRestabelecerConexao', 'Tentando restabelecer conexão')}
                {overallStatus === 'healthy' && t('components.todosSistemasNormais', 'Todos os sistemas funcionando normalmente.')}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
