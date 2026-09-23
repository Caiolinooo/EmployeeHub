'use client';

/**
 * Aba Bancos/Recebimentos (§7.1): contas, cobranças, conciliação e pagamentos.
 */
import React from 'react';
import ContasBancariasCards from '@/components/financeiro/ContasBancariasCards';
import CobrancasList from '@/components/financeiro/CobrancasList';
import ConciliacaoPanel from '@/components/financeiro/ConciliacaoPanel';
import PagamentosPanel from '@/components/financeiro/PagamentosPanel';

export default function BancosRecebimentosTab() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto pb-8">
      <ContasBancariasCards />
      <CobrancasList />
      <ConciliacaoPanel />
      <PagamentosPanel />
    </div>
  );
}
