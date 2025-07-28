import React from 'react';
import PayrollDashboard from '@/components/payroll/PayrollDashboard';

/**
 * Página principal do módulo de folha de pagamento
 * Sistema de Folha de Pagamento - Painel ABZ
 */
export default function PayrollPage() {
  return <PayrollDashboard />;
}

export const metadata = {
  title: 'Folha de Pagamento - Painel ABZ',
  description: 'Gestão completa de folha de pagamento',
};
