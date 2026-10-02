/**
 * Áreas do módulo Financeiro (Portal / Financeiro).
 * Agrupa rotas parecidas: painel, cadastros, folha, faturamento, contas, relatórios.
 * O hub (/folha-pagamento, /faturas, /nfse, /bancos) honra ?tab=. As demais rotas
 * resolvem pela URL.
 */

export interface FinNavItem {
  id: string;
  labelKey: string;
  href: string;
}

export interface FinNavGroup {
  id: string;
  labelKey: string;
  items: FinNavItem[];
}

export const FIN_NAV_GROUPS: FinNavGroup[] = [
  {
    id: 'painel',
    labelKey: 'financeiro.navPainel',
    items: [
      { id: 'visao-geral', labelKey: 'financeiro.tabVisaoGeral', href: '/folha-pagamento?tab=visao-geral' },
    ],
  },
  {
    id: 'cadastros',
    labelKey: 'financeiro.navCadastros',
    items: [
      { id: 'empresas', labelKey: 'fin.tabEmpresas', href: '/folha-pagamento?tab=empresas' },
      { id: 'funcionarios', labelKey: 'payroll.employees', href: '/folha-pagamento/funcionarios' },
      { id: 'clientes', labelKey: 'fin.tabClientes', href: '/folha-pagamento?tab=clientes' },
      { id: 'rubricas', labelKey: 'payroll.payrollCodes', href: '/folha-pagamento/configuracoes/codigos' },
      { id: 'tabelas', labelKey: 'payroll.legalTables', href: '/folha-pagamento/configuracoes/tabelas' },
      { id: 'perfis', labelKey: 'payroll.calculationProfiles', href: '/folha-pagamento/configuracoes/perfis' },
    ],
  },
  {
    id: 'folha',
    labelKey: 'financeiro.navFolha',
    items: [
      { id: 'folhas', labelKey: 'financeiro.tabFolhas', href: '/folha-pagamento?tab=folhas' },
      { id: 'nova', labelKey: 'payroll.newPayrollSheet', href: '/folha-pagamento/nova' },
      { id: 'planilhas', labelKey: 'payroll.recentSheets', href: '/folha-pagamento/sheets' },
    ],
  },
  {
    id: 'faturamento',
    labelKey: 'financeiro.navFaturamento',
    items: [
      { id: 'faturas', labelKey: 'financeiro.tabFaturas', href: '/folha-pagamento?tab=faturas' },
      { id: 'nfse', labelKey: 'financeiro.tabNfse', href: '/folha-pagamento?tab=nfse' },
    ],
  },
  {
    id: 'contas',
    labelKey: 'financeiro.navContas',
    items: [
      { id: 'bancos', labelKey: 'financeiro.tabBancos', href: '/folha-pagamento?tab=bancos' },
    ],
  },
  {
    id: 'relatorios',
    labelKey: 'financeiro.navRelatorios',
    items: [
      { id: 'rel-mensal', labelKey: 'payroll.monthlyReport', href: '/folha-pagamento/relatorios/mensal' },
      { id: 'rel-custos', labelKey: 'payroll.costAnalysis', href: '/folha-pagamento/relatorios/custos' },
      { id: 'rel-guias', labelKey: 'payroll.paymentGuides', href: '/folha-pagamento/relatorios/guias' },
    ],
  },
  {
    id: 'ferramentas',
    labelKey: 'financeiro.navFerramentas',
    items: [
      { id: 'config', labelKey: 'financeiro.navConfig', href: '/admin/financeiro-config' },
    ],
  },
];

const HUB_TABS = new Set(['visao-geral', 'folhas', 'empresas', 'clientes', 'faturas', 'nfse', 'bancos']);

/** Prefixos mais longos primeiro. */
const PATH_AREAS: Array<{ prefix: string; id: string }> = [
  { prefix: '/folha-pagamento/configuracoes/codigos', id: 'rubricas' },
  { prefix: '/folha-pagamento/configuracoes/tabelas', id: 'tabelas' },
  { prefix: '/folha-pagamento/configuracoes/perfis', id: 'perfis' },
  { prefix: '/folha-pagamento/relatorios/mensal', id: 'rel-mensal' },
  { prefix: '/folha-pagamento/relatorios/custos', id: 'rel-custos' },
  { prefix: '/folha-pagamento/relatorios/guias', id: 'rel-guias' },
  { prefix: '/folha-pagamento/funcionarios', id: 'funcionarios' },
  { prefix: '/folha-pagamento/empresas', id: 'empresas' },
  { prefix: '/folha-pagamento/sheets', id: 'planilhas' },
  { prefix: '/folha-pagamento/nova', id: 'nova' },
  { prefix: '/folha-pagamento/faturas', id: 'faturas' },
  { prefix: '/folha-pagamento/nfse', id: 'nfse' },
  { prefix: '/folha-pagamento/bancos', id: 'bancos' },
  { prefix: '/admin/financeiro-config', id: 'config' },
];

function normalizarPath(pathname: string): string {
  const limpo = (pathname || '/folha-pagamento').replace(/\/$/, '');
  return limpo || '/folha-pagamento';
}

function ehHub(path: string): boolean {
  return (
    path === '/folha-pagamento' ||
    path === '/folha-pagamento/faturas' ||
    path === '/folha-pagamento/nfse' ||
    path === '/folha-pagamento/bancos'
  );
}

export function resolverAreaAtiva(pathname: string, tab: string | null): string {
  const path = normalizarPath(pathname);
  if (ehHub(path) && tab && HUB_TABS.has(tab)) return tab;
  for (const regra of PATH_AREAS) {
    if (path === regra.prefix || path.startsWith(`${regra.prefix}/`)) return regra.id;
  }
  return 'visao-geral';
}

export function grupoDaArea(areaId: string): FinNavGroup | undefined {
  return FIN_NAV_GROUPS.find((grupo) => grupo.items.some((item) => item.id === areaId));
}

export function itemDaArea(areaId: string): FinNavItem | undefined {
  for (const grupo of FIN_NAV_GROUPS) {
    const item = grupo.items.find((entrada) => entrada.id === areaId);
    if (item) return item;
  }
  return undefined;
}
