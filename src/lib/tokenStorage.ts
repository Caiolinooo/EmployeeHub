/**
 * Utilitário para gerenciar tokens de autenticação no localStorage
 */

// Constantes para as chaves de armazenamento
const TOKEN_KEY = 'abzToken';
const LEGACY_TOKEN_KEY = 'token';
const TOKEN_EXPIRY_KEY = 'tokenExpiry';

/**
 * Salva o token no localStorage e cookies
 * @param token Token JWT
 * @param expiryInSeconds Tempo de expiração em segundos (opcional)
 */
export const saveToken = (token: string, expiryInSeconds?: number): void => {
  if (!token) {
    console.error('Tentativa de salvar token vazio');
    return;
  }

  try {
    // Verificar se o token tem o formato correto de um JWT
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('Token não tem formato JWT válido, mas será salvo mesmo assim');
    } else {
      console.log('Token tem formato JWT válido');
    }

    // Salvar o token em ambas as chaves para compatibilidade
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(LEGACY_TOKEN_KEY, token);

    // Se fornecido, salvar a data de expiração
    const expiryDate = new Date();
    if (expiryInSeconds) {
      expiryDate.setSeconds(expiryDate.getSeconds() + expiryInSeconds);
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryDate.toISOString());
    } else {
      // Padrão de 24 horas
      expiryDate.setHours(expiryDate.getHours() + 24);
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryDate.toISOString());
    }

    // Salvar também em cookies para acesso pelo servidor
    const setCookie = (name: string, value: string, expires: Date) => {
      const secure = window.location.protocol === 'https:' ? '; secure' : '';
      document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; samesite=lax${secure}`;
    };

    setCookie(TOKEN_KEY, token, expiryDate);
    setCookie(LEGACY_TOKEN_KEY, token, expiryDate);

    console.log('Token salvo com sucesso no localStorage e cookies. Comprimento:', token.length);
    console.log('Token expira em:', expiryDate.toISOString());

    // Verificar se os cookies foram realmente definidos
    setTimeout(() => {
      const cookies = document.cookie;
      console.log('Cookies após salvar token:', cookies);

      if (!cookies.includes(TOKEN_KEY) && !cookies.includes(LEGACY_TOKEN_KEY)) {
        console.warn('Cookies não foram definidos corretamente. Tentando novamente com opções diferentes...');

        // Tentar novamente com opções diferentes
        document.cookie = `${TOKEN_KEY}=${token}; path=/;`;
        document.cookie = `${LEGACY_TOKEN_KEY}=${token}; path=/;`;

        console.log('Cookies após segunda tentativa:', document.cookie);
      }
    }, 100);
  } catch (error) {
    console.error('Erro ao salvar token:', error);
  }
};

/**
 * Recupera o token do localStorage ou cookies
 * @returns O token JWT ou null se não existir
 */
// Verificar se estamos no navegador
const isBrowser = typeof window !== 'undefined';

export const getToken = (): string | null => {
  // Se não estamos no navegador (SSR), retornar null
  if (!isBrowser) {
    return null;
  }

  try {
    // Tentar obter o token da chave principal primeiro
    let token = localStorage.getItem(TOKEN_KEY);

    // Se não encontrar, tentar a chave legada
    if (!token) {
      token = localStorage.getItem(LEGACY_TOKEN_KEY);

      // Se encontrou na chave legada, atualizar para a chave principal
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        console.log('Token migrado da chave legada para a chave principal');
      }
    }

    // Se ainda não encontrou, tentar nos cookies
    if (!token) {
      // Função para obter valor de um cookie por nome
      const getCookie = (name: string): string | null => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
          const cookieValue = parts.pop()?.split(';').shift() || null;
          return cookieValue;
        }
        return null;
      };

      // Tentar obter dos cookies
      token = getCookie(TOKEN_KEY) || getCookie(LEGACY_TOKEN_KEY);

      // Se encontrou nos cookies, salvar no localStorage também
      if (token) {
        console.log('Token encontrado nos cookies, salvando no localStorage');
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(LEGACY_TOKEN_KEY, token);
      }
    }

    if (token) {
      console.log('Token recuperado com sucesso. Comprimento:', token.length);

      // Verificar se o token está expirado
      const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
      if (expiryStr) {
        const expiry = new Date(expiryStr);
        if (expiry < new Date()) {
          console.warn('Token expirado, removendo...');
          removeToken();
          return null;
        }
      }

      // Verificar se o token tem o formato correto de um JWT
      try {
        const parts = token.split('.');
        if (parts.length !== 3) {
          console.warn('Token não tem formato JWT válido, removendo...');
          removeToken();
          return null;
        }

        // Verificar se o payload pode ser decodificado
        try {
          const payload = JSON.parse(atob(parts[1]));

          // Verificar se o token tem os campos necessários
          if (!payload.userId && !payload.sub) {
            console.warn('Token não contém ID do usuário, removendo...');
            removeToken();
            return null;
          }

          // Verificar se o token está expirado
          if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            console.warn('Token expirado segundo o payload, removendo...');
            removeToken();
            return null;
          }

          console.log('Token JWT válido com payload:', {
            userId: payload.userId || payload.sub,
            role: payload.role,
            exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'não definido'
          });
        } catch (decodeError) {
          console.warn('Erro ao decodificar payload do token:', decodeError);
          // Não remover o token aqui, pode ser um formato diferente mas ainda válido
        }
      } catch (formatError) {
        console.warn('Erro ao verificar formato do token:', formatError);
        // Não remover o token aqui, pode ser um formato diferente mas ainda válido
      }
    } else {
      console.warn('Nenhum token encontrado no localStorage ou cookies');
    }

    return token;
  } catch (error) {
    console.error('Erro ao recuperar token:', error);
    return null;
  }
};

/**
 * Remove o token do localStorage e cookies
 */
export const removeToken = (): void => {
  // Se não estamos no navegador (SSR), não fazer nada
  if (!isBrowser) {
    return;
  }

  try {
    // Remover do localStorage
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);

    // Remover dos cookies
    const removeCookie = (name: string) => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; samesite=lax`;
    };

    removeCookie(TOKEN_KEY);
    removeCookie(LEGACY_TOKEN_KEY);

    console.log('Token removido com sucesso do localStorage e cookies');
  } catch (error) {
    console.error('Erro ao remover token:', error);
  }
};

