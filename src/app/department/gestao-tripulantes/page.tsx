'use client';

import React, { Suspense, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { FiAward } from 'react-icons/fi';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import DashboardCards from '@/components/gestao-tripulantes/DashboardCards';
import GtPageShell from '@/components/gestao-tripulantes/GtPageShell';
import GTMatrixFilters from '@/components/gestao-tripulantes/GTMatrixFilters';
import GTMatrix from '@/components/gestao-tripulantes/GTMatrix';
import GTMatrixLegend from '@/components/gestao-tripulantes/GTMatrixLegend';
import MarcadosBulkBar from '@/components/gestao-tripulantes/matrix/MarcadosBulkBar';
import CollaboratorModal from '@/components/gestao-tripulantes/CollaboratorModal';
import AsoReviewPanel from '@/components/gestao-tripulantes/AsoReviewPanel';
import AsoAgendamentoInbox from '@/components/gestao-tripulantes/AsoAgendamentoInbox';
import DocsAlertasPanel, { type DocumentoAlertaUI } from '@/components/gestao-tripulantes/DocsAlertasPanel';
import type { TabKey } from '@/components/gestao-tripulantes/CollaboratorModal';
import {
  parseGtDashboardKpi,
  type GtDashboardKpi,
} from '@/lib/gestao-tripulantes/embarque-status';
import { useGtMatrizPermissions } from '@/components/gestao-tripulantes/use-gt-matriz-permissions';
import { useGtLiveProbe } from '@/hooks/useGtLiveProbe';

const GTManScheduleTab = dynamic(
  () => import('@/components/gestao-tripulantes/GTManScheduleTab'),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse h-64 bg-gray-100 rounded-xl" aria-hidden="true" />
    ),
  }
);

const MatrizTreinamentoConfigTab = dynamic(
  () => import('@/components/gestao-tripulantes/admin/MatrizTreinamentoConfigTab'),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse h-64 bg-gray-100 rounded-xl" aria-hidden="true" />
    ),
  }
);

interface DashboardData {
  total_colaboradores: number;
  total_embarcados: number;
  total_disponiveis: number;
  total_docs_vencidos: number;
  total_docs_vencendo: number;
  total_docs_vencidos_historico?: number;
  asos_pendentes_revisao: number;
}

interface Collaborator {
  id: string;
  nome_completo: string;
  cpf: string;
  email: string;
  matricula: string;
  foto_url: string;
  cargo_nome: string;
  empresa_nome: string;
  embarcacao_nome: string;
  centro_custo_nome: string;
  status_embarque: string;
  standby: boolean;
  data_proximo_embarque: string;
  qtd_docs_vencidos: number;
  qtd_docs_vencendo: number;
  qtd_docs_validos: number;
  docs_vencidos_resumo?: { titulo: string; tipo_documento: string; data_validade: string; aba: string }[];
}

interface FiltersState {
  search: string;
  empresa: string;
  /** R8: multi-embarcação, valores = NOMES (API resolve nomes→ids paginado). */
  embarcacoes: string[];
  cargo: string;
  centro_custo: string;
  status: string;
  ativo: string;
  apenasStandby: boolean;
  docsVencidos: boolean;
}

function kpiBannerKey(kpi: GtDashboardKpi | ''): string {
  switch (kpi) {
    case 'embarcados':
      return 'gestaoTripulantes.dashboard.kpiBannerEmbarcados';
    case 'disponiveis':
      return 'gestaoTripulantes.dashboard.kpiBannerDisponiveis';
    case 'docs_vencidos':
      return 'gestaoTripulantes.dashboard.kpiBannerDocs';
    case 'colaboradores':
      return 'gestaoTripulantes.dashboard.kpiBannerTotal';
    case '':
      return '';
    default: {
      const _exhaustive: never = kpi;
      return _exhaustive;
    }
  }
}

