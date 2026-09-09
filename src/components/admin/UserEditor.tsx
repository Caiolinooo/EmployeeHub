'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiSave, FiX, FiUser, FiMail, FiPhone, FiBriefcase, FiUsers, FiPlus, FiTrash2, FiDollarSign, FiShield, FiImage, FiVolume2, FiUpload } from 'react-icons/fi';
import { AccessPermissions } from '@/models/User';
import ServerUserReimbursementSettings from './ServerUserReimbursementSettings';
import ReimbursementPermissionsEditor from './ReimbursementPermissionsEditor';
import ACLPermissionTreeSelector from './ACLPermissionTreeSelector';
import { useI18n } from '@/contexts/I18nContext';
import { supabase } from '@/lib/supabase';
import { Sector } from '@/types/index';
import { useACLPermissions } from '@/hooks/useACLPermissions';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { QHSE_MODULE_KEY } from '@/lib/document-catalog/permissions';
import { getFullPermissionsForRole, getModuleKeyForCatalogFeature } from '@/config/modules';
import CollaboratorDocumentsCatalog from './CollaboratorDocumentsCatalog';
import CatalogFeatureToggles from './CatalogFeatureToggles';

// Interface para o usuário no editor
export interface UserEditorData {
  _id?: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  role: 'ADMIN' | 'USER' | 'MANAGER';
  position?: string;
  department?: string;
  sector_id?: string;
  startup_splash_enabled?: boolean;
  startup_splash_url?: string;
  startup_sound_enabled?: boolean;
  startup_sound_url?: string;
  accessPermissions?: AccessPermissions;
  reimbursement_email_settings?: {
    enabled: boolean;
    recipients: string[];
  };
}

interface UserEditorProps {
  user?: UserEditorData;
  onSave: (user: UserEditorData, password?: string) => void;
  onCancel: () => void;
  isNewUser?: boolean;
  isNew?: boolean;
  isModal?: boolean;
}

