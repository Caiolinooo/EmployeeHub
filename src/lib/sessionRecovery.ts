/**
 * Sistema de recuperação automática de sessão
 */

import { getToken, saveToken, removeToken } from './tokenStorage';
import { getRefreshToken, saveRefreshToken, removeRefreshToken, isRefreshTokenValid } from './refreshTokenStorage';

export interface SessionRecoveryResult {
  success: boolean;
  user?: any;
  message?: string;
  requiresLogin?: boolean;
}

/**
 * Tenta recuperar a sessão do usuário automaticamente
 */
export async function attemptSessionRecovery(): Promise<SessionRecoveryResult> {
  console.log('🔄 Tentando recuperar sessão automaticamente...');

  try {
    // 1. Verificar se já existe um token válido
    const existingToken = getToken();
    if (existingToken && isTokenStillValid(existingToken)) {
      console.log('✅ Token existente ainda é válido');
      
      // Verificar se o token funciona fazendo uma chamada de teste
      const tokenWorks = await testTokenValidity(existingToken);
      if (tokenWorks.success) {
        return {
          success: true,
          user: tokenWorks.user,
          message: 'Sessão recuperada com token existente'
        };
      }
    }

    // 2. Tentar usar refresh token se disponível
    const refreshToken = getRefreshToken();
    if (refreshToken && isRefreshTokenValid()) {
      console.log('🔄 Tentando recuperar sessão com refresh token...');
      
      const refreshResult = await refreshTokenWithRecovery(refreshToken);
      if (refreshResult.success) {
        return {
          success: true,
          user: refreshResult.user,
          message: 'Sessão recuperada com refresh token'
        };
      } else {
        console.log('❌ Falha ao recuperar com refresh token:', refreshResult.message);
      }
    }

    // 3. Verificar se há sessão Supabase ativa
    const supabaseRecovery = await attemptSupabaseSessionRecovery();
    if (supabaseRecovery.success) {
      return supabaseRecovery;
    }

    // 4. Se nada funcionou, limpar tokens inválidos
    console.log('🧹 Limpando tokens inválidos...');
    removeToken();
    removeRefreshToken();

    return {
      success: false,
      requiresLogin: true,
      message: 'Não foi possível recuperar a sessão. Login necessário.'
    };

  } catch (error) {
    console.error('❌ Erro durante recuperação de sessão:', error);
    
    // Em caso de erro, limpar tokens para evitar loops
    removeToken();
    removeRefreshToken();
    
    return {
      success: false,
      requiresLogin: true,
      message: 'Erro durante recuperação de sessão'
    };
  }
}

/**
 * Verifica se um token ainda é válido (não expirado)
 */
function isTokenStillValid(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) {
      return true; // Token sem expiração
    }

    const expiryTime = payload.exp * 1000;
    const currentTime = Date.now();
    const timeUntilExpiry = expiryTime - currentTime;

    // Considerar válido se ainda tem mais de 1 minuto
    return timeUntilExpiry > 60000;
  } catch (error) {
    console.error('Erro ao verificar validade do token:', error);
    return false;
  }
}

/**
 * Testa se um token funciona fazendo uma chamada à API
 */
async function testTokenValidity(token: string): Promise<{ success: boolean; user?: any }> {
  try {
    const response = await fetch('/api/auth/verify-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ token })
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        user: data.user
      };
    } else {
      return { success: false };
    }
  } catch (error) {
    console.error('Erro ao testar validade do token:', error);
    return { success: false };
  }
}

/**
 * Tenta renovar o token usando refresh token
 */
async function refreshTokenWithRecovery(refreshToken: string): Promise<{ success: boolean; user?: any; message?: string }> {
  try {
    const response = await fetch('/api/auth/refresh-with-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.success && data.accessToken) {
        // Salvar o novo access token
        const tokenExpiry = 24 * 60 * 60; // 1 dia
        saveToken(data.accessToken, tokenExpiry);
        
        // Salvar o novo refresh token se fornecido
        if (data.refreshToken) {
          const refreshExpiry = data.expiresInSeconds || 30 * 24 * 60 * 60; // 30 dias
          const rememberMe = data.user?.rememberMe || false;
          saveRefreshToken(data.refreshToken, refreshExpiry, rememberMe);
        }
        
        return {
          success: true,
          user: data.user,
          message: 'Token renovado com sucesso'
        };
      }
    }

    return {
      success: false,
      message: `Erro HTTP ${response.status}`
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro de rede: ${error}`
    };
  }
}

/**
 * Tenta recuperar sessão usando Supabase
 */
async function attemptSupabaseSessionRecovery(): Promise<SessionRecoveryResult> {
  try {
    // Importar dinamicamente para evitar problemas de SSR
    const { supabase } = await import('@/lib/supabase');
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Erro ao obter sessão Supabase:', error);
      return { success: false };
    }

    if (session?.user) {
      console.log('✅ Sessão Supabase encontrada');
      
      // Buscar dados completos do usuário
      const { data: userData, error: userError } = await supabase
        .from('users_unified')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (userError || !userData) {
        console.error('Erro ao buscar dados do usuário:', userError);
        return { success: false };
      }

      // Gerar novo token JWT para o usuário
      try {
        const tokenResponse = await fetch('/api/auth/generate-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userData.id,
            email: userData.email,
            phoneNumber: userData.phone_number,
            role: userData.role,
            firstName: userData.first_name,
            lastName: userData.last_name
          }),
        });

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          
          if (tokenData.token) {
            // Salvar o novo token
            const tokenExpiry = 24 * 60 * 60; // 1 dia
            saveToken(tokenData.token, tokenExpiry);
            
            return {
              success: true,
              user: userData,
              message: 'Sessão recuperada via Supabase'
            };
          }
        }
      } catch (tokenError) {
        console.error('Erro ao gerar token a partir da sessão Supabase:', tokenError);
      }
    }

    return { success: false };
  } catch (error) {
    console.error('Erro ao tentar recuperar sessão Supabase:', error);
    return { success: false };
  }
}

/**
 * Recupera sessão quando o usuário retorna ao site
 */
export async function recoverSessionOnReturn(): Promise<SessionRecoveryResult> {
  console.log('👋 Usuário retornou ao site, verificando sessão...');
  
  // Verificar se o usuário estava ausente por muito tempo
  const lastActivity = localStorage.getItem('lastActivity');
  const now = Date.now();
  
  if (lastActivity) {
    const timeSinceLastActivity = now - parseInt(lastActivity);
    const hoursAway = timeSinceLastActivity / (1000 * 60 * 60);
    
    console.log(`⏰ Usuário esteve ausente por ${hoursAway.toFixed(1)} horas`);
    
    // Se esteve ausente por mais de 1 hora, tentar recuperar sessão
    if (hoursAway > 1) {
      const recovery = await attemptSessionRecovery();
      
      // Atualizar última atividade
      localStorage.setItem('lastActivity', now.toString());
      
      return recovery;
    }
  }
  
  // Atualizar última atividade
  localStorage.setItem('lastActivity', now.toString());
  
  // Se não esteve ausente por muito tempo, apenas verificar token atual
  const existingToken = getToken();
  if (existingToken) {
    const tokenWorks = await testTokenValidity(existingToken);
    if (tokenWorks.success) {
      return {
        success: true,
        user: tokenWorks.user,
        message: 'Sessão ainda válida'
      };
    }
  }
  
  // Se chegou aqui, tentar recuperação completa
  return attemptSessionRecovery();
}