/**
 * Verifica se o token existe e não está expirado
 * @returns true se o token for válido, false caso contrário
 */
export const isTokenValid = (): boolean => {
  // Se não estamos no navegador (SSR), retornar false
  if (!isBrowser) {
    return false;
  }

  const token = getToken();
  if (!token) return false;

  // Verificar expiração
  const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (expiryStr) {
    const expiry = new Date(expiryStr);
    if (expiry < new Date()) {
      console.warn('Token expirado');
      return false;
    }
  }

  return true;
};

/**
 * Adiciona o token ao cabeçalho de autorização
 * @param headers Cabeçalhos HTTP existentes ou novos
 * @returns Cabeçalhos com o token adicionado
 */
export const addTokenToHeaders = (headers: HeadersInit = {}): HeadersInit => {
  const token = getToken();
  if (!token) {
    console.warn('Tentativa de adicionar token aos cabeçalhos, mas nenhum token foi encontrado');
    return headers;
  }

  const newHeaders = new Headers(headers);
  newHeaders.set('Authorization', `Bearer ${token}`);

  // Log para depuração
  console.log('addTokenToHeaders: Token adicionado ao cabeçalho. Comprimento:', token.length);

  return newHeaders;
};

/**
 * Função para fazer requisições autenticadas
 * @param url URL da requisição
 * @param options Opções da requisição
 * @returns Promise com a resposta
 */
