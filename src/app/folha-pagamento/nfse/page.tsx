'use client';

import FinanceiroHub from '@/components/financeiro/FinanceiroHub';

/** Deep-link da aba NFS-e (§9): /folha-pagamento/nfse (aceita ?faturaId=). */
export default function NfsePage() {
  return <FinanceiroHub tabInicial="nfse" />;
}