const UserEditor: React.FC<UserEditorProps> = ({
  user,
  onSave,
  onCancel,
  isNewUser = false,
  isModal = true
}) => {
  const { t } = useI18n();
  const { hasAccess, user: sessionUser, refreshProfile } = useSupabaseAuth();
  const showQhseSection = hasAccess(QHSE_MODULE_KEY);
  const defaultUser: UserEditorData = {
    phoneNumber: '',
    firstName: '',
    lastName: '',
    email: '',
    role: 'USER',
    position: '',
    department: '',
    startup_splash_enabled: false,
    startup_splash_url: '',
    startup_sound_enabled: false,
    startup_sound_url: '',
    accessPermissions: {
      modules: getFullPermissionsForRole('USER'),
      features: {}
    },
    reimbursement_email_settings: {
      enabled: false,
      recipients: []
    }
  };

  const [editedUser, setEditedUser] = useState<UserEditorData>(() => {
    const initial = user ? { ...user } : defaultUser;
    console.log('[DEBUG UserEditor] Initializing editedUser state:', {
      from_user: !!user,
      sector_id: initial.sector_id,
      department: initial.department
    });
    return initial;
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPermissions, setShowPermissions] = useState(false);
  const [showReimbursementSettings, setShowReimbursementSettings] = useState(false);
  const [showACLPermissions, setShowACLPermissions] = useState(false);
  const [loadingModules, setLoadingModules] = useState(false);
  const [selectedACLPermissions, setSelectedACLPermissions] = useState<string[]>([]);
  const [roleACLPermissions, setRoleACLPermissions] = useState<string[]>([]);

  // State for available sectors
  const [availableSectors, setAvailableSectors] = useState<Sector[]>([]);

  // Sincronizar editedUser quando a prop user mudar
  useEffect(() => {
    if (user) {
      setEditedUser({
        ...defaultUser,
        ...user,
        startup_splash_enabled: user.startup_splash_enabled !== undefined ? user.startup_splash_enabled : false,
        startup_splash_url: user.startup_splash_url || '',
        startup_sound_enabled: user.startup_sound_enabled !== undefined ? user.startup_sound_enabled : false,
        startup_sound_url: user.startup_sound_url || '',
        accessPermissions: user.accessPermissions || defaultUser.accessPermissions,
        reimbursement_email_settings: user.reimbursement_email_settings || defaultUser.reimbursement_email_settings
      });
    } else {
      setEditedUser(defaultUser);
    }
  }, [user]);

  // DEBUG: Log initial user prop
  useEffect(() => {
    console.log('[DEBUG UserEditor] Initial user prop:', {
      user_id: user?._id,
      sector_id: user?.sector_id,
      department: user?.department,
      firstName: user?.firstName,
      lastName: user?.lastName,
      startup_splash_enabled: user?.startup_splash_enabled,
      startup_splash_url: user?.startup_splash_url,
      startup_sound_enabled: user?.startup_sound_enabled,
      startup_sound_url: user?.startup_sound_url
    });
  }, [user]);

  // DEBUG: Log quando editedUser mudar
  useEffect(() => {
    console.log('[DEBUG UserEditor] editedUser changed:', {
      sector_id: editedUser.sector_id,
      department: editedUser.department
    });
  }, [editedUser.sector_id, editedUser.department]);


  // Estado para módulos disponíveis (carregados dinamicamente)
  const [availableModules, setAvailableModules] = useState<Array<{ id: string, label: string, description: string }>>([]);
  const [rolePermissions, setRolePermissions] = useState<any>({});

  // Hook para gerenciar permissões ACL
  const {
    permissions: userACLPermissions,
    loading: loadingACL,
    loadUserPermissions,
    grantPermission,
    revokePermission
  } = useACLPermissions(editedUser._id || '');

  // Carregar permissões do usuário
  useEffect(() => {
    if (editedUser._id) {
      loadUserPermissions(editedUser._id);
    }
  }, [editedUser._id, loadUserPermissions]);

  // Sincronizar as permissões carregadas com o estado local para edição offline
  useEffect(() => {
    if (userACLPermissions) {
      const individualIds = userACLPermissions.individual_permissions
        .filter((up: any) => !up.is_expired)
        .map((up: any) => up.permission.id) || [];
      setSelectedACLPermissions(individualIds);

      const roleIds = userACLPermissions.role_permissions
        .map((rp: any) => rp.permission.id) || [];
      setRoleACLPermissions(roleIds);
      console.log('[UserEditor] Loaded ACL permissions into state:', {
        individualCount: individualIds.length,
        roleCount: roleIds.length
      });
    }
  }, [userACLPermissions]);

  // Carregar módulos disponíveis e permissões por role
  useEffect(() => {
    const loadModulesAndPermissions = async () => {
      try {
        setLoadingModules(true);

        // Carregar módulos disponíveis
        const modulesResponse = await fetch('/api/admin/available-modules');
        const modules = await modulesResponse.json();
        setAvailableModules(modules);

        // Carregar permissões por role
        const permissionsResponse = await fetch('/api/admin/role-permissions');
        const permissions = await permissionsResponse.json();
        setRolePermissions(permissions);

        // Carregar setores via API (uses admin client to bypass RLS)
        const sectorsResponse = await fetch('/api/sectors');
        if (sectorsResponse.ok) {
          const sectorsData = await sectorsResponse.json();
          console.log('[DEBUG UserEditor] Sectors loaded:', sectorsData);
          setAvailableSectors(sectorsData as Sector[]);
        } else {
          console.error('Failed to fetch sectors:', await sectorsResponse.text());
        }

      } catch (error) {
        console.error(t('components.erroAoCarregarModulosEPermissoes'), error);
      } finally {
        setLoadingModules(false);
      }
    };

    loadModulesAndPermissions();
  }, []);

  // Sincronizar sector_id quando os setores são carregados e o usuário tem um setor definido
  // Isso garante que o dropdown exiba corretamente o setor previamente cadastrado
  useEffect(() => {
    console.log('[DEBUG UserEditor] Sync effect triggered:', {
      user_sector_id: user?.sector_id,
      availableSectors_count: availableSectors.length,
      availableSectors: availableSectors.map(s => ({ id: s.id, name: s.name })),
      editedUser_sector_id: editedUser.sector_id
    });

    if (user?.sector_id && availableSectors.length > 0) {
      // Verifica se o sector_id do usuário existe nos setores disponíveis
      const sectorExists = availableSectors.some(s => s.id === user.sector_id);
      console.log('[DEBUG UserEditor] Sector exists check:', {
        user_sector_id: user.sector_id,
        sectorExists,
        matchingSector: availableSectors.find(s => s.id === user.sector_id)
      });

      if (sectorExists) {
        setEditedUser(prev => {
          const newState = {
            ...prev,
            sector_id: user.sector_id,
            department: user.department || prev.department
          };
          console.log('[DEBUG UserEditor] Updating editedUser:', newState);
          return newState;
        });
      }
    }
  }, [availableSectors, user?.sector_id, user?.department]);

  // Carregar permissões ACL quando o usuário for selecionado (temporariamente desabilitado)
  // useEffect(() => {
  //   if (editedUser._id && showACLPermissions) {
  //     loadUserACLPermissions();
  //   }
  // }, [editedUser._id, showACLPermissions, loadUserACLPermissions]);



  const handleACLPermissionChange = (permissionIds: string[]) => {
    setSelectedACLPermissions(permissionIds);
  };

  // Permissões padrão para cada papel — all 24 system modules
  const defaultPermissions: Record<string, { modules: Record<string, boolean> }> = {
    ADMIN: {
      modules: {
        dashboard: true, noticias: true, calendario: true, 'ia-assistant': true,
        ponto: true, contracheque: true, reembolso: true, kpi: true,
        avaliacao: true, epi: true, ferias: true, 'lista-presenca': true,
        contratos: true, academy: true, biblioteca: true, ajuda: true,
        compras: true, poliweb: true, 'man-schedule': true, chat: true,
        wkradar: true, admin: true, 'integracao-erp': true
      }
    },
    MANAGER: {
      modules: {
        dashboard: true, noticias: true, calendario: true, 'ia-assistant': true,
        ponto: true, contracheque: true, reembolso: true, kpi: false,
        avaliacao: true, epi: true, ferias: true, 'lista-presenca': true,
        contratos: true, academy: true, biblioteca: true, ajuda: true,
        compras: true, poliweb: true, 'man-schedule': false, chat: true,
        wkradar: false, admin: false, 'integracao-erp': false
      }
    },
    USER: {
      modules: {
        dashboard: true, noticias: true, calendario: true, 'ia-assistant': true,
        ponto: true, contracheque: true, reembolso: true, kpi: false,
        avaliacao: false, epi: true, ferias: true, 'lista-presenca': true,
        contratos: true, academy: true, biblioteca: true, ajuda: true,
        compras: false, poliweb: true, 'man-schedule': false, chat: true,
        wkradar: false, admin: false, 'integracao-erp': false
      }
    }
  };

  // Inicializar permissões se não existirem
  if (!editedUser.accessPermissions) {
    editedUser.accessPermissions = defaultPermissions[editedUser.role];
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Se estiver alterando o papel, atualizar as permissões padrão
    if (name === 'role' && ['ADMIN', 'MANAGER', 'USER'].includes(value)) {
      const role = value as 'ADMIN' | 'MANAGER' | 'USER';
      setEditedUser(prev => ({
        ...prev,
        [name]: role,
        accessPermissions: defaultPermissions[role]
      }));
    } else if (name === 'position') {
      // Smart Sector Auto-Selection based on Position Keywords
      const positionLower = value.toLowerCase();
      let matchedSector: Sector | undefined;

      // Keyword mapping (position keyword -> sector name)
      const keywordMap: Record<string, string> = {
        'financeiro': 'Financeiro',
        'finanças': 'Financeiro',
        'contábil': 'Financeiro',
        'contador': 'Financeiro',
        'fiscal': 'Financeiro',
        'tesouraria': 'Financeiro',
        'logística': 'Logística',
        'supply': 'Logística',
        'almoxarifado': 'Logística',
        'operações': 'Operações',
        'operador': 'Operações',
        'offshore': 'Operações',
        'plataforma': 'Operações',
        'ti': 'TI',
        'tecnologia': 'TI',
        'sistemas': 'TI',
        'desenvolvedor': 'TI',
        'suporte': 'TI',
        'infraestrutura': 'TI',
        'engenharia': 'Engenharia',
        'engenheiro': 'Engenharia',
        'qhse': 'QHSE',
        'segurança': 'QHSE',
        'saúde': 'QHSE',
        'meio ambiente': 'QHSE',
        'qualidade': 'QHSE',
        'hse': 'QHSE',
        'rh': 'Departamento Pessoal',
        'recursos humanos': 'Departamento Pessoal',
        'pessoal': 'Departamento Pessoal',
        'dp': 'Departamento Pessoal',
        'recrutamento': 'Recrutamento',
        'seleção': 'Recrutamento',
        'comunicação': 'Comunicação',
        'marketing': 'Comunicação',
        'mídias': 'Comunicação'
      };

      for (const [keyword, sectorName] of Object.entries(keywordMap)) {
        if (positionLower.includes(keyword)) {
          matchedSector = availableSectors.find(s => s.name === sectorName);
          if (matchedSector) break;
        }
      }

      setEditedUser(prev => ({
        ...prev,
        position: value,
        // Only auto-set if not already set AND a match was found
        ...(matchedSector && !prev.sector_id ? { sector_id: matchedSector.id, department: matchedSector.name } : {})
      }));
    } else {
      setEditedUser(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleModulePermissionChange = (moduleId: string, checked: boolean) => {
    setEditedUser(prev => ({
      ...prev,
      accessPermissions: {
        ...prev.accessPermissions,
        modules: {
          ...prev.accessPermissions?.modules,
          [moduleId]: checked
        }
      }
    }));
  };

  const handleFeaturePermissionChange = (featureId: string, checked: boolean) => {
    const moduleKey = getModuleKeyForCatalogFeature(featureId);
    setEditedUser(prev => ({
      ...prev,
      accessPermissions: {
        ...prev.accessPermissions,
        features: {
          ...prev.accessPermissions?.features,
          [featureId]: checked
        },
        modules: {
          ...prev.accessPermissions?.modules,
          ...(checked && moduleKey ? { [moduleKey]: true } : {}),
        }
      }
    }));
  };

  // Validar email
  const validateEmail = (email: string): boolean => {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
  };

  const [uploadingSplash, setUploadingSplash] = useState(false);
  const [uploadingSound, setUploadingSound] = useState(false);

  const handleUploadSplash = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingSplash(true);
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'splash');
      if (editedUser._id) {
        formData.append('userId', editedUser._id);
      }

      const res = await fetch('/api/admin/users/upload-startup-asset', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Erro no upload da imagem');
      }

      setEditedUser((prev) => ({
        ...prev,
        startup_splash_url: data.url,
        startup_splash_enabled: true,
      }));
    } catch (err: any) {
      console.error('Erro no upload de splash:', err);
      alert(err.message || 'Erro ao carregar foto do splash');
    } finally {
      setUploadingSplash(false);
      e.target.value = '';
    }
  };

  const handleUploadSound = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingSound(true);
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'sound');
      if (editedUser._id) {
        formData.append('userId', editedUser._id);
      }

      const res = await fetch('/api/admin/users/upload-startup-asset', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Erro no upload do áudio');
      }

      setEditedUser((prev) => ({
        ...prev,
        startup_sound_url: data.url,
        startup_sound_enabled: true,
      }));
    } catch (err: any) {
      console.error('Erro no upload de som:', err);
      alert(err.message || 'Erro ao carregar arquivo de áudio');
    } finally {
      setUploadingSound(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar campos obrigatórios
    if (!editedUser.phoneNumber || !editedUser.firstName || !editedUser.lastName) {
      setPasswordError(t('userEditor.requiredFields', 'Phone number, first name and last name are required'));
      return;
    }

    // Validar senha para novos usuários
    if (isNewUser && !password) {
      setPasswordError(t('userEditor.passwordRequired', 'Password is required for new users'));
      return;
    }

    // Validar confirmação de senha
    if (password && password !== confirmPassword) {
      setPasswordError(t('userEditor.passwordMismatch', 'Passwords do not match'));
      return;
    }

    // Se for edição, persistir as alterações ACL antes de salvar o perfil do usuário
    if (!isNewUser && editedUser._id) {
      try {
        console.log('[UserEditor] Iniciando salvamento das permissões ACL...');
        // Obter permissões atuais
        const currentPermissions = userACLPermissions?.individual_permissions
          .filter((up: any) => !up.is_expired)
          .map((up: any) => up.permission.id) || [];

        // Encontrar permissões a adicionar
        const toAdd = selectedACLPermissions.filter(id => !currentPermissions.includes(id));

        // Encontrar permissões a remover
        const toRemove = currentPermissions.filter(id => !selectedACLPermissions.includes(id));

        // Adicionar novas permissões
        for (const permissionId of toAdd) {
          await grantPermission(editedUser._id, permissionId);
        }

        // Remover permissões desmarcadas
        for (const permissionId of toRemove) {
          await revokePermission(editedUser._id, permissionId);
        }

        console.log('[UserEditor] Permissões ACL salvas com sucesso no submit');
        if (sessionUser?.id && editedUser._id === sessionUser.id) {
          await refreshProfile();
        }
      } catch (error) {
        console.error('[UserEditor] Erro ao persistir permissões ACL no submit:', error);
      }
    }

    // Debug: Log dos dados antes de enviar
    console.log('UserEditor - Dados sendo enviados:', JSON.stringify(editedUser, null, 2));
    console.log('UserEditor - phoneNumber:', editedUser.phoneNumber);

    // Enviar dados para o componente pai
    onSave(editedUser, password || undefined);
  };

  const renderContent = () => (
    <>
      {isModal && (
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-abz-blue">
            {isNewUser ? t('userEditor.newUser', 'New User') : t('userEditor.editUser', 'Edit User')}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-red-600 p-1 rounded-full hover:bg-red-100"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6">
        {passwordError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
            {passwordError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Informações básicas */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <FiUser className="mr-2" /> Informações Pessoais
            </h3>

            <div className="space-y-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome*
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={editedUser.firstName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                  required
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Sobrenome*
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={editedUser.lastName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                  required
                />
              </div>

              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone*
                </label>
                <div className="flex items-center">
                  <FiPhone className="text-gray-400 mr-2" />
                  <input
                    type="tel"
                    id="phoneNumber"
                    name="phoneNumber"
                    value={editedUser.phoneNumber}
                    onChange={handleChange}
                    placeholder="+5511999999999"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  E-mail
                </label>
                <div className="flex items-center">
                  <FiMail className="text-gray-400 mr-2" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={editedUser.email || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Informações profissionais */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <FiBriefcase className="mr-2" /> Informações Profissionais
            </h3>

            <div className="space-y-4">
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('common.systemRole')}*
                </label>
                <select
                  id="role"
                  name="role"
                  value={editedUser.role}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                  required
                >
                  <option value="USER">{t('common.user')}</option>
                  <option value="MANAGER">{t('common.manager')}</option>
                  <option value="ADMIN">{t('common.administrator')}</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  <strong>Administrador:</strong> Acesso completo ao sistema, incluindo todas as funcionalidades administrativas.<br />
                  <strong>Gerente:</strong> Acesso a funcionalidades de gerenciamento, mas sem permissões administrativas completas.<br />
                  <strong>Usuário:</strong> Acesso básico ao sistema. Pode visualizar conteúdo e usar funcionalidades padrão.
                </p>
              </div>

              <div>
                <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-1">
                  Cargo
                </label>
                <input
                  type="text"
                  id="position"
                  name="position"
                  value={editedUser.position || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                  placeholder={t('components.exAnalistaDeLogistica')}
                />
              </div>

              <div>
                <label htmlFor="sector_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Departamento / Setor
                </label>
                <select
                  id="sector_id"
                  name="sector_id"
                  value={editedUser.sector_id || ''}
                  onChange={(e) => {
                    const selectedSectorId = e.target.value;
                    const selectedSector = availableSectors.find(s => s.id === selectedSectorId);

                    setEditedUser(prev => ({
                      ...prev,
                      sector_id: selectedSectorId,
                      department: selectedSector ? selectedSector.name : ''
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                >
                  <option value="">Selecione um departamento...</option>
                  {availableSectors.map(sector => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Selecione o departamento do usuário. Isso definirá o acesso aos módulos e configurações de compras.
                </p>
              </div>

              {isNewUser && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Senha{isNewUser ? '*' : ''}
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                    required={isNewUser}
                    minLength={8}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {isNewUser ? t('components.minimoDe8Caracteres') : 'Deixe em branco para manter a senha atual'}
                  </p>
                </div>
              )}

              {password && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmar Senha*
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                    required={!!password}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {!isNewUser && editedUser._id && showQhseSection && (
          <div className="mb-6 p-4 border border-amber-200 rounded-lg bg-amber-50/40">
            <CollaboratorDocumentsCatalog userId={editedUser._id} onlyQhse />
          </div>
        )}

        {!isNewUser && editedUser._id && (
          <div className="mb-6 p-4 border border-gray-200 rounded-lg">
            <CollaboratorDocumentsCatalog userId={editedUser._id} hideQhse />
          </div>
        )}

        {/* Permissões de acesso */}
        <div className="mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <button
              type="button"
              onClick={() => setShowPermissions(!showPermissions)}
              className="flex items-center text-abz-blue hover:text-abz-blue-dark font-medium"
            >
              <FiUsers className="mr-2" />
              {showPermissions ? t('components.ocultarPermissoes') : t('components.configurarPermissoesDeAcesso')}
            </button>

            <button
              type="button"
              onClick={() => setShowACLPermissions(!showACLPermissions)}
              className="flex items-center text-green-600 hover:text-green-700 font-medium"
            >
              <FiShield className="mr-2" />
              {showACLPermissions ? 'Ocultar ACL' : t('components.permissoesAclAvancadas')}
            </button>
          </div>

          {/* Temporariamente desabilitado
            <button
              type="button"
              onClick={() => setShowACLPermissions(!showACLPermissions)}
              className="flex items-center text-green-600 hover:text-green-700 font-medium"
            >
              <FiShield className="mr-2" />
              {showACLPermissions ? 'Ocultar ACL' : t('components.permissoesAclAvancadas')}
            </button>
            */}

          {showPermissions && (
            <div className="mt-4 p-4 border border-gray-200 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Módulos do Sistema</h3>
              <p className="text-sm text-gray-500 mb-4">
                Configure as permissões individuais deste usuário. As permissões individuais têm prioridade sobre as permissões do role.
              </p>

              {/* Mostrar permissões padrão do role */}
              {editedUser.role && rolePermissions[editedUser.role] && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">
                    Permissões Padrão do Role "{editedUser.role}"
                  </h4>
                  <div className="text-xs text-blue-700">
                    {Object.entries(rolePermissions[editedUser.role]?.modules || {})
                      .filter(([_, enabled]) => enabled)
                      .map(([moduleId]) => {
                        const modItem = availableModules.find(m => m.id === moduleId);
                        return modItem?.label;
                      })
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                </div>
              )}

              {loadingModules ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Carregando módulos...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {availableModules.map((module) => {
                    const hasIndividualPermission = editedUser.accessPermissions?.modules?.[module.id] !== undefined;
                    const isEnabledByRole = rolePermissions[editedUser.role]?.modules?.[module.id] || false;
                    const isEnabledIndividually = editedUser.accessPermissions?.modules?.[module.id] || false;
                    const finalEnabled = hasIndividualPermission ? isEnabledIndividually : isEnabledByRole;

                    return (
                      <div key={module.id} className="flex items-start p-2 border rounded-lg">
                        <input
                          type="checkbox"
                          id={`module-${module.id}`}
                          checked={finalEnabled}
                          onChange={(e) => handleModulePermissionChange(module.id, e.target.checked)}
                          disabled={editedUser.role === 'ADMIN'} // Administradores têm acesso a tudo
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                        />
                        <div className="ml-2 flex-1">
                          <label htmlFor={`module-${module.id}`} className="block text-sm font-medium text-gray-900">
                            {module.label}
                          </label>
                          <p className="text-xs text-gray-500">{module.description}</p>
                          {hasIndividualPermission && (
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                              Personalizado
                            </span>
                          )}
                          {!hasIndividualPermission && isEnabledByRole && (
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                              Por Role
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {(() => {
                const featureValues = {
                  ...(rolePermissions[editedUser.role]?.features || {}),
                  ...(editedUser.accessPermissions?.features || {}),
                };
                return (
                  <div className="mt-4">
                    <p className="text-xs text-slate-500 mb-2">
                      Features do catálogo ficam visíveis mesmo se o módulo estiver desmarcado.
                      Ativar uma feature liga o módulo correspondente no save.
                    </p>
                    <CatalogFeatureToggles
                      values={featureValues}
                      onChange={handleFeaturePermissionChange}
                      disabled={editedUser.role === 'ADMIN'}
                    />
                  </div>
                );
              })()}

              {/* Permissões específicas de reembolso */}
              <ReimbursementPermissionsEditor
                permissions={editedUser.accessPermissions || { modules: {}, features: {} }}
                onChange={(updatedPermissions) => {
                  setEditedUser({
                    ...editedUser,
                    accessPermissions: updatedPermissions
                  });
                }}
                readOnly={editedUser.role === 'ADMIN'} // Administradores têm todas as permissões
              />
            </div>
          )}

          {/* Permissões ACL Avançadas */}
          {showACLPermissions && (
            <div className="mt-6 p-4 border border-green-200 rounded-lg bg-green-50">
              <div className="flex items-center mb-4">
                <FiShield className="h-5 w-5 text-green-600 mr-2" />
                <h3 className="text-lg font-medium text-green-900">Permissões ACL Avançadas</h3>
              </div>

              <p className="text-sm text-green-700 mb-4">
                Sistema de controle de acesso hierárquico com permissões granulares.
                As permissões individuais têm prioridade sobre as permissões do role.
              </p>

              {loadingACL ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                  <span className="ml-2 text-green-700">Carregando permissões ACL...</span>
                </div>
              ) : (
                <ACLPermissionTreeSelector
                  selectedPermissions={selectedACLPermissions}
                  onPermissionChange={handleACLPermissionChange}
                  userRole={editedUser.role}
                  showRolePermissions={true}
                  rolePermissions={roleACLPermissions}
                  disabled={editedUser.role === 'ADMIN'} // Administradores têm todas as permissões
                />
              )}

              {editedUser.role === 'ADMIN' && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Nota:</strong> Administradores têm acesso automático a todas as permissões ACL,
                    independente das configurações individuais.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Configurações de Email de Reembolso */}
        {editedUser.email && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowReimbursementSettings(!showReimbursementSettings)}
              className="flex items-center text-abz-blue hover:text-abz-blue-dark font-medium"
            >
              <FiMail className="mr-2" />
              {showReimbursementSettings ? t('components.ocultarConfiguracoesDeEmail') : 'Configurar Email de Reembolso'}
            </button>

            {showReimbursementSettings && (
              <ServerUserReimbursementSettings
                email={editedUser.email}
                initialSettings={editedUser.reimbursement_email_settings}
                onSave={(settings) => {
                  setEditedUser(prev => ({
                    ...prev,
                    reimbursement_email_settings: settings
                  }));
                }}
              />
            )}
          </div>
        )}

        {/* Configurações de Inicialização Personalizada (Splash & Áudio) */}
        <div className="mb-6 border border-indigo-100 rounded-xl p-5 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/40 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <FiImage className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Tela de Inicialização & Áudio (Splash Screen)</h3>
              <p className="text-xs text-gray-500">Defina uma foto de splash e um áudio de abertura personalizados para este usuário ao entrar no portal.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Splash Image */}
            <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <FiImage className="text-indigo-600" />
                    Splash Screen (Foto)
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editedUser.startup_splash_enabled}
                      onChange={(e) => setEditedUser(prev => ({ ...prev, startup_splash_enabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {editedUser.startup_splash_url ? (
                  <div className="relative mb-3 group rounded-lg overflow-hidden border border-gray-200 bg-gray-900 aspect-video flex items-center justify-center">
                    <img
                      src={editedUser.startup_splash_url}
                      alt="Preview Splash"
                      className="max-h-full max-w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setEditedUser(prev => ({ ...prev, startup_splash_url: '', startup_splash_enabled: false }))}
                      className="absolute top-2 right-2 p-1.5 bg-red-600/80 hover:bg-red-700 text-white rounded-md transition shadow"
                      title="Remover foto"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 mb-3 text-center bg-gray-50 flex flex-col items-center justify-center min-h-[110px]">
                    <FiImage className="w-8 h-8 text-gray-300 mb-1" />
                    <span className="text-xs text-gray-400">Nenhuma foto de splash enviada</span>
                  </div>
                )}
              </div>

              <div>
                <label className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition shadow-xs">
                  <FiUpload className="w-4 h-4 text-indigo-600" />
                  <span>{uploadingSplash ? 'Enviando imagem...' : editedUser.startup_splash_url ? 'Substituir Imagem' : 'Enviar Foto do Splash'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadSplash}
                    disabled={uploadingSplash}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Startup Sound */}
            <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <FiVolume2 className="text-indigo-600" />
                    Som de Início (Áudio)
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editedUser.startup_sound_enabled}
                      onChange={(e) => setEditedUser(prev => ({ ...prev, startup_sound_enabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {editedUser.startup_sound_url ? (
                  <div className="mb-3 p-2 bg-slate-50 border border-gray-200 rounded-lg flex flex-col gap-2">
                    <audio controls className="w-full h-8" src={editedUser.startup_sound_url} />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setEditedUser(prev => ({ ...prev, startup_sound_url: '', startup_sound_enabled: false }))}
                        className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 font-medium"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                        Remover áudio
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 mb-3 text-center bg-gray-50 flex flex-col items-center justify-center min-h-[110px]">
                    <FiVolume2 className="w-8 h-8 text-gray-300 mb-1" />
                    <span className="text-xs text-gray-400">Nenhum som de início enviado</span>
                  </div>
                )}
              </div>

              <div>
                <label className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition shadow-xs">
                  <FiUpload className="w-4 h-4 text-indigo-600" />
                  <span>{uploadingSound ? 'Enviando áudio...' : editedUser.startup_sound_url ? 'Substituir Áudio' : 'Enviar Arquivo de Áudio'}</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleUploadSound}
                    disabled={uploadingSound}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Botões de ação (Sticky) */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t p-3 sm:p-4 mt-6 z-20 flex justify-end space-x-3 rounded-b-xl shadow-xs">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue transition"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="flex items-center px-5 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue transition"
          >
            <FiSave className="mr-2" />
            {t('common.save')}
          </button>
        </div>
      </form>
    </>
  );

  // Renderizar como modal ou como componente normal
  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl max-w-4xl w-full max-h-[96dvh] sm:max-h-[90vh] overflow-auto">
          {renderContent()}
        </div>
      </div>
    );
  }

  // Renderizar como componente normal
  return (
    <div className="bg-white rounded-lg shadow-md">
      {renderContent()}
    </div>
  );
};

export default UserEditor;
