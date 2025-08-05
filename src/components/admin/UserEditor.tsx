'use client';

import React, { useState } from 'react';
import { FiSave, FiX, FiUser, FiMail, FiPhone, FiBriefcase, FiUsers, FiPlus, FiTrash2, FiDollarSign } from 'react-icons/fi';
import { AccessPermissions } from '@/models/User';
import ServerUserReimbursementSettings from './ServerUserReimbursementSettings';
import ReimbursementPermissionsEditor from './ReimbursementPermissionsEditor';
import { useI18n } from '@/contexts/I18nContext';

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
  const defaultUser: UserEditorData = {
    phoneNumber: '',
    firstName: '',
    lastName: '',
    email: '',
    role: 'USER',
    position: '',
    department: '',
    accessPermissions: {
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
        admin: false
      }
    },
    reimbursement_email_settings: {
      enabled: false,
      recipients: []
    }
  };

  const [editedUser, setEditedUser] = useState<UserEditorData>(user ? { ...user } : defaultUser);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPermissions, setShowPermissions] = useState(false);
  const [showReimbursementSettings, setShowReimbursementSettings] = useState(false);


  // Lista de módulos disponíveis
  const availableModules = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'manual', label: 'Manual' },
    { id: 'procedimentos', label: 'Procedimentos' },
    { id: 'politicas', label: 'Políticas' },
    { id: 'calendario', label: 'Calendário' },
    { id: 'noticias', label: 'Notícias' },
    { id: 'reembolso', label: 'Reembolso' },
    { id: 'contracheque', label: 'Contracheque' },
    { id: 'ponto', label: 'Ponto' },
    { id: 'admin', label: 'Administração' },
  ];

  // Permissões padrão para cada papel
  const defaultPermissions = {
    ADMIN: {
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
        admin: true
      }
    },
    MANAGER: {
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
        admin: false
      }
    },
    USER: {
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
        admin: false
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

  // Validar email
  const validateEmail = (email: string): boolean => {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
  };

  const handleSubmit = (e: React.FormEvent) => {
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
                    placeholder="Ex: Analista de Logística"
                  />
                </div>

                <div>
                  <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                    Departamento
                  </label>
                  <input
                    type="text"
                    id="department"
                    name="department"
                    value={editedUser.department || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                    placeholder="Ex: Logística"
                  />
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
                      {isNewUser ? 'Mínimo de 8 caracteres' : 'Deixe em branco para manter a senha atual'}
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

          {/* Permissões de acesso */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowPermissions(!showPermissions)}
              className="flex items-center text-abz-blue hover:text-abz-blue-dark font-medium"
            >
              <FiUsers className="mr-2" />
              {showPermissions ? 'Ocultar Permissões' : 'Configurar Permissões de Acesso'}
            </button>

            {showPermissions && (
              <div className="mt-4 p-4 border border-gray-200 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Módulos do Sistema</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Selecione os módulos que este usuário poderá acessar. Administradores têm acesso a todos os módulos automaticamente.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {availableModules.map((module) => (
                    <div key={module.id} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`module-${module.id}`}
                        checked={editedUser.accessPermissions?.modules?.[module.id] || false}
                        onChange={(e) => handleModulePermissionChange(module.id, e.target.checked)}
                        disabled={editedUser.role === 'ADMIN'} // Administradores têm acesso a tudo
                        className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
                      />
                      <label htmlFor={`module-${module.id}`} className="ml-2 block text-sm text-gray-900">
                        {module.label}
                      </label>
                    </div>
                  ))}
                </div>

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
                {showReimbursementSettings ? 'Ocultar Configurações de Email' : 'Configurar Email de Reembolso'}
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

          {/* Botões de ação */}
          <div className="flex justify-end space-x-3 border-t pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
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
