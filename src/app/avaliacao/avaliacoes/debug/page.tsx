'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { FiFileText, FiArrowLeft, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import PageHeader from '@/components/PageHeader';
import MainLayout from '@/components/Layout/MainLayout';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { getToken } from '@/lib/tokenStorage';
import ClientOnly from '@/components/ClientOnly';

/**
 * Página de depuração para identificar problemas na rota de avaliações
 */
export default function AvaliacoesDebugPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, profile, isAdmin, isManager } = useSupabaseAuth();

  const [authStatus, setAuthStatus] = useState<any>({});
  const [tokenStatus, setTokenStatus] = useState<any>({});
  const [apiStatus, setApiStatus] = useState<any>({});
  const [routerStatus, setRouterStatus] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verificar autenticação e token
  useEffect(() => {
    async function checkAuth() {
      try {
        setIsLoading(true);

        // Verificar status de autenticação
        const authInfo = {
          user: user ? 'Autenticado' : 'Não autenticado',
          userId: user?.id || 'N/A',
          email: user?.email || 'N/A',
          profile: profile ? `Role: ${profile.role}` : 'Sem perfil',
          isAdmin,
          isManager,
          canAccessEvaluations: isAdmin || isManager
        };

        setAuthStatus(authInfo);
        console.log('Status de autenticação:', authInfo);

        // Verificar token
        const token = getToken();
        const tokenInfo = {
          exists: !!token,
          length: token ? token.length : 0
        };

        setTokenStatus(tokenInfo);
        console.log('Status do token:', tokenInfo);

        // Testar API
        if (token) {
          try {
            console.log('Testando API com token...');
            const headers = {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            };

            // Adicionar timestamp para evitar cache
            const timestamp = new Date().getTime();
            const response = await fetch(`/api/avaliacao-desempenho/avaliacoes?_=${timestamp}`, {
              headers,
              cache: 'no-store',
              next: { revalidate: 0 }
            });

            const responseStatus = {
              status: response.status,
              statusText: response.statusText,
              ok: response.ok
            };

            console.log('Resposta da API:', responseStatus);

            let responseData = null;
            try {
              responseData = await response.json();
              console.log('Dados da API:', responseData);
            } catch (e) {
              console.error('Erro ao parsear resposta:', e);
            }

            setApiStatus({
              ...responseStatus,
              data: responseData
            });
          } catch (apiError) {
            console.error('Erro ao testar API:', apiError);
            setApiStatus({
              error: apiError instanceof Error ? apiError.message : 'Erro desconhecido'
            });
          }
        } else {
          setApiStatus({
            error: 'Token não disponível para testar API'
          });
        }

        // Verificar status do router
        try {
          setRouterStatus({
            available: !!router,
            methods: Object.keys(router || {}).join(', ')
          });
        } catch (routerError) {
          console.error('Erro ao verificar router:', routerError);
          setRouterStatus({
            error: routerError instanceof Error ? routerError.message : 'Erro desconhecido'
          });
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        setError(error instanceof Error ? error.message : 'Erro desconhecido');
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, [user, profile, isAdmin, isManager, router]);

  return (
    <ClientOnly>
      <MainLayout>
        <div className="space-y-8">
          <PageHeader
            title={t('avaliacao.debug.title', 'Depuração de Avaliações')}
            description={t('avaliacao.debug.description', 'Ferramenta para identificar problemas na rota de avaliações')}
            icon={<FiFileText className="w-8 h-8" />}
          />

          <div className="mb-4">
            <Link
              href="/avaliacao"
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <FiArrowLeft className="mr-1" />
              {t ? t('common.voltar', 'Voltar') : 'Voltar'}
            </Link>
          </div>

          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">{t('avaliacao.debug.systemDiagnostic', 'Diagnóstico do Sistema')}</h2>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
            >
              <FiRefreshCw className="mr-2 -ml-1 h-5 w-5" />
              {t('common.refresh', 'Atualizar')}
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <strong className="font-bold">{t('common.error', 'Erro!')} </strong>
              <span className="block sm:inline ml-2">{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-abz-blue"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status de Autenticação */}
              <div className="bg-white shadow overflow-hidden rounded-lg">
                <div className="px-4 py-5 sm:px-6 bg-gray-50">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">{t('avaliacao.debug.authStatus', 'Status de Autenticação')}</h3>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    {Object.entries(authStatus).map(([key, value]) => (
                      <div key={key} className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">{key}</dt>
                        <dd className="mt-1 text-sm text-gray-900">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>

              {/* Status do Token */}
              <div className="bg-white shadow overflow-hidden rounded-lg">
                <div className="px-4 py-5 sm:px-6 bg-gray-50">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">{t('avaliacao.debug.tokenStatus', 'Status do Token')}</h3>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    {Object.entries(tokenStatus).map(([key, value]) => (
                      <div key={key} className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">{key}</dt>
                        <dd className="mt-1 text-sm text-gray-900">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>

              {/* Status do Router */}
              <div className="bg-white shadow overflow-hidden rounded-lg">
                <div className="px-4 py-5 sm:px-6 bg-gray-50">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">{t('avaliacao.debug.routerStatus', 'Status do Router')}</h3>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    {Object.entries(routerStatus).map(([key, value]) => (
                      <div key={key} className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">{key}</dt>
                        <dd className="mt-1 text-sm text-gray-900">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>

              {/* Status da API */}
              <div className="bg-white shadow overflow-hidden rounded-lg">
                <div className="px-4 py-5 sm:px-6 bg-gray-50">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">{t('avaliacao.debug.apiStatus', 'Status da API')}</h3>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    {Object.entries(apiStatus).filter(([key]) => key !== 'data').map(([key, value]) => (
                      <div key={key} className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">{key}</dt>
                        <dd className="mt-1 text-sm text-gray-900">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>

                  {apiStatus.data && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">{t('avaliacao.debug.apiData', 'Dados da API')}</h4>
                      <pre className="bg-gray-50 p-4 rounded overflow-auto text-xs">
                        {JSON.stringify(apiStatus.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Links para Navegação */}
              <div className="bg-white shadow overflow-hidden rounded-lg">
                <div className="px-4 py-5 sm:px-6 bg-gray-50">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">{t('avaliacao.debug.navigationLinks', 'Links para Navegação')}</h3>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">{t('avaliacao.debug.directLinks', 'Links Diretos (window.location)')}</h4>
                      <ul className="space-y-2">
                        <li>
                          <button
                            onClick={() => router.push('/avaliacao')}
                            className="text-abz-blue hover:underline"
                          >
                            {t('avaliacao.debug.dashboardLink', 'Dashboard de Avaliações')} (window.location → router)
                          </button>
                        </li>
                        <li>
                          <Link
                            href="/avaliacao/lista-avaliacoes"
                            className="text-abz-blue hover:underline"
                          >
                            {t('avaliacao.debug.evaluationListLink', 'Lista de Avaliações')} (Link)
                          </Link>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">{t('avaliacao.debug.routerLinks', 'Links via Router')}</h4>
                      <ul className="space-y-2">
                        <li>
                          <button
                            onClick={() => router.push('/avaliacao')}
                            className="text-abz-blue hover:underline"
                          >
                            {t('avaliacao.debug.dashboardLink', 'Dashboard de Avaliações')} (router.push)
                          </button>
                        </li>
                        <li>
                          <Link
                            href="/avaliacao/lista-avaliacoes"
                            className="text-abz-blue hover:underline"
                          >
                            {t('avaliacao.debug.evaluationListLink', 'Lista de Avaliações')} (Link)
                          </Link>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">{t('avaliacao.debug.linkComponentLinks', 'Links via Link Component')}</h4>
                      <ul className="space-y-2">
                        <li>
                          <Link href="/avaliacao" className="text-abz-blue hover:underline">
                            {t('avaliacao.debug.dashboardLink', 'Dashboard de Avaliações')} (Link)
                          </Link>
                        </li>
                        <li>
                          <Link href="/avaliacao/lista-avaliacoes" className="text-abz-blue hover:underline">
                            {t('avaliacao.debug.evaluationListLink', 'Lista de Avaliações')} (Link)
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </MainLayout>
    </ClientOnly>
  );
}

