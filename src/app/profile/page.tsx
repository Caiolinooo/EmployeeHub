'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FiUser, FiMail, FiPhone, FiSettings, FiUpload, FiImage, FiTrash2, FiEdit, FiSave, FiLock } from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MainLayout from '@/components/Layout/MainLayout';
import ServerUserReimbursementSettings from '@/components/admin/ServerUserReimbursementSettings';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import ChangePasswordTab from '@/components/Profile/ChangePasswordTab';
import { useI18n } from '@/contexts/I18nContext';
import NotificationPreferencesPanel from '@/components/Profile/NotificationPreferencesPanel';

export default function ProfilePage() {
  const { user, profile, isLoading, refreshProfile } = useSupabaseAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [showReimbursementSettings, setShowReimbursementSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'password', 'emails', 'phones'
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    position: '',
    department: '',
    theme: 'light',
    language: 'pt-BR',
    notifications: true
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Aguardar o carregamento completo da autenticação
    if (isLoading) {
      console.log(t('profile.aguardandoCarregamentoDaAutenticacao'));
      return;
    }

    // Verificar se o usuário está autenticado
    if (!user) {
      console.log(t('profile.usuarioNaoAutenticadoRedirecionandoParaLogin'));
      toast.error(t('profile.vocePrecisaEstarLogadoParaAcessarEstaPagina'));
      router.replace('/login');
      return;
    }

    // Aguardar o carregamento do perfil
    if (!profile) {
      console.log('🔄 Aguardando carregamento do perfil...');
      // Tentar recarregar o perfil se não estiver carregado
      if (refreshProfile) {
        console.log('🔄 Tentando recarregar perfil...');
        refreshProfile();
      }
      return;
    }

    console.log(t('profile.usuarioEPerfilCarregadosInicializandoPaginaDePerfi'));
    console.log('👤 Dados do perfil:', {
      id: profile.id,
      email: profile.email,
      firstName: profile.first_name,
      lastName: profile.last_name
    });

    // Carregar a foto de perfil
    loadProfileImage();

    // Inicializar o formulário com os dados do perfil
    const extendedProfile = profile as any;
    setFormData({
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      email: profile.email || '',
      phoneNumber: profile.phone_number || '',
      position: profile.position || '',
      department: profile.department || '',
      theme: extendedProfile.theme || 'light',
      language: extendedProfile.language || 'pt-BR',
      notifications: true
    });
  }, [profile, isLoading, user, router, refreshProfile]);

  // Função para carregar a imagem de perfil
  const loadProfileImage = async () => {
    if (!profile?.id) {
      setProfileImage(null); // Default to icon if no profile ID
      return;
    }

    try {
      // Buscar a URL da foto do Google Drive no banco de dados
      const { data: userData, error } = await supabase
        .from('users_unified')
        .select('drive_photo_url, avatar')
        .eq('id', profile.id)
        .single();

      if (error) {
        console.error(t('profile.erroAoBuscarDadosDoUsuario'), error);
        setProfileImage(null);
        return;
      }

      // Usar drive_photo_url se disponível, senão usar avatar como fallback
      const photoUrl = userData?.drive_photo_url || userData?.avatar;

      if (!photoUrl) {
        setProfileImage(null); // Fallback to icon
        return;
      }

      // Verify the image URL is accessible
      if (typeof window !== 'undefined') {
        const checkImage = new window.Image();
        checkImage.onload = () => {
          setProfileImage(photoUrl);
        };
        checkImage.onerror = () => {
          console.warn(t('profile.imagemDePerfilNaoEncontradaOuInacessivelNaUrl'), photoUrl);
          setProfileImage(null); // Fallback to icon
        };
        checkImage.src = photoUrl;
      } else {
        // Server-side rendering fallback
        setProfileImage(photoUrl);
      }

    } catch (error) {
      console.error('Erro geral ao carregar imagem de perfil:', error);
      setProfileImage(null); // Fallback to icon
    }
  };

  // Função para fazer upload da imagem de perfil
  const uploadProfileImage = async (file: File) => {
    if (!profile?.id) return;

    try {
      setUploading(true);

      const token = localStorage.getItem('token');

      if (!token) {
        toast.error(t('profile.naoAutorizado'));
        return;
      }

      // Criar FormData para upload via API do Google Drive
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('userId', profile.id);

      const response = await fetch('/api/users-unified/upload-photo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(t('profile.photoUpdatedSuccess'));

        // Atualizar a URL da imagem
        await loadProfileImage();

        // Atualizar o perfil no contexto
        await refreshProfile();
      } else {
        const error = await response.json();
        toast.error(error.error || t('profile.errorUpdatingPhoto'));
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error(t('profile.errorUpdatingPhoto'));
    } finally {
      setUploading(false);
    }
  };

  // Função para remover a imagem de perfil
  const removeProfileImage = async () => {
    if (!profile?.id) return;

    try {
      setUploading(true);

      // Remover imagens do bucket correto (profile-photos) dentro da pasta do usuário
      const folder = `${profile.id}`;
      const { data: files, error: listError } = await supabase.storage.from('profile-photos').list(folder, { limit: 100 });
      if (listError) {
        console.warn('Falha ao listar arquivos do bucket profile-photos:', listError);
      } else if (files && files.length > 0) {
        const paths = files.map((f: any) => `${folder}/${f.name}`);
        const { error: removeError } = await supabase.storage.from('profile-photos').remove(paths);
        if (removeError) {
          console.warn('Falha ao remover arquivos do bucket profile-photos:', removeError);
        }
      }

      // Limpar referências no banco de dados (avatar e drive_photo_url)
      const { error: dbErr } = await supabase
        .from('users_unified')
        .update({ avatar: null, drive_photo_url: null, updated_at: new Date().toISOString() })
        .eq('id', profile.id);
      if (dbErr) {
        console.warn('Falha ao limpar avatar/drive_photo_url no banco:', dbErr);
      }

      setProfileImage(null);
      toast.success('Imagem de perfil removida com sucesso');

      // Atualizar perfil no contexto e recarregar a url
      await refreshProfile();
      await loadProfileImage();
    } catch (error) {
      console.error('Erro ao remover imagem:', error);
      toast.error('Erro ao remover a imagem');
    } finally {
      setUploading(false);
    }
  };

  // Função para lidar com a seleção de arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verificar o tipo e tamanho do arquivo
    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.porFavorSelecioneUmaImagemValida'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      toast.error(t('profile.aImagemDeveTerNoMaximo5mb'));
      return;
    }

    uploadProfileImage(file);
  };

  // Função para abrir o seletor de arquivo
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Função para atualizar os dados do perfil
  const updateProfile = async () => {
    if (!profile?.id) {
      toast.error(t('profile.perfilNaoEncontradoFacaLoginNovamente'));
      return;
    }

    try {
      // Validar dados do formulário
      if (!formData.firstName || !formData.lastName) {
        toast.error(t('profile.nomeESobrenomeSaoObrigatorios'));
        return;
      }

      // Preparar os dados para atualização
      const updateData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone_number: formData.phoneNumber,
        position: formData.position,
        department: formData.department,
        // Removendo o campo preferences que não existe na tabela
        // Armazenando as preferências em campos individuais ou em metadados se necessário
        theme: formData.theme,
        language: formData.language,
        updated_at: new Date().toISOString()
      };

      console.log('Atualizando perfil com dados:', updateData);

      // Atualizar os dados do perfil no Supabase
      const { data, error } = await supabase
        .from('users_unified')
        .update(updateData)
        .eq('id', profile.id)
        .select();

      if (error) {
        const errorMessage = error.message || 'Erro desconhecido';
        toast.error(`Erro ao atualizar perfil: ${errorMessage}`);
        console.error('Erro ao atualizar perfil:', error);
        return;
      }

      console.log('Perfil atualizado com sucesso:', data);
      toast.success('Perfil atualizado com sucesso');
      setEditing(false);

      // Atualizar os dados do perfil no contexto
      await refreshProfile();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Erro ao atualizar perfil:', error);
      toast.error(`Erro ao atualizar perfil: ${errorMessage}`);
    }
  };

  // Função para lidar com mudanças no formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  if (!isClient) {
    return null;
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-abz-blue"></div>
        </div>
      </MainLayout>
    );
  }

  if (!user || !profile) {
    return (
      <MainLayout>
        <div className="bg-white rounded-lg shadow-md p-6 max-w-3xl mx-auto">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Não autenticado</h1>
            <p className="mb-4">Você precisa estar logado para acessar esta página.</p>
            <Button
              onClick={() => router.push('/login')}
              className="bg-abz-blue hover:bg-abz-blue-dark"
            >
              Fazer login
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-abz-blue mb-6 flex items-center">
          <FiUser className="mr-2" /> {t('profile.myProfile')}
        </h1>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            {/* Cabeçalho com foto de perfil */}
            <div className="flex flex-col md:flex-row items-center md:items-start mb-8">
              <div className="relative mb-4 md:mb-0 md:mr-8">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200">
                  {profileImage ? (
                    <Image
                      src={profileImage}
                      alt={t('profile.profilePhoto')}
                      width={128}
                      height={128}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <FiUser className="w-16 h-16 text-gray-400" />
                  )}
                </div>

                {/* Botões de ação para a foto */}
                <div className="mt-2 flex justify-center space-x-2">
                  <Button
                    onClick={handleUploadClick}
                    className="p-2 bg-abz-blue text-white rounded-full hover:bg-abz-blue-dark h-auto"
                    disabled={uploading}
                    title={t('profile.uploadPhoto')}
                    size="icon"
                  >
                    {uploading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <FiUpload className="w-4 h-4" />
                    )}
                  </Button>

                  {profileImage && (
                    <Button
                      onClick={removeProfileImage}
                      className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 h-auto"
                      disabled={uploading}
                      title="Remover foto"
                      size="icon"
                      variant="destructive"
                    >
                      {uploading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <FiTrash2 className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>

                {/* Input oculto para upload de arquivo */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              <div className="text-center md:text-left flex-1">
                <div className="flex items-center justify-center md:justify-between mb-2">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {profile.first_name} {profile.last_name}
                  </h2>

                  <Button
                    onClick={editing ? updateProfile : () => setEditing(true)}
                    variant="link"
                    className="hidden md:flex items-center text-abz-blue hover:text-abz-blue-dark p-0 h-auto"
                  >
                    {editing ? (
                      <>
                        <FiSave className="mr-1" />
                        <span>Salvar</span>
                      </>
                    ) : (
                      <>
                        <FiEdit className="mr-1" />
                        <span>Editar Perfil</span>
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-gray-500 mb-2">{profile.position || 'Cargo não informado'}</p>
                <p className="text-gray-500 mb-4">{profile.department || 'Departamento não informado'}</p>

                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {profile.role === 'ADMIN' ? 'Administrador' :
                     profile.role === 'MANAGER' ? 'Gerente' : t('profile.usuario')}
                  </span>

                  {profile.active && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                      Ativo
                    </span>
                  )}
                </div>

                {/* Botão de editar para mobile */}
                <Button
                  onClick={editing ? updateProfile : () => setEditing(true)}
                  variant="link"
                  className="mt-4 md:hidden flex items-center justify-center text-abz-blue hover:text-abz-blue-dark mx-auto p-0 h-auto"
                >
                  {editing ? (
                    <>
                      <FiSave className="mr-1" />
                      <span>Salvar</span>
                    </>
                  ) : (
                    <>
                      <FiEdit className="mr-1" />
                      <span>Editar Perfil</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Formulário de edição ou visualização de informações */}
            {editing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Informações pessoais */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.personalInfo')}</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">{t('profile.firstName')}</label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">{t('profile.lastName')}</label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Email</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md bg-gray-100"
                        disabled
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Telefone</label>
                      <input
                        type="tel"
                        name="phoneNumber"
                        value={formData.phoneNumber}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>

                {/* Informações profissionais */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('common.professionalInfo')}</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">{t('common.position')}</label>
                      <input
                        type="text"
                        name="position"
                        value={formData.position}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">{t('common.department')}</label>
                      <input
                        type="text"
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">{t('common.systemRole')}</label>
                      <input
                        type="text"
                        value={profile.role === 'ADMIN' ? 'Administrador' :
                               profile.role === 'MANAGER' ? 'Gerente' : t('profile.usuario')}
                        className="w-full p-2 border border-gray-300 rounded-md bg-gray-100"
                        disabled
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Informações pessoais */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações Pessoais</h2>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Nome completo</p>
                      <p className="font-medium">{profile.first_name} {profile.last_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium flex items-center">
                        <FiMail className="mr-2 text-gray-400" />
                        {profile.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Telefone</p>
                      <p className="font-medium flex items-center">
                        <FiPhone className="mr-2 text-gray-400" />
                        {profile.phone_number || t('profile.naoInformado')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Informações profissionais */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('common.professionalInfo')}</h2>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">{t('common.position')}</p>
                      <p className="font-medium">{profile.position || t('common.notInformed')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('common.department')}</p>
                      <p className="font-medium">{profile.department || t('common.notInformed')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('common.systemRole')}</p>
                      <p className="font-medium">
                        {profile.role === 'ADMIN' ? t('common.administrator') :
                         profile.role === 'MANAGER' ? t('common.manager') : t('common.user')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Preferências do usuário */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('common.preferences')}</h2>

              {editing ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Tema removido - não necessário para este projeto */}

                  <div>
                    <label className="block text-sm text-gray-500 mb-1">{t('common.language')}</label>
                    <select
                      name="language"
                      value={formData.language}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="pt-BR">{t('common.portugueseBrazil')}</option>
                      <option value="en-US">{t('common.englishUS')}</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="notifications"
                      name="notifications"
                      checked={formData.notifications}
                      onChange={handleInputChange}
                      className="mr-2"
                    />
                    <label htmlFor="notifications" className="text-sm text-gray-700">
                      Receber notificações
                    </label>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Tema removido - não necessário para este projeto */}

                  <div>
                    <p className="text-sm text-gray-500">{t('common.language')}</p>
                    <p className="font-medium">
                      {(profile as any).language === 'en-US' ? t('common.englishUS') : t('common.portugueseBrazil')}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">{t('common.notifications')}</p>
                    <p className="font-medium">
                      {t('common.enabled')}
                    </p>
                  </div>
                </div>
              )}

              {/* Botões de ação */}
              <div className="mt-6 flex justify-end">
                {editing && (
                  <>
                    <Button
                      onClick={() => setEditing(false)}
                      variant="outline"
                      className="mr-2"
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      onClick={updateProfile}
                      className="bg-abz-blue hover:bg-abz-blue-dark"
                    >
                      {t('common.save')}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Navegação por abas */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex border-b border-gray-200 mb-6">
                <Button
                  onClick={() => setActiveTab('profile')}
                  variant="ghost"
                  className={`py-2 px-4 font-medium text-sm h-auto ${
                    activeTab === 'profile'
                      ? 'border-b-2 border-abz-blue text-abz-blue'
                      : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                  }`}
                >
                  <FiUser className="inline mr-1" /> Perfil
                </Button>
                <Button
                  onClick={() => setActiveTab('password')}
                  variant="ghost"
                  className={`py-2 px-4 font-medium text-sm h-auto ${
                    activeTab === 'password'
                      ? 'border-b-2 border-abz-blue text-abz-blue'
                      : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                  }`}
                >
                  <FiLock className="inline mr-1" /> Alterar Senha
                </Button>
              </div>

              {/* Conteúdo da aba selecionada */}
              {activeTab === 'profile' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Configurações</h2>

                  <div className="space-y-4">
                    <Button
                      onClick={() => setShowReimbursementSettings(true)}
                      variant="link"
                      className="text-abz-blue hover:text-abz-blue-dark p-0 h-auto"
                    >
                      <FiSettings className="mr-2" />
                      <span>Configurações de Email de Reembolso</span>
                    </Button>
                  </div>

                  {showReimbursementSettings && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                      <div className="max-w-2xl w-full">
                        <ServerUserReimbursementSettings
                          email={profile.email || undefined}
                          onClose={() => setShowReimbursementSettings(false)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Preferências de Notificação */}
                  <NotificationPreferencesPanel />
                </div>
              )}

              {/* Aba de alteração de senha */}
              {activeTab === 'password' && <ChangePasswordTab />}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

