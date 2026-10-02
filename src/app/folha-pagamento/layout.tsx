'use client';

import React, { Suspense } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import FinanceiroShell from '@/components/financeiro/FinanceiroShell';

/**
 * Layout do módulo Financeiro (folha → fatura → NFS-e → bancos → conciliação).
 * MainLayout = sidebar + topbar do portal. FinanceiroShell agrupa as áreas
 * (cadastros, folha, faturamento, contas, relatórios). Gate em ProtectedRoute
 * (`folha_pagamento`).
 */
export default function PayrollLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute moduleName="folha_pagamento">
      <MainLayout>
        <Suspense fallback={<div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>}>
          <FinanceiroShell>{children}</FinanceiroShell>
        </Suspense>
      </MainLayout>
    </ProtectedRoute>
  );
}
