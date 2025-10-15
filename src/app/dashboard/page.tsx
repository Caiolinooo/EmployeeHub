'use client';

import React, { useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import {
  FiArrowRightCircle,
  FiExternalLink,
  FiDownload,
  FiAlertCircle,
  FiLoader
} from 'react-icons/fi';
import Link from 'next/link';
import dashboardCards, { getTranslatedCards, DashboardCard, iconMap } from '@/data/cards';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSiteConfig } from '@/contexts/SiteConfigContext';
import DashboardSearch from '@/components/Search/DashboardSearch';

import { getCardsCached, invalidateCardsCache } from '@/lib/cardsCache';

// Error Fallback Component
function ErrorFallback({error, resetErrorBoundary}: {error: Error; resetErrorBoundary: () => void}) {
  const { t } = useI18n();
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start">
        <FiAlertCircle className="text-red-500 mt-1 mr-2" />
        <div>
          <h3 className="text-red-800 font-medium">{t('common.error')}</h3>
          <p className="text-red-600 mt-1">{error.message}</p>
          <button
            onClick={resetErrorBoundary}
            className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
          >
            {t('common.tryAgain')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Loading component
function LoadingSpinner() {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center p-8">
      <FiLoader className="animate-spin h-8 w-8 text-abz-blue" />
      <span className="ml-2 text-gray-600">{t('common.loading')}</span>
    </div>
  );
}

export default function Dashboard() {
  const { user, profile, isAdmin, isAuthenticated, isLoading, hasAccess } = useSupabaseAuth();
  const { t, locale } = useI18n();
  const { config } = useSiteConfig();
  const router = useRouter();
  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const fetchCards = React.useCallback(async (retryCount = 0) => {
    try {
      setLoadingCards(true);
      setError(null);

      // Retry fallback to local cache
      if (retryCount > 0) {
        const cachedCards = localStorage.getItem('dashboard-cards-cache');
        if (cachedCards) {
          try {
            const parsedCards = JSON.parse(cachedCards);
            console.log('📦 Usando cards do cache local como fallback');
            setCards(parsedCards);
            setLoadingCards(false);
            return;
          } catch (e) {
            console.warn(t('dashboard.cacheLocalInvalidoRemovendo'));
            localStorage.removeItem('dashboard-cards-cache');
          }
        }
      }

      // Single-source fetch with de-dupe + TTL
      const rawCards = await getCardsCached({
        userId: user?.id || null,
        userRole: (user as any)?.role || null,
        userEmail: (user as any)?.email || null,
        userPhone: (user as any)?.phone_number || null,
      });

      const currentLanguage = locale;
      console.log('🌐 Dashboard - Locale atual:', currentLanguage);
      console.log('📦 Dashboard - Cards do banco:', rawCards?.length || 0);

      const dbCards = (rawCards || []).map((card: any, idx: number) => {
        const title = currentLanguage === 'en-US' && card.titleEn ? card.titleEn : card.title;
        const description = currentLanguage === 'en-US' && card.descriptionEn ? card.descriptionEn : card.description;

        // Debug para o primeiro card
        if (idx === 0) {
          console.log('🔍 Card Debug:', {
            locale: currentLanguage,
            title_pt: card.title,
            title_en: card.titleEn,
            selected_title: title,
            description_pt: card.description,
            description_en: card.descriptionEn,
            selected_description: description
          });
        }

        // Resolve icon component from iconName string
        let resolvedIcon = iconMap[card.iconName || card.icon];
        if (!resolvedIcon) {
          console.warn(`Icon not found in map: ${card.iconName || card.icon}. Using default.`);
          resolvedIcon = FiAlertCircle; // Fallback icon
        }

        return {
          ...card,
          title,
          description,
          icon: resolvedIcon,
          moduleKey: card.module_key || card.moduleKey
        } as DashboardCard;
      });

      console.log(`✅ ${dbCards.length} cards carregados com sucesso`);

      if (dbCards && dbCards.length > 0) {
        try {
          localStorage.setItem('dashboard-cards-cache', JSON.stringify(dbCards));
          console.log('💾 Cards salvos no cache local');
        } catch (e) {
          console.warn(t('dashboard.naoFoiPossivelSalvarNoCacheLocal'), e);
        }
        setCards(dbCards);
      } else {
        console.log('⚠️ Nenhum card encontrado, usando cards hardcoded');
        setCards(getTranslatedCards((key: string) => t(key)));
      }
    } catch (err) {
      console.error('Error loading cards:', err);
      if (retryCount < 2) {
        console.log(`🔄 Tentando novamente em 2 segundos... (tentativa ${retryCount + 2})`);
        setTimeout(() => {
          fetchCards(retryCount + 1);
        }, 2000);
        return;
      }
      const cachedCards = localStorage.getItem('dashboard-cards-cache');
      if (cachedCards) {
        try {
          const parsedCards = JSON.parse(cachedCards);
          console.log(t('dashboard.usandoCardsDoCacheLocalAposErro'));
          setCards(parsedCards);
          setError('Usando dados em cache. Alguns cards podem estar desatualizados.');
          setLoadingCards(false);
          return;
        } catch (e) {
          console.warn(t('dashboard.cacheLocalInvalido'));
          localStorage.removeItem('dashboard-cards-cache');
        }
      }
      console.log(t('dashboard.erroCriticoUsandoCardsHardcoded'));
      setCards(getTranslatedCards((key: string) => t(key)));
      setError(t('dashboard.naoFoiPossivelCarregarOsCardsPersonalizadosUsandoC'));
    } finally {
      setLoadingCards(false);
    }
  }, [user, locale, t]);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (isAuthenticated) {
      fetchCards();
    } else if (!isLoading) {
      setCards(getTranslatedCards((key: string) => t(key)));
      setLoadingCards(false);
    }
  }, [isAuthenticated, isLoading, router, t, fetchCards]);

  // Função para limpar cache e recarregar
  const clearCacheAndReload = () => {
    localStorage.removeItem('dashboard-cards-cache');
    invalidateCardsCache({ userId: (user as any)?.id || null, userRole: (user as any)?.role || null });
    setError(null);
    if (isAuthenticated) {
      fetchCards();
    }
  };

  // Efeito adicional para atualizar traduções quando o idioma muda
  useEffect(() => {
    if (!loadingCards && cards.length > 0) {
      // Verificar se os cards atuais são do banco (têm titleEn/descriptionEn) ou estáticos
      const hasDbCards = cards.some(card => 'titleEn' in card || 'descriptionEn' in card);

      if (!hasDbCards) {
        // Se são cards estáticos, atualizar as traduções
        console.log(t('dashboard.atualizandoTraducoesDosCardsEstaticosParaIdioma'), locale);
        setCards(getTranslatedCards((key: string) => t(key)));
      }
    }
  }, [locale, t, loadingCards]); // Removido 'cards' das dependências para evitar loop infinito

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        setError(null);
        setCards(getTranslatedCards((key: string) => t(key)));
      }}
    >
      <MainLayout>
          <div className="space-y-8">
            <div className="pb-5 border-b border-gray-200">
              {/* Saudação personalizada com nome do usuário */}
              {user && (
                <div className="mb-4">
                  <h1 className="text-2xl font-bold text-gray-800">
                    {t('dashboard.greeting', locale === 'en-US' ? 'Welcome' : 'Olá')}, {
                      profile?.first_name?.split(' ')[0] ||
                      (user as any).first_name?.split(' ')[0] ||
                      (user as any).firstName?.split(' ')[0] ||
                      user.email?.split('@')[0]?.split('.')[0] || t('dashboard.usuario')
                    }! 👋
                  </h1>
                </div>
              )}

              <h2 className="text-3xl font-extrabold text-abz-blue-dark">
                {t('dashboard.logisticsPanel', config.dashboardTitle || 'ABZ Group')}
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                {t('dashboard.welcomeMessage', config.dashboardDescription || '')}
              </p>
            </div>

            {/* Busca Global */}
            <div className="mb-8">
              <DashboardSearch />
            </div>

            {/* Loading State */}
            {loadingCards && (
              <div className="flex justify-center items-center py-12">
                <LoadingSpinner />
              </div>
            )}

            {/* Error/Warning State */}
            {error && !loadingCards && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <FiAlertCircle className="text-yellow-600 mt-1 mr-2" />
                  <div className="flex-1">
                    <h3 className="font-medium text-yellow-800">Aviso</h3>
                    <p className="text-sm text-yellow-700 mt-1">{error}</p>
                    <div className="mt-2 space-x-4">
                      <button
                        onClick={() => {
                          setError(null);
                          fetchCards();
                        }}
                        className="text-yellow-800 underline text-sm hover:text-yellow-900 transition-colors"
                      >
                        Tentar carregar novamente
                      </button>
                      <button
                        onClick={clearCacheAndReload}
                        className="text-yellow-800 underline text-sm hover:text-yellow-900 transition-colors"
                      >
                        Limpar cache e recarregar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!loadingCards && !error && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {cards
                  .filter(card => {
                    // Nunca mostrar o card de admin no dashboard
                    if (card.id === 'admin') return false;

                    if (!card.enabled) return false;
                    if (card.adminOnly && !isAdmin) return false;
                    if (card.managerOnly && !(isAdmin || user?.role === 'MANAGER')) return false;

                    // Caso especial para avaliação - sempre mostrar para usuários autenticados
                    if (card.moduleKey === 'avaliacao') {
                      return !!user;
                    }

                    // Caso especial para academy - sempre mostrar para usuários autenticados
                    if (card.moduleKey === 'academy') {
                      return !!user;
                    }

                    if (card.moduleKey && !hasAccess(card.moduleKey)) return false;
                    return true;
                  })
                  .sort((a, b) => a.order - b.order)
                  .map((card) => {
                    // Mapear o iconName para o componente de ícone real
                    const Icon = card.iconName && iconMap[card.iconName]
                      ? iconMap[card.iconName]
                      : card.icon || iconMap.FiGrid;

                    // Aplicar tradução se disponível
                    const cardTitle = locale === 'en-US' && (card as any).titleEn
                      ? (card as any).titleEn
                      : card.title;
                    const cardDescription = locale === 'en-US' && (card as any).descriptionEn
                      ? (card as any).descriptionEn
                      : card.description;

                    return (
                      <div
                        key={card.id}
                        className="bg-white rounded-lg shadow-md p-5 transition-shadow hover:shadow-lg flex flex-col h-full"
                      >
                        <div className="flex items-start mb-3">
                          <div className="bg-abz-light-blue p-3 rounded-full mr-3 flex-shrink-0">
                            <Icon className="text-abz-blue w-5 h-5" />
                          </div>
                          <h3 className="font-semibold text-abz-text-black flex-1">{cardTitle}</h3>
                        </div>

                        <p className="text-sm text-abz-text-dark mb-4 flex-grow">
                          {cardDescription}
                        </p>

                        <div className="mt-auto pt-4 border-t border-gray-100">
                          {card.external ? (
                            <a
                              href={card.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-4 py-2 text-white rounded-md hover:opacity-90 transition-colors text-sm font-medium shadow-sm"
                              style={{backgroundColor: config.primaryColor}}
                            >
                              <FiExternalLink className="mr-1.5" />
                              {t('dashboard.access')}
                            </a>
                          ) : (
                            <Link
                              href={card.href}
                              className="inline-flex items-center px-4 py-2 text-white rounded-md hover:opacity-90 transition-colors text-sm font-medium shadow-sm"
                              style={{backgroundColor: config.primaryColor}}
                            >
                              <FiArrowRightCircle className="mr-1.5" />
                              {t('dashboard.access')}
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {!loadingCards && !error && cards.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <p className="text-gray-600">
                  {t('dashboard.noCards')}
                </p>
              </div>
            )}

            <div className="bg-abz-light-blue bg-opacity-40 rounded-lg border border-abz-blue border-opacity-20 p-6 mt-6">
              <h2 className="text-lg font-semibold text-abz-blue-dark mb-2">
                {t('dashboard.quickAccessFeatures')}
              </h2>
              <div className="text-sm text-gray-600 space-y-2">
                <p>{t('dashboard.centralizedPanel')}</p>
                <p>{t('dashboard.contactSupport')}</p>
              </div>
              {isAdmin && (
                <div className="mt-4 pt-4 border-t border-abz-blue border-opacity-20">
                  <Link
                    href="/admin"
                    style={{
                      backgroundColor: config.secondaryColor,
                      color: config.secondaryColor === '#ffffff' ? '#000000' : '#ffffff'
                    }}
                    className="inline-flex items-center px-4 py-2 rounded-md hover:opacity-90 transition-colors text-sm font-medium shadow-sm"
                  >
                    {t('dashboard.accessAdminPanel')}
                  </Link>
                </div>
              )}
            </div>
          </div>
      </MainLayout>
    </ErrorBoundary>
  );
}
