'use client';

import FinanceiroHub from '@/components/financeiro/FinanceiroHub';

/** Deep-link da aba Bancos & Recebimentos (§9): /folha-pagamento/bancos. */
export default function BancosPage() {
  return <FinanceiroHub tabInicial="bancos" />;
}
