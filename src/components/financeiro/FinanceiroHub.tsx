'use client';

/**
 * Hub do módulo Financeiro (§7.1 + reforma §4): Visão geral · Folhas ·
 * Empresas · Clientes · Faturas · NFS-e · Bancos/Recebimentos. Estado da aba
 * em ?tab= (deep-link friendly); as rotas /folha-pagamento/{faturas,nfse,bancos}
 * entram com tabInicial. A navegação por área fica em FinanceiroShell.
 */
import React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import GtPageShell, { GT_PAGE_SCROLLPORT_CLASS } from '@/components/gestao-tripulantes/GtPageShell';
import CompetenciaOverview from '@/components/financeiro/CompetenciaOverview';
import FolhasTab from '@/components/financeiro/FolhasTab';
import EmpresasTab from '@/components/financeiro/EmpresasTab';
import ClientesTab from '@/components/financeiro/ClientesTab';
import FaturasList from '@/components/financeiro/FaturasList';
import NfseEmissoesList from '@/components/financeiro/NfseEmissoesList';
import BancosRecebimentosTab from '@/components/financeiro/BancosRecebimentosTab';

export type FinanceiroTab = 'visao-geral' | 'folhas' | 'empresas' | 'clientes' | 'faturas' | 'nfse' | 'bancos';

const TAB_IDS: FinanceiroTab[] = ['visao-geral', 'folhas', 'empresas', 'clientes', 'faturas', 'nfse', 'bancos'];

function ehTabValida(valor: string | null | undefined): valor is FinanceiroTab {
  return typeof valor === 'string' && (TAB_IDS as string[]).includes(valor);
}

export default function FinanceiroHub({ tabInicial }: { tabInicial?: FinanceiroTab }) {
  const router = useRouter();
  const pathname = usePathname() || '/folha-pagamento';
  const searchParams = useSearchParams();

  const tabParam = searchParams?.get('tab');
  // ?tab= explícito vence (deep-link real); subpáginas (faturas/nfse/bancos) só
  // definem o default quando a URL não trouxer aba.
  const tab: FinanceiroTab = ehTabValida(tabParam) ? tabParam : (tabInicial ?? 'visao-geral');

  function trocarAba(nova: FinanceiroTab) {
    router.push(`${pathname}?tab=${nova}`, { scroll: false });
  }

  return (
    <GtPageShell>
      <div className={GT_PAGE_SCROLLPORT_CLASS}>
        {tab === 'visao-geral' && <CompetenciaOverview onDrill={(destino) => trocarAba(destino)} />}
        {tab === 'folhas' && <FolhasTab />}
        {tab === 'empresas' && <EmpresasTab />}
        {tab === 'clientes' && <ClientesTab />}
        {tab === 'faturas' && <FaturasList />}
        {tab === 'nfse' && <NfseEmissoesList />}
        {tab === 'bancos' && <BancosRecebimentosTab />}
      </div>
    </GtPageShell>
  );
}
