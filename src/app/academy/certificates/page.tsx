'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import Certificates from '@/components/Academy/Certificates';
import { 
  ArrowLeftIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';

const CertificatesPage: React.FC = () => {
  const router = useRouter();

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/academy')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Voltar ao Academy
          </button>
          
          <div className="flex items-center">
            <TrophyIcon className="w-8 h-8 text-yellow-600 mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Meus Certificados</h1>
              <p className="text-gray-600 mt-1">
                Certificados dos cursos que você concluiu
              </p>
            </div>
          </div>
        </div>

        {/* Componente de certificados */}
        <Certificates />
      </div>
    </MainLayout>
  );
};

export default CertificatesPage;
