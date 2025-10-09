'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowLeft } from 'react-icons/fi';
import MainLayout from '@/components/Layout/MainLayout';
import InterfaceAprovacaoGerente from '@/components/avaliacao/InterfaceAprovacaoGerente';
import { useAuth } from '@/contexts/AuthContext';

export default function AprovacoesPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Verificar se o usuário tem permissão para aprovar avaliações
  if (!user || !['admin', 'gerente'].includes(user.role)) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Acesso Negado
            </h2>
            <p className="text-gray-600 mb-6">
              Você não tem permissão para acessar esta página. Apenas gerentes e administradores podem aprovar avaliações.
            </p>
            <button
              onClick={() => router.push('/avaliacao')}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiArrowLeft className="mr-2" size={16} />
              Voltar para Avaliações
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push('/avaliacao')}
            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors mb-4"
          >
            <FiArrowLeft className="mr-2" size={16} />
            Voltar para Avaliações
          </button>
        </div>

        <InterfaceAprovacaoGerente gerenteId={user.id} />
      </div>
    </MainLayout>
  );
}
