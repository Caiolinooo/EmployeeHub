'use client';

import React, { useState, useEffect } from 'react';
import { FiSettings, FiList, FiUsers, FiBarChart2, FiDatabase, FiLoader, FiAlertCircle, FiCalendar, FiUserCheck, FiAward } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import MainLayout from '@/components/Layout/MainLayout';
import { CreateCriteriosTable } from '@/components/admin/avaliacao/CreateCriteriosTable';
import { ImportCriteriosButton } from '@/components/admin/avaliacao/ImportCriteriosButton';
import PainelPeriodosAvaliacao from '@/components/admin/PainelPeriodosAvaliacao';
import PainelGerentesAvaliacao from '@/components/admin/PainelGerentesAvaliacao';
import PainelLideresSetor from '@/components/admin/PainelLideresSetor';
import ExecutarMigrationAvaliacao from '@/components/admin/ExecutarMigrationAvaliacao';
import DiagnosticoAdmin from '@/components/admin/DiagnosticoAdmin';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

/**
 * Client component for the Avaliacao Admin page content
 */
export default function AvaliacaoAdminContent() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'database' | 'criterios' | 'funcionarios' | 'periodos' | 'gerentes' | 'lideres'>('periodos');
  const { user, profile, isLoading, isAdmin } = useSupabaseAuth();
  const router = useRouter();

  // Verificar se o usuário é administrador
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      console.log('Usuário não é administrador, redirecionando...');
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.avaliacao.title', 'Administração do Módulo de Avaliação')}
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px overflow-x-auto">
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
                    'Gerencie as tabelas do banco de dados necessárias para o módulo de avaliação de desempenho.'
                  )}
                </p>

                <div className="grid grid-cols-1 gap-6">
                  <DiagnosticoAdmin />
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
                    'Gerencie os critérios de avaliação utilizados no sistema.'
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
                    'Gerencie os funcionários que participam do processo de avaliação.'
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

