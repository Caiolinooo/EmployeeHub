import React from 'react';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';

/**
 * Layout do módulo de folha de pagamento
 * Sistema de Folha de Pagamento - Painel ABZ
 */
export default function PayrollLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-abz-background">
      <ProtectedRoute moduleName="folha_pagamento">
        {children}
      </ProtectedRoute>
    </div>
  );
}

export const metadata = {
  title: {
    template: '%s - Folha de Pagamento - Painel ABZ',
    default: 'Folha de Pagamento - Painel ABZ',
  },
  description: 'Sistema de gestão de folha de pagamento integrado ao Painel ABZ',
};
