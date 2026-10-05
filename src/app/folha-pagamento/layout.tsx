'use client';

import React, { Suspense } from 'react';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import FinanceiroShell from '@/components/financeiro/FinanceiroShell';

/**
 * Layout do módulo Financeiro — shell próprio com menu horizontal Elementor.
 * Sem MainLayout (sem sidebar do portal). Gate em ProtectedRoute (`financeiro`).
 */
export default function PayrollLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute moduleName="financeiro">
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-400">Carregando…</div>}>
        <FinanceiroShell>{children}</FinanceiroShell>
      </Suspense>
    </ProtectedRoute>
  );
}
