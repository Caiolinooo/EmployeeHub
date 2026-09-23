'use client';

import FinanceiroHub from '@/components/financeiro/FinanceiroHub';

/** Deep-link da aba Faturas (§9): /folha-pagamento/faturas. */
export default function FaturasPage() {
  return <FinanceiroHub tabInicial="faturas" />;
}
