'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiUser,
  FiUsers,
  FiShield,
  FiSearch,
  FiKey,
  FiClock,
  FiMail,
  FiPhone,
  FiGlobe,
  FiRefreshCw,
  FiUserCheck,
  FiCheck,
  FiX,
  FiAlertCircle,
  FiFilter,
  FiSettings
} from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import UserEditor, { UserEditorData } from '@/components/admin/UserEditor';
import UserAccessHistory from '@/components/admin/UserAccessHistory';
import UserPasswordReset from '@/components/admin/UserPasswordReset';
import UserRoleManager from '@/components/admin/UserRoleManager';
import { useAllUsers } from '@/hooks/useAllUsers';

// Interface para o usu�rio na lista
interface User {
  _id: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  role: 'ADMIN' | 'USER' | 'MANAGER';
  position?: string;
  department?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  isAuthorized?: boolean;
  authorizationStatus?: string;
  accessPermissions?: any;
}

// Interface para usu�rio autorizado
type AuthorizedUser = {
  _id: string;
  email?: string;
  phoneNumber?: string;
  domain?: string;
  inviteCode?: string;
  status: 'active' | 'pending' | 'rejected' | 'expired';
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  maxUses?: number;
  usedCount?: number;
  notes?: string;
};

// Estat�sticas de acesso
type AuthStats = {
  users: {
    total: number;
    active: number;
    newLast30Days: number;
    activeLast7Days: number;
  };
  authorizations: {
    email: number;
    phone: number;
    domain: number;
    inviteCode: number;
    pending: number;
    rejected: number;
  };
  departments: Array<{ name: string; count: number }>;
  positions: Array<{ name: string; count: number }>;
};

