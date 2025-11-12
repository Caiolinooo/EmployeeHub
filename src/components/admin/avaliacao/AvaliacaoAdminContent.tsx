'use client';

import React, { useState, useEffect } from 'react';
import { FiSettings, FiList, FiUsers, FiBarChart2, FiDatabase, FiLoader, FiAlertCircle, FiCalendar, FiUserCheck, FiAward } from 'react-icons/fi';
import { isFeatureEnabled } from '@/lib/featureFlags';
import { useI18n } from '@/contexts/I18nContext';
import MainLayout from '@/components/Layout/MainLayout';
import { CreateCriteriosTable } from '@/components/admin/avaliacao/CreateCriteriosTable';
import { ImportCriteriosButton } from '@/components/admin/avaliacao/ImportCriteriosButton';
import PainelPeriodosAvaliacao from '@/components/admin/PainelPeriodosAvaliacao';
import PainelGerentesAvaliacao from '@/components/admin/PainelConfigGerentesAvaliacaoAdvanced';
import PainelLideresSetor from '@/components/admin/PainelLideresSetor';
import ExecutarMigrationAvaliacao from '@/components/admin/ExecutarMigrationAvaliacao';
import DiagnosticoAdmin from '@/components/admin/DiagnosticoAdmin';
import DiagnosticoForeignKeys from '@/components/admin/DiagnosticoForeignKeys';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

/**
 * Client component for the Avaliacao Admin page content
 */
