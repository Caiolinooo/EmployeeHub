'use client';

/**
 * Hub do módulo Financeiro (§7.1): abas Visão geral · Folhas · Faturas ·
 * NFS-e · Bancos/Recebimentos. Estado da aba em ?tab= (deep-link friendly);
 * as rotas /folha-pagamento/{faturas,nfse,bancos} entram com tabInicial.
 */
import React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { FiBarChart2, FiList, FiFileText, FiFilePlus, FiCreditCard } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import CompetenciaOverview from '@/components/financeiro/CompetenciaOverview';
import FolhasTab from '@/components/financeiro/FolhasTab';
import FaturasList from '@/components/financeiro/FaturasList';
import NfseEmissoesList from '@/components/financeiro/NfseEmissoesList';
import BancosRecebimentosTab from '@/components/financeiro/BancosRecebimentosTab';

export type FinanceiroTab = 'visao-geral' | 'folhas' | 'faturas' | 'nfse' | 'bancos';

const TAB_IDS: FinanceiroTab[] = ['visao-geral', 'folhas', 'faturas', 'nfse', 'bancos'];

const TAB_META: Record<FinanceiroTab, { labelKey: string; icon: React.ReactNode }> = {
  'visao-geral': { labelKey: 'financeiro.tabVisaoGeral', icon: <FiBarChart2 className="h-4 w-4" /> },
  folhas: { labelKey: 'financeiro.tabFolhas', icon: <FiList className="h-4 w-4" /> },
  faturas: { labelKey: 'financeiro.tabFaturas', icon: <FiFileText className="h-4 w-4" /> },
  nfse: { labelKey: 'financeiro.tabNfse', icon: <FiFilePlus className="h-4 w-4" /> },
  bancos: { labelKey: 'financeiro.tabBancos', icon: <FiCreditCard className="h-4 w-4" /> },
};

function ehTabValida(valor: string | null | undefined): valor is FinanceiroTab {
  return typeof valor === 'string' && (TAB_IDS as string[]).includes(valor);
}

export default function FinanceiroHub({ tabInicial }: { tabInicial?: FinanceiroTab }) {
  const { t } = useI18n();
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
    <div className="flex flex-col min-h-0 flex-1 gap-4">
      {/* Cabeçalho + abas */}
      <div className="shrink-0 space-y-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('financeiro.titulo')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('financeiro.subtitulo')}</p>
        </div>
        <nav className="flex flex-wrap gap-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 shadow-sm">
          {TAB_IDS.map((id) => {
            const meta = TAB_META[id];
            const ativa = id === tab;
            return (
              <button
                key={id}
                type="button"
                onClick={() => trocarAba(id)}
                aria-current={ativa ? 'page' : undefined}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  ativa
                    ? 'bg-abz-blue text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {meta.icon}
                <span className="whitespace-nowrap">{t(meta.labelKey)}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Conteúdo da aba */}
      <div className="flex min-h-0 flex-1 flex-col">
        {tab === 'visao-geral' && <CompetenciaOverview onDrill={(destino) => trocarAba(destino)} />}
        {tab === 'folhas' && <FolhasTab />}
        {tab === 'faturas' && <FaturasList />}
        {tab === 'nfse' && <NfseEmissoesList />}
        {tab === 'bancos' && <BancosRecebimentosTab />}
      </div>
    </div>
  );
}