function GestaoTripulantesContent() {
  const { t } = useI18n();
  const { user, hasFeature } = useSupabaseAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pathnameSafe = pathname || '/department/gestao-tripulantes';
  const kpiFilter = parseGtDashboardKpi(searchParams?.get('kpi'));

  const { canManageMatrizes, canViewMatrizes } = useGtMatrizPermissions();

  const [activeTab, setActiveTab] = useState<'matrix' | 'schedule' | 'aso-logistica' | 'matriz-config'>(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam === 'aso-logistica') return 'aso-logistica';
    if (tabParam === 'matriz-config') return 'matriz-config';
    if (tabParam === 'schedule') return 'schedule';
    return 'matrix';
  });
  const [scheduleMounted, setScheduleMounted] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [colaboradores, setColaboradores] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColaborador, setSelectedColaborador] = useState<Collaborator | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showAlertas, setShowAlertas] = useState(false);
  const [modalTab, setModalTab] = useState<TabKey | undefined>(undefined);
  const [highlightDocId, setHighlightDocId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FiltersState>({
    search: '', empresa: '', embarcacoes: [], cargo: '', centro_custo: '', status: '',
    ativo: 'ativos', apenasStandby: false, docsVencidos: false
  });
  // R5: seleção de marcados sobrevive a refetches (set de ids; checkboxes filtram pela página atual)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // R5: mesma família de gate do fechamento — ADMIN/MANAGER (bypass do hasFeature)
  // ou ACL `gestao-tripulantes.fechamento.marcas`. O server reforça no POST.
  const podeMarcar = useMemo(() => hasFeature('gestao-tripulantes.fechamento.marcas'), [hasFeature]);

  useEffect(() => {
    if (filters.docsVencidos) setShowAlertas(true);
  }, [filters.docsVencidos]);

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'aso-logistica') setActiveTab('aso-logistica');
    else if (tab === 'matriz-config') setActiveTab('matriz-config');
  }, [searchParams]);

  const setKpiInUrl = useCallback((kpi: GtDashboardKpi | '') => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (kpi) params.set('kpi', kpi);
    else params.delete('kpi');
    const qs = params.toString();
    router.replace(qs ? `${pathnameSafe}?${qs}` : pathnameSafe, { scroll: false });
  }, [pathnameSafe, router, searchParams]);

  const handleKpiClick = useCallback((kpi: GtDashboardKpi) => {
    const next = kpiFilter === kpi ? '' : kpi;
    if (next === 'embarcados' || next === 'disponiveis' || next === 'docs_vencidos' || next === 'colaboradores') {
      setActiveTab('matrix');
    }
    setShowAlertas(next === 'docs_vencidos');
    setFilters((prev) => ({
      ...prev,
      status: '',
      apenasStandby: next === 'disponiveis',
      docsVencidos: next === 'docs_vencidos',
      ativo: 'ativos',
    }));
    setKpiInUrl(next);
  }, [kpiFilter, setKpiInUrl]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/dashboard');
      if (!res.ok) throw new Error('Erro ao carregar dashboard');
      const json = await res.json();
      setDashboard(json.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchColaboradores = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.empresa) params.set('empresa', filters.empresa);
      // R8: multi-embarcação via CSV de nomes (server resolve nomes→ids paginado)
      if (filters.embarcacoes.length > 0) params.set('embarcacoes', filters.embarcacoes.join(','));
      if (filters.cargo) params.set('cargo', filters.cargo);
      if (filters.centro_custo) params.set('centro_custo', filters.centro_custo);
      if (kpiFilter === 'embarcados') {
        params.set('kpi', 'embarcados');
      } else if (filters.status) {
        params.set('status', filters.status);
      }
      if (filters.ativo) params.set('ativo', filters.ativo);
      if (kpiFilter === 'disponiveis' || filters.apenasStandby) params.set('standby', 'true');
      if (kpiFilter === 'docs_vencidos' || filters.docsVencidos) params.set('onlyVencidos', 'true');
      params.set('limit', kpiFilter ? '500' : '100');

      const res = await fetchWithToken(`/api/gestao-tripulantes/colaboradores?${params}`);
      if (!res.ok) throw new Error('Erro ao carregar colaboradores');
      const json = await res.json();
      setColaboradores(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters, kpiFilter]);

  useEffect(() => {
    if (user) {
      fetchDashboard();
    }
  }, [user, fetchDashboard]);

  useEffect(() => {
    if (!user) return;
    const delay = filters.search ? 300 : 0;
    const timer = setTimeout(() => {
      fetchColaboradores();
    }, delay);
    return () => clearTimeout(timer);
  }, [user, filters, kpiFilter, fetchColaboradores]);

  // R3 live: probe leve (15s) via hook compartilhado (baseline na 1ª resposta,
  // pausa com aba oculta, guarda de requisição em voo). Muda a assinatura →
  // refetch dos cards + da lista. Refs evitam rearmar o probe a cada tecla do
  // filtro (debounce de 300ms da busca preservado).
  const fetchDashboardRef = useRef(fetchDashboard);
  const fetchColaboradoresRef = useRef(fetchColaboradores);
  useEffect(() => {
    fetchDashboardRef.current = fetchDashboard;
    fetchColaboradoresRef.current = fetchColaboradores;
  }, [fetchDashboard, fetchColaboradores]);

  useGtLiveProbe({
    escopo: 'colaboradores',
    intervalMs: 15000,
    enabled: Boolean(user),
    onChange: () => {
      fetchDashboardRef.current();
      fetchColaboradoresRef.current();
    },
  });

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedIdsList = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const handleFilterChange = useCallback((partial: Partial<FiltersState>) => {
    if (partial.status !== undefined || partial.apenasStandby !== undefined || partial.docsVencidos !== undefined) {
      setKpiInUrl('');
    }
    setFilters(prev => ({ ...prev, ...partial }));
  }, [setKpiInUrl]);

  const handleRowClick = useCallback((colaborador: Collaborator) => {
    setSelectedColaborador(colaborador);
    setHighlightDocId(null);
    setModalTab((colaborador.qtd_docs_vencidos || 0) > 0 ? 'ficha' : undefined);
    setShowModal(true);
  }, []);

  const handleOpenAlerta = useCallback((item: DocumentoAlertaUI) => {
    setSelectedColaborador({
      id: item.colaborador_id,
      nome_completo: item.colaborador_nome || '',
      cpf: '',
      email: '',
      matricula: item.colaborador_matricula || '',
      foto_url: '',
      cargo_nome: '',
      empresa_nome: '',
      embarcacao_nome: '',
      centro_custo_nome: '',
      status_embarque: '',
      standby: false,
      data_proximo_embarque: '',
      qtd_docs_vencidos: 0,
      qtd_docs_vencendo: 0,
      qtd_docs_validos: 0,
    });
    setModalTab(item.aba);
    setHighlightDocId(item.id);
    setShowModal(true);
  }, []);

  const bannerLabel = useMemo(() => {
    const key = kpiBannerKey(kpiFilter);
    return key ? t(key) : '';
  }, [kpiFilter, t]);

  return (
    <GtPageShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">{t('gestaoTripulantes.title')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t('gestaoTripulantes.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {(canViewMatrizes || canManageMatrizes) && (
            <button
              type="button"
              onClick={() => setActiveTab('matriz-config')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm ${
                activeTab === 'matriz-config'
                  ? 'bg-blue-600 text-white shadow-blue-500/20'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
              }`}
              title="Configurar matriz de treinamentos exigidos por cargo"
            >
              <FiAward className={`w-4 h-4 ${activeTab === 'matriz-config' ? 'text-white' : 'text-indigo-600'}`} />
              Matriz de Treinamentos
            </button>
          )}
          <a href="/department/gestao-tripulantes/novo"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap shadow-sm font-semibold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Novo Colaborador
          </a>
        </div>
      </div>

      {/* Tabs Seletor */}
      <div className="border-b border-gray-200 shrink-0 overflow-x-auto no-scrollbar">
        <nav className="flex space-x-4 sm:space-x-6 -mb-px min-w-max pb-0.5">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'matrix'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Matriz de Conformidade
          </button>
          <button
            onClick={() => {
              setActiveTab('schedule');
              setScheduleMounted(true);
            }}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'schedule'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Man Schedule (Escala MIO)
          </button>
          <button
            onClick={() => setActiveTab('aso-logistica')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'aso-logistica'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ASO Logística
          </button>
          {(canViewMatrizes || canManageMatrizes) && (
            <button
              onClick={() => setActiveTab('matriz-config')}
              className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === 'matriz-config'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Matriz de Treinamentos
            </button>
          )}
        </nav>
      </div>

      {activeTab === 'matrix' && (
        <div className="flex flex-col flex-1 min-h-0 min-w-0 gap-3 overflow-y-auto lg:overflow-hidden">
          <div className="shrink-0 space-y-3">
            <AsoReviewPanel compact />
            <DashboardCards data={dashboard} activeKpi={kpiFilter} onKpiClick={handleKpiClick} />
            {bannerLabel && (
              <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 text-blue-900 text-sm rounded-xl px-4 py-2">
                <span>{bannerLabel}</span>
                <button
                  type="button"
                  onClick={() => handleKpiClick(kpiFilter || 'colaboradores')}
                  className="text-xs font-semibold underline underline-offset-2 hover:text-blue-700"
                >
                  {t('gestaoTripulantes.dashboard.kpiClear', 'Limpar filtro')}
                </button>
              </div>
            )}
            {showAlertas && (
              <DocsAlertasPanel
                open={showAlertas}
                onClose={() => setShowAlertas(false)}
                onOpenDocumento={handleOpenAlerta}
              />
            )}
            <GTMatrixFilters filters={filters} onChange={handleFilterChange} colaboradores={colaboradores} />
          </div>
          {podeMarcar && selectedIdsList.length > 0 && (
            <MarcadosBulkBar
              selectedIds={selectedIdsList}
              onClear={handleClearSelection}
              onMarcado={() => fetchDashboard()}
            />
          )}
          <GTMatrix
            colaboradores={colaboradores}
            loading={loading}
            onRowClick={handleRowClick}
            className="flex-1 min-h-0 min-w-0"
            selectable={podeMarcar}
            selectedIds={podeMarcar ? selectedIds : undefined}
            onToggleSelect={podeMarcar ? handleToggleSelect : undefined}
          />
          <GTMatrixLegend />
        </div>
      )}

      {activeTab === 'aso-logistica' && (
        <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
          <AsoAgendamentoInbox />
        </div>
      )}

      {activeTab === 'matriz-config' && (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto pr-1">
          <MatrizTreinamentoConfigTab readOnly={!canManageMatrizes} />
        </div>
      )}

      {scheduleMounted && (
        <div className={activeTab === 'schedule' ? 'flex flex-col flex-1 min-h-0 min-w-0 w-full overflow-hidden' : 'hidden'}>
          <GTManScheduleTab onColabClick={handleRowClick} kpiFilter={kpiFilter} />
        </div>
      )}

      {showModal && selectedColaborador && (
        <CollaboratorModal
          colaboradorId={selectedColaborador.id}
          initialTab={modalTab}
          highlightDocId={highlightDocId}
          onClose={() => { setShowModal(false); setSelectedColaborador(null); setHighlightDocId(null); }}
        />
      )}
    </GtPageShell>
  );
}

export default function GestaoTripulantesPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-64 bg-gray-100 rounded-xl" aria-hidden="true" />}>
      <GestaoTripulantesContent />
    </Suspense>
  );
}
