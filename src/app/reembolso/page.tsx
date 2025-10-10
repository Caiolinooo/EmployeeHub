'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiDollarSign, FiList, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import MainLayout from '@/components/Layout/MainLayout';
import ReimbursementFormWrapper from '@/components/ReimbursementFormWrapper';
import ErrorBoundary from '@/components/ErrorBoundary';
// Import the components directly to avoid chunk loading issues
import ReimbursementDashboardComponent from '@/components/ReimbursementDashboard';
import ReimbursementApprovalComponent from '@/components/ReimbursementApproval';

// Define a type for the dynamic import result
type DynamicImportResult = { default: React.ComponentType<any> };

// Criar um componente wrapper para usar com React.Suspense
const ReimbursementApproval = () => {
  return <ReimbursementApprovalComponent />;
};

type TabType = 'request' | 'dashboard' | 'approval';

export default function ReembolsoPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin, profile } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState<TabType>('request');
  const [hasApprovalPermission, setHasApprovalPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user has approval permission
  useEffect(() => {
    // Forçar a verificação de permissões para garantir que a aba de aprovação seja exibida corretamente
    console.log({t('reimbursement.verificandoPermissoesDeAprovacaoParaExibirAba')});

    // IMPORTANTE: Garantir que todos os administradores e gerentes tenham acesso
    // independentemente de estarem cadastrados ou não

    // Administradores sempre têm permissão
    if (isAdmin) {
      console.log({t('reimbursement.usuarioEAdministradorConcedendoPermissaoDeAprovaca')});
      setHasApprovalPermission(true);
      setIsLoading(false);
      return;
    }

    // Verificar se o usuário é gerente
    const isManager = profile?.role === 'MANAGER';
    if (isManager) {
      console.log({t('reimbursement.usuarioEGerenteConcedendoPermissaoDeAprovacao')});
      setHasApprovalPermission(true);
      setIsLoading(false);
      return;
    }

    // Verificar permissões específicas - verificar ambos os formatos de permissões
    const hasFeaturePermission = !!(
      profile?.accessPermissions?.features?.reimbursement_approval ||
      profile?.access_permissions?.features?.reimbursement_approval
    );

    // Verificar se o email do usuário é o email do administrador ou de um gerente conhecido
    // Lista de emails de administradores e gerentes
    const adminEmails = [
      'caio.correia@groupabz.com',
      'caio@groupabz.com',
      'caiovaleriogoulartcorreia@gmail.com',
      'admin@groupabz.com',
      'gerente@groupabz.com',
      'manager@groupabz.com'
    ];

    const userEmail = profile?.email || '';

    // Verificar se o email do usuário está na lista de emails de administradores/gerentes
    const isAdminOrManagerEmail = userEmail && adminEmails.includes(userEmail.toLowerCase());

    // Verificar domínio do email (se for do domínio groupabz.com, conceder permissão)
    const isGroupAbzDomain = userEmail && (
      userEmail.toLowerCase().endsWith('@groupabz.com') ||
      userEmail.toLowerCase().endsWith('@abz.com.br')
    );

    console.log({t('reimbursement.verificandoPermissoesDeAprovacao')}, {
      isAdmin,
      isManager,
      hasFeaturePermission,
      role: profile?.role,
      email: userEmail,
      isAdminOrManagerEmail,
      isGroupAbzDomain,
      accessPermissions: profile?.accessPermissions,
      access_permissions: profile?.access_permissions
    });

    // Garantir que as permissões sejam definidas corretamente
    // Conceder permissão para administradores, gerentes, emails específicos e domínios da empresa
    setHasApprovalPermission(
      !!hasFeaturePermission ||
      !!isAdmin ||
      !!isManager ||
      !!isAdminOrManagerEmail ||
      !!isGroupAbzDomain
    );

    setIsLoading(false);
  }, [isAdmin, profile]);

  // Set active tab based on URL parameter
  useEffect(() => {
    if (searchParams) {
      const tab = searchParams.get('tab') as TabType;
      if (tab && ['request', 'dashboard', 'approval'].includes(tab)) {
        console.log(`Definindo aba ativa a partir do URL: ${tab}`);
        setActiveTab(tab);
      } else {
        // Se não houver parâmetro de aba ou for inválido, definir para 'request'
        console.log({t('reimbursement.nenhumaAbaValidaEncontradaNoUrlDefinindoPara')}request"');
        setActiveTab('request');
      }
    }
  }, [searchParams]);

  // Handle tab change
  const handleTabChange = (tab: TabType) => {
    // Permitir acesso à aba de aprovação para todos, mas mostrar mensagem de erro dentro da aba
    // se o usuário não tiver permissão
    console.log(`Mudando para a aba: ${tab}`);

    setActiveTab(tab);
    router.push(`/reembolso?tab=${tab}`, { scroll: false });
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'request':
        return <ReimbursementFormWrapper />;
      case 'dashboard':
        return (
          <ErrorBoundary fallback={
            <div className="p-4 text-center">
              <div className="text-red-500 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-lg font-semibold">Erro ao carregar o dashboard</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Ocorreu um erro ao carregar o dashboard de reembolsos.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Tentar novamente
              </button>
            </div>
          }>
            <ReimbursementDashboardComponent />
          </ErrorBoundary>
        );
      case 'approval':
        // Sempre renderizar o componente de aprovação
        // A verificação de permissão será feita dentro do componente
        return (
          <React.Suspense fallback={
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-abz-blue mx-auto mb-4"></div>
              <p className="text-gray-500">
                {t('reimbursement.loadingApproval', 'Carregando aprovações de reembolsos...')}
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Isso pode levar alguns segundos na primeira vez.
              </p>
            </div>
          }>
            <ErrorBoundary fallback={
              <div className="p-4 text-center">
                <div className="text-red-500 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="text-lg font-semibold">Erro ao carregar a página de aprovação</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Ocorreu um erro ao carregar o componente de aprovação de reembolsos.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Tentar novamente
                </button>
              </div>
            }>
              <ReimbursementApproval />
            </ErrorBoundary>
          </React.Suspense>
        );
      default:
        return <ReimbursementFormWrapper />;
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <FiDollarSign className="h-6 w-6 text-abz-blue mr-2" />
          <h1 className="text-2xl font-bold text-abz-blue">{t('reimbursement.title', 'Reembolso')}</h1>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => handleTabChange('request')}
              className={`py-4 px-6 font-medium text-sm border-b-2 ${
                activeTab === 'request'
                  ? 'border-abz-blue text-abz-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <FiDollarSign className="mr-2" />
                {t('reimbursement.tabs.request', 'Solicitar Reembolso')}
              </div>
            </button>

            <button
              onClick={() => handleTabChange('dashboard')}
              className={`py-4 px-6 font-medium text-sm border-b-2 ${
                activeTab === 'dashboard'
                  ? 'border-abz-blue text-abz-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <FiList className="mr-2" />
                {t('reimbursement.tabs.dashboard', 'Meus Reembolsos')}
              </div>
            </button>

            {/* Always show approval tab for admins and managers, or if user has permission */}
            <button
              onClick={() => handleTabChange('approval')}
              className={`py-4 px-6 font-medium text-sm border-b-2 ${
                activeTab === 'approval'
                  ? 'border-abz-blue text-abz-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              disabled={isLoading}
            >
              <div className="flex items-center">
                <FiCheck className="mr-2" />
                {t('reimbursement.tabs.approval', 'Aprovar Reembolsos')}
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <ErrorBoundary fallback={
            <div className="p-4 text-center">
              <div className="text-red-500 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-lg font-semibold">Erro ao carregar o conteúdo</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Ocorreu um erro ao carregar o conteúdo da página.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Tentar novamente
              </button>
            </div>
          }>
            {renderTabContent()}
          </ErrorBoundary>
        </div>
      </div>
    </MainLayout>
  );
}
