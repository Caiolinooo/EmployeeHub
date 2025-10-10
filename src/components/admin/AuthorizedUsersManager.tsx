'use client';

import { useState, useEffect } from 'react';
import { FiPlus, FiCheck, FiX, FiMail, FiPhone, FiGlobe, FiKey, FiRefreshCw, FiFilter, FiTrash2, FiAlertCircle } from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';

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

export default function AuthorizedUsersManager() {
  const { user } = useSupabaseAuth();
  const { t } = useI18n();
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>([]);
  const [stats, setStats] = useState<AuthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
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
  const [successMessage, setSuccessMessage] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  // Carregar usuários autorizados
  useEffect(() => {
    if (user) {
      fetchAuthorizedUsers();
      fetchStats();
    }
  }, [user, filter]);

  const fetchAuthorizedUsers = async () => {
    setLoading(true);
    try {
      let url = '/api/admin/authorized-users';
      if (filter !== 'all') {
        url += `?status=${filter}`;
      }

      // Obter o token do localStorage
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error({t('components.tokenNaoEncontradoFacaLoginNovamente')});
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || {t('components.erroAoCarregarUsuariosAutorizados')});
      }

      const data = await response.json();
      setAuthorizedUsers(data);
    } catch (error) {
      console.error({t('components.erroAoCarregarUsuariosAutorizados')}, error);
      setError({t('components.erroAoCarregarUsuariosAutorizadosTenteNovamente')});
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Obter o token do localStorage
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error({t('components.tokenNaoEncontradoFacaLoginNovamente')});
      }

      const response = await fetch('/api/admin/access-stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || {t('components.erroAoCarregarEstatisticas')});
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error({t('components.erroAoCarregarEstatisticas')}, error);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    console.log('Iniciando adição de usuário/código:', formType);

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
          // Adicionar configurações de expiração se fornecidas
          if (expiryDays) payload.expiryDays = expiryDays;
          if (maxUses) payload.maxUses = maxUses;
          break;
      }

      payload.action = action;

      console.log({t('components.enviandoSolicitacaoParaApi')}, payload);

      // Obter o token do localStorage
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error({t('components.tokenNaoEncontradoFacaLoginNovamente')});
      }

      const response = await fetch('/api/admin/authorized-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      console.log('Status da resposta:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error('Resposta de erro da API:', errorData);
        throw new Error(errorData.error || {t('components.erroAoAdicionarUsuarioAutorizado')});
      }

      const result = await response.json();
      console.log('Resultado da API:', result);

      if (result.success) {
        setSuccessMessage(result.message);

        // Se for código de convite, mostrar o código gerado
        if (formType === 'invite' && result.inviteCode) {
          setGeneratedInviteCode(result.inviteCode);

          // Se tiver email para enviar o convite
          if (inviteEmail && result.inviteCode && result.expiresAt) {
            // Enviar email com o código de convite
            // Obter o token do localStorage
            const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

            if (!token) {
              throw new Error({t('components.tokenNaoEncontradoFacaLoginNovamente')});
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

        // Limpar formulário
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
        setError(result.message || {t('components.erroAoAdicionarUsuarioAutorizado')});
      }
    } catch (error) {
      console.error({t('components.erroAoAdicionarUsuarioAutorizado')}, error);
      setError({t('components.erroAoAdicionarUsuarioAutorizadoTenteNovamente')});
    }
  };

  const handleApprove = async (id: string) => {
    try {
      // Obter o token do localStorage
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error({t('components.tokenNaoEncontradoFacaLoginNovamente')});
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
        throw new Error(errorData.error || {t('components.erroAoAprovarUsuario')});
      }

      const result = await response.json();

      if (result.success) {
        setSuccessMessage({t('components.usuarioAprovadoComSucesso')});
        fetchAuthorizedUsers();
        fetchStats();
      } else {
        setError(result.message || {t('components.erroAoAprovarUsuario')});
      }
    } catch (error) {
      console.error({t('components.erroAoAprovarUsuario')}, error);
      setError({t('components.erroAoAprovarUsuarioTenteNovamente')});
    }
  };

  const openRejectModal = (id: string) => {
    setSelectedUserId(id);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    try {
      // Obter o token do localStorage
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error({t('components.tokenNaoEncontradoFacaLoginNovamente')});
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
        throw new Error(errorData.error || {t('components.erroAoRejeitarUsuario')});
      }

      const result = await response.json();

      if (result.success) {
        setSuccessMessage({t('components.usuarioRejeitadoComSucesso')});
        setShowRejectModal(false);
        fetchAuthorizedUsers();
        fetchStats();
      } else {
        setError(result.message || {t('components.erroAoRejeitarUsuario')});
      }
    } catch (error) {
      console.error({t('components.erroAoRejeitarUsuario')}, error);
      setError({t('components.erroAoRejeitarUsuarioTenteNovamente')});
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm({t('components.temCertezaQueDesejaExcluirEsteUsuarioAutorizado')})) {
      return;
    }

    try {
      console.log({t('components.excluindoUsuarioAutorizadoComIdId')});
      // Obter o token do localStorage
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error({t('components.tokenNaoEncontradoFacaLoginNovamente')});
      }

      const response = await fetch(`/api/admin/authorized-users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Status da resposta:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error('Resposta de erro da API:', errorData);
        throw new Error(errorData.error || {t('components.erroAoExcluirUsuarioAutorizado')});
      }

      const result = await response.json();
      console.log('Resultado da API:', result);

      if (result.success) {
        setSuccessMessage({t('components.usuarioAutorizadoExcluidoComSucesso')});
        fetchAuthorizedUsers();
        fetchStats();
      } else {
        setError(result.message || {t('components.erroAoExcluirUsuarioAutorizado')});
      }
    } catch (error) {
      console.error({t('components.erroAoExcluirUsuarioAutorizado')}, error);
      setError({t('components.erroAoExcluirUsuarioAutorizadoTenteNovamente')});
    }
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
    if (user.domain) return {t('components.dominioUserdomain')};
    if (user.inviteCode) return {t('components.codigoDeConviteUserinvitecode')};
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6">Gerenciamento de Usuários Autorizados</h2>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-700">Usuários</h3>
            <div className="mt-2 space-y-1">
              <p className="text-sm">Total: <span className="font-bold">{stats.users.total}</span></p>
              <p className="text-sm">Ativos: <span className="font-bold">{stats.users.active}</span></p>
              <p className="text-sm">Novos (30 dias): <span className="font-bold">{stats.users.newLast30Days}</span></p>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-700">Autorizações</h3>
            <div className="mt-2 space-y-1">
              <p className="text-sm">Email: <span className="font-bold">{stats.authorizations.email}</span></p>
              <p className="text-sm">Telefone: <span className="font-bold">{stats.authorizations.phone}</span></p>
              <p className="text-sm">Domínio: <span className="font-bold">{stats.authorizations.domain}</span></p>
              <p className="text-sm">Convite: <span className="font-bold">{stats.authorizations.inviteCode}</span></p>
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-yellow-700">Solicitações</h3>
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

      {/* Botões de ação */}
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

      {/* Formulário de adição */}
      {showAddForm && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('admin.addAuthorization', 'Adicionar Autorização')}</h3>

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
              Domínio
            </button>

            <button
              onClick={() => setFormType('invite')}
              className={`flex items-center px-3 py-2 rounded-md ${formType === 'invite' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              <FiKey className="mr-2" />
              Código de Convite
            </button>
          </div>

          <form onSubmit={handleAddUser} className="space-y-4">
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
                  Número de Telefone
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
                  Domínio
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
                      Dias até Expiração (opcional)
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
                      Número Máximo de Usos (opcional)
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
                    Se preenchido, o código de convite será enviado para este email
                  </p>
                </div>

                {generatedInviteCode && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md mt-4">
                    <p className="font-semibold mb-2">Código de Convite Gerado:</p>
                    <div className="bg-white p-3 rounded border border-yellow-300 text-center">
                      <span className="text-xl font-mono font-bold tracking-wider">{generatedInviteCode}</span>
                    </div>
                    <p className="text-sm mt-2 text-yellow-700">
                      Compartilhe este código com o usuário que você deseja convidar.
                    </p>
                  </div>
                )}
              </>
            )}

            {formType !== 'invite' || !generatedInviteCode ? (
              <>
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Observações (opcional)
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
                    {formType === 'invite' ? t('admin.generateCode', 'Gerar Código') : t('common.add', 'Adicionar')}
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
                  Gerar Outro Código
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Lista de usuários autorizados */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Identificação
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data de Criação
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expiração / Usos
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : authorizedUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  Nenhum usuário autorizado encontrado.
                </td>
              </tr>
            ) : (
              authorizedUsers.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getAuthorizationTypeIcon(user)}
                      <span className="ml-2 text-sm text-gray-900">
                        {user.email ? 'Email' : user.phoneNumber ? 'Telefone' : user.domain ? {t('components.dominio')} : 'Convite'}
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
                        onClick={() => handleDelete(user._id)}
                        className="text-gray-600 hover:text-gray-900"
                        title={t('common.delete', 'Excluir')}
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

      {/* Modal de rejeição */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Rejeitar Solicitação</h3>

            <div className="mb-4">
              <label htmlFor="rejectReason" className="block text-sm font-medium text-gray-700 mb-1">
                Motivo da Rejeição
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
                {t('common.cancel', 'Cancelar')}
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
