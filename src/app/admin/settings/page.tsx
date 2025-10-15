'use client';

import React, { useState, useEffect } from 'react';
import { FiSave, FiRefreshCw, FiUpload } from 'react-icons/fi';
import { useSiteConfig } from '@/contexts/SiteConfigContext';
import { useI18n } from '@/contexts/I18nContext';

interface SiteConfig {
  id: string;
  title: string;
  description: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
  contactEmail: string;
  footerText: string;
  dashboardTitle: string;
  dashboardDescription: string;
  sidebarTitle?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
  updatedAt: string;
}

export default function SettingsPage() {
  const { t } = useI18n();

  const siteConfig = useSiteConfig();
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);

  // Calendário da empresa (ICS)
  const [calUrlInput, setCalUrlInput] = useState<string>('');
  const [calNotifyMins, setCalNotifyMins] = useState<number>(60);
  const [calExtraRecipients, setCalExtraRecipients] = useState<string>('');
  const [calMarkerColor, setCalMarkerColor] = useState<string>('#6339F5');
  const [calIsSaving, setCalIsSaving] = useState(false);
  const [calLoaded, setCalLoaded] = useState(false);

  const loadCompanyCalendarSettings = async () => {
    try {
      const res = await fetch('/api/admin/calendar/company/settings');
      const data = await res.json();
      if (res.ok) {
        const { ics_url, notify_minutes_before, extra_recipients, marker_color } = data || {};
        setCalUrlInput(ics_url || '');
        setCalNotifyMins(typeof notify_minutes_before === 'number' ? notify_minutes_before : 60);
        setCalExtraRecipients(Array.isArray(extra_recipients) ? extra_recipients.join(', ') : '');
        setCalMarkerColor(typeof marker_color === 'string' ? marker_color : '#6339F5');
      }
    } catch (e) {
      console.error(t('admin.falhaAoCarregarCompanyCalendar'), e);
    } finally {
      setCalLoaded(true);
    }
  };

  // Carregar configurações
  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/config');

      if (!response.ok) {
        if (response.status === 404) {
          // Configuração não encontrada, criar uma padrão
          const defaultConfig = {
            id: 'default',
            title: 'Painel ABZ Group',
            description: 'Painel centralizado para colaboradores da ABZ Group',
            logo: '/images/LC1_Azul.png',
            favicon: '/favicon.ico',
            primaryColor: '#005dff',
            secondaryColor: '#6339F5',
            companyName: 'ABZ Group',
            contactEmail: 'contato@groupabz.com',
            footerText: '© 2024 ABZ Group. Todos os direitos reservados.',
            dashboardTitle: t('admin.painelDeLogisticaAbzGroup'),
            dashboardDescription: t('admin.bemvindoAoCentroDeRecursosParaColaboradoresDaLogis'),
            sidebarTitle: 'Painel ABZ',
            updatedAt: new Date().toISOString(),
          };

          setConfig(defaultConfig);

          // Tentar criar a configuração padrão no servidor
          try {
            const createResponse = await fetch('/api/config', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(defaultConfig),
            });

            if (createResponse.ok) {
              console.log(t('admin.configuracaoPadraoCriadaComSucesso'));
            }
          } catch (createError) {
            console.error(t('admin.erroAoCriarConfiguracaoPadrao'), createError);
          }
        } else {
          throw new Error(t('admin.erroAoCarregarConfiguracoes'));
        }
      } else {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error(t('admin.erroAoCarregarConfiguracoes'), error);
      setError(t('admin.erroAoCarregarConfiguracoesPorFavorTenteNovamente'));

      // Definir configuração padrão mesmo em caso de erro
      setConfig({
        id: 'default',
        title: 'Painel ABZ Group',
        description: 'Painel centralizado para colaboradores da ABZ Group',
        logo: '/images/LC1_Azul.png',
        favicon: '/favicon.ico',
        primaryColor: '#005dff',
        secondaryColor: '#6339F5',
        companyName: 'ABZ Group',
        contactEmail: 'contato@groupabz.com',
        footerText: '© 2024 ABZ Group. Todos os direitos reservados.',
        dashboardTitle: t('admin.painelDeLogisticaAbzGroup'),
        dashboardDescription: t('admin.bemvindoAoCentroDeRecursosParaColaboradoresDaLogis'),
        sidebarTitle: 'Painel ABZ',
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    loadCompanyCalendarSettings();
  }, []);

  // Função para lidar com mudanças nos campos
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (config) {
      setConfig({ ...config, [name]: value });
    }
  };

  // Função para lidar com upload de arquivos
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    if (e.target.files && e.target.files.length > 0) {
      if (type === 'logo') {
        setLogoFile(e.target.files[0]);
      } else {
        setFaviconFile(e.target.files[0]);
      }
    }
  };

  // Função para fazer upload de arquivo
  const uploadFile = async (file: File, type: string): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        return data.files[0].url;
      } else {
        console.error(`Erro ao fazer upload do ${type}`);
        return null;
      }
    } catch (error) {
      console.error(`Erro ao fazer upload do ${type}`, error);
      return null;
    }
  };

  // Função para salvar configurações
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!config) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updatedConfig = { ...config };

      // Fazer upload do logo, se houver
      if (logoFile) {
        const logoUrl = await uploadFile(logoFile, 'images');
        if (logoUrl) {
          updatedConfig.logo = logoUrl;
        }
      }

      // Fazer upload do favicon, se houver
      if (faviconFile) {
        const faviconUrl = await uploadFile(faviconFile, 'images');
        if (faviconUrl) {
          updatedConfig.favicon = faviconUrl;
        }
      }

      // Salvar configurações
      console.log(t('admin.enviandoConfiguracoesParaOServidor'), updatedConfig);

      try {
        const response = await fetch('/api/config', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedConfig),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(t('admin.erroNaRespostaDaAPI'), response.status, errorText);
          throw new Error(t('admin.erroAoSalvarConfiguracoes'));
        }

        console.log(t('admin.respostaDaAPI'), response.status);

        const savedConfig = await response.json();
        console.log(t('admin.configuracaoSalvaComSucesso'), savedConfig);
        setConfig(savedConfig);
        setSuccess(t('admin.configuracoesSalvasComSucesso'));

        // Atualizar o contexto global para aplicar as mudanças imediatamente
        if (siteConfig?.refreshConfig) {
          console.log(t('admin.atualizandoContextoGlobalDeConfiguracoes'));
          await siteConfig.refreshConfig();
        }

        // Limpar arquivos
        setLogoFile(null);
        setFaviconFile(null);

        // Forçar recarregamento da página após 2 segundos para garantir que as mudanças sejam aplicadas
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } catch (error) {
        console.error(t('admin.erroAoSalvarConfiguracoes'), error);
        setError(t('admin.erroAoSalvarConfiguracoesPorFavorTenteNovamente'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-abz-blue"></div>
        <p className="ml-2">{t('admin.carregandoConfiguracoes')}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
        {t('admin.erroAoCarregarConfiguracoesPorFavorRecarregueAPagina')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.configuracoesDoSistema')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('admin.personalizeAsConfiguracoesGeraisDoSistema')}
        </p>
      </div>

      {/* Mensagem de erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Mensagem de sucesso */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Configurações Básicas */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('admin.configuracoesBasicas')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.tituloDoSite')}
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={config.title}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                required
              />
            </div>

            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.nomeDaEmpresa')}
              </label>
              <input
                type="text"
                id="companyName"
                name="companyName"
                value={config.companyName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                required
              />
            </div>

            <div>
              <label htmlFor="dashboardTitle" className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.tituloDoPainelPrincipal')}
              </label>
              <input
                type="text"
                id="dashboardTitle"
                name="dashboardTitle"
                value={config.dashboardTitle}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                placeholder="Painel de Logística ABZ Group"
              />
              <p className="mt-1 text-xs text-gray-500">{t('admin.tituloExibidoNoPainelPrincipal')}</p>
            </div>

            <div>
              <label htmlFor="sidebarTitle" className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.tituloDoMenuLateral')}
              </label>
              <input
                type="text"
                id="sidebarTitle"
                name="sidebarTitle"
                value={config.sidebarTitle || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                placeholder="Painel ABZ"
              />
              <p className="mt-1 text-xs text-gray-500">{t('admin.tituloExibidoNoMenuLateral')}</p>
            </div>

            <div>
              <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.emailDeContato')}
              </label>
              <input
                type="email"
                id="contactEmail"
                name="contactEmail"
                value={config.contactEmail}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.descricaoDoSite')}
              </label>
              <textarea
                id="description"
                name="description"
                value={config.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="dashboardDescription" className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.descricaoDoPainelPrincipal')}
              </label>
              <textarea
                id="dashboardDescription"
                name="dashboardDescription"
                value={config.dashboardDescription}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                placeholder="Bem-vindo ao centro de recursos para colaboradores da logística."
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="footerText" className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.textoDoRodape')}
              </label>
              <input
                type="text"
                id="footerText"
                name="footerText"
                value={config.footerText}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              />
            </div>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={fetchConfig}
            className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
          >
            <FiRefreshCw className="mr-2 h-4 w-4" />
            {t('admin.recarregar')}
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue disabled:opacity-70"
          >
            <FiSave className="mr-2 h-4 w-4" />
            {isSaving ? t('admin.salvando') : t('admin.salvarConfiguracoes')}
          </button>
        </div>
      </form>
    </div>
  );
}