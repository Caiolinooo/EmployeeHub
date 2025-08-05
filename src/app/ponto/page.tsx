'use client';

import React from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { useI18n } from '@/contexts/I18nContext';
import {
  FiClock,
  FiSmartphone,
  FiDownload,
  FiExternalLink,
  FiBookOpen,
  FiPlay,
} from 'react-icons/fi';

// Link para o sistema web
const EXTERNAL_URL = 'https://www.ahgora.com.br/novabatidaonline/';
// Link para o manual
const MANUAL_URL = '/documentos/Manual de Uso Ponto Ahgora.pdf';

// App Store and Google Play Links
const MYAHGORA_GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=br.com.ahgora.myahgora';
const MYAHGORA_APP_STORE = 'https://apps.apple.com/br/app/my-ahgora/id1502293191';
const AHGORA_MULTI_GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=br.com.ahgora.ahgoramulti';
const AHGORA_MULTI_APP_STORE = 'https://apps.apple.com/us/app/ahgora-multi/id1436645391';

// Component for App Download Buttons
const AppDownloadButton = ({ href, storeName }: { href: string; storeName: string }) => {
  // Return null immediately if href is missing
  if (!href) return null;

  // Determine icon *after* validating href
  // Use FiSmartphone for App Store as FiApple doesn't exist in fi
  const Icon = storeName === 'App Store' ? FiSmartphone : FiPlay;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 transition duration-150 text-xs shadow-sm mr-2 mb-2"
    >
      {/* Render Icon only if it's valid */}
      {Icon && <Icon className="mr-1.5 h-4 w-4" />}
      {storeName}
    </a>
  );
};

export default function PontoPage() {
  const { t } = useI18n();

  return (
    <MainLayout>
      <h1 className="text-3xl font-extrabold text-abz-blue-dark mb-6">{t('ponto.pageTitle')}</h1>

      <div className="bg-white p-8 rounded-lg shadow-md space-y-8">

        {/* Introduction */}
        <div className="prose prose-sm max-w-none text-abz-text-dark">
          <h2 className="text-xl font-semibold text-abz-text-black mb-3">{t('ponto.welcomeTitle')}</h2>
          <p>
            {t('ponto.welcomeDescription')}
          </p>
        </div>

        {/* App Access Info */}
        <div className="border-t pt-6">
          <h2 className="text-xl font-semibold text-abz-text-black mb-4 flex items-center">
            <FiSmartphone className="mr-2 text-abz-blue" /> {t('ponto.appAccess')}
          </h2>

          {/* Ahgora Multi */}
          <div className="mb-6 pb-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-abz-text-black mb-2">Ahgora Multi</h3>
            <div className="mb-3">
              <AppDownloadButton href={AHGORA_MULTI_APP_STORE} storeName="App Store" />
              <AppDownloadButton href={AHGORA_MULTI_GOOGLE_PLAY} storeName="Google Play" />
            </div>
            <p className="text-sm text-gray-600 mb-1">
              {t('ponto.ahgoraMultiDescription')}
            </p>
            <p className="text-sm text-gray-600"><span className="font-medium">{t('ponto.activationKey')}</span> {t('ponto.activationKeyInfo')}</p>
          </div>

          {/* MyAhgora */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-abz-text-black mb-2">MyAhgora</h3>
            <div className="mb-3">
              {MYAHGORA_APP_STORE ? (
                <AppDownloadButton href={MYAHGORA_APP_STORE} storeName="App Store" />
              ) : (
                <span className="text-xs text-gray-400 italic mr-2 mb-2 inline-block">{t('ponto.appStoreUnavailable')}</span>
              )}
              <AppDownloadButton href={MYAHGORA_GOOGLE_PLAY} storeName="Google Play" />
            </div>
            <p className="text-sm text-gray-600 mb-1">
              {t('ponto.myAhgoraDescription')}
            </p>
            <p className="text-sm text-gray-600"><span className="font-medium">{t('ponto.companyCode')}</span> 4811</p>
            <p className="text-sm text-gray-600"><span className="font-medium">{t('ponto.registrationPassword')}</span> {t('ponto.activationKeyInfo')}</p>
          </div>
        </div>

        {/* Web Access */}
        <div className="border-t pt-6">
          <h2 className="text-xl font-semibold text-abz-text-black mb-3 flex items-center">
            <FiExternalLink className="mr-2 text-abz-blue" /> {t('ponto.webAccess')}
          </h2>
          <p className="text-sm text-abz-text-dark mb-4">
            {t('ponto.webAccessDescription')}
          </p>
          <a
            href={EXTERNAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-6 py-3 bg-abz-blue text-white rounded-lg font-semibold hover:bg-abz-blue-dark transition duration-200 shadow-md text-sm"
          >
            <FiExternalLink className="mr-2" />
            {t('ponto.accessBatidaOnline')}
          </a>
        </div>

        {/* Manual Download */}
        <div className="border-t pt-6">
          <h2 className="text-xl font-semibold text-abz-text-black mb-3 flex items-center">
            <FiBookOpen className="mr-2 text-abz-blue" /> {t('ponto.additionalResources')}
          </h2>
          <p className="text-sm text-abz-text-dark mb-4">
            {t('ponto.manualDescription')}
          </p>
          <a
            href={MANUAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            download="Manual de Uso Ponto Ahgora.pdf"
            className="inline-flex items-center px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition duration-200 shadow-md text-sm"
          >
            <FiDownload className="mr-2" />
            {t('ponto.downloadManual')}
          </a>
        </div>

      </div>
    </MainLayout>
  );
}
