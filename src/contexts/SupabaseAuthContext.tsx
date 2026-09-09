'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { User } from '@supabase/supabase-js';
import { Tables } from '@/types/supabase';
import { getToken, saveToken, removeToken, isTokenValid } from '@/lib/tokenStorage';
import { saveRefreshToken, getRefreshToken, removeRefreshToken } from '@/lib/refreshTokenStorage';
import tokenRefreshManager, { startTokenRefreshManager, stopTokenRefreshManager } from '@/lib/tokenRefreshManager';
import { attemptSessionRecovery, recoverSessionOnReturn } from '@/lib/sessionRecovery';
import { activateUserAfterEmailVerification } from '@/lib/user-approval';
import { getDefaultPermissionsForRole } from '@/config/modules';
import { clearCompanionSession } from '@/lib/ia/companion-session-storage';
import { hasEffectiveFeature } from '@/lib/effective-feature';
// Import a browser-compatible JWT library or use a safer approach

// Função para gerar um token JWT (deve ser feito no servidor)
// Esta função é apenas um stub para o cliente, a geração real deve ocorrer via API
const generateToken = async (user: any) => {
  try {
    // No cliente, devemos chamar uma API para gerar o token
    const response = await fetch('/api/auth/generate-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        phoneNumber: user.phone_number,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      }),
    });

    if (!response.ok) {
      throw new Error('Falha ao gerar token');
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Erro ao gerar token JWT:', error);
    return '';
  }
};

// Tipo para usuário - usando Partial para permitir flexibilidade
export interface UserProfile {
  id: string;
  email?: string | null;
  phone_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
  position?: string | null;
  department?: string | null;
  sector_id?: string | null;
  active?: boolean | null;
  is_active?: boolean | null;
  is_verified?: boolean | null;
  is_authorized?: boolean | null;
  authorization_status?: string | null;
  authorized_by?: string | null;
  authorization_notes?: any;
  password?: string | null;
  password_last_changed?: string | null;
  avatar?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  access_history?: any;
  verification_code?: string | null;
  verification_code_expires?: string | null;
  drive_photo_url?: string | null;
  tax_id?: string | null;
  bio?: string | null;
  birth_date?: string | null;
  cover_url?: string | null;
  startup_splash_enabled?: boolean | null;
  startup_splash_url?: string | null;
  startup_sound_enabled?: boolean | null;
  startup_sound_url?: string | null;
  accessPermissions?: {
    modules?: {
      [key: string]: boolean;
    };
    features?: {
      [key: string]: boolean;
    };
  };
  access_permissions?: {
    modules?: {
      [key: string]: boolean;
    };
    features?: {
      [key: string]: boolean;
    };
  };
  sector?: {
    id: string;
    name: string;
    allowed_modules: string[];
    allowed_cards: string[];
  };
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
  hasApprovalPermission: boolean;
  passwordExpired: boolean;
  loginStep: 'phone' | 'verification' | 'password' | 'complete' | 'unauthorized' | 'pending' | 'quick_register';
  hasPassword: boolean;
  authStatus?: string;
  hasEvaluationAccess: boolean;
  setLoginStep: (step: 'phone' | 'verification' | 'password' | 'complete' | 'unauthorized' | 'pending' | 'quick_register') => void;
  initiateLogin: (phoneNumber: string, email?: string, inviteCode?: string) => Promise<boolean>;
  loginWithPassword: (identifier: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  loginWithOtp: (identifier: string, checkOnly?: boolean) => Promise<{ success: boolean; hasPassword: boolean; status?: string }>;
  verifyOtp: (identifier: string, code: string) => Promise<{ success: boolean; status?: string }>;
  verifyCode: (phoneNumber: string, code: string, email?: string, inviteCode?: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
  checkPasswordStatus: () => Promise<boolean>;
  hasAccess: (module: string) => boolean;
  hasFeature: (feature: string) => boolean;
  getToken: () => string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
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

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [passwordExpired, setPasswordExpired] = useState(false);
  const [loginStep, setLoginStep] = useState<'phone' | 'verification' | 'password' | 'complete' | 'unauthorized' | 'pending' | 'quick_register'>('phone');
  const [hasPassword, setHasPassword] = useState(false);
  const [authStatus, setAuthStatus] = useState<string | undefined>(undefined);
  const [rolePermissions, setRolePermissions] = useState<any>({});
  const [aclEnabledModules, setAclEnabledModules] = useState<string[]>([]);
  const [effectiveFeatures, setEffectiveFeatures] = useState<Record<string, boolean>>({});
  const [aclPermissionNames, setAclPermissionNames] = useState<string[]>([]);
  const router = useRouter();

  // Carregar permissões por role
  useEffect(() => {
    const loadRolePermissions = async () => {
      try {
        const response = await fetch('/api/admin/role-permissions');
        const permissions = await response.json();
        setRolePermissions(permissions);
      } catch (error) {
        console.error('Erro ao carregar permissões por role:', error);
      }
    };

    loadRolePermissions();
  }, []);

  // Carregar módulos habilitados via ACL (após perfil do usuário estar disponível)
  useEffect(() => {
    if (!user?.id) return;

    const loadAclModules = async () => {
      try {
        const res = await fetch('/api/user/effective-permissions', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.effective_modules) {
            // Extrair módulos que ficaram ativos especificamente via ACL
            // A API já inclui ACL na composição, então usamos os effective_modules
            const modules = Object.entries(data.effective_modules)
              .filter(([_, v]) => v === true)
              .map(([k]) => k);
            setAclEnabledModules(modules);
          }
          setEffectiveFeatures(data.effective_features || {});
          setAclPermissionNames(Array.isArray(data.acl_permission_names) ? data.acl_permission_names : []);
        }
      } catch (error) {
        console.error('Erro ao carregar módulos ACL:', error);
      }
    };

    loadAclModules();

    // Reagir a eventos de atualização de permissões
    const handlePermissionsUpdate = () => {
      loadAclModules();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('permissions-updated', handlePermissionsUpdate);
      window.addEventListener('visibilitychange', handlePermissionsUpdate);
      window.addEventListener('focus', handlePermissionsUpdate);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('permissions-updated', handlePermissionsUpdate);
        window.removeEventListener('visibilitychange', handlePermissionsUpdate);
        window.removeEventListener('focus', handlePermissionsUpdate);
      }
    };
  }, [user?.id]);

