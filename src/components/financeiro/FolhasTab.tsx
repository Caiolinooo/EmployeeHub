'use client';

/**
 * Aba Folhas (§7.1): card-links para as rotas EXISTENTES do fluxo DP.
 * Nada é movido de lugar — só a navegação muda (rótulos via payroll.*).
 */
import React from 'react';
import Link from 'next/link';
import {
  FiList, FiPlusSquare, FiUsers, FiBriefcase, FiFileText, FiPieChart,
  FiFileMinus, FiSettings, FiCode, FiTable, FiSliders, FiExternalLink,
} from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { FIN_CARD_CLASS } from '@/components/financeiro/shared';

interface LinkCard {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
}

const FOLHAS_LINKS: LinkCard[] = [
  { href: '/department/dp?tab=folha', labelKey: 'payroll.recentSheets', icon: <FiList className="h-6 w-6" /> },
  { href: '/department/dp?tab=folha', labelKey: 'payroll.newPayrollSheet', icon: <FiPlusSquare className="h-6 w-6" /> },
  { href: '/folha-pagamento/funcionarios', labelKey: 'payroll.manageEmployees', icon: <FiUsers className="h-6 w-6" /> },
  { href: '/folha-pagamento/empresas', labelKey: 'payroll.manageCompanies', icon: <FiBriefcase className="h-6 w-6" /> },
  { href: '/folha-pagamento/relatorios/mensal', labelKey: 'payroll.monthlyReport', icon: <FiFileText className="h-6 w-6" /> },
  { href: '/folha-pagamento/relatorios/custos', labelKey: 'payroll.costAnalysis', icon: <FiPieChart className="h-6 w-6" /> },
  { href: '/folha-pagamento/relatorios/guias', labelKey: 'payroll.paymentGuides', icon: <FiFileMinus className="h-6 w-6" /> },
  { href: '/folha-pagamento/configuracoes/codigos', labelKey: 'payroll.payrollCodes', icon: <FiCode className="h-6 w-6" /> },
  { href: '/folha-pagamento/configuracoes/tabelas', labelKey: 'payroll.legalTables', icon: <FiTable className="h-6 w-6" /> },
  { href: '/folha-pagamento/configuracoes/perfis', labelKey: 'payroll.calculationProfiles', icon: <FiSliders className="h-6 w-6" /> },
  { href: '/folha-pagamento/configuracoes/codigos', labelKey: 'payroll.settings', icon: <FiSettings className="h-6 w-6" /> },
];

export default function FolhasTab() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <p className="text-sm text-gray-500">{t('financeiro.folhasDescricao')}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {FOLHAS_LINKS.map((card) => (
          <Link
            key={`${card.href}-${card.labelKey}`}
            href={card.href}
            className={`${FIN_CARD_CLASS} group flex items-center gap-4 p-5 transition hover:shadow-md`}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-abz-light-blue text-abz-blue transition group-hover:bg-abz-blue group-hover:text-white">
              {card.icon}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900">{t(card.labelKey)}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                <FiExternalLink className="h-3 w-3" />
                {card.href.replace('/folha-pagamento', '') || '/'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
