'use client';

import React from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';

/**
 * Layout do módulo Financeiro (folha → fatura → NFS-e → bancos → conciliação).
 * MainLayout = sidebar + topbar (padrão /department/dp). Gate do módulo em
 * ProtectedRoute (`folha_pagamento`, design §7.1).
 */
export default function PayrollLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute moduleName="folha_pagamento">
      <MainLayout>{children}</MainLayout>
    </ProtectedRoute>
  );
}
