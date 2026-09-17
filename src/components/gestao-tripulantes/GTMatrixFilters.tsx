'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronDown, FiFilter, FiSearch, FiX } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { cn } from '@/lib/utils';
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
  /** R8: multi-embarcação. Valores = NOMES (contrato values-as-NAMES); API resolve nomes→ids. */
  embarcacoes: string[];
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

interface OptionItem {
  id: string;
  label: string;
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

/**
 * R8: fonte de opções vem de GET /embarcacoes (lista completa, não só a já
 * filtrada na página). Fallback fail-soft: distinct da página atual.
 */
function useEmbarcacaoOptions(colaboradores: Collaborator[]): OptionItem[] {
  const [apiOptions, setApiOptions] = useState<OptionItem[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetchWithToken('/api/gestao-tripulantes/embarcacoes?ativo=true');
        if (!res.ok) return;
        const json = await res.json();
        const rows = Array.isArray(json?.data) ? json.data : [];
        const opts: OptionItem[] = rows
          .map((r: { nome?: string | null }) => ({ id: String(r?.nome || ''), label: String(r?.nome || '') }))
          .filter((o: OptionItem) => o.id);
        opts.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
        if (alive && opts.length > 0) setApiOptions(opts);
      } catch {
        /* fail-soft: cai no distinct da página */
      }
    })();
    return () => { alive = false; };
  }, []);

  const pageOptions = useMemo(() => {
    return Array.from(new Set(colaboradores.map(c => c.embarcacao_nome).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map(v => ({ id: v, label: v }));
  }, [colaboradores]);

  return apiOptions.length > 0 ? apiOptions : pageOptions;
}

/**
 * Multi-select de embarcações (chips + dropdown com busca).
 * Valores = nomes (contrato da matriz); o server resolve nomes→ids paginado.
 */
function EmbarcacoesMultiSelect({
  options,
  selected,
  onChange,
}: {
  options: OptionItem[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (nome: string) => {
    onChange(selected.includes(nome) ? selected.filter(s => s !== nome) : [...selected, nome]);
  };

  return (
    <div ref={rootRef} className="relative w-full lg:w-48">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full min-h-[40px] px-2.5 py-2 border border-gray-200 rounded-lg text-xs sm:text-sm bg-white flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={`truncate text-left ${selected.length > 0 ? 'text-blue-900 font-medium' : 'text-gray-500'}`}>
          {selected.length === 0
            ? t('gtMatrizV2.filtros.embarcacoesTodas')
            : t('gtMatrizV2.filtros.embarcacoesSelecionadas', { count: selected.length })}
        </span>
        <FiChevronDown className={cn('w-4 h-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[13rem] max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg p-1.5">
          <div className="relative mb-1">
            <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('gtMatrizV2.filtros.buscarEmbarcacao')}
              className="w-full pl-7 pr-2 py-2 border border-gray-200 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {filtered.length === 0 && (
            <p className="px-2 py-2.5 text-xs text-gray-400">{t('gtMatrizV2.filtros.semOpcoes')}</p>
          )}
          {filtered.map(o => (
            <label
              key={o.id}
              className="flex items-center gap-2 px-2 py-2.5 rounded-md hover:bg-blue-50 cursor-pointer text-xs sm:text-sm text-gray-700 select-none"
            >
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={selected.includes(o.id)}
                onChange={() => toggle(o.id)}
              />
              <span className="truncate">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GTMatrixFilters({ filters, onChange, colaboradores = [] }: GTMatrixFiltersProps) {
  const { t } = useI18n();
  const [expandido, setExpandido] = useState(false);
  const embarcacaoOptions = useEmbarcacaoOptions(colaboradores);

  const distinctOptions = useMemo(() => {
    const extract = (key: keyof Collaborator) =>
      Array.from(new Set(
        colaboradores.map(c => (c[key] as string)).filter(Boolean)
      )).sort();
    return {
      empresas: extract('empresa_nome'),
      cargos: extract('cargo_nome'),
      centrosCusto: extract('centro_custo_nome'),
    };
  }, [colaboradores]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.empresa) n += 1;
    if (filters.embarcacoes.length > 0) n += 1;
    if (filters.cargo) n += 1;
    if (filters.centro_custo) n += 1;
    if (filters.status) n += 1;
    if (filters.ativo && filters.ativo !== 'ativos') n += 1;
    if (filters.apenasStandby) n += 1;
    if (filters.docsVencidos) n += 1;
    return n;
  }, [filters]);

  return (
    <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2.5 sm:gap-3">
      {/* Linha 1: Busca rápida (sempre visível) + toggle de filtros no mobile */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('gestaoTripulantes.filters.search')}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            value={filters.search}
            onChange={e => onChange({ search: e.target.value })}
          />
        </div>
        <button
          type="button"
          onClick={() => setExpandido(o => !o)}
          aria-expanded={expandido}
          className={cn(
            'lg:hidden shrink-0 flex items-center gap-1.5 px-3 min-h-[40px] rounded-lg border text-xs font-semibold transition-colors',
            expandido || activeCount > 0
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-gray-200 text-gray-600'
          )}
        >
          <FiFilter className="w-4 h-4" />
          {expandido ? t('gtMatrizV2.filtros.ocultar') : t('gtMatrizV2.filtros.mostrar')}
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Linhas 2-3: filtros (colapsáveis no mobile, sempre abertos no lg) */}
      <div className={cn('flex-col gap-2.5 sm:gap-3', expandido ? 'flex' : 'hidden lg:flex')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:flex lg:flex-wrap gap-2 sm:gap-2.5 items-center">
          <div className="w-full lg:w-40">
            <SearchableCreatableSelect
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              options={distinctOptions.empresas.map(v => ({ id: v, label: v }))}
              value={filters.empresa}
              onChange={id => onChange({ empresa: id })}
              emptyLabel={t('gestaoTripulantes.filters.allCompanies')}
              placeholder={t('gestaoTripulantes.filters.allCompanies')}
            />
          </div>

          {/* R8: embarcação multi (chips + dropdown da lista completa) */}
          <EmbarcacoesMultiSelect
            options={embarcacaoOptions}
            selected={filters.embarcacoes}
            onChange={next => onChange({ embarcacoes: next })}
          />

          <div className="w-full lg:w-40">
            <SearchableCreatableSelect
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              options={distinctOptions.cargos.map(v => ({ id: v, label: v }))}
              value={filters.cargo}
              onChange={id => onChange({ cargo: id })}
              emptyLabel={t('gestaoTripulantes.filters.allPositions')}
              placeholder={t('gestaoTripulantes.filters.allPositions')}
            />
          </div>

          <div className="w-full lg:w-40">
            <SearchableCreatableSelect
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              options={distinctOptions.centrosCusto.map(v => ({ id: v, label: v }))}
              value={filters.centro_custo}
              onChange={id => onChange({ centro_custo: id })}
              emptyLabel={t('gestaoTripulantes.filters.allCostCenters')}
              placeholder={t('gestaoTripulantes.filters.allCostCenters')}
            />
          </div>

          <div className="w-full lg:w-36">
            <select
              className="w-full min-h-[40px] px-2.5 py-2 border border-gray-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
              className="w-full min-h-[40px] px-2.5 py-2 border border-blue-200 bg-blue-50/50 text-blue-900 rounded-lg text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.ativo || 'ativos'}
              onChange={e => onChange({ ativo: e.target.value })}
            >
              <option value="ativos">Apenas Ativos</option>
              <option value="inativos">Apenas Inativos</option>
              <option value="todos">Todos (Ativos + Inativos)</option>
            </select>
          </div>
        </div>

        {/* Chips das embarcações selecionadas */}
        {filters.embarcacoes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.embarcacoes.map(nome => (
              <span
                key={nome}
                className="inline-flex items-center gap-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-full pl-2.5 pr-1 py-0.5 text-xs font-medium"
              >
                {nome}
                <button
                  type="button"
                  onClick={() => onChange({ embarcacoes: filters.embarcacoes.filter(n => n !== nome) })}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-blue-100 text-blue-600"
                  aria-label={t('gtMatrizV2.filtros.removerFiltro', { nome })}
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Linha 3: Checkboxes */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <label className="flex items-center gap-2 py-2 text-xs sm:text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.apenasStandby}
              onChange={e => onChange({ apenasStandby: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            {t('gestaoTripulantes.filters.onlyStandby')}
          </label>
          <label className="flex items-center gap-2 py-2 text-xs sm:text-sm text-gray-600 cursor-pointer select-none">
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
    </div>
  );
}