export const fetchWithToken = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = getToken();

  if (!token) {
    console.warn('Tentativa de fazer requisição autenticada sem token');

    // Verificar se estamos em uma página que requer autenticação
    if (typeof window !== 'undefined' &&
        (window.location.pathname.startsWith('/avaliacao') ||
         window.location.pathname.startsWith('/admin'))) {
      console.error('Página requer autenticação mas token não encontrado');

      // Redirecionar para login após um breve atraso
      setTimeout(() => {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }, 500);
    }
  }

  // Criar novos cabeçalhos para evitar problemas de mutabilidade
  const headers = new Headers(options.headers || {});

  // Adicionar token de autorização se disponível
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);

    // Log para depuração
    console.log(`fetchWithToken: Enviando requisição para ${url} com token (comprimento: ${token.length})`);
  } else {
    console.log(`fetchWithToken: Enviando requisição para ${url} sem token`);
  }

  // Adicionar cabeçalhos padrão se não existirem
  if (!headers.has('Content-Type') && !options.body) {
    headers.set('Content-Type', 'application/json');
  }

  // Adicionar timestamp para evitar cache
  const timestamp = new Date().getTime();
  const urlWithTimestamp = url.includes('?')
    ? `${url}&_t=${timestamp}`
    : `${url}?_t=${timestamp}`;

  try {
    // Verificar se a URL contém um ID e se é um UUID válido
    if (url.includes('/avaliacoes/')) {
      const parts = url.split('/');
      const idIndex = parts.findIndex(part => part === 'avaliacoes') + 1;

      // Verificar se o próximo segmento após 'avaliacoes' existe e não é outro segmento de rota
      if (idIndex < parts.length && parts[idIndex] !== 'avaliacoes') {
        const id = parts[idIndex];
        // Remover parâmetros de consulta se existirem
        const cleanId = id.split('?')[0];

        // Verificar se é um UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        // Lista de rotas especiais que não precisam ser UUIDs
        const specialRoutes = ['nova', 'editar', 'debug'];

        // Se o ID não for vazio e não for uma rota especial e não for um UUID válido
        if (cleanId && !specialRoutes.includes(cleanId) && !uuidRegex.test(cleanId)) {
          console.warn(`fetchWithToken: ID possivelmente inválido na URL: ${cleanId}`);

          // Se a URL contém um ID inválido e não é uma rota de listagem ou uma rota especial
          if (!url.endsWith('/avaliacoes') && !url.endsWith('/avaliacoes/')) {
            // Verificar se é uma rota de edição (que pode ter /editar no final)
            const isEditRoute = url.includes('/editar') || url.includes('/debug');
            // Verificar se é uma rota de API ou uma rota de página
            const isApiRoute = url.includes('/api/');

            // Se for uma rota de API, verificar se é uma rota válida
            if (isApiRoute && !isEditRoute) {
              // Verificar se a URL tem um formato válido para a API
              if (url.includes('/api/avaliacao-desempenho/avaliacoes/') ||
                  url.includes('/api/avaliacao/avaliacoes/')) {
                console.error(`fetchWithToken: URL de API inválida: ${url}`);
                throw new Error(`ID inválido na URL: ${cleanId}. O ID deve ser um UUID válido.`);
              }
            }
          }
        }
      }
    }

    console.log(`fetchWithToken: Enviando requisição para ${urlWithTimestamp}`);

    const response = await fetch(urlWithTimestamp, {
      ...options,
      headers,
      // Adicionar credentials para enviar cookies
      credentials: 'same-origin'
    });

    // Log detalhado para depuração
    console.log(`fetchWithToken: Resposta de ${url} - Status: ${response.status}`);

    if (!response.ok) {
      console.error(`fetchWithToken: Erro na resposta - Status: ${response.status}, URL: ${url}`);
      // Tentar obter detalhes do erro
      try {
        const errorText = await response.text();
        console.error(`fetchWithToken: Detalhes do erro: ${errorText}`);
      } catch (textError) {
        console.error(`fetchWithToken: Não foi possível obter detalhes do erro: ${textError}`);
      }
    }

    return response;
  } catch (error) {
    console.error(`fetchWithToken: Erro ao fazer requisição para ${url}:`, error);
    throw error;
  }
};
