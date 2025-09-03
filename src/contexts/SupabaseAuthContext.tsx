'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { User } from '@supabase/supabase-js';
import { Tables } from '@/types/supabase';
import { getToken, saveToken, removeToken } from '@/lib/tokenStorage';
import { activateUserAfterEmailVerification } from '@/lib/user-approval';
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

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [passwordExpired, setPasswordExpired] = useState(false);
  const [loginStep, setLoginStep] = useState<'phone' | 'verification' | 'password' | 'complete' | 'unauthorized' | 'pending' | 'quick_register'>('phone');
  const [hasPassword, setHasPassword] = useState(false);
  const [authStatus, setAuthStatus] = useState<string | undefined>(undefined);
  const [rolePermissions, setRolePermissions] = useState<any>({});
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
              const { data, error } = await supabase
                .from('users_unified')
                .select('*')
                .eq('id', refreshData.user.id)
                .single();

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
      const { data: userData, error: userError } = await supabase
        .from('users_unified')
        .select('*')
        .eq('id', verifyData.userId)
        .single();

      if (userError) {
        console.error('Erro ao buscar usuário pelo ID do token:', userError);
        setIsLoading(false);
        return false;
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
          modules: {
            dashboard: true,
            manual: true,
            procedimentos: true,
            politicas: true,
            calendario: true,
            noticias: true,
            reembolso: true,
            contracheque: true,
            ponto: true,
            ...(userData.role === 'ADMIN' ? { admin: true, avaliacao: true } : {}),
            ...(userData.role === 'MANAGER' ? { avaliacao: true } : {})
          },
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
      } else if (phoneNumber) {
        // Verificar se o telefone existe na tabela users_unified
        const { data: userData, error: userError } = await supabase
          .from('users_unified')
          .select('*')
          .eq('phone_number', phoneNumber)
          .single();

        if (userError) {
          // Telefone não encontrado
          setAuthStatus('new_phone');
          return false;
        }

        // Verificar se o usuário está ativo
        if (!userData.active) {
          setAuthStatus('inactive');
          return false;
        }

        // Telefone encontrado, verificar se tem senha
        setHasPassword(!!userData.password);
        setLoginStep('password');
        return true;
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
      console.log('Tentando login com senha para:', identifier);
      const isEmail = identifier.includes('@');

      // Preparar os dados para envio
      const loginData = {
        [isEmail ? 'email' : 'phoneNumber']: identifier,
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
          saveToken(response.token, 86400); // 24 horas
          localStorage.setItem('user', JSON.stringify(response.user));
          console.log('✅ Token salvo com sucesso!');

          // Se a opção "lembrar-me" estiver marcada, definir um cookie de longa duração
          if (rememberMe) {
            localStorage.setItem('rememberMe', 'true');
          }

          setUser(response.user);
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

        // Verificar se é o administrador
        if (identifier === 'caio.correia@groupabz.com' || identifier === '+5522997847289') {
          console.log('Tentativa de login do administrador falhou, tentando criar conta...');

          // Tentar criar a conta do administrador usando o Supabase diretamente
          try {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: 'caio.correia@groupabz.com',
              password: 'Caio@2122@', // Usar a senha correta do administrador
            });

            if (signUpError) {
              console.error('Erro ao criar conta de administrador:', signUpError);
              return false;
            }

            console.log('Conta de administrador criada com sucesso, tentando login novamente...');

            // Tentar login novamente
            const secondResponse = await fetchWrapper.post('/api/auth/login', {
              email: 'caio.correia@groupabz.com',
              password: 'Caio@2122@'
            });

            if (secondResponse.token) {
              localStorage.setItem('auth', 'true');
              localStorage.setItem('token', secondResponse.token);
              localStorage.setItem('user', JSON.stringify(secondResponse.user));

              setUser(secondResponse.user);
              setLoginStep('complete');

              await checkPasswordStatus();

              return true;
            }
          } catch (adminError) {
            console.error('Erro ao criar/logar como administrador:', adminError);
          }
        }

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

      // Verificar se o usuário existe
      const { data: userData, error: userError } = await supabase
        .from('users_unified')
        .select('*')
        .eq(isEmail ? 'email' : 'phone_number', identifier)
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
          [isEmail ? 'email' : 'phone_number']: identifier,
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

      // Enviar o código por email ou SMS
      if (isEmail) {
        // Enviar por email
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
      } else {
        // Enviar por SMS
        try {
          const smsResponse = await fetch('/api/auth/send-sms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              phoneNumber: identifier,
              code: otpData.code,
              type: 'verification'
            }),
          });

          if (!smsResponse.ok) {
            console.error('Erro ao enviar SMS:', await smsResponse.text());
            return { success: false, hasPassword, status: 'sms_error' };
          }

          console.log('SMS enviado com sucesso');
        } catch (smsError) {
          console.error('Exceção ao enviar SMS:', smsError);
          return { success: false, hasPassword, status: 'sms_error' };
        }
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
      console.log('Iniciando processo de logout...');

      // Chamar a API de logout se tiver token personalizado
      const token = getToken();
      if (token) {
        try {
          console.log('Chamando API de logout para o token personalizado');
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
        } catch (apiError) {
          console.error('Erro ao chamar API de logout:', apiError);
          // Continuar com o processo de logout mesmo se a API falhar
        }
      }

      // Remover tokens usando o utilitário
      removeToken();

      // Remover outros dados de autenticação
      localStorage.removeItem('auth');
      localStorage.removeItem('user');
      localStorage.removeItem('rememberMe');

      // Limpar cookies relacionados à autenticação
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'abzToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

      // Fazer logout no Supabase
      console.log('Fazendo logout no Supabase');
      await supabase.auth.signOut();

      // Limpar estado
      setUser(null);
      setProfile(null);
      setLoginStep('phone');

      console.log('Logout concluído com sucesso');

      // Redirecionar para login
      window.location.href = '/login';
    } catch (error) {
      console.error('Erro ao fazer logout:', error);

      // Tentar limpar manualmente mesmo em caso de erro
      try {
        // Remover tokens usando o utilitário
        removeToken();

        // Remover outros dados de autenticação
        localStorage.removeItem('auth');
        localStorage.removeItem('user');

        // Limpar cookies relacionados à autenticação
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'abzToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

        // Limpar estado
        setUser(null);
        setProfile(null);
      } catch (cleanupError) {
        console.error('Erro ao limpar dados de autenticação:', cleanupError);
      }

      // Forçar redirecionamento mesmo em caso de erro
      window.location.href = '/login';
    }
  };

  // Verificar se o usuário está autenticado ao carregar a página
  useEffect(() => {
    const checkAuth = async () => {
      try {
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
                  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'caio.correia@groupabz.com';
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
                const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'caio.correia@groupabz.com';
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
        // Verificar se já temos um token
        const token = getToken();
        if (token) {
          console.log('SupabaseAuthContext - Token encontrado, tentando carregar perfil...');

          // Carregar o perfil a partir do token
          await loadUserProfileFromToken();
        } else {
          console.log('SupabaseAuthContext - Nenhum token encontrado, verificando sessão...');
          await checkAuth();
        }

        // Configurar o refresh token
        cleanupRefresh = await setupRefreshToken();
      } catch (error) {
        console.error('SupabaseAuthContext - Erro ao inicializar autenticação:', error);
        setIsLoading(false);
      }
    };

    initAuth();

    // Limpar o listener e o intervalo de refresh ao desmontar o componente
    return () => {
      subscription.unsubscribe();
      if (cleanupRefresh) cleanupRefresh();
    };
  }, []);

  // Alias para logout (para compatibilidade)
  const logout = signOut;

  // Verificar se o usuário está autenticado
  const isAuthenticated = !!user;

  // Verificar papéis do usuário
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'caio.correia@groupabz.com';

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

    // Verificar se o email é o email do administrador principal (caio.correia@groupabz.com)
    // Não permitir que outros emails sejam considerados admin apenas por serem iguais ao adminEmail
    const isAdminEmail = (profile?.email === 'caio.correia@groupabz.com' || user?.email === 'caio.correia@groupabz.com');

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
      const isMainAdmin = profile?.email === 'caio.correia@groupabz.com' || user?.email === 'caio.correia@groupabz.com';

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
          console.log(`🔍 Verificando acesso ao módulo: ${module}`);

          // Caso especial para o módulo de avaliação - ACESSO UNIVERSAL
          if (module === 'avaliacao') {
            // Se há um usuário autenticado (mesmo sem profile carregado), permitir acesso
            const hasUser = !!user;
            console.log(`✅ Módulo avaliacao - Acesso ${hasUser ? 'PERMITIDO' : 'NEGADO'}:`, {
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
            console.log(`✅ Módulo academy - Acesso ${hasUser ? 'PERMITIDO' : 'NEGADO'}:`, {
              user: !!user,
              userId: user?.id,
              profile: !!profile,
              isAdmin,
              isManager
            });
            return hasUser;
          }

          console.log('Estado atual do usuário:', {
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
            console.log(`Usuário é admin, concedendo acesso ao módulo: ${module}`);
            return true;
          }

          // Gerentes têm acesso a tudo, exceto à área de administração
          if (isManager && module !== 'admin') {
            console.log(`Usuário é gerente, concedendo acesso ao módulo: ${module}`);
            return true;
          }

          // Verificar permissões individuais primeiro (prioridade)
          const individualPermissions = profile?.accessPermissions?.modules || profile?.access_permissions?.modules;
          if (individualPermissions && individualPermissions[module] !== undefined) {
            const hasIndividualAccess = individualPermissions[module];
            console.log(`Acesso ao módulo ${module} baseado em permissões individuais: ${hasIndividualAccess}`);
            return hasIndividualAccess;
          }

          // Se não há permissões individuais, verificar permissões do role
          const roleModulePermissions = profile?.role ? rolePermissions[profile.role]?.modules : undefined;
          if (roleModulePermissions && roleModulePermissions[module] !== undefined) {
            const hasRoleAccess = roleModulePermissions[module];
            console.log(`Acesso ao módulo ${module} baseado em permissões do role ${profile?.role}: ${hasRoleAccess}`);
            return hasRoleAccess;
          }

          // Fallback para permissões padrão se não encontrar nas configurações
          console.log(`Módulo ${module} não encontrado nas permissões, negando acesso`);
          return false;
        },
        hasFeature: (feature: string) => {
          // Administradores têm acesso a todas as funcionalidades
          if (isAdmin) return true;

          // Gerentes têm acesso a todas as funcionalidades, exceto as administrativas
          if (isManager && !feature.startsWith('admin.')) return true;

          // Verificar permissões de funcionalidade (verificar tanto accessPermissions quanto access_permissions)
          return !!(
            profile?.accessPermissions?.features?.[feature] ||
            profile?.access_permissions?.features?.[feature]
          );
        },
        refreshProfile: async () => {
          try {
            if (!user?.id) return;

            console.log('Atualizando perfil do usuário...');

            // Buscar o perfil atualizado no Supabase
            const { data, error } = await supabase
              .from('users_unified')
              .select('*')
              .eq('id', user.id)
              .single();

            if (error) {
              console.error('Erro ao atualizar perfil:', error);
              return;
            }

            if (data) {
              // Converter para o formato de perfil
              const profileData: UserProfile = {
                ...data,
                accessPermissions: data.access_permissions || {}
              };

              setProfile(profileData);
              console.log('Perfil do usuário atualizado com sucesso');
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