export default function AvaliacaoAdminContent() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'database' | 'criterios' | 'funcionarios' | 'periodos' | 'gerentes' | 'lideres' | 'config'>('periodos');
  const [settings, setSettings] = useState<any>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const weightedEnvEnabled = isFeatureEnabled('avaliacao_weighted_calc');

  // Carregar settings globais
  useEffect(() => {
    const load = async () => {
      setSettingsLoading(true);
      try {
        const res = await fetch('/api/avaliacao/settings');
        const json = await res.json();
        if (json.success) setSettings(json.data);
      } catch(err) {
        console.warn('Falha ao carregar settings', err);
      } finally {
        setSettingsLoading(false);
      }
    };
    load();
  }, []);

  const toggleWeighted = async () => {
    if (!weightedEnvEnabled) {
      alert('A função de cálculo ponderado está desativada via ambiente. Defina EVALUACAO_WEIGHTED_ENABLED=true para ativar.');
      return;
    }
    const targetMethod = settings?.calculo?.method === 'weighted' ? 'simple_average' : 'weighted';
    try {
      const res = await fetch('/api/avaliacao/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: targetMethod })
      });
      const json = await res.json();
      if (json.success) {
        setSettings(json.data);
      } else {
        alert('Erro ao atualizar método: ' + (json.error || 'desconhecido'));
      }
    } catch (e:any) {
      alert('Falha na requisição: ' + e.message);
    }
  };
                <button
                  onClick={() => setActiveTab('config')}
                  className={`py-4 px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === 'config'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <FiSettings className="inline-block mr-2" />
                  Configuração
                </button>
              {activeTab === 'config' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Configuração de Cálculo</h2>
                  <div className="p-4 border rounded-md bg-gray-50 space-y-4">
                    <p className="text-sm text-gray-600">
                      Controle do método de cálculo das médias. O ambiente deve ter <code className="px-1 bg-yellow-200 rounded">EVALUACAO_WEIGHTED_ENABLED=true</code> para permitir uso de pesos.
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">Cálculo Ponderado</p>
                        <p className="text-xs text-gray-500">Quando ativo, usa pesos configurados por pergunta (default 1).</p>
                      </div>
                      <button
                        onClick={toggleWeighted}
                        disabled={settingsLoading}
                        className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                          settings?.calculo?.method === 'weighted' && weightedEnvEnabled
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-300 hover:bg-gray-400 text-gray-800'
                        }`}
                      >
                        {settingsLoading ? 'Atualizando...' : settings?.calculo?.method === 'weighted' && weightedEnvEnabled ? 'Ativado' : 'Desativado'}
                      </button>
                    </div>
                    {!weightedEnvEnabled && (
                      <div className="text-xs text-red-600">
                        A flag de ambiente não está ativa. Mesmo que o método esteja setado para weighted, o cálculo continuará simples.
                      </div>
                    )}
                  </div>
                </div>
              )}
  const { user, profile, isLoading, isAdmin } = useSupabaseAuth();
  const router = useRouter();

  // Verificar se o usuário é administrador
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      console.log(t('components.usuarioNaoEAdministradorRedirecionando'));
      router.push('/dashboard');
    }
  }, [isLoading, isAdmin, router]);

  // Mostrar tela de carregamento enquanto verifica permissões
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <FiLoader className="animate-spin h-12 w-12 text-blue-600" />
      </div>
    );
  }

  // Se não for administrador, não mostrar nada (será redirecionado)
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Acesso Negado</h1>
          <p className="text-gray-600 mb-4">Você não tem permissão para acessar esta página.</p>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Voltar para o Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.avaliacao.title', 'Administração do Módulo de Avaliação')}
          </h1>
        </div>

        {/* Alerta de Migration Necessária */}
        {activeTab !== 'database' && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg shadow-sm">
            <div className="flex items-start">
              <FiAlertCircle className="text-yellow-600 mt-0.5 mr-3 flex-shrink-0" size={24} />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-800">
                  ⚠️ Migration Necessária
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Para usar este módulo, você precisa executar a migration do banco de dados.
                    Vá para a aba <strong>"Banco de Dados"</strong> e clique em <strong>"Executar Migration"</strong>.
                  </p>
                </div>
                <div className="mt-3">
                  <button
                    onClick={() => setActiveTab('database')}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
                  >
                    <FiDatabase className="mr-1" />
                    Ir para Banco de Dados
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <button
                onClick={() => setActiveTab('periodos')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'periodos'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FiCalendar className="inline-block mr-2" />
                Períodos de Avaliação
              </button>
              <button
                onClick={() => setActiveTab('gerentes')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'gerentes'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FiUserCheck className="inline-block mr-2" />
                Gerentes de Avaliação
              </button>
              <button
                onClick={() => setActiveTab('lideres')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'lideres'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FiAward className="inline-block mr-2" />
                Líderes de Setor
              </button>
              <button
                onClick={() => setActiveTab('criterios')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'criterios'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FiList className="inline-block mr-2" />
                {t('admin.avaliacao.tabs.criterios', 'Critérios')}
              </button>
              <button
                onClick={() => setActiveTab('funcionarios')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'funcionarios'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FiUsers className="inline-block mr-2" />
                {t('admin.avaliacao.tabs.funcionarios', 'Funcionários')}
              </button>
              <button
                onClick={() => setActiveTab('database')}
                className={`py-4 px-6 text-center border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'database'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FiDatabase className="inline-block mr-2" />
                {t('admin.avaliacao.tabs.database', 'Banco de Dados')}
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'periodos' && (
              <PainelPeriodosAvaliacao />
            )}

            {activeTab === 'gerentes' && (
              <PainelGerentesAvaliacao />
            )}

            {activeTab === 'lideres' && (
              <PainelLideresSetor />
            )}

            {activeTab === 'database' && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  {t('admin.avaliacao.database.title', 'Configuração do Banco de Dados')}
                </h2>
                <p className="text-gray-600 mb-6">
                  {t(
                    'admin.avaliacao.database.description',
                    t('components.gerencieAsTabelasDoBancoDeDadosNecessariasParaOMod')
                  )}
                </p>

                <div className="grid grid-cols-1 gap-6">
                  <DiagnosticoAdmin />
                  <DiagnosticoForeignKeys />
                  <ExecutarMigrationAvaliacao />
                  <CreateCriteriosTable />
                  <ImportCriteriosButton />
                </div>
              </div>
            )}

            {activeTab === 'criterios' && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  {t('admin.avaliacao.criterios.title', 'Gerenciamento de Critérios')}
                </h2>
                <p className="text-gray-600 mb-6">
                  {t(
                    'admin.avaliacao.criterios.description',
                    t('components.gerencieOsCriteriosDeAvaliacaoUtilizadosNoSistema')
                  )}
                </p>

                <div className="flex justify-center">
                  <Link
                    href="/avaliacao/criterios"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <FiList className="mr-2 -ml-1 h-5 w-5" />
                    {t('admin.avaliacao.criterios.manage', 'Gerenciar Critérios')}
                  </Link>
                </div>
              </div>
            )}

            {activeTab === 'funcionarios' && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  {t('admin.avaliacao.funcionarios.title', 'Gerenciamento de Funcionários')}
                </h2>
                <p className="text-gray-600 mb-6">
                  {t(
                    'admin.avaliacao.funcionarios.description',
                    t('components.gerencieOsFuncionariosQueParticipamDoProcessoDeAva')
                  )}
                </p>

                <div className="flex justify-center">
                  <Link
                    href="/admin/user-management"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <FiUsers className="mr-2 -ml-1 h-5 w-5" />
                    {t('admin.avaliacao.funcionarios.manage', 'Gerenciar Funcionários')}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

