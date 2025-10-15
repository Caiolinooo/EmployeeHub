'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { saveToken } from '@/lib/tokenStorage';
import { removeRefreshToken } from '@/lib/refreshTokenStorage';

// Tipo para usuário
export interface User {
  id: string;
  phoneNumber: string;
  firstName: string | null;
  lastName: string | null;
  name?: string | null;
  email?: string | null;
  role: 'ADMIN' | 'USER' | 'MANAGER';
  position?: string | null;
  avatar?: string | null;
  department?: string | null;
  passwordLastChanged?: Date | null;
  active: boolean;
  accessPermissions?: {
    modules?: {
      [key: string]: boolean;
    };
    features?: {
      [key: string]: boolean;
    };
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

// Tipo para credenciais de login por telefone
export interface PhoneCredentials {
  phoneNumber: string;
  verificationCode?: string;
}

// Tipo para atualização de senha
export interface PasswordUpdateData {
  password: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
  passwordExpired: boolean;
  loginStep: 'phone' | 'verification' | 'password' | 'complete' | 'unauthorized' | 'pending' | 'set_password' | 'quick_register';
  hasPassword: boolean;
  authStatus?: string;
  requiresPassword?: boolean;
  isNewUser?: boolean;
  setLoginStep: (step: 'phone' | 'verification' | 'password' | 'complete' | 'unauthorized' | 'pending' | 'set_password' | 'quick_register') => void;
  initiateLogin: (phoneNumber: string, email?: string, inviteCode?: string) => Promise<boolean>;
  loginWithPassword: (identifier: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  verifyCode: (phoneNumber: string, code: string, email?: string, inviteCode?: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
  setPasswordAfterVerification: (password: string) => Promise<boolean>;
  checkPasswordStatus: () => Promise<boolean>;
  hasAccess: (module: string) => boolean;
  hasFeature: (feature: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [passwordExpired, setPasswordExpired] = useState(false);
  const [loginStep, setLoginStep] = useState<'phone' | 'verification' | 'password' | 'complete' | 'unauthorized' | 'pending' | 'set_password' | 'quick_register'>('phone');
  const [hasPassword, setHasPassword] = useState(false);
  const [authStatus, setAuthStatus] = useState<string | undefined>(undefined);
  const [requiresPassword, setRequiresPassword] = useState<boolean>(false);
  const [isNewUser, setIsNewUser] = useState<boolean>(false);

  // Função para renovar o token
  const refreshToken = async (token: string): Promise<{ success: boolean; token?: string; user?: User }> => {
    try {
      console.log('Tentando renovar token...');
      const refreshResponse = await fetch('/api/auth/token-refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        console.log('Token renovado com sucesso');

        if (refreshData.token && refreshData.token !== token) {
          console.log('Token renovado recebido');
          localStorage.setItem('token', refreshData.token);
          return { success: true, token: refreshData.token, user: refreshData.user };
        }

        if (refreshData.user) {
          return { success: true, token, user: refreshData.user };
        }

        return { success: true, token };
      } else {
        console.log('Falha na renovação do token, tentando fix-token');
        return { success: false };
      }
    } catch (error) {
      console.error('Erro ao renovar token:', error);
      return { success: false };
    }
  };

  // Função para corrigir o token
  const fixToken = async (token: string): Promise<{ success: boolean; token?: string; user?: User }> => {
    try {
      console.log('Tentando corrigir token...');
      const response = await fetch('/api/auth/fix-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('Verificando token com a API:', response.status, response.ok);
      if (response.ok) {
        const data = await response.json();
        console.log('Dados do usuário recebidos:', data.user);
        console.log('Papel do usuário:', data.user?.role);

        // Atualizar o token se um novo foi gerado
        if (data.token && data.token !== token) {
          console.log('Novo token recebido após correção');
          localStorage.setItem('token', data.token);
          return { success: true, token: data.token, user: data.user };
        }

        return { success: true, token, user: data.user };
      } else {
        console.log('Token inválido, não foi possível corrigir');
        return { success: false };
      }
    } catch (error) {
      console.error('Erro ao corrigir token:', error);
      return { success: false };
    }
  };

  // Verificar se o usuário está autenticado ao carregar a página
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedAuth = localStorage.getItem('auth');
        let storedToken = localStorage.getItem('token');

        // Verificar se existe o token antigo (abzToken) e migrar para o novo formato
        if (!storedToken) {
          const oldToken = localStorage.getItem('abzToken');
          if (oldToken) {
            console.log('Token antigo encontrado, migrando para o novo formato');
            localStorage.setItem('token', oldToken);
            localStorage.removeItem('abzToken'); // Remover o token antigo após migração
            storedToken = oldToken;
          }
        }

        if (storedAuth === 'true' && storedToken) {
          // Primeiro tentar renovar o token
          const refreshResult = await refreshToken(storedToken);

          if (refreshResult.success) {
            if (refreshResult.user) {
              console.log('Atualizando dados do usuário após renovação de token');
              setUser(refreshResult.user);
              localStorage.setItem('user', JSON.stringify(refreshResult.user));
              setIsLoading(false);
              return;
            }
          } else {
            // Se a renovação falhar, tentar o fix-token
            const fixResult = await fixToken(storedToken);

            if (fixResult.success) {
              if (fixResult.user) {
                console.log('Atualizando dados do usuário após correção de token');
                setUser(fixResult.user);
                localStorage.setItem('user', JSON.stringify(fixResult.user));
              }
            } else {
              console.log('Token inválido, fazendo logout');
              // Token inválido, fazer logout
              logout();
              return;
            }
          }
        } else {
          // Sem token, verificar se há usuário armazenado
          const storedUser = localStorage.getItem('user');
          console.log('Verificando usuário armazenado:', storedUser ? 'Existe' : 'Não existe');
          if (storedAuth === 'true' && storedUser) {
            const parsedUser = JSON.parse(storedUser);
            console.log('Usuário armazenado:', parsedUser);
            console.log('Papel do usuário armazenado:', parsedUser?.role);
            setUser(parsedUser);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Configurar o refresh token periódico
  useEffect(() => {
    // Só configurar o refresh se o usuário estiver presente
    if (!user) return;

    console.log('Configurando refresh token periódico');

    // Função para verificar e renovar o token
    const checkAndRefreshToken = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Tentar renovar o token
      const refreshResult = await refreshToken(token);

      if (!refreshResult.success) {
        // Se falhar, tentar corrigir
        const fixResult = await fixToken(token);

        if (!fixResult.success) {
          console.log('Não foi possível renovar ou corrigir o token, fazendo logout');
          // Em vez de chamar logout diretamente, que pode causar problemas de dependência circular
          setUser(null);
          localStorage.removeItem('auth');
          localStorage.removeItem('token');
          localStorage.removeItem('abzToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
        } else if (fixResult.user) {
          // Atualizar o usuário se recebemos dados atualizados
          setUser(fixResult.user);
          localStorage.setItem('user', JSON.stringify(fixResult.user));
        }
      } else if (refreshResult.user) {
        // Atualizar o usuário se recebemos dados atualizados
        setUser(refreshResult.user);
        localStorage.setItem('user', JSON.stringify(refreshResult.user));
      }
    };

    // Verificar o token a cada 5 minutos
    const intervalId = setInterval(checkAndRefreshToken, 5 * 60 * 1000);

    // Limpar o intervalo quando o componente for desmontado
    return () => clearInterval(intervalId);
  }, [user]);

  // Função para iniciar o login com número de telefone ou email
  const initiateLogin = async (phoneNumber: string, email?: string, inviteCode?: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      console.log('Iniciando login com:', {
        phoneNumber: phoneNumber || 'Não fornecido',
        email: email || 'Não fornecido',
        inviteCode: inviteCode || 'Não fornecido'
      });

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber, email, inviteCode }),
      });

      console.log('Resposta do servidor para iniciar login:', {
        status: response.status,
        ok: response.ok
      });

      // Verificar se a resposta é um HTML em vez de JSON (erro comum)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        console.error('Resposta HTML recebida em vez de JSON. Possível erro 500 no servidor.');
        return false;
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Erro ao processar JSON da resposta:', jsonError);
        return false;
      }

      console.log('Resposta do login:', data);

      if (data.success) {
        // Verificar se o usuário tem senha
        if (data.hasPassword) {
          console.log('Usuário tem senha, mudando para etapa de senha');
          setHasPassword(true);
          setLoginStep('password');
        } else {
          // Verificar se o usuário está autorizado a receber código
          if (!data.authorized && data.authStatus === 'unauthorized') {
            console.log('Usuário não autorizado a receber código');
            setAuthStatus('unauthorized');
            setLoginStep('unauthorized');
            return false;
          }

          console.log('Usuário autorizado, mudando para etapa de verificação');
          setLoginStep('verification');
        }
        return true;
      } else if (data.authStatus) {
        // Verificar status de autorização
        console.log('🔍 DEBUG AuthContext - Status de autorização:', data.authStatus);
        setAuthStatus(data.authStatus);
        if (data.authStatus === 'pending') {
          console.log('🔍 DEBUG AuthContext - Definindo loginStep para pending');
          setLoginStep('pending');
        } else if (data.authStatus === 'unauthorized') {
          console.log('🔍 DEBUG AuthContext - Definindo loginStep para unauthorized');
          setLoginStep('unauthorized');
        } else if (data.authStatus === 'inactive') {
          // Conta desativada
          console.log('🔍 DEBUG AuthContext - Definindo loginStep para unauthorized (inactive)');
          setLoginStep('unauthorized'); // Usando o mesmo estado para simplificar
        } else if (data.authStatus === 'pending_registration' || data.authStatus === 'incomplete_registration') {
          // Usuário existe mas registro não foi completado
          console.log('🎯 DEBUG AuthContext - DETECTADO pending_registration - mudando para quick_register');
          setLoginStep('quick_register');
          console.log('🎯 DEBUG AuthContext - loginStep definido como quick_register');
        } else if (data.authStatus === 'new_email' || data.authStatus === 'new_phone') {
          // Email/telefone não cadastrado, mostrar formulário de registro
          console.log('🎯 DEBUG AuthContext - DETECTADO new_email/new_phone - mudando para quick_register');
          setLoginStep('quick_register');
          console.log('🎯 DEBUG AuthContext - loginStep definido como quick_register para novo usuário');
        } else {
          console.log('🔍 DEBUG AuthContext - Status não reconhecido:', data.authStatus);
        }
      }

      return false;
    } catch (error) {
      console.error('Erro ao iniciar login:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Função para login com senha
  const loginWithPassword = async (identifier: string, password: string, rememberMe: boolean = false): Promise<boolean> => {
    setIsLoading(true);
    try {
      const isEmail = identifier.includes('@');
      console.log('Tentando login com senha no frontend:', {
        [isEmail ? 'email' : 'phoneNumber']: identifier,
        password: password.substring(0, 3) + '...',
        rememberMe
      });

      // Use dynamic import to avoid circular dependencies
      const apiHelpers = await import('@/lib/api-helpers');

      try {
        // Usar a função de login com tratamento de erros
        const data = await apiHelpers.loginWithCredentials(identifier, password);
        console.log('Dados da resposta:', data);

        if (data && data.token) {
          setUser(data.user);
          localStorage.setItem('auth', 'true');
          saveToken(data.token, 86400); // 24 horas - usar tokenStorage
          localStorage.setItem('user', JSON.stringify(data.user));

          // Se a opção "lembrar-me" estiver marcada, definir um cookie de longa duração
          if (rememberMe) {
            // Armazenar a preferência de "lembrar-me"
            localStorage.setItem('rememberMe', 'true');
          }

          setLoginStep('complete');

          // Verificar status da senha
          await checkPasswordStatus();

          return true;
        }

        // Verificar status de autorização
        if (data.authStatus) {
          setAuthStatus(data.authStatus);
          if (data.authStatus === 'inactive') {
            // Conta desativada
            setLoginStep('unauthorized');
          }
        }

        // Mostrar mensagem de erro
        if (data.error) {
          console.error('Erro de login:', data.error);
        }

        return false;
      } catch (fetchError) {
        console.error('Erro ao fazer login:', fetchError);
        return false;
      }
    } catch (error) {
      console.error('Erro ao fazer login com senha:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Função para verificar o código e completar o login
  const verifyCode = async (phoneNumber: string, code: string, email?: string, inviteCode?: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      console.log(`Verificando código: ${code} para ${email || phoneNumber}`);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          verificationCode: code,
          email,
          inviteCode
        }),
      });

      console.log('Resposta do servidor para verificação de código:', {
        status: response.status,
        ok: response.ok
      });

      // Verificar se a resposta é um HTML em vez de JSON (erro comum)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        console.error('Resposta HTML recebida em vez de JSON. Possível erro 500 no servidor.');
        return false;
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Erro ao processar JSON da resposta:', jsonError);
        return false;
      }
      console.log('Dados da resposta de verificação:', data);

      if (response.ok && data.success) {
        console.log('Verificação de código bem-sucedida, atualizando estado do usuário');
        setUser(data.user);
        localStorage.setItem('auth', 'true');
        saveToken(data.token, 86400); // 24 horas - usar tokenStorage
        localStorage.setItem('user', JSON.stringify(data.user));

        // Verificar se o usuário precisa definir senha
        if (data.requiresPassword) {
          console.log('Usuário precisa definir senha');
          setRequiresPassword(true);
          setIsNewUser(data.isNewUser || false);
          setLoginStep('set_password');
          return true;
        }

        setLoginStep('complete');
        setAuthStatus(undefined);

        // Verificar status da senha
        await checkPasswordStatus();

        return true;
      } else {
        console.error('Erro na verificação do código:', data.error || 'Erro desconhecido');

        // Verificar status de autorização
        if (data.authStatus) {
          console.log('Status de autorização:', data.authStatus);
          setAuthStatus(data.authStatus);
          if (data.authStatus === 'pending') {
            setLoginStep('pending');
          } else if (data.authStatus === 'unauthorized') {
            setLoginStep('unauthorized');
          } else if (data.authStatus === 'inactive') {
            // Conta desativada
            setLoginStep('unauthorized'); // Usando o mesmo estado para simplificar
          } else if (data.authStatus === 'new_user') {
            // Novo usuário, precisa se registrar
            setLoginStep('quick_register');
          }
        }
        return false;
      }
    } catch (error) {
      console.error('Erro ao verificar código:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Função para atualizar a senha
  const updatePassword = async (password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        return false;
      }

      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setPasswordExpired(false);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Erro ao atualizar senha:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Função para definir senha após verificação de código
  const setPasswordAfterVerification = async (password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        return false;
      }

      const response = await fetch('/api/auth/set-password-after-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setRequiresPassword(false);
        setHasPassword(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Erro ao definir senha após verificação:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Função para verificar o status da senha
  const checkPasswordStatus = async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        return false;
      }

      const response = await fetch('/api/auth/password-status', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPasswordExpired(data.expired);
        return data.expired;
      }

      return false;
    } catch (error) {
      console.error('Erro ao verificar status da senha:', error);
      return false;
    }
  };

  // Função para fazer logout
  const logout = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      // Chamar a API de logout se tiver token
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }).catch(error => {
          console.error('Erro ao chamar API de logout:', error);
        });
      }
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      // Limpar estado e localStorage mesmo se houver erro
      setUser(null);
      localStorage.removeItem('auth');
      localStorage.removeItem('token');
      localStorage.removeItem('abzToken'); // Remover também o token antigo
      localStorage.removeItem('user');
      localStorage.removeItem('rememberMe');
      removeRefreshToken();

      // Limpar cookies relacionados à autenticação
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'abzToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

      // Redirecionar para a página de login
      window.location.href = '/login';
    }
  };

  // Verificar se o usuário está autenticado
  const isAuthenticated = !!user;

  // Verificar papéis do usuário
  const isAdmin = useMemo(() => {
    // Verificar se o usuário é o administrador principal
    const adminEmail = 'caio.correia@groupabz.com';
    const adminPhone = '+5522997847289';
    const isMainAdmin = user?.email === adminEmail || user?.phoneNumber === adminPhone;

    // Verificar se o usuário tem permissão de admin nas permissões de acesso
    const hasAdminPermission = user?.accessPermissions?.modules?.admin === true;

    return user?.role === 'ADMIN' || isMainAdmin || hasAdminPermission;
  }, [user]);

  const isManager = useMemo(() => {
    // Verificar se o usuário tem papel de gerente
    const hasManagerRole = user?.role === 'MANAGER';

    // Verificar se o usuário tem permissão de avaliação nas permissões de acesso
    const hasAvaliacaoPermission = user?.accessPermissions?.modules?.avaliacao === true;

    return hasManagerRole || hasAvaliacaoPermission;
  }, [user]);

  // Adicionar logs para depuração
  console.log('AuthContext - Verificando papel do usuário:', {
    isAdmin,
    isManager,
    role: user?.role,
    email: user?.email,
    phone: user?.phoneNumber
  });
  console.log('AuthContext - Usuário completo:', user);

  // Verificar status da senha ao carregar
  useEffect(() => {
    if (isAuthenticated) {
      checkPasswordStatus();
    }
  }, [isAuthenticated]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        isAdmin,
        isManager,
        passwordExpired,
        loginStep,
        hasPassword,
        authStatus,
        requiresPassword,
        isNewUser,
        setLoginStep,
        initiateLogin,
        loginWithPassword,
        verifyCode,
        updatePassword,
        setPasswordAfterVerification,
        checkPasswordStatus,
        hasAccess: (module: string) => {
          // Administradores têm acesso a tudo
          if (isAdmin) return true;

          // Gerentes têm acesso a tudo, exceto à área de administração
          if (isManager && module !== 'admin') return true;

          // Verificar permissões de módulo
          const hasModuleAccess = !!user?.accessPermissions?.modules?.[module];

          // Verificar permissão específica para avaliação
          if (module === 'avaliacao') {
            return hasModuleAccess || isManager;
          }

          return hasModuleAccess;
        },
        hasFeature: (feature: string) => {
          // Administradores têm acesso a todas as funcionalidades
          if (isAdmin) return true;

          // Gerentes têm acesso a todas as funcionalidades, exceto as administrativas
          if (isManager && !feature.startsWith('admin.')) return true;

          // Verificar permissões de funcionalidade
          return !!user?.accessPermissions?.features?.[feature];
        },
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }

  return context;
}
