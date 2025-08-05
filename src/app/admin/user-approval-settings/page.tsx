'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'react-hot-toast';
import { FiSettings, FiUsers, FiCheck, FiX, FiLoader } from 'react-icons/fi';

interface UserApprovalSettings {
  bypassApproval: boolean;
  autoActivateOnEmailVerification: boolean;
}

export default function UserApprovalSettingsPage() {
  const { user, isAdmin, isLoading: authLoading } = useSupabaseAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [settings, setSettings] = useState<UserApprovalSettings>({
    bypassApproval: false,
    autoActivateOnEmailVerification: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Verificar se o usuário é admin
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push('/dashboard');
    }
  }, [user, isAdmin, authLoading, router]);

  // Carregar configurações
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/admin/user-approval-settings');
        const data = await response.json();
        
        if (data.success) {
          setSettings(data.data);
        } else {
          console.error('Erro ao carregar configurações:', data.error);
          toast.error('Erro ao carregar configurações');
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        toast.error('Erro ao carregar configurações');
      } finally {
        setLoading(false);
      }
    };

    if (user && isAdmin) {
      loadSettings();
    }
  }, [user, isAdmin]);

  // Salvar configurações
  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/user-approval-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Configurações salvas com sucesso!');
      } else {
        console.error('Erro ao salvar configurações:', data.error);
        toast.error('Erro ao salvar configurações');
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  // Atualizar configuração
  const updateSetting = (key: keyof UserApprovalSettings, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <FiLoader className="animate-spin h-6 w-6 text-blue-600" />
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-3 rounded-full">
              <FiSettings className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Configurações de Aprovação de Usuários
              </h1>
              <p className="text-gray-600">
                Configure como os novos usuários são aprovados no sistema
              </p>
            </div>
          </div>
        </div>

        {/* Settings Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="space-y-6">
            {/* Bypass Approval Setting */}
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 mt-1">
                <FiUsers className="h-5 w-5 text-gray-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Bypass de Aprovação Manual
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Quando ativado, usuários não precisam de aprovação manual do administrador
                    </p>
                  </div>
                  <button
                    onClick={() => updateSetting('bypassApproval', !settings.bypassApproval)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      settings.bypassApproval ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.bypassApproval ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Auto Activate Setting */}
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 mt-1">
                <FiCheck className="h-5 w-5 text-gray-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Ativação Automática após Verificação de Email
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Quando ativado junto com o bypass, usuários são ativados automaticamente após verificarem o email
                    </p>
                  </div>
                  <button
                    onClick={() => updateSetting('autoActivateOnEmailVerification', !settings.autoActivateOnEmailVerification)}
                    disabled={!settings.bypassApproval}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      settings.autoActivateOnEmailVerification && settings.bypassApproval 
                        ? 'bg-blue-600' 
                        : 'bg-gray-200'
                    } ${!settings.bypassApproval ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        settings.autoActivateOnEmailVerification && settings.bypassApproval 
                          ? 'translate-x-5' 
                          : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                {!settings.bypassApproval && (
                  <p className="text-xs text-gray-500 mt-2">
                    Esta opção só está disponível quando o bypass de aprovação está ativado
                  </p>
                )}
              </div>
            </div>

            {/* Warning */}
            {settings.bypassApproval && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <FiX className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Atenção
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        Com o bypass ativado, novos usuários terão acesso ao sistema automaticamente.
                        Certifique-se de que isso está alinhado com as políticas de segurança da empresa.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-6 border-t border-gray-200">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <FiLoader className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <FiCheck className="-ml-1 mr-2 h-4 w-4" />
                    Salvar Configurações
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
