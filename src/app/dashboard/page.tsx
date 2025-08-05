'use client';

import React, { useEffect, useState, Suspense } from 'react';
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
  const { user, isAdmin, isAuthenticated, isLoading } = useSupabaseAuth();
  const { t, locale } = useI18n();
  const { config } = useSiteConfig();
  const router = useRouter();
  const [cards, setCards] = useState<DashboardCard[]>(getTranslatedCards((key: string) => t(key)));
  const [loadingCards, setLoadingCards] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
      return;
    }

    const fetchCards = async () => {
      try {
        setLoadingCards(true);
        setError(null);

        const response = await fetch('/api/cards');
        if (!response.ok) {
          throw new Error('Failed to fetch cards');
        }

        const data = await response.json();
        const currentLanguage = locale;

        const dbCards = data.map((card: any) => {
          const title = currentLanguage === 'en-US' && card.titleEn ? card.titleEn : card.title;
          const description = currentLanguage === 'en-US' && card.descriptionEn ? card.descriptionEn : card.description;

          // Resolve icon component from iconName string
          let resolvedIcon = iconMap[card.icon]; // card.icon is expected to be a string like 'FiBookOpen'
          if (!resolvedIcon) {
            console.warn(`Icon not found in map: ${card.icon}. Using default.`);
            resolvedIcon = FiAlertCircle; // Fallback icon
          }

          return {
            ...card,
            title,
            description,
            icon: resolvedIcon, // Use the resolved icon component
          };
        });

        if (dbCards && dbCards.length > 0) {
          setCards(dbCards);
        }
      } catch (err) {
        console.error('Error loading cards:', err);
        // Fallback to static cards - refresh with current translations
        setCards(getTranslatedCards((key: string) => t(key)));
      } finally {
        setLoadingCards(false);
      }
    };

    if (isAuthenticated) {
      fetchCards();
    }
  }, [t, isAuthenticated, isLoading, router, locale]);

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
        <Suspense fallback={<LoadingSpinner />}>
          <div className="space-y-8">
            <div className="pb-5 border-b border-gray-200">
              <h1 className="text-3xl font-extrabold text-abz-blue-dark">
                {t('dashboard.logisticsPanel')}
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                {t('dashboard.welcomeMessage')}
              </p>
            </div>

            {loadingCards && <LoadingSpinner />}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <FiAlertCircle className="text-red-500 mt-1 mr-2" />
                  <div>
                    <h3 className="font-medium text-red-800">{t('common.error')}</h3>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {!loadingCards && !error && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {cards
                  .filter(card => {
                    if (!card.enabled) return false;
                    if (card.adminOnly && !isAdmin) return false;
                    if (card.managerOnly && !(isAdmin || user?.role === 'MANAGER')) return false;
                    return true;
                  })
                  .sort((a, b) => a.order - b.order)
                  .map((card) => {
                    // Mapear o iconName para o componente de ícone real
                    const Icon = card.iconName && iconMap[card.iconName]
                      ? iconMap[card.iconName]
                      : card.icon || iconMap.FiGrid;
                    return (
                      <div
                        key={card.id}
                        className="bg-white rounded-lg shadow-md p-5 transition-shadow hover:shadow-lg flex flex-col h-full"
                      >
                        <div className="flex items-start mb-3">
                          <div className="bg-abz-light-blue p-3 rounded-full mr-3 flex-shrink-0">
                            <Icon className="text-abz-blue w-5 h-5" />
                          </div>
                          <h3 className="font-semibold text-abz-text-black flex-1">{card.title}</h3>
                        </div>

                        <p className="text-sm text-abz-text-dark mb-4 flex-grow">
                          {card.description}
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
        </Suspense>
      </MainLayout>
    </ErrorBoundary>
  );
}
