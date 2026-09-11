'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import Certificates from '@/components/Academy/Certificates';
import {
  ArrowLeftIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import { useI18n } from '@/contexts/I18nContext';

const CertificatesPage: React.FC = () => {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <MainLayout>
      <div className="flex flex-col min-h-0 flex-1 h-full max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="shrink-0 mb-6">
          <button
            onClick={() => router.push('/academy')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            {t('academy.voltarAoAcademy')}
          </button>

          <div className="flex items-center">
            <TrophyIcon className="w-8 h-8 text-yellow-600 mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('academy.meusCertificados')}</h1>
              <p className="text-gray-600 mt-1">
                {t('academy.certificadosDosCursosQueVoceConcluiu')}
              </p>
            </div>
          </div>
        </div>

        {/* Componente de certificados */}
        <div className="flex-1 min-h-0 overflow-auto">
          <Certificates />
        </div>
      </div>
    </MainLayout>
  );
};

export default CertificatesPage;
