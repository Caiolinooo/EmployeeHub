'use client';

/**
 * Casca Financeiro: menu horizontal estilo Elementor (mega menu dropdown por área),
 * sem sidebar. Botão de retorno ao dashboard. Breadcrumb contextual.
 * Paleta do portal (abz-blue / abz-blue-dark).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiChevronDown,
  FiChevronRight,
  FiCode,
  FiCreditCard,
  FiFileMinus,
  FiFilePlus,
  FiFileText,
  FiList,
  FiPieChart,
  FiPlusSquare,
  FiSliders,
  FiTable,
  FiUsers,
} from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import LanguageSelector from '@/components/LanguageSelector';
import UserAvatar from '@/components/UserAvatar';
import {
  FIN_NAV_GROUPS,
  grupoDaArea,
  itemDaArea,
  resolverAreaAtiva,
  type FinNavGroup,
} from '@/components/financeiro/financeiro-nav';

/* ── Ícones por área ── */
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
};

/* ── Mega Menu Dropdown ── */
function MegaMenuDropdown({
  grupo,
  areaAtiva,
  aberto,
  onToggle,
  onFechar,
}: {
  grupo: FinNavGroup;
  areaAtiva: string;
  aberto: boolean;
  onToggle: () => void;
  onFechar: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const grupoAtivo = grupo.items.some((item) => item.id === areaAtiva);

  useEffect(() => {
    if (!aberto) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onFechar();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aberto, onFechar]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
          grupoAtivo
            ? 'bg-abz-blue text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100 hover:text-abz-blue-dark'
        }`}
      >
        {t(grupo.labelKey)}
        {grupo.items.length > 1 && (
          <FiChevronDown className={`h-3.5 w-3.5 transition ${aberto ? 'rotate-180' : ''}`} />
        )}
      </button>

      {aberto && grupo.items.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
          <p className="mb-2 px-3 pt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            {t(grupo.labelKey)} · {grupo.items.length} {grupo.items.length === 1 ? 'item' : 'itens'}
          </p>
          {grupo.items.map((item) => {
            const ativo = item.id === areaAtiva;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onFechar}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  ativo
                    ? 'bg-abz-blue/10 font-bold text-abz-blue'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  ativo ? 'bg-abz-blue text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {ICONE[item.id] || <FiFileText className="h-4 w-4" />}
                </span>
                <span className="truncate">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Shell principal ── */
export default function FinanceiroShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { user, profile } = useSupabaseAuth();
  const pathname = usePathname() || '/folha-pagamento';
  const searchParams = useSearchParams();
  const area = resolverAreaAtiva(pathname, searchParams?.get('tab') ?? null);
  const grupo = grupoDaArea(area);
  const item = itemDaArea(area);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  // Mobile: grupo expandido
  const [grupoMobile, setGrupoMobile] = useState(grupo?.id ?? 'painel');

  useEffect(() => {
    if (grupo?.id) setGrupoMobile(grupo.id);
  }, [grupo?.id]);

  const fecharMenu = useCallback(() => setMenuAberto(null), []);

  // Filtrar grupo "ferramentas" do menu principal (ferramentas fica em admin)
  const gruposVisiveis = FIN_NAV_GROUPS.filter((g) => g.id !== 'ferramentas');
  const grupoMobileObj = gruposVisiveis.find((g) => g.id === grupoMobile) ?? gruposVisiveis[0];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-2.5">
          {/* Logo + Voltar ao dash */}
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2.5 rounded-xl px-2 py-1 transition hover:bg-gray-100"
            title={t('financeiro.navPortal')}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-abz-blue-dark text-xs font-black text-white">
              ABZ
            </span>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-bold text-abz-blue-dark">{t('financeiro.titulo')}</p>
              <p className="truncate text-[11px] text-gray-400">{t('financeiro.navPortal')}</p>
            </div>
          </Link>

          {/* Nav horizontal — desktop */}
          <nav className="hidden flex-1 items-center gap-1 lg:flex">
            {gruposVisiveis.map((g) => {
              // Painel tem item único → link direto, sem dropdown
              if (g.items.length === 1) {
                const unico = g.items[0];
                const ativo = unico.id === area;
                return (
                  <Link
                    key={g.id}
                    href={unico.href}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      ativo
                        ? 'bg-abz-blue text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-abz-blue-dark'
                    }`}
                  >
                    {t(g.labelKey)}
                  </Link>
                );
              }
              return (
                <MegaMenuDropdown
                  key={g.id}
                  grupo={g}
                  areaAtiva={area}
                  aberto={menuAberto === g.id}
                  onToggle={() => setMenuAberto(menuAberto === g.id ? null : g.id)}
                  onFechar={fecharMenu}
                />
              );
            })}
          </nav>

          {/* Right: idioma + avatar + nova fatura */}
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:block">
              <LanguageSelector />
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200">
              <UserAvatar user={user} profile={profile} className="h-full w-full" />
            </div>
            <Link
              href="/folha-pagamento?tab=faturas&nova=1"
              className="hidden items-center gap-1.5 rounded-lg bg-abz-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-abz-blue-dark sm:inline-flex"
            >
              + {t('financeiro.novaFatura')}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Mobile nav ── */}
      <div className="border-b border-gray-100 bg-white px-4 py-2 lg:hidden">
        <div className="flex gap-1 overflow-x-auto">
          {gruposVisiveis.map((g) => {
            const ativo = g.id === grupoMobile;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGrupoMobile(g.id)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  ativo ? 'bg-abz-blue text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t(g.labelKey)}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {grupoMobileObj.items.map((navItem) => {
            const ativo = navItem.id === area;
            return (
              <Link
                key={navItem.id}
                href={navItem.href}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  ativo
                    ? 'bg-abz-blue/10 text-abz-blue'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {ICONE[navItem.id]}
                {t(navItem.labelKey)}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Breadcrumb ── */}
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-4">
        <div className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
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
      </div>

      {/* ── Conteúdo ── */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-4">
        {children}
      </main>
    </div>
  );
}
