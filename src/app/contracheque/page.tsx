'use client';

import React from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { FiExternalLink, FiDollarSign } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

const EXTERNAL_SYSTEM_URL = 'http://179.191.211.166/radarwebnet';

export default function ContrachequePage() {
  const { t } = useI18n();

  return (
    <MainLayout>
      <h1 className="text-3xl font-extrabold text-abz-blue-dark mb-6">{t('contracheque.pageTitle')}</h1>

      <div className="bg-white p-8 rounded-lg shadow-md space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-abz-text-black mb-3">{t('contracheque.accessSystem')}</h2>
          <p className="text-abz-text-dark mb-4">
            {t('contracheque.systemDescription')}
          </p>
          <p className="text-abz-text-dark mb-4">
            {t('contracheque.externalAccess')}
          </p>
          <a
            href={EXTERNAL_SYSTEM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-6 py-3 bg-abz-blue text-white rounded-lg font-semibold hover:bg-abz-blue-dark transition duration-200 shadow-md text-sm"
          >
            <FiExternalLink className="mr-2 text-white" />
            {t('contracheque.accessSystem')}
          </a>
        </div>

        {/* Placeholder for additional instructions or contact information */}

      </div>
    </MainLayout>
  );
}
