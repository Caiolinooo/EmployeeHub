'use client';

import React, { useState, useEffect } from 'react';
import { FiSave, FiRefreshCw, FiUpload } from 'react-icons/fi';
import { useSiteConfig } from '@/contexts/SiteConfigContext';
import { useI18n } from '@/contexts/I18nContext';
import { safeImageSrc } from '@/lib/safe-image-src';

interface SiteConfig {
  id: string;
  title: string;
  description: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  login_logo?: string;
  sidebar_logo?: string;
  widget_logo?: string;
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
  const currentSiteTitle = siteConfig?.config?.title || 'Painel ABZ';
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loginLogoFile, setLoginLogoFile] = useState<File | null>(null);
  const [sidebarLogoFile, setSidebarLogoFile] = useState<File | null>(null);
  const [widgetLogoFile, setWidgetLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [selectedLocale, setSelectedLocale] = useState<'pt-BR' | 'en-US' | 'es-ES'>('pt-BR');

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
          // Configuração não encontrada, criar uma padrão usando título do site atual
          const defaultConfig = {
            id: 'default',
            title: currentSiteTitle,
            description: siteConfig?.config?.description || '',
            logo: siteConfig?.config?.logo || '/images/LC1_Azul.png',
            favicon: siteConfig?.config?.favicon || '/favicon.ico',
            primaryColor: siteConfig?.config?.primaryColor || '#005dff',
            secondaryColor: siteConfig?.config?.secondaryColor || '#6339F5',
            companyName: siteConfig?.config?.companyName || 'ABZ Group',
            contactEmail: siteConfig?.config?.contactEmail || 'contato@groupabz.com',
            footerText: siteConfig?.config?.footerText || '© 2024 ABZ Group. Todos os direitos reservados.',
            dashboardTitle: siteConfig?.config?.dashboardTitle || '',
            dashboardDescription: siteConfig?.config?.dashboardDescription || '',
            sidebarTitle: siteConfig?.config?.sidebarTitle || currentSiteTitle,
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

      // Definir configuração padrão mesmo em caso de erro usando título do site atual
      setConfig({
        id: 'default',
        title: currentSiteTitle,
        description: siteConfig?.config?.description || '',
        logo: siteConfig?.config?.logo || '/images/LC1_Azul.png',
        favicon: siteConfig?.config?.favicon || '/favicon.ico',
        primaryColor: siteConfig?.config?.primaryColor || '#005dff',
        secondaryColor: siteConfig?.config?.secondaryColor || '#6339F5',
        companyName: siteConfig?.config?.companyName || 'ABZ Group',
        contactEmail: siteConfig?.config?.contactEmail || 'contato@groupabz.com',
        footerText: siteConfig?.config?.footerText || '© 2024 ABZ Group. Todos os direitos reservados.',
        dashboardTitle: siteConfig?.config?.dashboardTitle || '',
        dashboardDescription: siteConfig?.config?.dashboardDescription || '',
        sidebarTitle: siteConfig?.config?.sidebarTitle || currentSiteTitle,
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
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'login_logo' | 'sidebar_logo' | 'widget_logo' | 'favicon') => {
    if (e.target.files && e.target.files.length > 0) {
      if (type === 'logo') {
        setLogoFile(e.target.files[0]);
      } else if (type === 'login_logo') {
        setLoginLogoFile(e.target.files[0]);
      } else if (type === 'sidebar_logo') {
        setSidebarLogoFile(e.target.files[0]);
      } else if (type === 'widget_logo') {
        setWidgetLogoFile(e.target.files[0]);
      } else {
        setFaviconFile(e.target.files[0]);
      }
    }
  };

  const handleRemoveImage = (type: 'logo' | 'login_logo' | 'sidebar_logo' | 'widget_logo') => {
    if (config) {
      setConfig({ ...config, [type]: '' });
      if (type === 'logo') setLogoFile(null);
      if (type === 'login_logo') setLoginLogoFile(null);
      if (type === 'sidebar_logo') setSidebarLogoFile(null);
      if (type === 'widget_logo') setWidgetLogoFile(null);
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

  // Função para correção automática (API)
  const handleAutoFix = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/config/fix', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Correção automática concluída:', data);
        setSuccess('✅ Correção automática concluída! Recarregando...');

        // Recarregar configurações
        await fetchConfig();

        // Atualizar contexto
        if (siteConfig?.refreshConfig) {
          await siteConfig.refreshConfig();
        }

        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        const errorData = await response.json();
        setError(`Erro na correção automática: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Erro na correção automática:', error);
      setError('Erro ao executar correção automática');
    } finally {
      setIsSaving(false);
    }
  };

  // Função para limpar valores padrão manualmente
  const handleClearDefaults = async () => {
    if (!config) return;

    const clearedConfig = {
      ...config,
      sidebarTitle: '',
      dashboardTitle: '',
      dashboardDescription: ''
    };

    setConfig(clearedConfig);
    setSuccess('Valores padrão limpos! Clique em "Salvar" para confirmar.');
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

      // Fazer upload do logo principal, se houver
      if (logoFile) {
        const logoUrl = await uploadFile(logoFile, 'images');
        if (logoUrl) {
          updatedConfig.logo = logoUrl;
        }
      }

      // Upload Login Logo
      if (loginLogoFile) {
        const url = await uploadFile(loginLogoFile, 'images');
        if (url) updatedConfig.login_logo = url;
      }

      // Upload Sidebar Logo
      if (sidebarLogoFile) {
        const url = await uploadFile(sidebarLogoFile, 'images');
        if (url) updatedConfig.sidebar_logo = url;
      }

      // Upload Widget Logo
      if (widgetLogoFile) {
        const url = await uploadFile(widgetLogoFile, 'images');
        if (url) updatedConfig.widget_logo = url;
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
          console.log('Contexto atualizado. Novo sidebarTitle:', siteConfig.config?.sidebarTitle);
        }

        // Limpar arquivos
        setLogoFile(null);
        setLoginLogoFile(null);
        setSidebarLogoFile(null);
        setWidgetLogoFile(null);
        setFaviconFile(null);

        // Não recarregar a página - deixar o contexto atualizar automaticamente
        console.log('Configurações salvas. O contexto deve atualizar automaticamente.');
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

      {/* Botão de Correção Automática */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-red-900 mb-2">
              🔧 Correção Automática de Configurações
            </h3>
            <p className="text-sm text-red-700 mb-4">
              Se os títulos e descrições não estão sendo salvos corretamente ou aparecem valores antigos,
              clique aqui para corrigir automaticamente. Esta ação irá:
            </p>
            <ul className="text-sm text-red-600 list-disc list-inside mb-4 space-y-1">
              <li>Adicionar campos faltantes no banco de dados</li>
              <li>Limpar todos os valores padrão antigos (ABZ, Painel, etc.)</li>
              <li>Recarregar as configurações</li>
            </ul>
          </div>
          <button
            onClick={handleAutoFix}
            disabled={isSaving}
            className="ml-4 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {isSaving ? 'Corrigindo...' : '🔧 CORRIGIR AGORA'}
          </button>
        </div>
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
            {/* Seletor de Idioma */}
            <div className="md:col-span-2 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.logoDoSite') || 'Logo do Site'}
              </label>
              <div className="flex items-center space-x-6">
                <div className="shrink-0">
                  {logoFile ? (
                    <img
                      className="h-16 w-16 object-contain rounded-lg border border-gray-200 bg-gray-50"
                      src={safeImageSrc(URL.createObjectURL(logoFile))}
                      alt="New logo preview"
                    />
                  ) : (
                    <img
                      className="h-16 w-16 object-contain rounded-lg border border-gray-200 bg-gray-50"
                      src={safeImageSrc(config.logo || '/images/LC1_Azul.png')}
                      alt="Current logo"
                    />
                  )}
                </div>
                <label className="block">
                  <span className="sr-only">Escolher logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'logo')}
                    className="block w-full text-sm text-slate-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                    "
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Recomendado: PNG ou SVG com fundo transparente. Altura máxima: 64px.
              </p>
            </div>

            {/* Login Logo */}
            <div className="md:col-span-2 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo da Página de Login
              </label>
              <div className="flex items-center space-x-6">
                <div className="shrink-0 relative group">
                  {loginLogoFile ? (
                    <img className="h-16 w-16 object-contain rounded-lg border border-gray-200 bg-gray-50" src={safeImageSrc(URL.createObjectURL(loginLogoFile))} alt="Preview" />
                  ) : (
                    <img className="h-16 w-16 object-contain rounded-lg border border-gray-200 bg-gray-50" src={safeImageSrc(config.login_logo || '/images/LC1_Azul.png')} alt="Current" />
                  )}
                  {config.login_logo && <button type="button" onClick={() => handleRemoveImage('login_logo')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600">x</button>}
                </div>
                <label className="block">
                  <span className="sr-only">Escolher logo login</span>
                  <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'login_logo')}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                </label>
              </div>
            </div>

            {/* Sidebar Logo */}
            <div className="md:col-span-2 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo do Menu Lateral
              </label>
              <div className="flex items-center space-x-6">
                <div className="shrink-0 relative group">
                  {sidebarLogoFile ? (
                    <img className="h-16 w-16 object-contain rounded-lg border border-gray-200 bg-gray-50" src={safeImageSrc(URL.createObjectURL(sidebarLogoFile))} alt="Preview" />
                  ) : (
                    <img className="h-16 w-16 object-contain rounded-lg border border-gray-200 bg-gray-50" src={safeImageSrc(config.sidebar_logo || '/images/LC1_Azul.png')} alt="Current" />
                  )}
                  {config.sidebar_logo && <button type="button" onClick={() => handleRemoveImage('sidebar_logo')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600">x</button>}
                </div>
                <label className="block">
                  <span className="sr-only">Escolher logo sidebar</span>
                  <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'sidebar_logo')}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                </label>
              </div>
            </div>

            {/* Widget Logo */}
            <div className="md:col-span-2 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo do Widget/Menu
              </label>
              <div className="flex items-center space-x-6">
                <div className="shrink-0 relative group">
                  {widgetLogoFile ? (
                    <img className="h-16 w-16 object-contain rounded-lg border border-gray-200 bg-gray-50" src={safeImageSrc(URL.createObjectURL(widgetLogoFile))} alt="Preview" />
                  ) : (
                    <img className="h-16 w-16 object-contain rounded-lg border border-gray-200 bg-gray-50" src={safeImageSrc(config.widget_logo || '/images/LC1_Azul.png')} alt="Current" />
                  )}
                  {config.widget_logo && <button type="button" onClick={() => handleRemoveImage('widget_logo')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600">x</button>}
                </div>
                <label className="block">
                  <span className="sr-only">Escolher logo widget</span>
                  <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'widget_logo')}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                </label>
              </div>
            </div>

            <div className="md:col-span-2 mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Idioma para Configuração
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLocale('pt-BR')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${selectedLocale === 'pt-BR'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                  🇧🇷 Português
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLocale('en-US')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${selectedLocale === 'en-US'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                  🇺🇸 English
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLocale('es-ES')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${selectedLocale === 'es-ES'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                  🇪🇸 Español
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Selecione o idioma para configurar os textos. Os textos serão exibidos de acordo com o idioma selecionado pelo usuário.
              </p>
            </div>

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.tituloDoSite')} ({selectedLocale})
              </label>
              <input
                type="text"
                id="title"
                name={`title_${selectedLocale}`}
                value={config[`title_${selectedLocale}` as keyof SiteConfig] as string || config.title}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                placeholder={selectedLocale === 'pt-BR' ? currentSiteTitle : selectedLocale === 'en-US' ? currentSiteTitle : currentSiteTitle}
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('admin.deixeVazioParaNaoExibir')}
              </p>
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
                value={config.dashboardTitle || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                placeholder=""
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('admin.tituloExibidoNoPainelPrincipal')}. {t('admin.deixeVazioParaNaoExibir')}
              </p>
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
                placeholder={currentSiteTitle}
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('admin.tituloExibidoNoMenuLateral')}. {t('admin.deixeVazioParaNaoExibir')}
              </p>
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
                placeholder=""
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('admin.deixeVazioParaNaoExibir')}
              </p>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="dashboardDescription" className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.descricaoDoPainelPrincipal')}
              </label>
              <textarea
                id="dashboardDescription"
                name="dashboardDescription"
                value={config.dashboardDescription || ''}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                placeholder=""
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('admin.deixeVazioParaNaoExibir')}
              </p>
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
        <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 flex justify-between">
          <button
            type="button"
            onClick={handleClearDefaults}
            className="inline-flex justify-center py-2 px-4 border border-orange-300 shadow-sm text-sm font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            <FiRefreshCw className="mr-2 h-4 w-4" />
            Limpar Títulos e Descrições
          </button>
          <div className="flex space-x-3">
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
        </div>
      </form>
    </div>
  );
}