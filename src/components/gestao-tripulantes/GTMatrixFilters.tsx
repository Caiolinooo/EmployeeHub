'use client';

import React, { useMemo } from 'react';
import { FiSearch } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import SearchableCreatableSelect from '@/components/gestao-tripulantes/SearchableCreatableSelect';

interface Collaborator {
  id: string;
  empresa_nome: string;
  embarcacao_nome: string;
  cargo_nome: string;
  centro_custo_nome: string;
  status_embarque: string;
}

interface FiltersState {
  search: string;
  empresa: string;
  embarcacao: string;
  cargo: string;
  centro_custo: string;
  status: string;
  ativo: string;
  apenasStandby: boolean;
  docsVencidos: boolean;
}

interface GTMatrixFiltersProps {
  filters: FiltersState;
  onChange: (partial: Partial<FiltersState>) => void;
  colaboradores?: Collaborator[];
}

const STATUS_OPTIONS = [
  { value: 'embarcado', labelKey: 'gestaoTripulantes.status.embarcado' },
  { value: 'standby', labelKey: 'gestaoTripulantes.status.standby' },
  { value: 'folga', labelKey: 'gestaoTripulantes.status.folga' },
  { value: 'desembarcado', labelKey: 'gestaoTripulantes.status.desembarcado' },
  { value: 'afastado', labelKey: 'gestaoTripulantes.status.afastado' },
  { value: 'ferias', labelKey: 'gestaoTripulantes.status.ferias' },
  { value: 'treinamento', labelKey: 'gestaoTripulantes.status.treinamento' },
];

export default function GTMatrixFilters({ filters, onChange, colaboradores = [] }: GTMatrixFiltersProps) {
  const { t } = useI18n();

  const distinctOptions = useMemo(() => {
    const extract = (key: keyof Collaborator) =>
      Array.from(new Set(
        colaboradores.map(c => (c[key] as string)).filter(Boolean)
      )).sort();
    return {
      empresas: extract('empresa_nome'),
      embarcacoes: extract('embarcacao_nome'),
      cargos: extract('cargo_nome'),
      centrosCusto: extract('centro_custo_nome'),
    };
  }, [colaboradores]);

  return (
    <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2.5 sm:gap-3">
      {/* Linha 1: Busca rápida */}
      <div className="relative w-full">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder={t('gestaoTripulantes.filters.search')}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          value={filters.search}
          onChange={e => onChange({ search: e.target.value })}
        />
      </div>

      {/* Linha 2: Dropdowns em grade responsiva (2 colunas em mobile, flex em desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:flex lg:flex-wrap gap-2 sm:gap-2.5 items-center">
        <div className="w-full lg:w-40">
          <SearchableCreatableSelect
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            options={distinctOptions.empresas.map(v => ({ id: v, label: v }))}
            value={filters.empresa}
            onChange={id => onChange({ empresa: id })}
            emptyLabel={t('gestaoTripulantes.filters.allCompanies')}
            placeholder={t('gestaoTripulantes.filters.allCompanies')}
          />
        </div>

        <div className="w-full lg:w-40">
          <SearchableCreatableSelect
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            options={distinctOptions.embarcacoes.map(v => ({ id: v, label: v }))}
            value={filters.embarcacao}
            onChange={id => onChange({ embarcacao: id })}
            emptyLabel={t('gestaoTripulantes.filters.allVessels')}
            placeholder={t('gestaoTripulantes.filters.allVessels')}
          />
        </div>

        <div className="w-full lg:w-40">
          <SearchableCreatableSelect
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            options={distinctOptions.cargos.map(v => ({ id: v, label: v }))}
            value={filters.cargo}
            onChange={id => onChange({ cargo: id })}
            emptyLabel={t('gestaoTripulantes.filters.allPositions')}
            placeholder={t('gestaoTripulantes.filters.allPositions')}
          />
        </div>

        <div className="w-full lg:w-40">
          <SearchableCreatableSelect
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            options={distinctOptions.centrosCusto.map(v => ({ id: v, label: v }))}
            value={filters.centro_custo}
            onChange={id => onChange({ centro_custo: id })}
            emptyLabel={t('gestaoTripulantes.filters.allCostCenters')}
            placeholder={t('gestaoTripulantes.filters.allCostCenters')}
          />
        </div>

        <div className="w-full lg:w-36">
          <select
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={filters.status}
            onChange={e => onChange({ status: e.target.value })}
          >
            <option value="">{t('gestaoTripulantes.filters.allStatus')}</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
            ))}
          </select>
        </div>

        <div className="w-full lg:w-44">
          <select
            className="w-full px-2.5 py-1.5 border border-blue-200 bg-blue-50/50 text-blue-900 rounded-lg text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filters.ativo || 'ativos'}
            onChange={e => onChange({ ativo: e.target.value })}
          >
            <option value="ativos">Apenas Ativos</option>
            <option value="inativos">Apenas Inativos</option>
            <option value="todos">Todos (Ativos + Inativos)</option>
          </select>
        </div>
      </div>

      {/* Linha 3: Checkboxes */}
      <div className="flex flex-wrap items-center gap-4 pt-0.5">
        <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.apenasStandby}
            onChange={e => onChange({ apenasStandby: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
          />
          {t('gestaoTripulantes.filters.onlyStandby')}
        </label>
        <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.docsVencidos}
            onChange={e => onChange({ docsVencidos: e.target.checked })}
            className="rounded border-gray-300 text-red-600 focus:ring-red-500 w-4 h-4"
          />
          {t('gestaoTripulantes.filters.onlyVencidos')}
        </label>
      </div>
    </div>
  );
}