  // Função para renovar o token JWT personalizado
  const refreshCustomToken = async () => {
    try {
      // Obter o token JWT personalizado usando o utilitário
      const token = getToken();
      if (!token) {
        console.log('Nenhum token personalizado encontrado para renovar');
        return false;
      }

      console.log('Tentando renovar token personalizado...');
      const refreshResponse = await fetch('/api/auth/token-refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ token }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        console.log('Token personalizado renovado com sucesso');

        if (refreshData.token && refreshData.token !== token) {
          console.log('Atualizando token renovado usando utilitário');

          // Usar o utilitário para salvar o token
          saveToken(refreshData.token, refreshData.expiresIn || 86400); // 24 horas por padrão

          // Se recebemos dados do usuário, atualizar o perfil
          if (refreshData.user) {
            console.log('Atualizando dados do usuário após renovação de token');

            // Criar objeto de usuário compatível com o Supabase Auth
            const supabaseUser: User = {
              id: refreshData.user.id,
              app_metadata: {},
              user_metadata: {},
              aud: 'authenticated',
              created_at: refreshData.user.createdAt,
              email: refreshData.user.email,
              phone: refreshData.user.phoneNumber,
              role: refreshData.user.role,
              updated_at: refreshData.user.updatedAt
            };

            // Atualizar o estado do usuário
            setUser(supabaseUser);

            // Buscar o perfil completo do usuário no Supabase
            try {
              console.log('Atualizando perfil do usuário após renovação de token...');
              let data = null;
              let error = null;
              try {
                const result = await supabase
                  .from('users_unified')
                  .select('*, sector:sectors(id, name, allowed_modules, allowed_cards)')
                  .eq('id', refreshData.user.id)
                  .single();
                data = result.data;
                error = result.error;
              } catch (err) {
                console.warn('Exceção ao buscar perfil com join de setor após renovação:', err);
                error = err;
              }

              if (error || !data) {
                console.warn('⚠️ Erro ao buscar perfil com join de setor, tentando fallback sem join...', error);
                const fallbackResult = await supabase
                  .from('users_unified')
                  .select('*')
                  .eq('id', refreshData.user.id)
                  .single();
                data = fallbackResult.data;
                error = fallbackResult.error;
              }

              if (!error && data) {
                // Converter para o formato de perfil
                const profileData: UserProfile = {
                  ...data,
                  accessPermissions: data.access_permissions || {}
                };

                setProfile(profileData);
                console.log('Perfil do usuário atualizado com sucesso após renovação de token');
              } else {
                console.error('Erro ao buscar perfil após renovação de token:', error);

                // Usar os dados da resposta como fallback
                const profileData: UserProfile = {
                  id: refreshData.user.id,
                  email: refreshData.user.email,
                  phone_number: refreshData.user.phoneNumber,
                  first_name: refreshData.user.firstName,
                  last_name: refreshData.user.lastName,
                  role: refreshData.user.role,
                  active: refreshData.user.active !== undefined ? refreshData.user.active : true,
                  created_at: refreshData.user.createdAt,
                  updated_at: refreshData.user.updatedAt,
                  access_permissions: refreshData.user.access_permissions || refreshData.user.accessPermissions || {},
                  position: refreshData.user.position,
                  department: refreshData.user.department,
                  avatar: refreshData.user.avatar,
                  password_last_changed: refreshData.user.password_last_changed,
                  accessPermissions: refreshData.user.accessPermissions || refreshData.user.access_permissions || {}
                };

                setProfile(profileData);
                console.log('Perfil do usuário definido a partir dos dados da resposta de renovação');
              }
            } catch (profileError) {
              console.error('Exceção ao buscar perfil após renovação de token:', profileError);
            }
          }

          return true;
        }
      } else {
        console.log('Falha na renovação do token personalizado, tentando fix-token');

        // Tentar corrigir o token
        try {
          const fixResponse = await fetch('/api/auth/fix-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ token }),
          });

          if (fixResponse.ok) {
            const fixData = await fixResponse.json();
            console.log('Token personalizado corrigido com sucesso');

            if (fixData.token && fixData.token !== token) {
              console.log('Atualizando token corrigido usando utilitário');

              // Usar o utilitário para salvar o token
              saveToken(fixData.token, fixData.expiresIn || 86400); // 24 horas por padrão

              // Se recebemos dados do usuário, atualizar o perfil
              if (fixData.user) {
                console.log('Atualizando dados do usuário após correção de token');

                // Criar objeto de usuário compatível com o Supabase Auth
                const supabaseUser: User = {
                  id: fixData.user._id,
                  app_metadata: {},
                  user_metadata: {},
                  aud: 'authenticated',
                  created_at: fixData.user.createdAt,
                  email: fixData.user.email,
                  phone: fixData.user.phoneNumber,
                  role: fixData.user.role,
                  updated_at: fixData.user.updatedAt
                };

                // Atualizar o estado do usuário
                setUser(supabaseUser);

                // Usar os dados da resposta como perfil
                const profileData: UserProfile = {
                  id: fixData.user._id,
                  email: fixData.user.email,
                  phone_number: fixData.user.phoneNumber,
                  first_name: fixData.user.firstName,
                  last_name: fixData.user.lastName,
                  role: fixData.user.role,
                  active: true,
                  created_at: fixData.user.createdAt,
                  updated_at: fixData.user.updatedAt,
                  access_permissions: fixData.user.accessPermissions || {},
                  accessPermissions: fixData.user.accessPermissions || {},
                  position: fixData.user.position,
                  department: fixData.user.department,
                  avatar: fixData.user.avatar,
                  password_last_changed: fixData.user.password_last_changed,
                };

                setProfile(profileData);
                console.log('Perfil do usuário atualizado com sucesso após correção de token');
              }

              return true;
            }
          }
        } catch (fixError) {
          console.error('Erro ao tentar corrigir token:', fixError);
        }
      }

      return false;
    } catch (error) {
      console.error('Erro ao renovar token personalizado:', error);
      return false;
    }
  };

  // Função para configurar o refresh token
  const setupRefreshToken = async () => {
    // Configurar o listener para atualizar o token antes de expirar
    const refreshInterval = setInterval(async () => {
      try {
        // Atualizar "Última Atividade" do usuário (User Activity Tracker)
        // Fazemos isso aqui pois o refreshInterval roda a cada minuto se a aba estiver aberta
        const currentUser = user || JSON.parse(localStorage.getItem('user') || 'null');
        if (currentUser?.id) {
          // Fire and forget - não precisamos esperar a resposta
          fetch('/api/metrics/activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
          }).catch(() => { /* Silent fail to avoid polling errors */ });
        }

        // Primeiro tentar renovar o token Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Verificar se o token está próximo de expirar (menos de 5 minutos)
          if (session.expires_at) {
            const expiresAt = new Date(session.expires_at * 1000);
            const now = new Date();
            const fiveMinutes = 5 * 60 * 1000; // 5 minutos em milissegundos

            if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
              console.log('Token Supabase próximo de expirar, renovando...');
              const { data, error } = await supabase.auth.refreshSession();

              if (error) {
                console.error('Erro ao renovar sessão Supabase:', error);
              } else if (data.session) {
                console.log('Sessão Supabase renovada com sucesso');
              }
            }
          }

          // Também renovar o token JWT personalizado
          await refreshCustomToken();
        }
      } catch (error) {
        console.error('Erro ao verificar sessão:', error);
      }
    }, 60000); // Verificar a cada minuto

    // Limpar o intervalo quando o componente for desmontado
    return () => clearInterval(refreshInterval);
  };

  // Função para carregar o perfil do usuário a partir do token
  const loadUserProfileFromToken = async () => {
    try {
      console.log('🔍 loadUserProfileFromToken - Iniciando carregamento do perfil...');

      // Obter o token usando o utilitário
      const token = getToken();
      if (!token) {
        console.log('❌ loadUserProfileFromToken - Nenhum token encontrado para carregar perfil');
        setIsLoading(false);
        return false;
      }

      console.log('✅ loadUserProfileFromToken - Token encontrado, comprimento:', token.length);

      // Verificar o token na API
      const verifyResponse = await fetch('/api/auth/verify-token', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!verifyResponse.ok) {
        console.error('Token inválido ao tentar carregar perfil. Status:', verifyResponse.status);
        try {
          const errorText = await verifyResponse.text();
          console.error('Detalhes do erro:', errorText);
        } catch (e) {
          console.error('Não foi possível obter detalhes do erro');
        }
        setIsLoading(false);
        return false;
      }

      const verifyData = await verifyResponse.json();
      console.log('Token verificado com sucesso:', verifyData);

      if (!verifyData.userId) {
        console.error('Token não contém ID do usuário');
        setIsLoading(false);
        return false;
      }

      // Buscar o usuário no Supabase
      console.log('Buscando usuário no Supabase com ID:', verifyData.userId);

      // Buscar o usuário na tabela users_unified
      let userData = null;
      let userError = null;

      try {
        const result = await supabase
          .from('users_unified')
          .select('*, sector:sectors(id, name, allowed_modules, allowed_cards)')
          .eq('id', verifyData.userId)
          .single();
        userData = result.data;
        userError = result.error;
      } catch (err) {
        console.warn('Exceção ao buscar usuário com join de setor:', err);
        userError = err;
      }

      if (userError || !userData) {
        console.warn('⚠️ Erro ou falha ao buscar usuário com join de setor, tentando fallback sem join...', userError);
        const fallbackResult = await supabase
          .from('users_unified')
          .select('*')
          .eq('id', verifyData.userId)
          .single();
        
        if (fallbackResult.error) {
          console.error('❌ Erro crítico ao buscar usuário pelo ID do token (fallback sem join):', fallbackResult.error);
          setIsLoading(false);
          return false;
        }
        userData = fallbackResult.data;
      }

      if (!userData) {
        console.error('Usuário não encontrado na tabela users_unified');
        setIsLoading(false);
        return false;
      }

      console.log('Usuário encontrado pelo token:', userData);

      // Criar objeto de usuário compatível com o Supabase Auth
      const supabaseUser: User = {
        id: userData.id,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: userData.created_at,
        email: userData.email,
        phone: userData.phone_number,
        role: userData.role,
        updated_at: userData.updated_at
      };

      console.log('Criando objeto de usuário compatível com Supabase Auth:', supabaseUser);

      // Atualizar o estado do usuário
      setUser(supabaseUser);

      // Verificar se o usuário tem permissões
      if (!userData.access_permissions) {
        console.log('Usuário não tem permissões, adicionando permissões padrão');

        // Adicionar permissões padrão
        userData.access_permissions = {
          modules: getDefaultPermissionsForRole(userData.role),
          features: {}
        };

        // Atualizar no banco de dados
        try {
          await supabase
            .from('users_unified')
            .update({
              access_permissions: userData.access_permissions
            })
            .eq('id', userData.id);

          console.log('Permissões padrão adicionadas ao usuário');
        } catch (updateError) {
          console.error('Erro ao atualizar permissões do usuário:', updateError);
        }
      }

      // Converter para o formato de perfil
      const profileData: UserProfile = {
        ...userData,
        accessPermissions: userData.access_permissions || {}
      };

      console.log('Definindo perfil do usuário:', {
        id: profileData.id,
        email: profileData.email,
        role: profileData.role,
        accessPermissions: profileData.accessPermissions
      });

      // Atualizar o estado do perfil
      setProfile(profileData);

      console.log('Perfil do usuário carregado com sucesso a partir do token');
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Erro ao carregar perfil do usuário a partir do token:', error);
      setIsLoading(false);
      return false;
    }
  };

  // Função para iniciar o login com número de telefone ou email
  const initiateLogin = async (phoneNumber: string, email?: string, inviteCode?: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      if (email) {
        // Verificar se o email existe na tabela users_unified
        const { data: userData, error: userError } = await supabase
          .from('users_unified')
          .select('*')
          .eq('email', email)
          .single();

        if (userError) {
          // Email não encontrado
          setAuthStatus('new_email');
          return false;
        }

        // Verificar se o usuário está ativo
        if (!userData.active) {
          setAuthStatus('inactive');
          return false;
        }

        // Email encontrado, verificar se tem senha
        setHasPassword(!!userData.password);
        setLoginStep('password');
        return true;
      }

      // Phone login is disabled
      if (phoneNumber) {
        console.warn('Phone login is disabled');
        return false;
      }

      return false;

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
      console.log('Tentando login com senha para:', identifier);
      const isEmail = identifier.includes('@');

      if (!isEmail) {
        console.error('Login allowed only with email');
        return false;
      }

      // Preparar os dados para envio
      const loginData = {
        email: identifier,
        password,
        rememberMe
      };

      console.log('Enviando dados de login:', {
        ...loginData,
        password: '********'
      });

      try {
        // Usar o wrapper de fetch para tratar erros de parsing JSON
        const response = await fetchWrapper.post('/api/auth/login', loginData);

        console.log('Resposta do login:', response);

        if (response.token) {
          // Armazenar o token usando o utilitário tokenStorage para consistência
          console.log('🔐 Salvando token após login bem-sucedido...');
          localStorage.setItem('auth', 'true');

          // Usar expiração diferente baseada em "lembrar-me"
          const tokenExpiry = rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60; // 7 dias ou 1 dia
          saveToken(response.token, tokenExpiry);
          localStorage.setItem('user', JSON.stringify(response.user));
          console.log('✅ Token salvo com sucesso!');

          // Se a opção "lembrar-me" estiver marcada, salvar refresh token
          if (rememberMe) {
            localStorage.setItem('rememberMe', 'true');

            // Se a resposta incluir refresh token, salvá-lo
            if (response.refreshToken) {
              const refreshExpiry = 90 * 24 * 60 * 60; // 90 dias
              saveRefreshToken(response.refreshToken, refreshExpiry, true);
              console.log('✅ Refresh token salvo para "lembrar-me"');
            }
          } else {
            // Para login normal, também salvar refresh token mas com expiração menor
            if (response.refreshToken) {
              const refreshExpiry = 30 * 24 * 60 * 60; // 30 dias
              saveRefreshToken(response.refreshToken, refreshExpiry, false);
              console.log('✅ Refresh token salvo para sessão normal');
            }
          }

          setUser(response.user);
          
          // Set profile from login response to ensure avatar data is available immediately
          if (response.user) {
            const profileData: UserProfile = {
              ...response.user,
              id: response.user.id || (response.user as any)._id,
              accessPermissions: (response.user as any).access_permissions || {}
            };
            setProfile(profileData);
          }
          
          setLoginStep('complete');

          // Verificar status da senha
          await checkPasswordStatus();

          return true;
        } else {
          console.error('Token não encontrado na resposta:', response);
          return false;
        }
      } catch (fetchError: any) {
        console.error('Erro ao fazer login:', fetchError.message);

        // Verificar se é erro de email não verificado
        if (fetchError.status === 403 && fetchError.data?.code === 'EMAIL_NOT_VERIFIED') {
          console.log('Email não verificado, mostrando prompt de verificação');
          // Aqui podemos emitir um evento ou usar um callback para mostrar o prompt
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('emailNotVerified', {
              detail: { email: fetchError.data.email }
            }));
          }
          return false;
        }

        // Para qualquer outro erro, rejeitar o login
        return false;
      }
    } catch (error) {
      console.error('Erro geral ao fazer login com senha:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Função para login com OTP (One-Time Password)
  const loginWithOtp = async (identifier: string, checkOnly: boolean = false): Promise<{ success: boolean; hasPassword: boolean; status?: string }> => {
    setIsLoading(true);
    try {
      console.log('Iniciando login com OTP para:', identifier);
      const isEmail = identifier.includes('@');

      if (!isEmail) {
        console.error('OTP login allowed only with email');
        return { success: false, hasPassword: false, status: 'invalid_identifier' };
      }

      // Verificar se o usuário existe
      const { data: userData, error: userError } = await supabase
        .from('users_unified')
        .select('*')
        .eq('email', identifier)
        .single();

      if (userError) {
        console.log('Usuário não encontrado:', userError);
        return { success: false, hasPassword: false, status: 'not_found' };
      }

      // Verificar se o usuário está ativo
      if (!userData.active) {
        console.log('Usuário inativo');
        return { success: false, hasPassword: false, status: 'inactive' };
      }

      // Verificar se o usuário tem senha
      const hasPassword = !!userData.password;
      console.log('Usuário tem senha:', hasPassword);

      // Se estamos apenas verificando, retornar o status
      if (checkOnly) {
        return { success: true, hasPassword, status: 'exists' };
      }

      // Enviar OTP
      const { data: otpData, error: otpError } = await supabase
        .from('verification_codes')
        .insert({
          email: identifier,
          code: Math.floor(100000 + Math.random() * 900000).toString(), // Código de 6 dígitos
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutos
          used: false
        })
        .select()
        .single();

      if (otpError) {
        console.error('Erro ao gerar código OTP:', otpError);
        return { success: false, hasPassword, status: 'otp_error' };
      }

      console.log('Código OTP gerado com sucesso:', otpData.code);

      // Enviar o código por email
      try {
        const emailResponse = await fetch('/api/auth/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: identifier,
            code: otpData.code,
            type: 'verification'
          }),
        });

        if (!emailResponse.ok) {
          console.error('Erro ao enviar email:', await emailResponse.text());
          return { success: false, hasPassword, status: 'email_error' };
        }

        console.log('Email enviado com sucesso');
      } catch (emailError) {
        console.error('Exceção ao enviar email:', emailError);
        return { success: false, hasPassword, status: 'email_error' };
      }

      return { success: true, hasPassword, status: 'otp_sent' };
    } catch (error) {
      console.error('Erro ao iniciar login com OTP:', error);
      return { success: false, hasPassword: false, status: 'error' };
    } finally {
      setIsLoading(false);
    }
  };

  // Função para verificar o código OTP
  const verifyOtp = async (identifier: string, code: string): Promise<{ success: boolean; status?: string }> => {
    setIsLoading(true);
    try {
      console.log('Verificando código OTP para:', identifier);
      const isEmail = identifier.includes('@');

      // Verificar o código
      const { data: codeData, error: codeError } = await supabase
        .from('verification_codes')
        .select('*')
        .eq(isEmail ? 'email' : 'phone_number', identifier)
        .eq('code', code)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (codeError) {
        console.error('Erro ao verificar código OTP:', codeError);
        return { success: false, status: 'invalid_code' };
      }

      // Marcar o código como usado
      await supabase
        .from('verification_codes')
        .update({ used: true })
        .eq('id', codeData.id);

      // Buscar o usuário
      const { data: userData, error: userError } = await supabase
        .from('users_unified')
        .select('*')
        .eq(isEmail ? 'email' : 'phone_number', identifier)
        .single();

      if (userError) {
        console.error('Erro ao buscar usuário após verificação de OTP:', userError);
        return { success: false, status: 'user_error' };
      }

      // Se for verificação por email, tentar ativar automaticamente o usuário
      if (isEmail && userData.id) {
        try {
          const activated = await activateUserAfterEmailVerification(userData.id);
          if (activated) {
            console.log('Usuário ativado automaticamente após verificação de email');
            // Recarregar dados do usuário para obter o status atualizado
            const { data: updatedUserData } = await supabase
              .from('users_unified')
              .select('*')
              .eq('id', userData.id)
              .single();

            if (updatedUserData) {
              userData.active = updatedUserData.active;
              userData.is_authorized = updatedUserData.is_authorized;
              userData.authorization_status = updatedUserData.authorization_status;
            }
          }
        } catch (activationError) {
          console.error('Erro ao tentar ativar usuário automaticamente:', activationError);
          // Continuar com o fluxo normal mesmo se a ativação falhar
        }
      }

      // Gerar token JWT
      const token = await generateToken(userData);

      // Salvar o token
      saveToken(token);

      // Atualizar o estado
      setUser({
        id: userData.id,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: userData.created_at,
        email: userData.email,
        phone: userData.phone_number,
        role: userData.role,
        updated_at: userData.updated_at
      });

      // Converter para o formato de perfil
      const profileData: UserProfile = {
        ...userData,
        accessPermissions: userData.access_permissions || {}
      };

      setProfile(profileData);
      setLoginStep('complete');

      return { success: true };
    } catch (error) {
      console.error('Erro ao verificar código OTP:', error);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  // Função para verificar o código e completar o login
  const verifyCode = async (phoneNumber: string, code: string, email?: string, inviteCode?: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Verificar o código
      const { data: codeData, error: codeError } = await supabase
        .from('verification_codes')
        .select('*')
        .eq(email ? 'email' : 'phone_number', email || phoneNumber)
        .eq('code', code)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (codeError) {
        console.error('Erro ao verificar código:', codeError);
        return false;
      }

      // Marcar o código como usado
      await supabase
        .from('verification_codes')
        .update({ used: true })
        .eq('id', codeData.id);

      // Buscar o usuário
      const { data: userData, error: userError } = await supabase
        .from('users_unified')
        .select('*')
        .eq(email ? 'email' : 'phone_number', email || phoneNumber)
        .single();

      if (userError) {
        console.error('Erro ao buscar usuário após verificação de código:', userError);
        return false;
      }

      // Gerar token JWT
      const token = await generateToken(userData);

      // Salvar o token
      saveToken(token);

      // Atualizar o estado
      setUser({
        id: userData.id,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: userData.created_at,
        email: userData.email,
        phone: userData.phone_number,
        role: userData.role,
        updated_at: userData.updated_at
      });

      // Converter para o formato de perfil
      const profileData: UserProfile = {
        ...userData,
        accessPermissions: userData.access_permissions || {}
      };

      setProfile(profileData);
      setLoginStep('complete');

      return true;
    } catch (error) {
      console.error('Erro ao verificar código:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Função para atualizar a senha do usuário
  const updatePassword = async (password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      if (!user) {
        console.error('Nenhum usuário autenticado para atualizar a senha');
        return false;
      }

      // Hash da senha
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);

      // Atualizar a senha no banco de dados
      const { error } = await supabase
        .from('users_unified')
        .update({
          password: hashedPassword,
          password_last_changed: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        console.error('Erro ao atualizar senha:', error);
        return false;
      }

      console.log('Senha atualizada com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao atualizar senha:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Função para verificar o status da senha
  const checkPasswordStatus = async (): Promise<boolean> => {
    try {
      if (!user) {
        console.log('Nenhum usuário autenticado para verificar status da senha');
        return false;
      }

      // Buscar o usuário no banco de dados
      const { data: userData, error } = await supabase
        .from('users_unified')
        .select('password_last_changed, role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Erro ao buscar dados do usuário para verificar senha:', error);
        return false;
      }

      // Verificar se a senha está expirada
      if (!userData.password_last_changed) {
        console.log('Usuário não tem data de alteração de senha, considerando expirada');
        setPasswordExpired(true);
        return true;
      }

      // Administradores não têm senha expirada
      if (userData.role === 'ADMIN') {
        console.log('Usuário é administrador, senha não expira');
        setPasswordExpired(false);
        return false;
      }

      // Verificar se a senha expirou (365 dias por padrão)
      const expiryDays = 365;
      const passwordDate = new Date(userData.password_last_changed);
      const expiryDate = new Date(passwordDate);
      expiryDate.setDate(expiryDate.getDate() + expiryDays);

      const isExpired = new Date() > expiryDate;
      console.log('Status de expiração da senha:', isExpired ? 'Expirada' : 'Válida');
      setPasswordExpired(isExpired);
      return isExpired;
    } catch (error) {
      console.error('Erro ao verificar status da senha:', error);
      return false;
    }
  };

  // Função para fazer logout
  const signOut = async () => {
    try {
      console.log('🚪 Iniciando processo de logout...');

      // CRÍTICO: Marcar flag de logout IMEDIATAMENTE para prevenir restauração de sessão
      localStorage.setItem('logout_in_progress', 'true');
      sessionStorage.setItem('logout_in_progress', 'true');

      const loggingOutUserId = user?.id || null;

      // STM Companion: limpa contexto/sessão local ANTES de zerar user (LTM no DB permanece)
      clearCompanionSession(loggingOutUserId);

      // Limpar estado DO REACT PRIMEIRO (antes de qualquer operação assíncrona)
      setUser(null);
      setProfile(null);
      setLoginStep('phone');
      setIsLoading(false);

      // Fazer logout no Supabase
      console.log('🔐 Fazendo logout no Supabase');
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (supabaseError) {
        console.error('Erro ao fazer logout no Supabase:', supabaseError);
      }

      // Chamar a API de logout se tiver token personalizado
      const token = getToken();
      if (token) {
        try {
          console.log('📡 Chamando API de logout');
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
        } catch (apiError) {
          console.error('Erro ao chamar API de logout:', apiError);
        }
      }

      // Remover tokens usando o utilitário
      removeToken();
      removeRefreshToken();

      // Limpar sessionStorage para invalidar caches de permissões
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
      }

      // Remover TODOS os dados de autenticação do localStorage
      const keysToRemove = ['auth', 'token', 'abzToken', 'user', 'rememberMe', 'sb-access-token', 'sb-refresh-token'];
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Garante limpeza de leftovers do Companion STM
      clearCompanionSession(loggingOutUserId);

      // Limpar todos os cookies relacionados à autenticação
      const cookiesToClear = ['token', 'abzToken', 'auth', 'refreshToken', 'sb-access-token', 'sb-refresh-token'];
      cookiesToClear.forEach(cookieName => {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname}`;
      });

      console.log('✅ Logout concluído - redirecionando para login');

      // Remover flag de logout
      localStorage.removeItem('logout_in_progress');
      sessionStorage.removeItem('logout_in_progress');

      // Usar replace em vez de href para evitar adicionar ao histórico
      // Adicionar timestamp e flag de logout para forçar reload e identificar logout
      window.location.replace('/login?logout=true&t=' + Date.now());
    } catch (error) {
      console.error('❌ Erro ao fazer logout:', error);

      // Tentar limpar manualmente mesmo em caso de erro
      try {
        // Limpar estado
        setUser(null);
        setProfile(null);

        // Remover tokens
        removeToken();
        removeRefreshToken();

        // Limpar sessionStorage
        if (typeof window !== 'undefined') {
          sessionStorage.clear();
        }

        // Limpar TUDO do localStorage (exceto configurações do usuário que não são sensíveis)
        const keysToKeep = ['i18nextLng', 'theme', 'NEXT_LOCALE'];
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
          if (!keysToKeep.includes(key)) {
            localStorage.removeItem(key);
          }
        });

        // Limpar todos os cookies
        const cookiesToClear = ['token', 'abzToken', 'auth', 'refreshToken', 'sb-access-token', 'sb-refresh-token'];
        cookiesToClear.forEach(cookieName => {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname}`;
        });
      } catch (cleanupError) {
        console.error('Erro ao limpar dados de autenticação:', cleanupError);
      }

      // Remover flag de logout
      localStorage.removeItem('logout_in_progress');
      sessionStorage.removeItem('logout_in_progress');

      // Forçar redirecionamento mesmo em caso de erro
      window.location.replace('/login?logout=true&t=' + Date.now());
    }
  };

  // Verificar se o usuário está autenticado ao carregar a página
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // CRÍTICO: Verificar se estamos em processo de logout
        const isLoggingOut = localStorage.getItem('logout_in_progress') === 'true' ||
          sessionStorage.getItem('logout_in_progress') === 'true';

        if (isLoggingOut) {
          console.log('🚫 Logout em progresso - não restaurar sessão');
          setIsLoading(false);
          return;
        }

        // Verificar se estamos na página de login vindo de um logout
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const isFromLogout = urlParams.get('logout') === 'true';

          if (isFromLogout) {
            console.log('🚫 Página de login detectada após logout - não restaurar sessão');
            setIsLoading(false);
            return;
          }
        }

        // Primeiro tentar carregar o perfil a partir do token
        const tokenProfileLoaded = await loadUserProfileFromToken();
        if (tokenProfileLoaded) {
          console.log('Perfil carregado com sucesso a partir do token, pulando verificação de sessão');
          return;
        }

        // Se não conseguiu carregar do token, verificar se há uma sessão ativa
        console.log('Tentando carregar perfil a partir da sessão Supabase...');
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);

          // Buscar o perfil do usuário na tabela users_unified
          let profileData;
          try {
            // Primeiro tentar buscar na tabela users_unified
            const { data: unifiedData, error: unifiedError } = await supabase
              .from('users_unified')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (!unifiedError && unifiedData) {
              console.log('Perfil encontrado na tabela users_unified:', unifiedData.id);
              profileData = unifiedData;
            } else {
              console.error('Erro ao buscar perfil do usuário:', unifiedError);

              // Verificar se o perfil não existe e criar um perfil básico
              if (unifiedError && unifiedError.code === 'PGRST116') {
                console.log('Perfil não encontrado, criando perfil básico para:', session.user.email);

                try {
                  // Extrair informações do usuário da autenticação
                  const email = session.user.email;
                  const phone = session.user.phone;

                  // Verificar se o usuário é o administrador principal
                  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '');
                  const isAdmin = email === adminEmail;

                  // Criar um perfil básico na tabela users_unified
                  const { data: newProfile, error: insertError } = await supabase
                    .from('users_unified')
                    .insert({
                      id: session.user.id,
                      email: email,
                      phone_number: phone,
                      first_name: isAdmin ? 'Caio' : 'Usuário',
                      last_name: isAdmin ? 'Correia' : 'ABZ',
                      role: isAdmin ? 'ADMIN' : 'USER',
                      active: true,
                      is_authorized: true,
                      authorization_status: 'active',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      access_permissions: isAdmin ? {
                        modules: {
                          admin: true,
                          avaliacao: true,
                          dashboard: true,
                          manual: true,
                          procedimentos: true,
                          politicas: true,
                          calendario: true,
                          noticias: true,
                          reembolso: true,
                          contracheque: true,
                          ponto: true
                        }
                      } : {
                        modules: {
                          dashboard: true,
                          manual: true,
                          procedimentos: true,
                          politicas: true,
                          calendario: true,
                          noticias: true,
                          reembolso: true,
                          contracheque: true,
                          ponto: true
                        }
                      }
                    })
                    .select('*')
                    .single();

                  if (insertError) {
                    console.error('Erro ao criar perfil básico:', insertError);
                  } else {
                    console.log('Perfil básico criado com sucesso:', newProfile);
                    profileData = newProfile;
                  }
                } catch (createError) {
                  console.error('Exceção ao criar perfil básico:', createError);
                }
              }
            }
          } catch (fetchError) {
            console.error('Exceção ao buscar perfil do usuário:', fetchError);
          }

          if (profileData) {
            // Verificar se o perfil já tem permissões no formato access_permissions
            if (profileData.access_permissions) {
              console.log('Perfil já tem permissões definidas:', profileData.id);

              // Converter para o formato accessPermissions para compatibilidade
              const userWithPermissions: UserProfile = {
                ...profileData,
                accessPermissions: profileData.access_permissions
              };

              setProfile(userWithPermissions);
            } else {
              // Buscar as permissões do usuário da tabela antiga como fallback
              console.log('Buscando permissões na tabela user_permissions para:', profileData.id);
              const { data: permissionsData, error: permissionsError } = await supabase
                .from('user_permissions')
                .select('*')
                .eq('user_id', session.user.id);

              if (permissionsError) {
                console.error('Erro ao buscar permissões do usuário:', permissionsError);

                // Definir permissões padrão
                const defaultModules: Record<string, boolean> = {
                  dashboard: true,
                  manual: true,
                  procedimentos: true,
                  politicas: true,
                  calendario: true,
                  noticias: true,
                  reembolso: true,
                  contracheque: true,
                  ponto: true,
                  academy: true
                };

                // Adicionar permissão de admin se for admin
                if (profileData.role === 'ADMIN') {
                  defaultModules['admin'] = true;
                  defaultModules['avaliacao'] = true;
                }

                // Adicionar permissão de avaliação se for gerente
                if (profileData.role === 'MANAGER') {
                  defaultModules['avaliacao'] = true;
                }

                // Adicionar as permissões padrão ao perfil
                const userWithPermissions: UserProfile = {
                  ...profileData,
                  accessPermissions: {
                    modules: defaultModules,
                    features: {}
                  }
                };

                // Atualizar o perfil no banco de dados
                await supabase
                  .from('users_unified')
                  .update({
                    access_permissions: userWithPermissions.accessPermissions
                  })
                  .eq('id', profileData.id);

                setProfile(userWithPermissions);
              } else {
                // Organizar as permissões
                const modules: { [key: string]: boolean } = {};
                const features: { [key: string]: boolean } = {};

                permissionsData.forEach(permission => {
                  if (permission.module) {
                    modules[permission.module] = true;
                  }
                  if (permission.feature) {
                    features[permission.feature] = true;
                  }
                });

                // Adicionar as permissões ao perfil
                const userWithPermissions: UserProfile = {
                  ...profileData,
                  accessPermissions: {
                    modules,
                    features
                  }
                };

                // Atualizar o perfil no banco de dados
                await supabase
                  .from('users_unified')
                  .update({
                    access_permissions: userWithPermissions.accessPermissions
                  })
                  .eq('id', profileData.id);

                setProfile(userWithPermissions);
              }
            }
          }
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Configurar o listener para mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {

      if (event === 'SIGNED_IN' && session?.user) {
        // Garantir que o token personalizado exista ao entrar
        const token = getToken();
        if (!token) {
          console.log('🔄 SIGNED_IN detectado sem token personalizado, tentando gerar...');
          // Importar função geradora da recuperação (ou reimplementar chamada)
          // Como estamos dentro do contexto, podemos chamar a API diretamente
          try {
            const tokenResponse = await fetch('/api/auth/generate-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: session.user.id,
                email: session.user.email,
                phoneNumber: session.user.phone,
                role: session.user.app_metadata?.role || 'USER', // Fallback role
                firstName: session.user.user_metadata?.first_name,
                lastName: session.user.user_metadata?.last_name
              }),
            });

            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              if (tokenData.token) {
                saveToken(tokenData.token);
                console.log('✅ Token personalizado gerado e salvo em onAuthStateChange');
              }
            }
          } catch (err) {
            console.error('Erro ao gerar token em onAuthStateChange:', err);
          }
        }

        setUser(session.user);

        // Buscar o perfil do usuário na tabela users_unified
        let profileData;
        try {
          // Primeiro tentar buscar na tabela users_unified com join de setor
          let unifiedData = null;
          let unifiedError: any = null;
          try {
            const { data, error } = await supabase
              .from('users_unified')
              .select('*, sector:sectors(id, name, allowed_modules, allowed_cards)')
              .eq('id', session.user.id)
              .single();
            unifiedData = data;
            unifiedError = error;
          } catch (err) {
            console.warn('Exceção ao buscar perfil com join de setor em onAuthStateChange:', err);
            unifiedError = err;
          }

          if (unifiedError || !unifiedData) {
            console.warn('⚠️ Erro ao buscar perfil com join de setor em onAuthStateChange, tentando fallback sem join...', unifiedError);
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('users_unified')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (!fallbackError && fallbackData) {
              unifiedData = fallbackData;
              unifiedError = null;
            }
          }

          if (!unifiedError && unifiedData) {
            console.log('Perfil encontrado na tabela users_unified:', unifiedData.id);
            profileData = unifiedData;
          } else {
            console.error('Erro ao buscar perfil do usuário:', unifiedError);

            // Verificar se o perfil não existe e criar um perfil básico
            if (unifiedError && unifiedError.code === 'PGRST116') {
              console.log('Perfil não encontrado, criando perfil básico para:', session.user.email);

              try {
                // Extrair informações do usuário da autenticação
                const email = session.user.email;
                const phone = session.user.phone;

                // Verificar se o usuário é o administrador principal
                const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '');
                const isAdmin = email === adminEmail;

                // Criar um perfil básico na tabela users_unified
                const { data: newProfile, error: insertError } = await supabase
                  .from('users_unified')
                  .insert({
                    id: session.user.id,
                    email: email,
                    phone_number: phone,
                    first_name: isAdmin ? 'Caio' : 'Usuário',
                    last_name: isAdmin ? 'Correia' : 'ABZ',
                    role: isAdmin ? 'ADMIN' : 'USER',
                    active: true,
                    is_authorized: true,
                    authorization_status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    access_permissions: isAdmin ? {
                      modules: {
                        admin: true,
                        avaliacao: true,
                        dashboard: true,
                        manual: true,
                        procedimentos: true,
                        politicas: true,
                        calendario: true,
                        noticias: true,
                        reembolso: true,
                        contracheque: true,
                        ponto: true
                      }
                    } : {
                      modules: {
                        dashboard: true,
                        manual: true,
                        procedimentos: true,
                        politicas: true,
                        calendario: true,
                        noticias: true,
                        reembolso: true,
                        contracheque: true,
                        ponto: true
                      }
                    }
                  })
                  .select('*')
                  .single();

                if (insertError) {
                  console.error('Erro ao criar perfil básico:', insertError);
                } else {
                  console.log('Perfil básico criado com sucesso:', newProfile);
                  profileData = newProfile;
                }
              } catch (createError) {
                console.error('Exceção ao criar perfil básico:', createError);
              }
            }
          }
        } catch (fetchError) {
          console.error('Exceção ao buscar perfil do usuário:', fetchError);
        }

        if (profileData) {
          // Verificar se o perfil já tem permissões no formato access_permissions
          if (profileData.access_permissions) {
            console.log('Perfil já tem permissões definidas:', profileData.id);

            // Converter para o formato accessPermissions para compatibilidade
            const userWithPermissions: UserProfile = {
              ...profileData,
              accessPermissions: profileData.access_permissions
            };

            setProfile(userWithPermissions);
          } else {
            // Buscar as permissões do usuário da tabela antiga como fallback
            console.log('Buscando permissões na tabela user_permissions para:', profileData.id);
            const { data: permissionsData, error: permissionsError } = await supabase
              .from('user_permissions')
              .select('*')
              .eq('user_id', session.user.id);

            if (permissionsError) {
              console.error('Erro ao buscar permissões do usuário:', permissionsError);

              // Definir permissões padrão
              const defaultModules: Record<string, boolean> = {
                dashboard: true,
                manual: true,
                procedimentos: true,
                politicas: true,
                calendario: true,
                noticias: true,
                reembolso: true,
                contracheque: true,
                ponto: true,
                academy: true
              };

              // Adicionar permissão de admin se for admin
              if (profileData.role === 'ADMIN') {
                defaultModules['admin'] = true;
                defaultModules['avaliacao'] = true;
              }

              // Adicionar permissão de avaliação se for gerente
              if (profileData.role === 'MANAGER') {
                defaultModules['avaliacao'] = true;
              }

              // Adicionar as permissões padrão ao perfil
              const userWithPermissions: UserProfile = {
                ...profileData,
                accessPermissions: {
                  modules: defaultModules,
                  features: {}
                }
              };

              // Atualizar o perfil no banco de dados
              await supabase
                .from('users_unified')
                .update({
                  access_permissions: userWithPermissions.accessPermissions
                })
                .eq('id', profileData.id);

              setProfile(userWithPermissions);
            } else {
              // Organizar as permissões
              const modules: { [key: string]: boolean } = {};
              const features: { [key: string]: boolean } = {};

              permissionsData.forEach(permission => {
                if (permission.module) {
                  modules[permission.module] = true;
                }
                if (permission.feature) {
                  features[permission.feature] = true;
                }
              });

              // Adicionar as permissões ao perfil
              const userWithPermissions: UserProfile = {
                ...profileData,
                accessPermissions: {
                  modules,
                  features
                }
              };

              // Atualizar o perfil no banco de dados
              await supabase
                .from('users_unified')
                .update({
                  access_permissions: userWithPermissions.accessPermissions
                })
                .eq('id', profileData.id);

              setProfile(userWithPermissions);
            }
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
    });

    let cleanupRefresh: (() => void) | undefined;

    const initAuth = async () => {
      console.log('SupabaseAuthContext - Iniciando autenticação...');

      try {
        // Tentar recuperar sessão automaticamente
        console.log('SupabaseAuthContext - Tentando recuperar sessão...');

        // Verificar primeiro se temos um token no localStorage (recuperação rápida)
        const token = getToken();
        if (token) {
          console.log('SupabaseAuthContext - Token encontrado no storage, tentando carregar perfil imediatamente...');
          const profileLoaded = await loadUserProfileFromToken();
          if (profileLoaded) {
            console.log('SupabaseAuthContext - Perfil carregado via token, pulando verificação de sessão lenta');

            // Ainda assim configuramos o refresh token
            cleanupRefresh = await setupRefreshToken();
            startTokenRefreshManager();

            setIsLoading(false);
            return;
          }
        }

        const recoveryResult = await recoverSessionOnReturn();

        if (recoveryResult.success && recoveryResult.user) {
          console.log('✅ Sessão recuperada automaticamente:', recoveryResult.message);
          setUser(recoveryResult.user);

          // CRÍTICO: Garantir que o token esteja no localStorage se recuperamos a sessão
          const currentToken = getToken();
          if (!currentToken && recoveryResult.user) {
            console.log('⚠️ Sessão recuperada mas token ausente no storage. Tentando regenerar...');
            // Tentar regenerar token se tivermos sessão mas não token
            try {
              // Tenta pegar da sessão do supabase primeiro se disponível (refresh session)
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                await refreshCustomToken(); // Isso deve salvar o token
              }
            } catch (e) {
              console.error('Erro ao tentar regenerar token após recuperação de sessão:', e);
            }
          }

          setIsLoading(false);
        } else if (recoveryResult.requiresLogin) {
          console.log('🔐 Login necessário:', recoveryResult.message);
          setIsLoading(false);
        } else {
          // Fallback para método tradicional
          console.log('🔄 Fallback para verificação tradicional...');

          // Verificar se já temos um token (se falhou no início ou se foi removido)
          const validToken = isTokenValid(); // Checagem mais robusta
          if (validToken) {
            console.log('SupabaseAuthContext - Token válido encontrado, tentando carregar perfil...');
            await loadUserProfileFromToken();
          } else {
            console.log('SupabaseAuthContext - Nenhum token válido encontrado, verificando sessão...');
            await checkAuth();
          }
        }

        // Configurar o refresh token
        cleanupRefresh = await setupRefreshToken();

        // Iniciar o gerenciador de refresh automático
        startTokenRefreshManager();
      } catch (error) {
        console.error('SupabaseAuthContext - Erro ao inicializar autenticação:', error);
        setIsLoading(false);
      }
    };

    initAuth();

    // Listeners para detectar retorno do usuário
    const handleVisibilityChange = async () => {
      if (!document.hidden && user) {
        console.log('👁️ Usuário retornou à aba, verificando sessão...');
        const recoveryResult = await recoverSessionOnReturn();

        if (recoveryResult.success && recoveryResult.user) {
          setUser(recoveryResult.user);
        } else if (recoveryResult.requiresLogin) {
          console.log('🔐 Sessão expirou, fazendo logout...');
          await signOut();
        }
      }
    };

    const handleFocus = async () => {
      if (user) {
        console.log('🎯 Janela ganhou foco, verificando sessão...');
        const recoveryResult = await recoverSessionOnReturn();

        if (recoveryResult.success && recoveryResult.user) {
          setUser(recoveryResult.user);
        } else if (recoveryResult.requiresLogin) {
          console.log('🔐 Sessão expirou, fazendo logout...');
          await signOut();
        }
      }
    };

    // Adicionar listeners apenas no cliente
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
    }

    // Limpar o listener e o intervalo de refresh ao desmontar o componente
    return () => {
      subscription.unsubscribe();
      if (cleanupRefresh) cleanupRefresh();

      // Parar o gerenciador de refresh automático
      stopTokenRefreshManager();

      // Remover listeners
      if (typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
      }
    };
  }, []);

  // Alias para logout (para compatibilidade)
  const logout = signOut;

  // Verificar se o usuário está autenticado
  const isAuthenticated = !!user;

  // Verificar papéis do usuário
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '');

  // Verificar se o usuário é administrador de várias maneiras para garantir acesso
  const isAdmin = useMemo(() => {
    // Verificar se o token JWT indica que o usuário é admin
    const token = getToken();
    let tokenPayload = null;
    if (token) {
      try {
        // Usar uma abordagem mais segura para verificar o token no cliente
        // Decodificar o token sem verificar a assinatura (apenas para uso no cliente)
        // A verificação real da assinatura deve ser feita no servidor
        const parts = token.split('.');
        if (parts.length === 3) {
          try {
            const base64Url = parts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
              atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
            tokenPayload = JSON.parse(jsonPayload);
          } catch (parseError) {
            console.error('Erro ao decodificar token JWT:', parseError);
          }
        }
      } catch (error) {
        console.error('Erro ao processar token JWT:', error);
      }
    }

    const hasAdminRole = profile?.role === 'ADMIN' || tokenPayload?.role === 'ADMIN';

    // Verificar se o email é o email do administrador principal (ADMIN_EMAIL)
    // Não permitir que outros emails sejam considerados admin apenas por serem iguais ao adminEmail
    const isAdminEmail = (profile?.email === (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '') || user?.email === (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || ''));

    // Verificar permissões explícitas de admin
    const hasAdminPermission = !!(profile?.access_permissions?.modules?.admin) ||
      !!(profile?.accessPermissions?.modules?.admin);

    const result = hasAdminRole || isAdminEmail || hasAdminPermission;

    // Debug apenas quando há mudanças significativas
    if (result && !isLoading) {
      console.log('SupabaseAuthContext - Admin access confirmed:', {
        hasAdminRole,
        isAdminEmail,
        hasAdminPermission,
        userEmail: user?.email,
        profileRole: profile?.role
      });
    }

    return result;
  }, [profile, user, adminEmail]);

  // Se o usuário for o administrador principal mas não tiver o papel de ADMIN, atualizar o perfil
  useEffect(() => {
    const updateAdminProfile = async () => {
      // Verificar se o email é exatamente o email do administrador principal
      const isMainAdmin = profile?.email === (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '') || user?.email === (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || '');

      if (isMainAdmin && profile?.role !== 'ADMIN') {
        console.log('Atualizando perfil do administrador principal...');
        try {
          const { error } = await supabase
            .from('users_unified')
            .update({
              role: 'ADMIN',
              access_permissions: {
                ...(profile?.access_permissions || {}),
                modules: {
                  ...(profile?.access_permissions?.modules || {}),
                  admin: true,
                  avaliacao: true
                }
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', profile?.id);

          if (error) {
            console.error('Erro ao atualizar perfil do administrador:', error);

            console.error('Falha ao atualizar perfil do administrador. Verifique as permissões do banco de dados.');
          } else {
            console.log('Perfil do administrador atualizado com sucesso!');
            // Recarregar a página para aplicar as alterações
            window.location.reload();
          }
        } catch (error) {
          console.error('Erro ao atualizar perfil do administrador:', error);
        }
      }
    };

    if (profile && !isLoading) {
      updateAdminProfile();
    }
  }, [profile, user, isLoading]);

  // Verificar se o usuário é gerente de várias maneiras para garantir acesso
  const isManager = useMemo(() => {
    // Se for admin, também tem acesso de gerente
    if (isAdmin) return true;

    // Verificar se o token JWT indica que o usuário é gerente
    const token = getToken();
    let tokenPayload: any = null;
    if (token) {
      try {
        // Usar uma abordagem mais segura para verificar o token no cliente
        // Decodificar o token sem verificar a assinatura (apenas para uso no cliente)
        const parts = token.split('.');
        if (parts.length === 3) {
          try {
            const base64Url = parts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
              atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
            tokenPayload = JSON.parse(jsonPayload);
          } catch (parseError) {
            console.error('Erro ao decodificar token JWT para gerente:', parseError);
          }
        }
      } catch (error) {
        console.error('Erro ao processar token JWT para gerente:', error);
      }
    }

    const hasManagerRole = profile?.role === 'MANAGER' || tokenPayload?.role === 'MANAGER';
    const hasAvaliacaoPermissionModule = !!(profile?.access_permissions?.modules?.avaliacao) ||
      !!(profile?.accessPermissions?.modules?.avaliacao);

    const result = hasManagerRole || hasAvaliacaoPermissionModule;

    // Debug: verificar se o usuário é gerente
    // console.log('SupabaseAuthContext - isManager:', result);
    // console.log('SupabaseAuthContext - hasManagerRole:', hasManagerRole);
    // console.log('SupabaseAuthContext - token role:', tokenPayload?.role);
    // console.log('SupabaseAuthContext - hasAvaliacaoPermissionModule for isManager calc:', hasAvaliacaoPermissionModule);

    return result;
  }, [profile, isAdmin]);

  // Verificar se o usuário tem permissão para aprovar reembolsos
  const hasApprovalPermission = useMemo(() => {
    if (!profile) return false;
    // Admins sempre têm permissão
    if (isAdmin) return true;
    // Gerentes (conforme definido por isManager) também têm essa permissão
    if (isManager) return true;

    // Verificar permissões específicas para aprovação de reembolso
    const specificPermission = !!(
      profile.accessPermissions?.features?.reimbursement_approval ||
      profile.access_permissions?.features?.reimbursement_approval
    );
    // Para depuração
    // console.log(`SupabaseAuthContext - hasApprovalPermission check: isAdmin=${isAdmin}, isManager=${isManager}, specificPermission=${specificPermission}`);
    // console.log('Profile for permission check:', profile);
    return specificPermission; // Se não for admin/manager, depende apenas da flag específica
  }, [profile, isAdmin, isManager]);

  // Verificar se o usuário tem acesso ao módulo de avaliação
  const hasEvaluationAccess = useMemo(() => {
    if (!profile) return false;
    if (isAdmin) return true;
    if (isManager) return true;

    // Todos os usuários autenticados podem acessar o módulo de avaliação
    // (para visualizar suas próprias avaliações)
    return true;
  }, [profile, isAdmin, isManager]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isAuthenticated,
        isAdmin,
        isManager,
        hasApprovalPermission,
        passwordExpired,
        loginStep,
        hasPassword,
        authStatus,
        hasEvaluationAccess,
        setLoginStep,
        initiateLogin,
        loginWithPassword,
        loginWithOtp,
        verifyOtp,
        verifyCode,
        updatePassword,
        checkPasswordStatus,
        hasAccess: (module: string) => {
          debugLog(`🔍 Verificando acesso ao módulo: ${module}`);

          // Caso especial para o módulo de avaliação - ACESSO UNIVERSAL
          if (module === 'avaliacao') {
            // Se há um usuário autenticado (mesmo sem profile carregado), permitir acesso
            const hasUser = !!user;
            debugLog(`✅ Módulo avaliacao - Acesso ${hasUser ? 'PERMITIDO' : 'NEGADO'}:`, {
              user: !!user,
              userId: user?.id,
              profile: !!profile,
              isAdmin,
              isManager
            });
            return hasUser;
          }

          // Caso especial para o módulo Academy - ACESSO UNIVERSAL
          if (module === 'academy') {
            // Se há um usuário autenticado (mesmo sem profile carregado), permitir acesso
            const hasUser = !!user;
            debugLog(`✅ Módulo academy - Acesso ${hasUser ? 'PERMITIDO' : 'NEGADO'}:`, {
              user: !!user,
              userId: user?.id,
              profile: !!profile,
              isAdmin,
              isManager
            });
            return hasUser;
          }

          debugLog('Estado atual do usuário:', {
            isAdmin,
            isManager,
            role: profile?.role,
            email: profile?.email,
            accessPermissions: profile?.accessPermissions,
            access_permissions: profile?.access_permissions
          });

          // Para outros módulos, seguir a lógica padrão

          // Administradores têm acesso a tudo
          if (isAdmin) {
            debugLog(`Usuário é admin, concedendo acesso ao módulo: ${module}`);
            return true;
          }

          // Gerentes têm acesso a tudo, exceto à área de administração
          if (isManager && module !== 'admin') {
            debugLog(`Usuário é gerente, concedendo acesso ao módulo: ${module}`);
            return true;
          }


          // ----------------------------------------------------------------------
          // LOGICA DE PERMISSÃO HIERÁRQUICA E RESTRITIVA (STRICT SECTOR MODE)
          // Referência: src/app/api/user/effective-permissions/route.ts
          // ----------------------------------------------------------------------

          // 1. Permissões Individuais (Prioridade Máxima)
          const individualPermissions = profile?.accessPermissions?.modules || profile?.access_permissions?.modules;
          if (individualPermissions && individualPermissions[module] !== undefined) {
            const hasIndividualAccess = individualPermissions[module];
            debugLog(`🔐 Acesso ao módulo ${module} determinado por permissão individual do usuário: ${hasIndividualAccess}`);
            return hasIndividualAccess;
          }

          // 1b. ACL Permissions (via effective-permissions API)
          // Se o effective-permissions API (que inclui user_acl_permissions + role_acl_permissions)
          // já retornou os módulos, usar como camada intermediária
          if (aclEnabledModules.includes(module)) {
            debugLog(`🔐 Acesso ao módulo ${module} concedido via ACL do usuário`);
            return true;
          }

          // 2. Permissões de Setor (Strict Sector Mode)
          // Se o usuário tem um setor definido, ele SÓ deve acessar o que o setor permite (além dos módulos core)
          // Isso substitui os defaults do Role "USER".
          if (profile?.sector?.allowed_modules && Array.isArray(profile.sector.allowed_modules)) {
            // Módulos Core - Sempre permitidos (devem estar sincronizados com a API)
            // dashboard é o único módulo obrigatório. Todos os outros (noticias, calendario, ajuda, etc) devem vir do Setor.
            const coreModules = ['dashboard'];

            // Verifica permissão do setor
            const hasSectorAccess = profile.sector.allowed_modules.includes(module);
            const isCoreModule = coreModules.includes(module);

            debugLog(`🔐 Acesso ao módulo ${module} via Setor: ${hasSectorAccess} (Core: ${isCoreModule})`);

            // No modo estrito, se tem setor, só acessa se for setorial OU core
            // NÃO caímos para o fallback de roleDefaults se o usuário tiver setor.
            return hasSectorAccess || isCoreModule;
          }

          // 3. Fallback: Role Defaults (Apenas se NÃO tiver setor)
          const roleModulePermissions = profile?.role ? rolePermissions[profile.role]?.modules : undefined;
          if (roleModulePermissions && roleModulePermissions[module] !== undefined) {
            const hasRoleAccess = roleModulePermissions[module];
            console.log(`🔐 Acesso ao módulo ${module} via Role Default: ${hasRoleAccess}`);
            return hasRoleAccess;
          }

          // Fallback para permissões padrão se não encontrar nas configurações
          console.log(`Módulo ${module} não encontrado nas permissões, negando acesso`);
          return false;
        },
        hasFeature: (feature: string) => {
          return hasEffectiveFeature(
            {
              role: profile?.role,
              features: {
                ...(profile?.access_permissions?.features || {}),
                ...(profile?.accessPermissions?.features || {}),
                ...effectiveFeatures,
              },
              aclNames: aclPermissionNames,
            },
            feature,
          );
        },
        refreshProfile: async () => {
          try {
            if (!user?.id) return;

            console.log('Atualizando perfil do usuário...');

            // Buscar o perfil atualizado no Supabase com join de setor
            let data = null;
            let error = null;
            try {
              const result = await supabase
                .from('users_unified')
                .select('*, sector:sectors(id, name, allowed_modules, allowed_cards)')
                .eq('id', user.id)
                .single();
              data = result.data;
              error = result.error;
            } catch (err) {
              console.warn('Exceção ao atualizar perfil com join de setor:', err);
              error = err;
            }

            if (error || !data) {
              console.warn('⚠️ Erro ao buscar perfil atualizado com join de setor, tentando fallback sem join...', error);
              const fallbackResult = await supabase
                .from('users_unified')
                .select('*')
                .eq('id', user.id)
                .single();
              
              if (fallbackResult.error) {
                console.error('Erro ao atualizar perfil (fallback sem join):', fallbackResult.error);
                return;
              }
              data = fallbackResult.data;
            }

            if (data) {
              // Converter para o formato de perfil
              const profileData: UserProfile = {
                ...data,
                accessPermissions: data.access_permissions || {}
              };

              setProfile(profileData);
              console.log('Perfil do usuário atualizado com sucesso');

              // Re-carregar módulos ACL + features efetivas (JSONB + nomes ACL)
              const aclRes = await fetch('/api/user/effective-permissions', { cache: 'no-store' });
              if (aclRes.ok) {
                const aclData = await aclRes.json();
                if (aclData.effective_modules) {
                  const modules = Object.entries(aclData.effective_modules)
                    .filter(([_, v]) => v === true)
                    .map(([k]) => k);
                  setAclEnabledModules(modules);
                }
                setEffectiveFeatures(aclData.effective_features || {});
                setAclPermissionNames(
                  Array.isArray(aclData.acl_permission_names) ? aclData.acl_permission_names : [],
                );
              }
            }
          } catch (error) {
            console.error('Erro ao atualizar perfil:', error);
          }
        },
        signOut,
        logout,
        getToken: () => getToken()
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useSupabaseAuth deve ser usado dentro de um SupabaseAuthProvider');
  }

  return context;
}
