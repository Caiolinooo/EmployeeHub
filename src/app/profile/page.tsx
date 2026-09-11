'use client';

import { normalizeCpf, formatCpf, maskCpf, formatBirthDate } from '@/lib/utils/identity';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FiUser, FiMail, FiPhone, FiSettings, FiUpload, FiImage, FiTrash2, FiEdit, FiSave, FiLock, FiDollarSign, FiKey, FiFileText, FiShield } from 'react-icons/fi';
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
import UserProfileView from '@/components/Profile/UserProfileView';
import UserAvatar from '@/components/UserAvatar';
import PasskeyManagement from '@/components/Profile/PasskeyManagement';
import SignatureTab from '@/components/Profile/SignatureTab';
import CollaboratorDocumentsCatalog from '@/components/admin/CollaboratorDocumentsCatalog';
import { QHSE_MODULE_KEY } from '@/lib/document-catalog/permissions';

export default function ProfilePage() {
  const { user, profile, isLoading, refreshProfile, hasAccess } = useSupabaseAuth();
  const showQhseTab = hasAccess(QHSE_MODULE_KEY);
  const { t } = useI18n();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'password', 'notifications', 'admin_reimbursement'
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    position: '',
    department: '',
    bio: '',
    taxId: '',
    birthDate: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Aguardar o carregamento completo da autenticação
    if (isLoading) {
      return;
    }

    // Verificar se o usuário está autenticado
    if (!user) {
      router.replace('/login');
      return;
    }

    // Aguardar o carregamento do perfil
    if (!profile) {
      if (refreshProfile) {
        refreshProfile();
      }
      return;
    }

    // Carregar a foto de perfil (apenas setar o state local se necessário para logica antiga, mas UserAvatar cuida da display)
    if (profile.avatar) setProfileImage(profile.avatar);

    // Inicializar o formulário com os dados do perfil
    setFormData({
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      email: profile.email || '',
      phoneNumber: profile.phone_number || '',
      position: profile.position || '',
      department: profile.department || '',
      // @ts-ignore
      bio: profile.bio || '',
      taxId: profile.tax_id ? formatCpf(profile.tax_id) : '',
      // @ts-ignore
      birthDate: (profile as any).birth_date || '',
    });

  }, [profile, isLoading, user, router, refreshProfile]);

  const handleUpdateProfile = async () => {
    try {
      if (!user) return;

      const { error } = await supabase
        .from('users_unified')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone_number: formData.phoneNumber,
          position: formData.position,
          department: formData.department,
          bio: formData.bio,
          tax_id: formData.taxId ? normalizeCpf(formData.taxId) : null,
          birth_date: formData.birthDate || null,
        } as any)
        .eq('id', user.id);


      if (error) throw error;

      toast.success(t('profile.updateSuccess', 'Perfil atualizado com sucesso! 🎉'));
      setEditing(false);
      refreshProfile();
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast.error(t('profile.updateError', 'Erro ao atualizar perfil'));
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error(t('profile.selectImageToUpload', 'Por favor, selecione uma imagem para enviar'));
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/avatar-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('users_unified')
        .update({ avatar: data.publicUrl } as any)
        .eq('id', user?.id);

      if (updateError) {
        throw updateError;
      }

      setProfileImage(data.publicUrl);
      refreshProfile();
      toast.success(t('profile.photoUpdatedSuccess', 'Foto de perfil atualizada com sucesso'));
    } catch (error: any) {
      console.error('Erro ao fazer upload da imagem:', error);
      toast.error(error.message || t('profile.errorUpdatingPhoto', 'Erro ao atualizar foto de perfil'));
    } finally {
      setUploading(false);
    }
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setCoverUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error(t('profile.selectImageToUpload', 'Por favor, selecione uma imagem para enviar'));
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `cover-${user?.id}-${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/cover-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('users_unified')
        .update({ cover_url: data.publicUrl } as any)
        .eq('id', user?.id);

      if (updateError) throw updateError;

      refreshProfile();
      toast.success(t('profile.coverPhotoUpdatedSuccess', 'Foto de capa atualizada com sucesso'));
    } catch (error: any) {
      console.error('Erro ao fazer upload da capa:', error);
      toast.error(error.message || t('profile.errorUpdatingCover', 'Erro ao atualizar foto de capa'));
    } finally {
      setCoverUploading(false);
    }
  };

  if (isLoading || !isClient || !user || !profile) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-0 sm:p-4 md:p-6 min-h-screen bg-gray-50/50 overflow-x-hidden">

        {editing ? (
          <div className="bg-white sm:rounded-xl sm:shadow-lg sm:border border-gray-100 p-4 md:p-8 w-full max-w-4xl mx-auto animation-fadeIn mb-8 relative overflow-hidden">

            {/* Header Configuration */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 md:mb-8 border-b border-gray-100 pb-4">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800">{t('profile.edit', 'Editar Perfil')}</h2>
              <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors w-full sm:w-auto text-center font-medium">
                {t('profile.cancel', 'Cancelar')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Visual Identity Section (Cover & Avatar) */}
              <div className="md:col-span-2 space-y-6">
                <div className="p-4 bg-blue-50/50 md:bg-blue-50 rounded-xl border border-blue-100">
                  <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                    <FiImage /> {t('profile.visualIdentity', 'Identidade Visual')}
                  </h3>

                  <div className="grid gap-6 sm:grid-cols-2">
                    {/* Cover Upload */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 block">{t('profile.coverPhoto', 'Foto de Capa')}</label>
                      <div
                        onClick={() => coverInputRef.current?.click()}
                        className="h-32 w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-white hover:border-blue-400 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group overflow-hidden relative"
                      >
                        {(profile as any)?.cover_url ? (
                          <img src={(profile as any).cover_url} className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" />
                        ) : null}
                        <div className="z-10 flex flex-col items-center">
                          <FiImage className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors" />
                          <span className="text-xs text-gray-500 font-medium">{t('profile.changeCover', 'Alterar Capa')}</span>
                        </div>
                        {coverUploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div></div>}
                      </div>
                      <input type="file" ref={coverInputRef} onChange={handleCoverUpload} className="hidden" accept="image/*" />
                    </div>

                    {/* Avatar Upload */}
                    <div className="space-y-2 flex flex-col items-center">
                      <label className="text-sm font-medium text-gray-700 block w-full text-center">{t('profile.profilePhoto', 'Foto de Perfil')}</label>
                      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 group-hover:border-blue-500 transition-colors relative">
                          <UserAvatar user={user} profile={profile} className="w-full h-full" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <FiUpload className="w-6 h-6" />
                          </div>
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5 shadow border border-gray-200 text-blue-600">
                          <FiEdit className="w-3 h-3" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">{t('profile.changeAvatar', 'Clique para alterar')}</p>
                      <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{t('profile.firstName', 'Nome')}</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{t('profile.lastName', 'Sobrenome')}</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{t('profile.phone', 'Telefone')}</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{t('profile.position', 'Cargo')}</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{t('profile.department', 'Departamento')}</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>

              {/* CPF and birth date — used for contract signing identity validation */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{t('profile.cpf', 'CPF')}</label>
                <input
                  type="text"
                  maxLength={14}
                  placeholder="000.000.000-00"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: formatCpf(e.target.value) })}
                />
                <p className="text-xs text-gray-400">{t('profile.cpf_hint', 'Utilizado para validação de identidade em assinaturas eletrônicas.')}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">{t('profile.birth_date', 'Data de Nascimento')}</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-gray-700">{t('profile.bio', 'Biografia')}</label>
                <textarea
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all h-24 resize-none"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder={t('profile.bioPlaceholder', 'Conte um pouco sobre você...')}
                />
              </div>

              <div className="md:col-span-2 pt-6 border-t border-gray-100 flex flex-col-reverse sm:flex-row justify-end gap-3 mt-4">
                <Button variant="outline" onClick={() => setEditing(false)} size="lg" className="w-full sm:w-auto">{t('profile.cancel', 'Cancelar')}</Button>
                <Button onClick={handleUpdateProfile} className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700 px-8" size="lg">{t('profile.save', 'Salvar Alterações')}</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-fadeIn">
            <UserProfileView
              user={profile as any}
              isOwnProfile={true}
              onEdit={() => setEditing(true)}
            />

            {/* Additional Settings Sections */}
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white sm:rounded-xl sm:shadow-sm sm:border border-gray-100 overflow-hidden w-full">
                <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-hide">
                  <button
                    onClick={() => setActiveTab('password')}
                    className={`px-4 md:px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap focus:outline-none ${activeTab === 'password' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-2">
                      <FiLock className="w-4 h-4" />
                      {t('profile.security', 'Segurança')}
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('notifications')}
                    className={`px-4 md:px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap focus:outline-none ${activeTab === 'notifications' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-2">
                      <FiSettings className="w-4 h-4" />
                      {t('profile.preferences', 'Preferências')}
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('signature')}
                    className={`px-4 md:px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap focus:outline-none ${activeTab === 'signature' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-2">
                      <FiEdit className="w-4 h-4" />
                      {t('profile.signature', 'Assinatura')}
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className={`px-4 md:px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap focus:outline-none ${activeTab === 'documents' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-2">
                      <FiFileText className="w-4 h-4" />
                      {t('profile.documents', 'Documentos')}
                    </div>
                  </button>
                  {showQhseTab && (
                    <button
                      onClick={() => setActiveTab('qhse')}
                      className={`px-4 md:px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap focus:outline-none ${activeTab === 'qhse' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2">
                        <FiShield className="w-4 h-4" />
                        {t('profile.qhse', 'QHSE / EPI')}
                      </div>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('passkeys')}
                    className={`px-4 md:px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap focus:outline-none ${activeTab === 'passkeys' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-2">
                      <FiKey className="w-4 h-4" />
                      {t('profile.passkeys', 'Biometria (Passkeys)')}
                    </div>
                  </button>
                  {(profile?.role === 'admin' || profile?.role === 'manager') && (
                    <button
                      onClick={() => setActiveTab('admin_reimbursement')}
                      className={`px-4 md:px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap focus:outline-none ${activeTab === 'admin_reimbursement' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2">
                        <FiDollarSign className="w-4 h-4" />
                        {t('profile.adminReimbursement', 'Reembolso (Admin)')}
                      </div>
                    </button>
                  )}
                </div>

                <div className="p-4 md:p-6 pb-6 md:pb-6 overflow-x-hidden">
                  {activeTab === 'password' && <ChangePasswordTab />}
                  {activeTab === 'notifications' && <NotificationPreferencesPanel />}
                  {activeTab === 'signature' && <SignatureTab />}
                  {activeTab === 'documents' && user?.id && (
                    <CollaboratorDocumentsCatalog userId={user.id} hideQhse />
                  )}
                  {activeTab === 'qhse' && showQhseTab && user?.id && (
                    <CollaboratorDocumentsCatalog userId={user.id} onlyQhse />
                  )}
                  {activeTab === 'passkeys' && <PasskeyManagement />}
                  {activeTab === 'admin_reimbursement' && <ServerUserReimbursementSettings userId={user?.id || ''} />}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