export default function UnifiedUserManager() {
  const { t } = useI18n();
  const { user, isAdmin } = useSupabaseAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'authorized'>('users');

  // Lista unificada de usu�rios do projeto
  const { users: hookUsers, loading: hookLoading, error: hookError, refresh: refreshAllUsers } = useAllUsers();

  // Estados para usu�rios regulares
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para usu�rios autorizados
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>([]);
  const [stats, setStats] = useState<AuthStats | null>(null);
  const [filter, setFilter] = useState('all');

  // Estados para modais
  const [showEditor, setShowEditor] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAccessHistory, setShowAccessHistory] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  // Estados para formul�rio de autoriza��o
  const [showAddForm, setShowAddForm] = useState(false);
  const [formType, setFormType] = useState<'email' | 'phone' | 'domain' | 'invite'>('email');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [domain, setDomain] = useState('');
  const [notes, setNotes] = useState('');
  const [generatedInviteCode, setGeneratedInviteCode] = useState('');
  const [expiryDays, setExpiryDays] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  // Estados para mensagens
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [isFixingToken, setIsFixingToken] = useState(false);

  // Estados para rejei��o
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  // Carregar dados quando o componente montar
  useEffect(() => {
    if (user) {
      // Primeiro tentar renovar o token
      const refreshToken = async () => {
        try {
          const token = localStorage.getItem('token') || localStorage.getItem('abzToken');
          if (token) {
            console.log('Tentando renovar token antes de carregar dados...');
            const refreshResponse = await fetch('/api/auth/token-refresh', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });

            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json();
              console.log('Token renovado com sucesso antes de carregar dados');

              if (refreshData.token && refreshData.token !== token) {
                console.log('Atualizando token renovado no localStorage');
                localStorage.setItem('token', refreshData.token);
                // Remover o token antigo se existir
                localStorage.removeItem('abzToken');
              }
            } else {
              console.log(t('components.falhaNaRenovacaoDoTokenTentandoFixtoken'));

              // Tentar corrigir o token
              try {
                const fixResponse = await fetch('/api/auth/fix-token', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                  },
                });

                if (fixResponse.ok) {
                  const fixData = await fixResponse.json();
                  console.log('Token corrigido com sucesso');

                  if (fixData.token && fixData.token !== token) {
                    console.log('Atualizando token corrigido no localStorage');
                    localStorage.setItem('token', fixData.token);
                  }
                }
              } catch (fixError) {
                console.error('Erro ao tentar corrigir token:', fixError);
              }
            }
          }
        } catch (refreshError) {
          console.error('Erro ao renovar token antes de carregar dados:', refreshError);
        }

        // Carregar dados ap�s tentativa de renova��o/corre��o do token
        fetchUsers();
        fetchAuthorizedUsers();
        fetchStats();
      };

      refreshToken();
    }
  }, [user]);

  // Carregar dados quando a aba mudar
  useEffect(() => {
    console.log('UnifiedUserManager - Tab changed to:', activeTab);
    if (activeTab === 'users') {
      console.log(t('components.iniciandoBuscaDeUsuariosDevidoAMudancaDeAba'));
      // Adicionar um pequeno delay para garantir que o componente esteja totalmente montado
      setTimeout(() => {
        fetchUsers();
      }, 100);
    } else if (activeTab === 'authorized') {
      fetchAuthorizedUsers();
      fetchStats();
    }
  }, [activeTab]);




  // Fun��o para corrigir o token manualmente
  const fixToken = async () => {
    setIsFixingToken(true);
    setError(null);
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error(t('components.naoHaTokenParaCorrigirFacaLoginNovamente'));
      }

      // Primeiro tentar renovar o token
      console.log('Tentando renovar token manualmente...');
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
          console.log('Atualizando token renovado no localStorage');
          localStorage.setItem('token', refreshData.token);
          localStorage.removeItem('abzToken');

          setSuccessMessage('Token renovado com sucesso! Recarregando dados...');

          // Recarregar dados
          await fetchUsers();
          await fetchAuthorizedUsers();
          await fetchStats();

          return;
        }
      }

      // Se a renova��o falhar, tentar corrigir o token
      console.log('Tentando corrigir token manualmente...');
      const fixResponse = await fetch('/api/auth/fix-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (fixResponse.ok) {
        const fixData = await fixResponse.json();
        console.log('Token corrigido com sucesso');

        if (fixData.token) {
          console.log('Atualizando token corrigido no localStorage');
          localStorage.setItem('token', fixData.token);
          localStorage.removeItem('abzToken');

          setSuccessMessage('Token corrigido com sucesso! Recarregando dados...');

          // Recarregar dados
          await fetchUsers();
          await fetchAuthorizedUsers();
          await fetchStats();
        } else {
          setError('Token corrigido, mas nenhum novo token foi gerado.');
        }
      } else {
        const errorData = await fixResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao corrigir token');
      }
    } catch (error) {
      console.error('Erro ao corrigir token:', error);
      setError(`Erro ao corrigir token: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);

      // Se falhar, tentar criar um novo token para o administrador
      if (user?.email === 'caio.correia@groupabz.com' || (user as any)?.phone_number === '+5522997847289') {
        try {
          console.log('Tentando criar novo token para o administrador...');

          // Redirecionar para a p�gina de corre��o de admin
          router.push('/admin-fix');
        } catch (adminFixError) {
          console.error('Erro ao tentar corrigir token de administrador:', adminFixError);
        }
      }
    } finally {
      setIsFixingToken(false);
    }
  };

  // Filtrar usu�rios quando o termo de busca mudar
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const lowercasedFilter = searchTerm.toLowerCase();
      const filtered = users.filter(user => {
        return (
          user.firstName.toLowerCase().includes(lowercasedFilter) ||
          user.lastName.toLowerCase().includes(lowercasedFilter) ||
          user.phoneNumber.toLowerCase().includes(lowercasedFilter) ||
          (user.email && user.email.toLowerCase().includes(lowercasedFilter)) ||
          (user.position && user.position.toLowerCase().includes(lowercasedFilter)) ||
          (user.department && user.department.toLowerCase().includes(lowercasedFilter))
        );
      });
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  // Sincronizar hook unificado -> estado local
  useEffect(() => {
    if (Array.isArray(hookUsers)) {
      setUsers(hookUsers as any);
      setFilteredUsers(hookUsers as any);
    }
    if (hookError) setError(hookError);
  }, [hookUsers, hookError]);

  // Buscar usu�rios regulares
  const fetchUsers = async () => {
    console.log(t('components.iniciandoBuscaDeUsuariosUseallusers'));
    setLoading(true);
    setError(null);
    try {
      await refreshAllUsers();
      return; // restante mantido apenas por compatibilidade
    } finally {
      setLoading(false);
    }

  };




  // Buscar usu�rios autorizados
  const fetchAuthorizedUsers = async () => {
    setLoading(true);
    try {
      let url = '/api/admin/authorized-users';
      if (filter !== 'all') {
        url += `?status=${filter}`;
      }

      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error(t('components.tokenNaoEncontradoFacaLoginNovamente'));
      }

      console.log(t('components.buscandoUsuariosAutorizadosComToken'), token.substring(0, 10) + '...');

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Resposta da API:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(t('components.erroAoBuscarUsuariosAutorizados'), errorData);

        // Se o erro for de acesso negado e o usu�rio for o administrador principal, redirecionar para a p�gina de corre��o
        if (response.status === 403 &&
            (user?.email === 'caio.correia@groupabz.com' || (user as any)?.phone_number === '+5522997847289')) {
          console.log(t('components.usuarioEOAdministradorPrincipalMasNaoTemAcessoRedi'));
          router.push('/admin-fix');
          return;
        }

        throw new Error(errorData.error || t('components.erroAoCarregarUsuariosAutorizados'));
      }

      const responseText = await response.text();
      console.log('Resposta recebida, tamanho:', responseText.length);

      // Verificar se a resposta est� vazia
      if (!responseText || responseText.trim() === '') {
        console.error(t('components.respostaVaziaRecebidaDaApiDeUsuariosAutorizados'));
        setAuthorizedUsers([]);
        setError(t('components.nenhumUsuarioAutorizadoEncontradoARespostaDaApiEst'));
        return;
      }

      try {
        const data = JSON.parse(responseText);
        console.log(t('components.usuariosAutorizadosRecebidos'), data.length);

        // Verificar se os dados est�o no formato esperado
        if (Array.isArray(data)) {
          // Verificar se os dados t�m a estrutura esperada
          if (data.length > 0) {
            const firstUser = data[0];
            // Verificar se os campos necess�rios est�o presentes
            if (!firstUser._id) {
              console.warn(t('components.dadosDeUsuarioAutorizadoPodemEstarEmFormatoIncorre'), firstUser);
              console.log('Tentando mapear para o formato correto...');

              // Tentar mapear para o formato correto
              const mappedData = data.map((user: any) => ({
                _id: user.id || user._id || '',
                email: user.email || undefined,
                phoneNumber: user.phone_number || user.phoneNumber || undefined,
                domain: user.authorization_domain || user.domain || undefined,
                inviteCode: user.invite_code || user.inviteCode || undefined,
                status: user.authorization_status || user.status || 'pending',
                createdAt: user.created_at || user.createdAt || new Date().toISOString(),
                updatedAt: user.updated_at || user.updatedAt || new Date().toISOString(),
                expiresAt: user.authorization_expires_at || user.expires_at || user.expiresAt || undefined,
                maxUses: user.authorization_max_uses || user.max_uses || user.maxUses || undefined,
                usedCount: user.authorization_uses || user.uses || user.usedCount || 0,
                notes: user.authorization_notes ?
                  (Array.isArray(user.authorization_notes) ?
                    user.authorization_notes.map((note: any) => note.note || note.details || note).join(', ') :
                    String(user.authorization_notes)
                  ) : user.notes || undefined
              }));

              console.log('Dados mapeados:', mappedData.length);
              setAuthorizedUsers(mappedData);
            } else {
              // Dados j� est�o no formato correto
              setAuthorizedUsers(data);
            }
          } else {
            // Array vazio, definir como est�
            setAuthorizedUsers(data);
          }
        } else {
          console.error(t('components.formatoDeRespostaInesperadoParaUsuariosAutorizados'), typeof data);
          setError(t('components.formatoDeRespostaInesperadoEsperavaUmArrayDeUsuari'));
          setAuthorizedUsers([]);
        }
      } catch (parseError) {
        console.error(t('components.erroAoAnalisarRespostaJsonDeUsuariosAutorizados'), parseError);
        console.log('Primeiros 100 caracteres da resposta:', responseText.substring(0, 100));
        setError(t('components.erroAoProcessarDadosDeUsuariosAutorizadosFormatoIn'));
        setAuthorizedUsers([]);
      }
    } catch (error) {
      console.error(t('components.erroAoCarregarUsuariosAutorizados'), error);
      setError(t('components.erroAoCarregarUsuariosAutorizadosTenteNovamente'));
    } finally {
      setLoading(false);
    }
  };

  // Buscar estat�sticas
  const fetchStats = async () => {
    try {
      let token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error(t('components.tokenNaoEncontradoFacaLoginNovamente'));
      }

      // Tentar renovar o token antes de fazer a requisi��o
      try {
        console.log(t('components.tentandoRenovarTokenAntesDeBuscarEstatisticas'));
        const refreshResponse = await fetch('/api/auth/token-refresh', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          console.log(t('components.tokenRenovadoComSucessoAntesDeBuscarEstatisticas'));

          if (refreshData.token && refreshData.token !== token) {
            console.log('Atualizando token renovado no localStorage');
            localStorage.setItem('token', refreshData.token);
            // Remover o token antigo se existir
            localStorage.removeItem('abzToken');

            // Usar o novo token
            token = refreshData.token;
          }
        }
      } catch (refreshError) {
        console.error(t('components.erroAoRenovarTokenAntesDeBuscarEstatisticas'), refreshError);
      }

      console.log(t('components.buscandoEstatisticasComToken'), token?.substring(0, 10) + '...');

      const response = await fetch('/api/admin/access-stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log(t('components.respostaDaApiDeEstatisticas'), response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(t('components.erroAoBuscarEstatisticas'), errorData);

        // Se o erro for de token inv�lido, tentar corrigir o token
        if (response.status === 401) {
          console.log(t('components.tokenInvalidoOuExpiradoTentandoCorrigir'));
          try {
            // Tentar corrigir o token
            const fixResponse = await fetch('/api/auth/fix-token', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });

            if (fixResponse.ok) {
              const fixData = await fixResponse.json();
              console.log('Token corrigido com sucesso');

              if (fixData.token) {
                console.log('Usando novo token para tentar novamente');
                localStorage.setItem('token', fixData.token);
                localStorage.removeItem('abzToken');

                // Tentar novamente com o novo token
                const retryResponse = await fetch('/api/admin/access-stats', {
                  headers: {
                    'Authorization': `Bearer ${fixData.token}`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                  }
                });

                if (retryResponse.ok) {
                  const data = await retryResponse.json();
                  console.log(t('components.estatisticasRecebidasAposCorrecaoDeToken'), data);
                  setStats(data);
                  return;
                }
              }
            }
          } catch (fixError) {
            console.error('Erro ao tentar corrigir token:', fixError);
          }
        }

        // Se o erro for de acesso negado e o usu�rio for o administrador principal, redirecionar para a p�gina de corre��o
        if (response.status === 403 &&
            (user?.email === 'caio.correia@groupabz.com' || (user as any)?.phone_number === '+5522997847289')) {
          console.log(t('components.usuarioEOAdministradorPrincipalMasNaoTemAcessoAsEs'));
          router.push('/admin-fix');
          return;
        }

        throw new Error(errorData.error || t('components.erroAoCarregarEstatisticas'));
      }

      const data = await response.json();
      console.log(t('components.estatisticasRecebidas'), data);
      setStats(data);
    } catch (error) {
      console.error(t('components.erroAoCarregarEstatisticas'), error);
      // N�o mostrar o erro na interface para n�o confundir o usu�rio
      // Apenas registrar no console para depura��o
    }
  };

  // Fun��es para gerenciar usu�rios regulares
  const handleAddUser = () => {
    setSelectedUser(null);
    setIsNewUser(true);
    setShowEditor(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsNewUser(false);
    setShowEditor(true);
  };

  const handleDeleteConfirm = (user: User) => {
    setSelectedUser(user);
    setShowDeleteConfirm(true);
  };

  const handleViewHistory = (user: User) => {
    setSelectedUser(user);
    setShowAccessHistory(true);
  };

  const handleResetPassword = (user: User) => {
    setSelectedUser(user);
    setShowPasswordReset(true);
  };

  const handleManageRole = (user: User) => {
    setSelectedUser(user);
    setShowRoleManager(true);
  };

  const handleSaveUser = async (userData: UserEditorData, password?: string) => {
    try {
      setError(null);
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error(t('components.naoAutorizado'));
      }

      const method = isNewUser ? 'POST' : 'PUT';
      const url = isNewUser ? '/api/users' : `/api/users/${userData._id}`;

      // Debug: Log dos dados antes de enviar para a API
      const requestData = {
        ...userData,
        password
      };
      console.log('UnifiedUserManager - Dados sendo enviados para API:', JSON.stringify(requestData, null, 2));
      console.log('UnifiedUserManager - phoneNumber:', requestData.phoneNumber);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('components.erroAoSalvarUsuario'));
      }

      setSuccessMessage(`${t('components.usuario')} ${isNewUser ? t('components.criado') : t('components.atualizado')} ${t('components.comSucesso')}!`);
      setShowEditor(false);
      fetchUsers();

      // Limpar a mensagem após 3 segundos
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error(t('components.erroAoSalvarUsuario'), error);
      setError(`${t('components.erroAoSalvarUsuario')}: ${error instanceof Error ? error.message : t('components.erroDesconhecido')}`);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      setError(null);
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error(t('components.naoAutorizado'));
      }

      const response = await fetch(`/api/users/${selectedUser._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('components.erroAoExcluirUsuario'));
      }

      setSuccessMessage(t('components.usuarioExcluidoComSucesso'));
      setShowDeleteConfirm(false);
      fetchUsers();

      // Limpar a mensagem ap�s 3 segundos
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error(t('components.erroAoExcluirUsuario'), error);
      setError(`${t('components.erroAoExcluirUsuario')}: ${error instanceof Error ? error.message : t('components.erroDesconhecido')}`);
    }
  };

  // Fun��es para gerenciar usu�rios autorizados
  const handleAddAuthorizedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    try {
      let action = '';
      const payload: any = { notes };

      switch (formType) {
        case 'email':
          action = 'add_user';
          payload.email = email;
          break;
        case 'phone':
          action = 'add_user';
          payload.phoneNumber = phoneNumber;
          break;
        case 'domain':
          action = 'add_domain';
          payload.domain = domain;
          break;
        case 'invite':
          action = 'generate_invite';
          // Adicionar configura��es de expira��o se fornecidas
          if (expiryDays) payload.expiryDays = expiryDays;
          if (maxUses) payload.maxUses = maxUses;
          break;
      }

      payload.action = action;

      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error(t('components.tokenNaoEncontradoFacaLoginNovamente'));
      }

      const response = await fetch('/api/admin/authorized-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || t('components.erroAoAdicionarUsuarioAutorizado'));
      }

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(result.message);

        // Se for c�digo de convite, mostrar o c�digo gerado
        if (formType === 'invite' && result.inviteCode) {
          setGeneratedInviteCode(result.inviteCode);

          // Se tiver email para enviar o convite
          if (inviteEmail && result.inviteCode && result.expiresAt) {
            // Enviar email com o c�digo de convite
            const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

            if (!token) {
              throw new Error(t('components.tokenNaoEncontradoFacaLoginNovamente'));
            }

            const emailResponse = await fetch('/api/admin/send-invite', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                email: inviteEmail,
                inviteCode: result.inviteCode,
                expiresAt: result.expiresAt,
                maxUses: result.maxUses || 1
              })
            });

            if (emailResponse.ok) {
              setSuccessMessage(`${result.message} Email enviado para ${inviteEmail}.`);
            } else {
              setSuccessMessage(`${result.message} Mas houve um erro ao enviar o email.`);
            }
          }
        }

        // Limpar formul�rio
        setEmail('');
        setPhoneNumber('');
        setDomain('');
        setNotes('');
        setExpiryDays('');
        setMaxUses('');
        setInviteEmail('');

        // Atualizar lista
        fetchAuthorizedUsers();
        fetchStats();
      } else {
        setError(result.message || t('components.erroAoAdicionarUsuarioAutorizado'));
      }
    } catch (error) {
      console.error(t('components.erroAoAdicionarUsuarioAutorizado'), error);
      setError(t('components.erroAoAdicionarUsuarioAutorizadoTenteNovamente'));
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error(t('components.tokenNaoEncontradoFacaLoginNovamente'));
      }

      const response = await fetch('/api/admin/authorized-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'approve',
          id
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || t('components.erroAoAprovarUsuario'));
      }

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(t('components.usuarioAprovadoComSucesso'));
        fetchAuthorizedUsers();
        fetchStats();
      } else {
        setError(result.message || t('components.erroAoAprovarUsuario'));
      }
    } catch (error) {
      console.error(t('components.erroAoAprovarUsuario'), error);
      setError(t('components.erroAoAprovarUsuarioTenteNovamente'));
    }
  };

  const openRejectModal = (id: string) => {
    setSelectedUserId(id);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error(t('components.tokenNaoEncontradoFacaLoginNovamente'));
      }

      const response = await fetch('/api/admin/authorized-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'reject',
          id: selectedUserId,
          reason: rejectReason
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || t('components.erroAoRejeitarUsuario'));
      }

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(t('components.usuarioRejeitadoComSucesso'));
        setShowRejectModal(false);
        fetchAuthorizedUsers();
        fetchStats();
      } else {
        setError(result.message || t('components.erroAoRejeitarUsuario'));
      }
    } catch (error) {
      console.error(t('components.erroAoRejeitarUsuario'), error);
      setError(t('components.erroAoRejeitarUsuarioTenteNovamente'));
    }
  };

  const handleDeleteAuthorizedUser = async (id: string) => {
    if (!confirm(t('components.temCertezaQueDesejaExcluirEsteUsuarioAutorizado'))) {
      return;
    }

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error(t('components.tokenNaoEncontradoFacaLoginNovamente'));
      }

      const response = await fetch(`/api/admin/authorized-users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || t('components.erroAoExcluirUsuarioAutorizado'));
      }

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(t('components.usuarioAutorizadoExcluidoComSucesso'));
        fetchAuthorizedUsers();
        fetchStats();
      } else {
        setError(result.message || t('components.erroAoExcluirUsuarioAutorizado'));
      }
    } catch (error) {
      console.error(t('components.erroAoExcluirUsuarioAutorizado'), error);
      setError(t('components.erroAoExcluirUsuarioAutorizadoTenteNovamente'));
    }
  };

  const handleApproveUser = async (userId: string) => {
    const token = localStorage.getItem('token') || localStorage.getItem('abzToken');
    if (!token) {
      setError(t('components.tokenDeAutenticacaoNaoEncontrado'));
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      setSuccessMessage(t('components.usuarioAprovadoComSucesso'));
      await fetchUsers();
      await fetchStats();
    } catch (err) {
      console.error(t('components.erroAoAprovarUsuario'), err);
      setError(err instanceof Error ? err.message : t('components.erroAoAprovarUsuario'));
    }
  };

  const handleRejectUser = async (userId: string) => {
    const token = localStorage.getItem('token') || localStorage.getItem('abzToken');
    if (!token) {
      setError(t('components.tokenDeAutenticacaoNaoEncontrado'));
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      setSuccessMessage(t('components.usuarioRejeitado'));
      await fetchUsers();
      await fetchStats();
    } catch (err) {
      console.error(t('components.erroAoRejeitarUsuario'), err);
      setError(err instanceof Error ? err.message : t('components.erroAoRejeitarUsuario'));
    }
  };

  // Fun��es auxiliares
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAuthorizationTypeIcon = (user: AuthorizedUser) => {
    if (user.email) return <FiMail className="text-blue-500" />;
    if (user.phoneNumber) return <FiPhone className="text-green-500" />;
    if (user.domain) return <FiGlobe className="text-purple-500" />;
    if (user.inviteCode) return <FiKey className="text-yellow-500" />;
    return null;
  };

  const getAuthorizationTypeText = (user: AuthorizedUser) => {
    if (user.email) return `Email: ${user.email}`;
    if (user.phoneNumber) return `Telefone: ${user.phoneNumber}`;
    if (user.domain) return t('components.dominioUserdomain');
    if (user.inviteCode) return t('components.codigoDeConviteUserinvitecode');
    return 'Desconhecido';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Ativo</span>;
      case 'pending':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pendente</span>;
      case 'rejected':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Rejeitado</span>;
      case 'expired':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Expirado</span>;
      default:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  // Renderiza��o do componente
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Abas */}
      <div className="flex justify-between mb-6">
        <div>
          <button
            onClick={fixToken}
            disabled={isFixingToken}
            className={`flex items-center px-4 py-2 rounded-md ${isFixingToken ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white`}
          >
            <FiRefreshCw className={`mr-2 ${isFixingToken ? 'animate-spin' : ''}`} />
            {isFixingToken ? 'Corrigindo Token...' : 'Corrigir Token de Acesso'}
          </button>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center px-4 py-2 rounded-md ${activeTab === 'users' ? 'bg-abz-blue text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            <FiUser className="mr-2" />
            Usu�rios
          </button>
          <button
            onClick={() => setActiveTab('authorized')}
            className={`flex items-center px-4 py-2 rounded-md ${activeTab === 'authorized' ? 'bg-abz-blue text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            <FiUserCheck className="mr-2" />
            Autoriza��es
          </button>
        </div>
      </div>

      {/* Mensagens de sucesso e erro */}
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md mb-4 flex items-center">
          <FiCheck className="mr-2 flex-shrink-0 h-5 w-5" />
          <div>
            <p className="font-bold">Sucesso</p>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-4 flex items-center">
          <FiAlertCircle className="mr-2 flex-shrink-0 h-5 w-5" />
          <div>
            <p className="font-bold">Erro</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Conte�do da aba de usu�rios */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-wrap justify-between items-center mb-6">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="relative mr-2">
                <input
                  type="text"
                  placeholder={t('components.buscarUsuarios')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-abz-blue focus:border-abz-blue w-full md:w-64"
                />
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
              <button
                onClick={() => {
                  console.log(t('components.atualizandoListaDeUsuariosManualmente'));
                  fetchUsers();
                }}
                className="flex items-center px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                title={t('admin.refreshUserList', 'Atualizar lista de usu�rios')}
              >
                <FiRefreshCw className="mr-1" />
                {t('common.refresh', 'Atualizar')}
              </button>
            </div>

            <button
              onClick={handleAddUser}
              className="flex items-center px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark transition-colors"
            >
              <FiPlus className="mr-2" />
              {t('userEditor.newUser', 'Novo Usu�rio')}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contato
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fun��o
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Autoriza��o
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Criado em
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    A��es
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                      Nenhum usu�rio encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    console.log(t('components.renderizandoUsuarioUserfirstnameUserlastnameUserid'));
                    return (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-abz-blue rounded-full flex items-center justify-center text-white">
                            {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.department || 'Sem departamento'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.phoneNumber}</div>
                        {user.email && <div className="text-sm text-gray-500">{user.email}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {user.role === 'ADMIN' ? 'Administrador' : user.role === 'MANAGER' ? 'Gerente' : t('components.usuario')}
                        </div>
                        <div className="text-sm text-gray-500">{user.position || 'N�o definido'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {user.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.authorizationStatus ? (
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.authorizationStatus === 'active' ? 'bg-green-100 text-green-800' :
                              user.authorizationStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {user.authorizationStatus === 'active' ? 'Autorizado' :
                               user.authorizationStatus === 'pending' ? 'Pendente' :
                               'Rejeitado'}
                            </span>
                            {user.authorizationStatus === 'pending' && (
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => handleApproveUser(user._id)}
                                  className="inline-flex items-center px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md transition-colors"
                                  title={t('components.aprovarUsuario')}
                                >
                                  <FiCheck className="w-3 h-3 mr-1" />
                                  Aprovar
                                </button>
                                <button
                                  onClick={() => handleRejectUser(user._id)}
                                  className="inline-flex items-center px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors"
                                  title={t('components.rejeitarUsuario')}
                                >
                                  <FiX className="w-3 h-3 mr-1" />
                                  Rejeitar
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleViewHistory(user)}
                            className="text-gray-600 hover:text-abz-blue"
                            title={t('components.verHistoricoDeAcesso')}
                          >
                            <FiClock />
                          </button>
                          <button
                            onClick={() => handleResetPassword(user)}
                            className="text-gray-600 hover:text-abz-blue"
                            title="Redefinir senha"
                          >
                            <FiKey />
                          </button>
                          <button
                            onClick={() => handleManageRole(user)}
                            className="text-gray-600 hover:text-abz-blue"
                            title="Gerenciar papel/fun��o"
                          >
                            <FiShield />
                          </button>
                          <button
                            onClick={() => handleEditUser(user)}
                            className="text-gray-600 hover:text-abz-blue"
                            title={t('components.editarUsuario')}
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            onClick={() => handleDeleteConfirm(user)}
                            className="text-gray-600 hover:text-red-600"
                            title={t('components.excluirUsuario')}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conte�do da aba de usu�rios autorizados */}
      {activeTab === 'authorized' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Estat�sticas */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-700">Usu�rios</h3>
                <div className="mt-2 space-y-1">
                  <p className="text-sm">Total: <span className="font-bold">{stats.users.total}</span></p>
                  <p className="text-sm">Ativos: <span className="font-bold">{stats.users.active}</span></p>
                  <p className="text-sm">Novos (30 dias): <span className="font-bold">{stats.users.newLast30Days}</span></p>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-green-700">Autoriza��es</h3>
                <div className="mt-2 space-y-1">
                  <p className="text-sm">Email: <span className="font-bold">{stats.authorizations.email}</span></p>
                  <p className="text-sm">Telefone: <span className="font-bold">{stats.authorizations.phone}</span></p>
                  <p className="text-sm">Dom�nio: <span className="font-bold">{stats.authorizations.domain}</span></p>
                  <p className="text-sm">Convite: <span className="font-bold">{stats.authorizations.inviteCode}</span></p>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-yellow-700">Solicita��es</h3>
                <div className="mt-2 space-y-1">
                  <p className="text-sm">Pendentes: <span className="font-bold">{stats.authorizations.pending}</span></p>
                  <p className="text-sm">Rejeitadas: <span className="font-bold">{stats.authorizations.rejected}</span></p>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-purple-700">Departamentos</h3>
                <div className="mt-2 space-y-1">
                  {stats.departments.slice(0, 3).map((dept, index) => (
                    <p key={index} className="text-sm">{dept.name}: <span className="font-bold">{dept.count}</span></p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bot�es de a��o */}
          <div className="flex flex-wrap justify-between items-center mb-6">
            <div className="flex space-x-2 mb-2 sm:mb-0">
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  setGeneratedInviteCode('');
                  setSuccessMessage('');
                  setError('');
                }}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <FiPlus className="mr-2" />
                {showAddForm ? t('common.cancel', 'Cancelar') : t('common.add', 'Adicionar')}
              </button>

              <button
                onClick={() => {
                  fetchAuthorizedUsers();
                  fetchStats();
                }}
                className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                <FiRefreshCw className="mr-2" />
                {t('common.refresh', 'Atualizar')}
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <FiFilter className="text-gray-500" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="pending">Pendentes</option>
                <option value="rejected">Rejeitados</option>
              </select>
            </div>
          </div>

          {/* Formul�rio de adi��o */}
          {showAddForm && (
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="text-lg font-semibold mb-4">Adicionar Autoriza��o</h3>

              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setFormType('email')}
                  className={`flex items-center px-3 py-2 rounded-md ${formType === 'email' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  <FiMail className="mr-2" />
                  Email
                </button>

                <button
                  onClick={() => setFormType('phone')}
                  className={`flex items-center px-3 py-2 rounded-md ${formType === 'phone' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  <FiPhone className="mr-2" />
                  Telefone
                </button>

                <button
                  onClick={() => setFormType('domain')}
                  className={`flex items-center px-3 py-2 rounded-md ${formType === 'domain' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  <FiGlobe className="mr-2" />
                  Dom�nio
                </button>

                <button
                  onClick={() => setFormType('invite')}
                  className={`flex items-center px-3 py-2 rounded-md ${formType === 'invite' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  <FiKey className="mr-2" />
                  C�digo de Convite
                </button>
              </div>

              <form onSubmit={handleAddAuthorizedUser} className="space-y-4">
                {formType === 'email' && (
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="usuario@exemplo.com"
                    />
                  </div>
                )}

                {formType === 'phone' && (
                  <div>
                    <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      N�mero de Telefone
                    </label>
                    <input
                      type="tel"
                      id="phoneNumber"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+5511999999999"
                    />
                  </div>
                )}

                {formType === 'domain' && (
                  <div>
                    <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
                      Dom�nio
                    </label>
                    <input
                      type="text"
                      id="domain"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="exemplo.com"
                    />
                  </div>
                )}

                {formType === 'invite' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label htmlFor="expiryDays" className="block text-sm font-medium text-gray-700 mb-1">
                          Dias at� Expira��o (opcional)
                        </label>
                        <input
                          type="number"
                          id="expiryDays"
                          value={expiryDays}
                          onChange={(e) => setExpiryDays(e.target.value)}
                          min="1"
                          max="365"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="30"
                        />
                      </div>
                      <div>
                        <label htmlFor="maxUses" className="block text-sm font-medium text-gray-700 mb-1">
                          N�mero M�ximo de Usos (opcional)
                        </label>
                        <input
                          type="number"
                          id="maxUses"
                          value={maxUses}
                          onChange={(e) => setMaxUses(e.target.value)}
                          min="1"
                          max="100"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="1"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-700 mb-1">
                        Enviar Convite por Email (opcional)
                      </label>
                      <input
                        type="email"
                        id="inviteEmail"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="usuario@exemplo.com"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Se preenchido, o c�digo de convite ser� enviado para este email
                      </p>
                    </div>

                    {generatedInviteCode && (
                      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md mt-4">
                        <p className="font-semibold mb-2">C�digo de Convite Gerado:</p>
                        <div className="bg-white p-3 rounded border border-yellow-300 text-center">
                          <span className="text-xl font-mono font-bold tracking-wider">{generatedInviteCode}</span>
                        </div>
                        <p className="text-sm mt-2 text-yellow-700">
                          Compartilhe este c�digo com o usu�rio que voc� deseja convidar.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {formType !== 'invite' || !generatedInviteCode ? (
                  <>
                    <div>
                      <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                        Observa��es (opcional)
                      </label>
                      <textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('components.adicioneInformacoesRelevantesSobreEstaAutorizacao')}
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        {formType === 'invite' ? t('components.gerarCodigo') : 'Adicionar'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setGeneratedInviteCode('');
                        setSuccessMessage('');
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Gerar Outro C�digo
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Lista de usu�rios autorizados */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Identifica��o
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data de Cria��o
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expira��o / Usos
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    A��es
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                ) : authorizedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      Nenhum usu�rio autorizado encontrado.
                    </td>
                  </tr>
                ) : (
                  authorizedUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getAuthorizationTypeIcon(user)}
                          <span className="ml-2 text-sm text-gray-900">
                            {user.email ? 'Email' : user.phoneNumber ? 'Telefone' : user.domain ? t('components.dominio') : 'Convite'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getAuthorizationTypeText(user)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(user.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.inviteCode && (
                          <div>
                            {user.expiresAt && (
                              <div className="mb-1">
                                <span className="font-medium">Expira:</span> {formatDate(user.expiresAt)}
                              </div>
                            )}
                            {user.maxUses && (
                              <div>
                                <span className="font-medium">Usos:</span> {user.usedCount || 0}/{user.maxUses}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {user.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(user._id)}
                                className="text-green-600 hover:text-green-900"
                                title="Aprovar"
                              >
                                <FiCheck className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => openRejectModal(user._id)}
                                className="text-red-600 hover:text-red-900"
                                title="Rejeitar"
                              >
                                <FiX className="h-5 w-5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteAuthorizedUser(user._id)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Excluir"
                          >
                            <FiTrash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modais */}
      {showEditor && selectedUser && (
        <UserEditor
          user={{
            _id: selectedUser._id,
            phoneNumber: selectedUser.phoneNumber,
            firstName: selectedUser.firstName,
            lastName: selectedUser.lastName,
            email: selectedUser.email,
            role: selectedUser.role,
            position: selectedUser.position,
            department: selectedUser.department
          }}
          onSave={handleSaveUser}
          onCancel={() => setShowEditor(false)}
          isNew={false}
        />
      )}

      {showEditor && isNewUser && (
        <UserEditor
          user={{
            phoneNumber: '',
            firstName: '',
            lastName: '',
            email: '',
            role: 'USER',
            position: '',
            department: ''
          }}
          onSave={handleSaveUser}
          onCancel={() => setShowEditor(false)}
          isNew={true}
        />
      )}

      {showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">{t('common.confirmDelete', 'Confirmar Exclus�o')}</h3>
            <p className="mb-4">
              {t('admin.users.confirmDeleteMessage', 'Tem certeza que deseja excluir o usu�rio')} <strong>{selectedUser.firstName} {selectedUser.lastName}</strong>? t('admin.users.actionCannotBeUndone', 'Esta a��o n�o pode ser desfeita.')
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                {t('common.cancel', 'Cancelar')}
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                {t('common.delete', 'Excluir')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAccessHistory && selectedUser && (
        <UserAccessHistory
          userId={selectedUser._id}
          userName={`${selectedUser.firstName} ${selectedUser.lastName}`}
          onClose={() => setShowAccessHistory(false)}
        />
      )}

      {showPasswordReset && selectedUser && (
        <UserPasswordReset
          userId={selectedUser._id}
          userName={`${selectedUser.firstName} ${selectedUser.lastName}`}
          onClose={() => setShowPasswordReset(false)}
          onSuccess={() => {
            setShowPasswordReset(false);
            // Opcional: recarregar dados do usu�rio
          }}
        />
      )}

      {showRoleManager && selectedUser && (
        <UserRoleManager
          userId={selectedUser._id}
          userName={`${selectedUser.firstName} ${selectedUser.lastName}`}
          currentRole={selectedUser.role}
          onClose={() => setShowRoleManager(false)}
          onRoleUpdated={() => {
            setShowRoleManager(false);
            fetchUsers();
          }}
        />
      )}

      {/* Modal de rejei��o */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Rejeitar Solicita��o</h3>

            <div className="mb-4">
              <label htmlFor="rejectReason" className="block text-sm font-medium text-gray-700 mb-1">
                Motivo da Rejei��o
              </label>
              <textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('components.informeOMotivoDaRejeicao')}
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Rejeitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
