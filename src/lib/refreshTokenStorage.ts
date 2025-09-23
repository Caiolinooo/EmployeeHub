/**
 * Utilitário para gerenciar refresh tokens de forma segura
 */

// Constantes para as chaves de armazenamento
const REFRESH_TOKEN_KEY = 'abzRefreshToken';
const REFRESH_TOKEN_EXPIRY_KEY = 'refreshTokenExpiry';
const REMEMBER_ME_KEY = 'rememberMe';

// Verificar se estamos no navegador
const isBrowser = typeof window !== 'undefined';

/**
 * Salva o refresh token no localStorage
 * @param refreshToken Token de refresh
 * @param expiryInSeconds Tempo de expiração em segundos
 * @param rememberMe Se o usuário marcou "lembrar-me"
 */
export const saveRefreshToken = (refreshToken: string, expiryInSeconds: number, rememberMe: boolean = false): void => {
  if (!isBrowser || !refreshToken) {
    console.error('Tentativa de salvar refresh token vazio ou fora do navegador');
    return;
  }

  try {
    // Salvar o refresh token
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    
    // Calcular e salvar a data de expiração
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + expiryInSeconds);
    localStorage.setItem(REFRESH_TOKEN_EXPIRY_KEY, expiryDate.toISOString());
    
    // Salvar a preferência de "lembrar-me"
    localStorage.setItem(REMEMBER_ME_KEY, rememberMe.toString());
    
    console.log('Refresh token salvo com sucesso:', {
      hasToken: !!refreshToken,
      expiresAt: expiryDate.toISOString(),
      rememberMe
    });
  } catch (error) {
    console.error('Erro ao salvar refresh token:', error);
  }
};

/**
 * Recupera o refresh token do localStorage
 * @returns O refresh token ou null se não existir ou estiver expirado
 */
export const getRefreshToken = (): string | null => {
  if (!isBrowser) {
    return null;
  }

  try {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    
    if (!refreshToken) {
      console.log('Nenhum refresh token encontrado');
      return null;
    }

    // Verificar se o token está expirado
    const expiryStr = localStorage.getItem(REFRESH_TOKEN_EXPIRY_KEY);
    if (expiryStr) {
      const expiry = new Date(expiryStr);
      if (expiry < new Date()) {
        console.log('Refresh token expirado, removendo...');
        removeRefreshToken();
        return null;
      }
    }

    console.log('Refresh token recuperado com sucesso');
    return refreshToken;
  } catch (error) {
    console.error('Erro ao recuperar refresh token:', error);
    return null;
  }
};

/**
 * Remove o refresh token do localStorage
 */
export const removeRefreshToken = (): void => {
  if (!isBrowser) {
    return;
  }

  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_EXPIRY_KEY);
    localStorage.removeItem(REMEMBER_ME_KEY);
    console.log('Refresh token removido com sucesso');
  } catch (error) {
    console.error('Erro ao remover refresh token:', error);
  }
};

/**
 * Verifica se o usuário marcou "lembrar-me"
 * @returns true se o usuário marcou "lembrar-me"
 */
export const isRememberMeEnabled = (): boolean => {
  if (!isBrowser) {
    return false;
  }

  try {
    const rememberMe = localStorage.getItem(REMEMBER_ME_KEY);
    return rememberMe === 'true';
  } catch (error) {
    console.error('Erro ao verificar remember me:', error);
    return false;
  }
};

/**
 * Verifica se o refresh token existe e não está expirado
 * @returns true se o refresh token for válido
 */
export const isRefreshTokenValid = (): boolean => {
  if (!isBrowser) {
    return false;
  }

  const refreshToken = getRefreshToken();
  return !!refreshToken;
};

/**
 * Obtém informações sobre o refresh token
 * @returns Informações sobre o refresh token
 */
export const getRefreshTokenInfo = (): {
  hasToken: boolean;
  expiresAt: string | null;
  rememberMe: boolean;
  isValid: boolean;
} => {
  if (!isBrowser) {
    return {
      hasToken: false,
      expiresAt: null,
      rememberMe: false,
      isValid: false
    };
  }

  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  const expiryStr = localStorage.getItem(REFRESH_TOKEN_EXPIRY_KEY);
  const rememberMe = localStorage.getItem(REMEMBER_ME_KEY) === 'true';
  
  let isValid = false;
  if (refreshToken && expiryStr) {
    const expiry = new Date(expiryStr);
    isValid = expiry > new Date();
  }

  return {
    hasToken: !!refreshToken,
    expiresAt: expiryStr,
    rememberMe,
    isValid
  };
};
