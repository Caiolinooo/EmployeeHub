'use client';

import React from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useRouter } from 'next/navigation';
import { FiLock, FiKey, FiShield } from 'react-icons/fi';
import TwoFactorSetup from '@/components/Auth/TwoFactorSetup';
import PasswordChange from '@/components/Auth/PasswordChange';

export default function SecuritySettingsPage() {
  const { isAuthenticated, isLoading } = useSupabaseAuth();
  const router = useRouter();

  // Redirecionar se não estiver autenticado
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-abz-blue"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <FiLock className="h-6 w-6 text-abz-blue mr-2" />
        <h1 className="text-2xl font-bold text-abz-blue">Configurações de Segurança</h1>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <FiKey className="text-abz-blue text-xl mr-2" />
            <h2 className="text-xl font-semibold">Alterar Senha</h2>
          </div>

          <p className="mb-4 text-gray-700">
            Recomendamos alterar sua senha regularmente para manter sua conta segura.
            Use uma senha forte com pelo menos 8 caracteres, incluindo letras maiúsculas, minúsculas, números e símbolos.
          </p>

          <PasswordChange />
        </div>

        <TwoFactorSetup />
      </div>
    </div>
  );
}
