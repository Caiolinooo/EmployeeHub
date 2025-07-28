import { supabaseAdmin, supabase } from '@/lib/db';
import { getToken } from '@/lib/tokenStorage';

/**
 * Função auxiliar para obter o token de autenticação de forma consistente
 * Tenta várias fontes para garantir que o token seja encontrado
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    console.log('🔍 Obtendo token de autenticação...');

    // Debug: Verificar o que existe no localStorage
    if (typeof window !== 'undefined') {
      console.log('🔍 Debug localStorage:', {
        auth: localStorage.getItem('auth'),
        token: localStorage.getItem('token') ? 'EXISTS' : 'NOT_FOUND',
        abzToken: localStorage.getItem('abzToken') ? 'EXISTS' : 'NOT_FOUND',
        user: localStorage.getItem('user') ? 'EXISTS' : 'NOT_FOUND'
      });
    }

    // 1. Primeiro, tentar obter o token usando o utilitário tokenStorage
    const storedToken = getToken();
    if (storedToken) {
      console.log('✅ Token encontrado no tokenStorage');
      return storedToken;
    }

    // 2. Tentar obter o token da sessão atual do Supabase
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (accessToken) {
        console.log('Token encontrado na sessão atual do Supabase');
        return accessToken;
      }
    } catch (sessionError) {
      console.error('Erro ao obter sessão do Supabase:', sessionError);
    }

    // 3. Tentar obter o token da sessão atual do SupabaseAdmin
    try {
      const { data: adminSessionData } = await supabaseAdmin.auth.getSession();
      const adminAccessToken = adminSessionData.session?.access_token;

      if (adminAccessToken) {
        console.log('Token encontrado na sessão admin do Supabase');
        return adminAccessToken;
      }
    } catch (adminSessionError) {
      console.error('Erro ao obter sessão admin do Supabase:', adminSessionError);
    }

    // 4. Se não houver token na sessão, tentar obter do localStorage
    if (typeof window !== 'undefined') {
      console.log('Token não encontrado na sessão, tentando localStorage');

      // Tentar obter do localStorage com a chave sb-xxxxx-auth-token
      try {
        const supabaseKeys = Object.keys(localStorage).filter(key =>
          key.startsWith('sb-') && key.endsWith('-auth-token')
        );

        if (supabaseKeys.length > 0) {
          console.log('Encontradas chaves Supabase no localStorage:', supabaseKeys);

          for (const key of supabaseKeys) {
            try {
              const storedValue = localStorage.getItem(key);
              if (storedValue) {
                const parsedValue = JSON.parse(storedValue);
                if (parsedValue.access_token) {
                  console.log(`Token encontrado na chave ${key}`);
                  return parsedValue.access_token;
                }
              }
            } catch (error) {
              console.error(`Erro ao processar chave ${key}:`, error);
            }
          }
        }
      } catch (localStorageError) {
        console.error('Erro ao acessar localStorage:', localStorageError);
      }

      // Tentar obter do localStorage diretamente com várias chaves possíveis
      try {
        const possibleKeys = [
          'supabase.auth.token',
          'supabase-auth-token',
          'abzToken',
          'token'
        ];

        for (const key of possibleKeys) {
          const localToken = localStorage.getItem(key);
          if (localToken) {
            try {
              // Verificar se é um JSON ou uma string direta
              if (localToken.startsWith('{')) {
                const parsedToken = JSON.parse(localToken);
                const token = parsedToken.access_token || parsedToken.token;
                if (token) {
                  console.log(`Token encontrado no localStorage com chave ${key}`);
                  return token;
                }
              } else if (localToken.split('.').length === 3) {
                // Parece ser um JWT válido
                console.log(`Token JWT encontrado no localStorage com chave ${key}`);
                return localToken;
              }
            } catch (parseError) {
              console.error(`Erro ao analisar token do localStorage (${key}):`, parseError);
            }
          }
        }
      } catch (directLocalStorageError) {
        console.error('Erro ao acessar localStorage diretamente:', directLocalStorageError);
      }

      // 5. Tentar obter do cookie
      try {
        console.log('Token não encontrado no localStorage, tentando cookies');
        const cookies = document.cookie.split(';');

        // Procurar por vários possíveis nomes de cookies
        const possibleCookieNames = [
          'supabase-auth-token',
          'sb-access-token',
          'abzToken',
          'token'
        ];

        for (const cookieName of possibleCookieNames) {
          const cookie = cookies.find(c => c.trim().startsWith(`${cookieName}=`));
          if (cookie) {
            try {
              const cookieValue = cookie.split('=')[1];

              // Verificar se é um JSON ou uma string direta
              if (cookieValue.startsWith('{')) {
                const parsedCookie = JSON.parse(decodeURIComponent(cookieValue));
                const token = parsedCookie.access_token || parsedCookie.token;

                if (token) {
                  console.log(`Token encontrado no cookie ${cookieName}`);
                  return token;
                }
              } else if (cookieValue.split('.').length === 3) {
                // Parece ser um JWT válido
                console.log(`Token JWT encontrado no cookie ${cookieName}`);
                return decodeURIComponent(cookieValue);
              }
            } catch (parseError) {
              console.error(`Erro ao analisar token do cookie ${cookieName}:`, parseError);
            }
          }
        }
      } catch (cookieError) {
        console.error('Erro ao acessar cookies:', cookieError);
      }
    }

    // 6. Verificação direta no localStorage como fallback
    if (typeof window !== 'undefined') {
      console.log('🔍 Verificação direta no localStorage...');

      // Tentar token direto
      const directToken = localStorage.getItem('token') || localStorage.getItem('abzToken');
      if (directToken) {
        console.log('✅ Token encontrado diretamente no localStorage');
        return directToken;
      }
    }

    // 7. Como último recurso, tentar obter um novo token
    try {
      console.log('❌ Token não encontrado em nenhuma fonte, tentando obter novo token');

      // Tentar com o cliente normal primeiro
      const { data: refreshData } = await supabase.auth.refreshSession();

      if (refreshData.session?.access_token) {
        console.log('✅ Novo token obtido com sucesso via supabase');
        return refreshData.session.access_token;
      }

      // Se falhar, tentar com o cliente admin
      const { data: adminRefreshData } = await supabaseAdmin.auth.refreshSession();

      if (adminRefreshData.session?.access_token) {
        console.log('✅ Novo token obtido com sucesso via supabaseAdmin');
        return adminRefreshData.session.access_token;
      }
    } catch (refreshError) {
      console.error('❌ Erro ao tentar obter novo token:', refreshError);
    }

    // 7. Verificar se há um token na URL (para casos de redirecionamento após login)
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('access_token');

        if (urlToken) {
          console.log('Token encontrado na URL');
          return urlToken;
        }
      } catch (urlError) {
        console.error('Erro ao verificar token na URL:', urlError);
      }
    }

    console.error('❌ Não foi possível obter token de autenticação de nenhuma fonte');

    // Debug final: mostrar tudo que tentamos
    if (typeof window !== 'undefined') {
      console.log('🔍 Debug final - Estado do localStorage:', {
        keys: Object.keys(localStorage),
        cookies: document.cookie
      });
    }

    return null;
  } catch (error) {
    console.error('❌ Erro ao obter token de autenticação:', error);
    return null;
  }
}

/**
 * Função auxiliar para fazer requisições autenticadas
 * Usa a função getAuthToken para obter o token e adiciona ao cabeçalho Authorization
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    // Obter token de autenticação
    const token = await getAuthToken();

    if (!token) {
      console.error('Não foi possível obter token para requisição autenticada');
      throw new Error('Não foi possível obter token de autenticação. Por favor, faça login novamente.');
    }

    // Criar headers com o token
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);

    // Se não houver Content-Type e não for FormData, definir como application/json
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    // Fazer a requisição com o token
    console.log(`Fazendo requisição autenticada para ${url}`);
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include' // Incluir cookies na requisição
    });

    // Verificar se a resposta foi bem-sucedida
    if (!response.ok) {
      // Se o erro for 401 (Unauthorized), tentar renovar o token e tentar novamente
      if (response.status === 401) {
        console.log('Token expirado ou inválido, tentando renovar...');

        // Tentar renovar o token
        const newToken = await getAuthToken();

        if (newToken && newToken !== token) {
          console.log('Token renovado, tentando requisição novamente');

          // Atualizar o token no header
          headers.set('Authorization', `Bearer ${newToken}`);

          // Tentar a requisição novamente
          const retryResponse = await fetch(url, {
            ...options,
            headers,
            credentials: 'include'
          });

          return retryResponse;
        }
      }

      // Se não for 401 ou não conseguiu renovar o token, lançar erro
      const errorText = await response.text();
      console.error(`Erro na requisição: ${response.status} - ${errorText}`);
      throw new Error(`Erro na requisição: ${response.status} - ${errorText}`);
    }

    return response;
  } catch (error) {
    console.error('Erro ao fazer requisição autenticada:', error);
    throw error;
  }
}
