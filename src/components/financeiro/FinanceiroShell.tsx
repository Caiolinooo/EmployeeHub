'use client';

/**
 * Casca Portal / Financeiro: trilha + menu agrupado por área
 * (painel, cadastros, folha, faturamento, contas, relatórios, ferramentas).
 * Paleta do portal (abz-blue / abz-blue-dark). O conteúdo da rota entra em children.
 */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiChevronRight,
  FiCode,
  FiCreditCard,
  FiFileMinus,
  FiFilePlus,
  FiFileText,
  FiList,
  FiPieChart,
  FiPlusSquare,
  FiSettings,
  FiSliders,
  FiTable,
  FiUsers,
} from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import {
  FIN_NAV_GROUPS,
  grupoDaArea,
  itemDaArea,
  resolverAreaAtiva,
  type FinNavItem,
} from '@/components/financeiro/financeiro-nav';

const ICONE: Record<string, React.ReactNode> = {
  'visao-geral': <FiBarChart2 className="h-4 w-4" />,
  empresas: <FiBriefcase className="h-4 w-4" />,
  funcionarios: <FiUsers className="h-4 w-4" />,
  clientes: <FiUsers className="h-4 w-4" />,
  rubricas: <FiCode className="h-4 w-4" />,
  tabelas: <FiTable className="h-4 w-4" />,
  perfis: <FiSliders className="h-4 w-4" />,
  folhas: <FiList className="h-4 w-4" />,
  nova: <FiPlusSquare className="h-4 w-4" />,
  planilhas: <FiFileText className="h-4 w-4" />,
  faturas: <FiFileText className="h-4 w-4" />,
  nfse: <FiFilePlus className="h-4 w-4" />,
  bancos: <FiCreditCard className="h-4 w-4" />,
  'rel-mensal': <FiCalendar className="h-4 w-4" />,
  'rel-custos': <FiPieChart className="h-4 w-4" />,
  'rel-guias': <FiFileMinus className="h-4 w-4" />,
  config: <FiSettings className="h-4 w-4" />,
};

function ClasseItem(ativo: boolean): string {
  return ativo
    ? 'bg-abz-blue text-white shadow-sm'
    : 'text-gray-600 hover:bg-abz-light-blue hover:text-abz-blue-dark';
}

function ItemLink({ item, ativo }: { item: FinNavItem; ativo: boolean }) {
  const { t } = useI18n();
  return (
    <Link
      href={item.href}
      aria-current={ativo ? 'page' : undefined}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${ClasseItem(ativo)}`}
    >
      {ICONE[item.id]}
      <span className="truncate">{t(item.labelKey)}</span>
    </Link>
  );
}

export default function FinanceiroShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname() || '/folha-pagamento';
  const searchParams = useSearchParams();
  const area = resolverAreaAtiva(pathname, searchParams?.get('tab') ?? null);
  const grupo = grupoDaArea(area);
  const item = itemDaArea(area);
  const [grupoMobile, setGrupoMobile] = useState(grupo?.id ?? 'painel');

  useEffect(() => {
    if (grupo?.id) setGrupoMobile(grupo.id);
  }, [grupo?.id]);

  const grupoAberto = FIN_NAV_GROUPS.find((entrada) => entrada.id === grupoMobile) ?? FIN_NAV_GROUPS[0];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-sm lg:flex">
        <div className="mb-4 flex items-center gap-2 px-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-abz-blue-dark text-xs font-black text-white">
            ABZ
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-abz-blue-dark">{t('financeiro.titulo')}</p>
            <p className="truncate text-[11px] text-gray-400">{t('financeiro.navPortal')}</p>
          </div>
        </div>
        <nav className="space-y-4">
          {FIN_NAV_GROUPS.map((entrada) => (
            <div key={entrada.id}>
              <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                {t(entrada.labelKey)}
              </p>
              <div className="space-y-0.5">
                {entrada.items.map((entradaItem) => (
                  <ItemLink key={entradaItem.id} item={entradaItem} ativo={entradaItem.id === area} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-wrap items-center gap-1 text-sm text-gray-500">
          <Link href="/dashboard" className="font-semibold text-abz-blue hover:underline">
            {t('financeiro.navPortal')}
          </Link>
          <FiChevronRight className="h-3.5 w-3.5" />
          <Link href="/folha-pagamento?tab=visao-geral" className="font-semibold text-gray-700 hover:text-abz-blue">
            {t('financeiro.titulo')}
          </Link>
          {grupo && item && t(grupo.labelKey) !== t(item.labelKey) && (
            <>
              <FiChevronRight className="h-3.5 w-3.5" />
              <span>{t(grupo.labelKey)}</span>
            </>
          )}
          {item && (
            <>
              <FiChevronRight className="h-3.5 w-3.5" />
              <span className="font-semibold text-abz-blue-dark">{t(item.labelKey)}</span>
            </>
          )}
        </div>

        <div className="shrink-0 space-y-2 lg:hidden">
          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
            {FIN_NAV_GROUPS.map((entrada) => {
              const ativo = entrada.id === grupoMobile;
              return (
                <button
                  key={entrada.id}
                  type="button"
                  onClick={() => setGrupoMobile(entrada.id)}
                  className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold ${
                    ativo ? 'bg-abz-blue text-white' : 'text-gray-600'
                  }`}
                >
                  {t(entrada.labelKey)}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {grupoAberto.items.map((entradaItem) => (
              <Link
                key={entradaItem.id}
                href={entradaItem.href}
                aria-current={entradaItem.id === area ? 'page' : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${ClasseItem(entradaItem.id === area)}`}
              >
                {ICONE[entradaItem.id]}
                {t(entradaItem.labelKey)}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
