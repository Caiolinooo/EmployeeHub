'use client';

import React, { useState, useEffect } from 'react';
import { FiSave, FiRefreshCw, FiUpload } from 'react-icons/fi';
import { useSiteConfig } from '@/contexts/SiteConfigContext';

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
  updatedAt: string;
}

export default function SettingsPage() {
  const siteConfig = useSiteConfig();
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);

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
              console.log('Configuração padrão criada com sucesso');
            }
          } catch (createError) {
            console.error('Erro ao criar configuração padrão:', createError);
          }
        } else {
          throw new Error('Erro ao carregar configurações');
        }
      } else {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      setError('Erro ao carregar configurações. Por favor, tente novamente.');

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
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
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
      console.error(`Erro ao fazer upload do ${type}:`, error);
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
      console.log('Enviando configurações para o servidor:', updatedConfig);

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
          console.error('Erro na resposta da API:', response.status, errorText);
          throw new Error(`Erro ao salvar configurações: ${response.status} ${errorText}`);
        }

        console.log('Resposta da API:', response.status);

        const savedConfig = await response.json();
        console.log('Configuração salva com sucesso:', savedConfig);
        setConfig(savedConfig);
        setSuccess('Configurações salvas com sucesso!');

        // Atualizar o contexto global para aplicar as mudanças imediatamente
        if (siteConfig?.refreshConfig) {
          console.log('Atualizando contexto global de configurações...');
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
        console.error('Erro ao salvar configurações:', error);
        setError('Erro ao salvar configurações. Por favor, tente novamente.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-abz-blue"></div>
        <p className="ml-2">Carregando configurações...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
        Erro ao carregar configurações. Por favor, recarregue a página.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações do Sistema</h1>
        <p className="mt-1 text-sm text-gray-500">
          Personalize as configurações gerais do sistema.
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

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Configurações Gerais
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Última atualização: {new Date(config.updatedAt).toLocaleString()}
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Informações Básicas */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-4">Informações Básicas</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Título do Site
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
                  Nome da Empresa
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

              <div className="md:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={config.description}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                  required
                />
              </div>

              <div>
                <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  E-mail de Contato
                </label>
                <input
                  type="email"
                  id="contactEmail"
                  name="contactEmail"
                  value={config.contactEmail}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                  required
                />
              </div>

              <div>
                <label htmlFor="footerText" className="block text-sm font-medium text-gray-700 mb-1">
                  Texto do Rodapé
                </label>
                <input
                  type="text"
                  id="footerText"
                  name="footerText"
                  value={config.footerText}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                  required
                />
              </div>
            </div>
          </div>

          {/* Aparência */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-4">Aparência</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700 mb-1">
                  Cor Primária
                </label>
                <div className="flex items-center">
                  <input
                    type="color"
                    id="primaryColorPicker"
                    value={config.primaryColor}
                    onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                    className="h-10 w-10 border border-gray-300 rounded mr-2"
                  />
                  <input
                    type="text"
                    id="primaryColor"
                    name="primaryColor"
                    value={config.primaryColor}
                    onChange={handleChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="secondaryColor" className="block text-sm font-medium text-gray-700 mb-1">
                  Cor Secundária
                </label>
                <div className="flex items-center">
                  <input
                    type="color"
                    id="secondaryColorPicker"
                    value={config.secondaryColor}
                    onChange={(e) => setConfig({ ...config, secondaryColor: e.target.value })}
                    className="h-10 w-10 border border-gray-300 rounded mr-2"
                  />
                  <input
                    type="text"
                    id="secondaryColor"
                    name="secondaryColor"
                    value={config.secondaryColor}
                    onChange={handleChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="logo" className="block text-sm font-medium text-gray-700 mb-1">
                  Logo
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    id="logo"
                    name="logo"
                    value={config.logo}
                    onChange={handleChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                    required
                  />
                  <label
                    htmlFor="logoFile"
                    className="ml-2 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue cursor-pointer"
                  >
                    <FiUpload className="inline-block mr-1" />
                    Upload
                  </label>
                  <input
                    type="file"
                    id="logoFile"
                    onChange={(e) => handleFileChange(e, 'logo')}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
                {logoFile && (
                  <p className="mt-1 text-sm text-gray-500">
                    Arquivo selecionado: {logoFile.name}
                  </p>
                )}
                <div className="mt-2">
                  <img
                    src={config.logo}
                    alt="Logo"
                    className="h-12 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-image.png';
                    }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="favicon" className="block text-sm font-medium text-gray-700 mb-1">
                  Favicon
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    id="favicon"
                    name="favicon"
                    value={config.favicon}
                    onChange={handleChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                    required
                  />
                  <label
                    htmlFor="faviconFile"
                    className="ml-2 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue cursor-pointer"
                  >
                    <FiUpload className="inline-block mr-1" />
                    Upload
                  </label>
                  <input
                    type="file"
                    id="faviconFile"
                    onChange={(e) => handleFileChange(e, 'favicon')}
                    className="hidden"
                    accept="image/x-icon,image/png,image/jpeg"
                  />
                </div>
                {faviconFile && (
                  <p className="mt-1 text-sm text-gray-500">
                    Arquivo selecionado: {faviconFile.name}
                  </p>
                )}
                <div className="mt-2">
                  <img
                    src={config.favicon}
                    alt="Favicon"
                    className="h-8 w-8 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-image.png';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={fetchConfig}
            className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
          >
            <FiRefreshCw className="mr-2 h-4 w-4" />
            Recarregar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue disabled:opacity-70"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Salvando...
              </>
            ) : (
              <>
                <FiSave className="mr-2 h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
