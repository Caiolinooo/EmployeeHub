'use client';

/**
 * /admin/financeiro-config (§7.2): abas Bancos · NFS-e · Layout de fatura ·
 * Municípios. Padrão de abas igual a integracao-erp/wkradar; aba em ?tab=.
 */
import React, { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { FiCreditCard, FiFileText, FiLayout, FiMapPin } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import BancosConfigTab from '@/components/financeiro/admin/BancosConfigTab';
import NfseConfigTab from '@/components/financeiro/admin/NfseConfigTab';
import TemplatesTab from '@/components/financeiro/admin/TemplatesTab';
import MunicipiosTab from '@/components/financeiro/admin/MunicipiosTab';

type AbaConfig = 'bancos' | 'nfse' | 'templates' | 'municipios';

const ABAS: AbaConfig[] = ['bancos', 'nfse', 'templates', 'municipios'];

const ABA_META: Record<AbaConfig, { labelKey: string; icon: React.ReactNode }> = {
  bancos: { labelKey: 'admin.tabBancos', icon: <FiCreditCard className="h-4 w-4" /> },
  nfse: { labelKey: 'admin.tabNfse', icon: <FiFileText className="h-4 w-4" /> },
  templates: { labelKey: 'admin.tabTemplates', icon: <FiLayout className="h-4 w-4" /> },
  municipios: { labelKey: 'admin.tabMunicipios', icon: <FiMapPin className="h-4 w-4" /> },
};

function ehAba(valor: string | null | undefined): valor is AbaConfig {
  return typeof valor === 'string' && (ABAS as string[]).includes(valor);
}

export default function FinanceiroConfigPage() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname() || '/admin/financeiro-config';
  const searchParams = useSearchParams();

  const abaParam = searchParams?.get('tab');
  const [aba, setAba] = useState<AbaConfig>(ehAba(abaParam) ? abaParam : 'bancos');

  function trocarAba(nova: AbaConfig) {
    setAba(nova);
    router.replace(`${pathname}?tab=${nova}`, { scroll: false });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('admin.financeiroConfig')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('financeiro.subtitulo')}</p>
      </div>

      <nav className="flex flex-wrap gap-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 shadow-sm">
        {ABAS.map((id) => {
          const meta = ABA_META[id];
          const ativa = id === aba;
          return (
            <button
              key={id}
              type="button"
              onClick={() => trocarAba(id)}
              aria-current={ativa ? 'page' : undefined}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                ativa ? 'bg-abz-blue text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {meta.icon}
              <span className="whitespace-nowrap">{t(meta.labelKey)}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col">
        {aba === 'bancos' && <BancosConfigTab />}
        {aba === 'nfse' && <NfseConfigTab />}
        {aba === 'templates' && <TemplatesTab />}
        {aba === 'municipios' && <MunicipiosTab />}
      </div>
    </div>
  );
}
