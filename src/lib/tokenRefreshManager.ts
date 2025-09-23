/**
 * Gerenciador de refresh automático de tokens
 */

import { getToken, saveToken, removeToken, isTokenValid } from './tokenStorage';
import { getRefreshToken, saveRefreshToken, removeRefreshToken } from './refreshTokenStorage';

// Intervalo para verificar expiração (5 minutos)
const CHECK_INTERVAL = 5 * 60 * 1000;

// Tempo antes da expiração para renovar (10 minutos)
const REFRESH_BEFORE_EXPIRY = 10 * 60 * 1000;

class TokenRefreshManager {
  private intervalId: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  /**
   * Inicia o monitoramento automático de tokens
   */
  start(): void {
    if (typeof window === 'undefined') {
      return; // Não executar no servidor
    }

    console.log('🔄 Iniciando gerenciador de refresh automático de tokens');

    // Verificar imediatamente
    this.checkAndRefreshToken();

    // Configurar verificação periódica
    this.intervalId = setInterval(() => {
      this.checkAndRefreshToken();
    }, CHECK_INTERVAL);

    // Verificar quando a aba volta ao foco
    window.addEventListener('focus', () => {
      this.checkAndRefreshToken();
    });

    // Verificar quando sai do modo invisível
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkAndRefreshToken();
      }
    });
  }

  /**
   * Para o monitoramento automático
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('⏹️ Gerenciador de refresh automático parado');
  }

  /**
   * Verifica se o token precisa ser renovado e o renova se necessário
   */
  private async checkAndRefreshToken(): Promise<void> {
    if (this.isRefreshing) {
      return; // Já está renovando
    }

    try {
      const token = getToken();
      if (!token) {
        console.log('🔍 Nenhum token encontrado para verificar');
        return;
      }

      // Verificar se o token está próximo da expiração
      if (this.isTokenNearExpiry(token)) {
        console.log('⚠️ Token próximo da expiração, tentando renovar...');
        await this.refreshToken();
      }
    } catch (error) {
      console.error('❌ Erro ao verificar token:', error);
    }
  }

  /**
   * Verifica se o token está próximo da expiração
   */
  private isTokenNearExpiry(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return true; // Token inválido, precisa renovar
      }

      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) {
        return false; // Token sem expiração
      }

      const expiryTime = payload.exp * 1000; // Converter para milliseconds
      const currentTime = Date.now();
      const timeUntilExpiry = expiryTime - currentTime;

      return timeUntilExpiry <= REFRESH_BEFORE_EXPIRY;
    } catch (error) {
      console.error('Erro ao verificar expiração do token:', error);
      return true; // Em caso de erro, assumir que precisa renovar
    }
  }

  /**
   * Renova o token usando refresh token
   */
  async refreshToken(): Promise<boolean> {
    if (this.isRefreshing) {
      // Se já está renovando, aguardar a promessa existente
      return this.refreshPromise || Promise.resolve(false);
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Executa a renovação do token
   */
  private async performRefresh(): Promise<boolean> {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        console.log('❌ Nenhum refresh token encontrado');
        return false;
      }

      console.log('🔄 Renovando token com refresh token...');

      const response = await fetch('/api/auth/refresh-with-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        console.error('❌ Erro ao renovar token:', response.status);
        
        // Se o refresh token é inválido, limpar tudo
        if (response.status === 401) {
          console.log('🧹 Refresh token inválido, limpando tokens...');
          removeToken();
          removeRefreshToken();
          
          // Redirecionar para login após um breve delay
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
          }, 1000);
        }
        
        return false;
      }

      const data = await response.json();
      
      if (data.success && data.accessToken) {
        console.log('✅ Token renovado com sucesso');
        
        // Salvar o novo access token
        const tokenExpiry = 24 * 60 * 60; // 1 dia em segundos
        saveToken(data.accessToken, tokenExpiry);
        
        // Salvar o novo refresh token se fornecido
        if (data.refreshToken) {
          const refreshExpiry = data.expiresInSeconds || 30 * 24 * 60 * 60; // 30 dias
          const rememberMe = data.user?.rememberMe || false;
          saveRefreshToken(data.refreshToken, refreshExpiry, rememberMe);
        }
        
        // Disparar evento personalizado para notificar outros componentes
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tokenRefreshed', {
            detail: { user: data.user }
          }));
        }
        
        return true;
      } else {
        console.error('❌ Resposta inválida ao renovar token:', data);
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao renovar token:', error);
      return false;
    }
  }

  /**
   * Força a renovação do token
   */
  async forceRefresh(): Promise<boolean> {
    console.log('🔄 Forçando renovação do token...');
    return this.refreshToken();
  }

  /**
   * Verifica se o gerenciador está ativo
   */
  isActive(): boolean {
    return this.intervalId !== null;
  }
}

// Instância singleton
const tokenRefreshManager = new TokenRefreshManager();

export default tokenRefreshManager;

// Funções de conveniência
export const startTokenRefreshManager = () => tokenRefreshManager.start();
export const stopTokenRefreshManager = () => tokenRefreshManager.stop();
export const refreshTokenNow = () => tokenRefreshManager.forceRefresh();
export const isTokenRefreshManagerActive = () => tokenRefreshManager.isActive();
