import React from 'react';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';

/**
 * Layout do módulo Financeiro (folha → fatura → NFS-e → bancos → conciliação).
 * Mantém ProtectedRoute do módulo de folha_pagamento (§7.1).
 */
export default function PayrollLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-abz-background">
      <ProtectedRoute moduleName="folha_pagamento">
        <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4 md:p-6">{children}</div>
      </ProtectedRoute>
    </div>
  );
}

export const metadata = {
  title: 'Financeiro - Painel ABZ',
  description: 'Faturas, NFS-e, bancos, cobranças e conciliação do Painel ABZ',
};
