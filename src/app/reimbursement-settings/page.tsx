'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import StandaloneUserReimbursementSettings from '@/components/admin/StandaloneUserReimbursementSettings';
import { FiMail, FiAlertCircle } from 'react-icons/fi';

export default function ReimbursementSettingsPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Obter email da URL
    const emailParam = searchParams?.get('email');
    if (emailParam) {
      setEmail(emailParam);
    } else {
      setError('Email não fornecido. Adicione o parâmetro email à URL.');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-abz-blue">
            Configurações de Email de Reembolso
          </h1>
          <p className="mt-2 text-gray-600">
            Configure as opções de envio de email para suas solicitações de reembolso.
          </p>
        </div>

        {error ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center text-red-600 mb-4">
              <FiAlertCircle className="mr-2 h-5 w-5" />
              <span className="font-medium">Erro</span>
            </div>
            <p className="text-gray-700">{error}</p>
          </div>
        ) : email ? (
          <StandaloneUserReimbursementSettings email={email} />
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6 flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-abz-blue"></div>
          </div>
        )}
      </div>
    </div>
  );
}
