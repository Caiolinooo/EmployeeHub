'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { formatCpf } from '@/lib/utils/identity';
import CollaboratorModal from '@/components/gestao-tripulantes/CollaboratorModal';
import ModalAprovacaoFechamento from '@/components/gestao-tripulantes/ModalAprovacaoFechamento';
import AsoAgendamentoDpPanel from '@/components/gestao-tripulantes/AsoAgendamentoDpPanel';
import DpFolhaPanel from '@/components/dp/DpFolhaPanel';
import GtPageShell, { GT_PAGE_SCROLLPORT_CLASS } from '@/components/gestao-tripulantes/GtPageShell';
import SearchableCreatableSelect from '@/components/gestao-tripulantes/SearchableCreatableSelect';
import { mesAnoAtualBRT } from '@/components/gestao-tripulantes/fechamento/fechamentoV2';
import { toast } from 'react-hot-toast';
import {
  FiUsers, FiCalendar, FiAlertTriangle, FiSearch, FiEdit2, FiRefreshCw, FiSend,
  FiBriefcase, FiShield, FiPlus, FiDollarSign,
} from 'react-icons/fi';
import { formatRegimeDisplay } from '@/lib/gestao-tripulantes/regime-escala';

interface ColaboradorItem {
  id: string;
  matricula: string | null;
  nome_completo: string;
  cpf: string;
  ativo: boolean;
  status_embarque: string;
  regime_trabalho: string | null;
  escala_embarque: number | null;
  escala_folga: number | null;
  cargo_nome?: string | null;
  empresa_nome?: string | null;
  embarcacao_nome?: string | null;
  centro_custo_nome?: string | null;
  centro_custo_codigo?: string | null;
}

interface AsoVencimentoItem {
  id: string;
  titulo: string;
  data_validade: string;
  alerta: 'vencido' | 'vencendo';
  colaborador?: {
    id: string;
    nome_completo: string;
    cpf: string;
    matricula: string | null;
    cargo_nome?: string | null;
    embarcacao_nome?: string | null;
  } | null;
}

interface FechamentoTotais {
  totalColaboradores: number;
  totalON: number;
  totalDBA: number;
  totalFI: number;
  totalTRE: number;
  totalFER?: number;
  totalSTB?: number;
  totalFOLGA?: number;
  colaboradoresComAlerta?: number;
}

function formatRegime(c: ColaboradorItem): string {
  return formatRegimeDisplay({
    regime_trabalho: c.regime_trabalho,
    escala_embarque: c.escala_embarque,
    escala_folga: c.escala_folga,
  });
}

function formatCentroCusto(c: ColaboradorItem): string {
  if (c.centro_custo_codigo && c.centro_custo_nome) {
    return `${c.centro_custo_codigo} - ${c.centro_custo_nome}`;
  }
  return c.centro_custo_nome || c.centro_custo_codigo || '—';
}

const EMBARQUE_STATUS_LABEL: Record<string, string> = {
  embarcado: 'Embarcado',
  standby: 'StandBy',
  folga: 'Folga',
  desembarcado: 'Desembarcado',
  afastado: 'Afastado',
  ferias: 'Afastado',
  treinamento: 'Treinamento',
};

const EMBARQUE_STATUS_CLASS: Record<string, string> = {
  embarcado: 'bg-green-100 text-green-800',
  standby: 'bg-orange-100 text-orange-800',
  folga: 'bg-blue-100 text-blue-800',
  desembarcado: 'bg-gray-100 text-gray-700',
  afastado: 'bg-red-100 text-red-800',
  ferias: 'bg-red-100 text-red-800',
  treinamento: 'bg-yellow-100 text-yellow-800',
};

function formatCpfDisplay(cpf: string | null | undefined): string {
  if (!cpf) return '—';
  const formatted = formatCpf(cpf);
  return formatted || cpf;
}

const COLABORADORES_FETCH_LIMIT = 5000;

export default function DepartamentoPessoalPage() {
  const { user, isLoading: authLoading, hasFeature } = useSupabaseAuth();
  const router = useRouter();

  const podeVerFolha = hasFeature('folha.view');

  const [activeTab, setActiveTab] = useState<'colaboradores' | 'fechamento' | 'asos' | 'folha'>('colaboradores');
  const [colaboradores, setColaboradores] = useState<ColaboradorItem[]>([]);
  const [asosPendentes, setAsosPendentes] = useState<AsoVencimentoItem[]>([]);
  const [asoAntecedenciaDias, setAsoAntecedenciaDias] = useState(60);
  const [loading, setLoading] = useState(true);
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<string | null>(null);
  const [isFechamentoModalOpen, setIsFechamentoModalOpen] = useState(false);
  const [isNotifyingAsos, setIsNotifyingAsos] = useState(false);
  const [isConsolidatingEsocial, setIsConsolidatingEsocial] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterEmbarcacao, setFilterEmbarcacao] = useState('');
  const [filterCargo, setFilterCargo] = useState('');
  const [filterEscala, setFilterEscala] = useState('');
  const [filterStatus, setFilterStatus] = useState('ativos');
  const [colaboradoresTotalApi, setColaboradoresTotalApi] = useState<number | null>(null);

  // Mês civil BRT (UTC viraria o mês após 21h do último dia).
  const [mesFechamento, setMesFechamento] = useState(() => mesAnoAtualBRT());
  const [fechamentoTotais, setFechamentoTotais] = useState<FechamentoTotais | null>(null);
  const [fechamentoLoading, setFechamentoLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [resColabs, resAsos] = await Promise.all([
        fetchWithToken(`/api/gestao-tripulantes/colaboradores?limit=${COLABORADORES_FETCH_LIMIT}`),
        fetchWithToken('/api/gestao-tripulantes/aso/notificar-vencimentos'),
      ]);

      if (resColabs.ok) {
        const json = await resColabs.json() as {
          data?: ColaboradorItem[];
          colaboradores?: ColaboradorItem[];
          pagination?: { total?: number };
        };
        const rows = json.data || json.colaboradores || [];
        setColaboradores(rows);
        const total = typeof json.pagination?.total === 'number' ? json.pagination.total : null;
        setColaboradoresTotalApi(total);
        if (total != null && total > rows.length) {
          console.warn(
            `[DP] lista incompleta: ${rows.length} de ${total} colaboradores (teto ${COLABORADORES_FETCH_LIMIT}).`
          );
        }
      } else {
        toast.error('Erro ao carregar colaboradores');
      }

      if (resAsos.ok) {
        const json = await resAsos.json();
        const vencidos = json.data?.vencidos || [];
        const vencendo = json.data?.vencendo || [];
        setAsosPendentes([...vencidos, ...vencendo]);
        if (json.data?.antecedencia_dias) {
          setAsoAntecedenciaDias(Number(json.data.antecedencia_dias) || 60);
        }
      } else {
        toast.error('Erro ao carregar vencimentos de ASO');
      }
    } catch {
      toast.error('Erro ao carregar dados do Departamento Pessoal');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFechamento = useCallback(async (mesAno: string) => {
    try {
      setFechamentoLoading(true);
      const res = await fetchWithToken(`/api/gestao-tripulantes/relatorio-mensal?mesAno=${encodeURIComponent(mesAno)}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setFechamentoTotais(json.totaisConsolidados || null);
      } else {
        setFechamentoTotais(null);
        toast.error(json.error || 'Erro ao carregar fechamento do mês');
      }
    } catch {
      setFechamentoTotais(null);
      toast.error('Erro ao carregar fechamento do mês');
    } finally {
      setFechamentoLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  useEffect(() => {
    if (user && activeTab === 'fechamento') {
      loadFechamento(mesFechamento);
    }
  }, [user, activeTab, mesFechamento, loadFechamento]);

  const handleDispararAlertasAso = async () => {
    try {
      setIsNotifyingAsos(true);
      const res = await fetchWithToken('/api/gestao-tripulantes/aso/notificar-vencimentos', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Alertas de ASO enviados com sucesso!');
      } else {
        toast.error(json.error || 'Erro ao disparar alertas');
      }
    } catch {
      toast.error('Erro de conexão ao disparar alertas');
    } finally {
      setIsNotifyingAsos(false);
    }
  };

  const handleConsolidarEsocial = async () => {
    try {
      setIsConsolidatingEsocial(true);
      const res = await fetchWithToken('/api/e-social/consolidar', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Eventos e-Social consolidados com sucesso!');
      } else {
        toast.error(json.error || 'Erro ao consolidar e-Social');
      }
    } catch {
      toast.error('Erro ao conectar com serviço de e-Social');
    } finally {
      setIsConsolidatingEsocial(false);
    }
  };

  const filteredColabs = useMemo(() => {
    return colaboradores.filter((c) => {
      if (filterStatus === 'ativos' && c.ativo === false) return false;
      if (filterStatus === 'inativos' && c.ativo !== false) return false;

      if (filterEmpresa && (c.empresa_nome || '') !== filterEmpresa) return false;
      if (filterEmbarcacao && (c.embarcacao_nome || '') !== filterEmbarcacao) return false;
      if (filterCargo && (c.cargo_nome || '') !== filterCargo) return false;
      if (filterEscala && formatRegime(c) !== filterEscala && (c.regime_trabalho || '') !== filterEscala) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const nome = (c.nome_completo || '').toLowerCase();
        const cpf = (c.cpf || '').replace(/\D/g, '');
        const mat = (c.matricula || '').toLowerCase();
        const cpfDigits = q.replace(/\D/g, '');
        const cpfMatch = cpfDigits.length > 0 && cpf.includes(cpfDigits);
        return nome.includes(q) || cpfMatch || mat.includes(q);
      }

      return true;
    });
  }, [colaboradores, filterStatus, filterEmpresa, filterEmbarcacao, filterCargo, filterEscala, searchTerm]);

  const empresasOptions = useMemo(() => {
    const set = new Set<string>();
    colaboradores.forEach((c) => { if (c.empresa_nome) set.add(c.empresa_nome); });
    return Array.from(set).sort();
  }, [colaboradores]);

  const embarcacoesOptions = useMemo(() => {
    const set = new Set<string>();
    colaboradores.forEach((c) => { if (c.embarcacao_nome) set.add(c.embarcacao_nome); });
    return Array.from(set).sort();
  }, [colaboradores]);

  const cargosOptions = useMemo(() => {
    const set = new Set<string>();
    colaboradores.forEach((c) => { if (c.cargo_nome) set.add(c.cargo_nome); });
    return Array.from(set).sort();
  }, [colaboradores]);

  const escalasOptions = useMemo(() => {
    const set = new Set<string>();
    colaboradores.forEach((c) => {
      const regime = formatRegime(c);
      if (regime !== '—') set.add(regime);
    });
    return Array.from(set).sort();
  }, [colaboradores]);

  const asosVencidosCount = useMemo(
    () => asosPendentes.filter((a) => a.alerta === 'vencido').length,
    [asosPendentes]
  );

  const ativosCount = useMemo(
    () => colaboradores.filter((c) => c.ativo !== false).length,
    [colaboradores]
  );

  const listaColaboradoresIncompleta =
    colaboradoresTotalApi != null && colaboradoresTotalApi > colaboradores.length;

  if (authLoading || !user) return null;

  return (
    <GtPageShell className="gap-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-abz-blue rounded-xl">
              <FiBriefcase className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-black text-gray-900">Departamento Pessoal (DP)</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Gestão unificada de colaboradores, escalas de trabalho, fechamento de folha e e-Social</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('colaboradores')}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-slate-200 transition"
              title={`${ativosCount} ativos na folha · ${colaboradores.length} carregados na consulta`}
            >
              <FiUsers className="w-3 h-3" />
              <span className="tabular-nums">{filteredColabs.length}</span>
              <span className="font-semibold text-slate-500 hidden sm:inline">· {ativosCount} ativos</span>
            </button>
            {listaColaboradoresIncompleta && (
              <span
                className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200"
                title={`A API retornou ${colaboradores.length} de ${colaboradoresTotalApi} colaboradores`}
              >
                {colaboradores.length}/{colaboradoresTotalApi}
              </span>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('asos')}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition"
              title={`${asosVencidosCount} vencidos · ${asosPendentes.length - asosVencidosCount} a vencer em ${asoAntecedenciaDias}d`}
            >
              <FiAlertTriangle className="w-3 h-3" />
              <span className="tabular-nums">{asosPendentes.length} ASO</span>
              <span className="font-semibold text-amber-700 hidden sm:inline">· {asosVencidosCount} vencidos</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={handleDispararAlertasAso}
            disabled={isNotifyingAsos}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-xl transition shadow-xs disabled:opacity-50"
            title="Disparar notificações de ASOs vencendo por e-mail e in-app"
          >
            <FiSend className={`w-3.5 h-3.5 ${isNotifyingAsos ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">Alertas de ASO</span>
          </button>

          <button
            onClick={handleConsolidarEsocial}
            disabled={isConsolidatingEsocial}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-indigo-900 bg-indigo-100 hover:bg-indigo-200 rounded-xl transition shadow-xs disabled:opacity-50"
            title="Consolidar eventos S-2200, S-2220 e S-2230"
          >
            <FiShield className={`w-3.5 h-3.5 ${isConsolidatingEsocial ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">e-Social</span>
          </button>

          <button
            onClick={() => router.push('/department/dp/novo')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-sm"
          >
            <FiPlus className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Novo colaborador</span>
          </button>

          <button
            onClick={() => setIsFechamentoModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-abz-blue hover:bg-blue-700 rounded-xl transition shadow-sm"
          >
            <FiCalendar className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Fechamento DP</span>
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200 shrink-0 overflow-x-auto no-scrollbar">
        <nav className="flex space-x-4 sm:space-x-6 -mb-px min-w-max pb-0.5">
          <button
            onClick={() => setActiveTab('colaboradores')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'colaboradores'
                ? 'border-abz-blue text-abz-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FiUsers className="w-4 h-4" />
            Cadastros & Colaboradores DP ({filteredColabs.length})
          </button>
          <button
            onClick={() => setActiveTab('fechamento')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'fechamento'
                ? 'border-abz-blue text-abz-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FiCalendar className="w-4 h-4" />
            Fechamento de Escala & Folha
          </button>
          <button
            onClick={() => setActiveTab('asos')}
            className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'asos'
                ? 'border-abz-blue text-abz-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FiAlertTriangle className="w-4 h-4 text-amber-500" />
            Vencimentos de ASO ({asosPendentes.length})
          </button>
          {podeVerFolha && (
            <button
              onClick={() => setActiveTab('folha')}
              className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'folha'
                  ? 'border-abz-blue text-abz-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FiDollarSign className="w-4 h-4 text-emerald-500" />
              Rubricas &amp; Folha
            </button>
          )}
          <button
            onClick={() => router.push('/department/e-social')}
            className="pb-3 text-sm font-bold border-b-2 border-transparent text-gray-500 hover:text-indigo-600 flex items-center gap-2 transition-all whitespace-nowrap"
          >
            <FiShield className="w-4 h-4 text-indigo-500" />
            Painel e-Social ↗
          </button>
        </nav>
      </div>

      {activeTab === 'colaboradores' && (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto lg:overflow-hidden gap-3">
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs space-y-2 shrink-0">
            <div className="flex flex-col md:flex-row gap-2 items-center justify-between">
              <div className="relative flex-1 w-full">
                <FiSearch className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por Nome, CPF ou Matrícula..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-abz-blue"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-gray-700"
                >
                  <option value="ativos">Status: Apenas Ativos</option>
                  <option value="inativos">Status: Apenas Inativos</option>
                  <option value="todos">Status: Todos</option>
                </select>

                <div className="w-32">
                  <SearchableCreatableSelect
                    className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-abz-blue"
                    options={empresasOptions.map(emp => ({ id: emp, label: emp }))}
                    value={filterEmpresa}
                    onChange={setFilterEmpresa}
                    emptyLabel="Empresas"
                    placeholder="Empresas"
                  />
                </div>

                <div className="w-32">
                  <SearchableCreatableSelect
                    className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-abz-blue"
                    options={embarcacoesOptions.map(emb => ({ id: emb, label: emb }))}
                    value={filterEmbarcacao}
                    onChange={setFilterEmbarcacao}
                    emptyLabel="Embarcações"
                    placeholder="Embarcações"
                  />
                </div>

                <div className="w-32">
                  <SearchableCreatableSelect
                    className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-abz-blue"
                    options={cargosOptions.map(cg => ({ id: cg, label: cg }))}
                    value={filterCargo}
                    onChange={setFilterCargo}
                    emptyLabel="Cargos"
                    placeholder="Cargos"
                  />
                </div>

                <select
                  value={filterEscala}
                  onChange={(e) => setFilterEscala(e.target.value)}
                  className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-gray-700"
                >
                  <option value="">Todas Escalas</option>
                  {escalasOptions.map(esc => <option key={esc} value={esc}>{esc}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className={`bg-white rounded-xl border border-gray-200 shadow-xs ${GT_PAGE_SCROLLPORT_CLASS}`}>
            <table className="w-full min-w-[720px] divide-y divide-gray-200 text-left text-xs">
              <thead className="bg-gray-50 text-gray-700 font-bold uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2">Matrícula</th>
                    <th className="px-3 py-2">Colaborador / CPF</th>
                    <th className="px-3 py-2">Cargo</th>
                    <th className="px-3 py-2 hidden xl:table-cell">Centro de Custo</th>
                    <th className="px-3 py-2">Empresa / Emb.</th>
                    <th className="px-3 py-2 hidden lg:table-cell">Escala</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                        <FiRefreshCw className="animate-spin inline w-5 h-5 mr-2 text-abz-blue" />
                        Carregando quadro de colaboradores...
                      </td>
                    </tr>
                  ) : filteredColabs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        Nenhum colaborador encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredColabs.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedColaboradorId(c.id)}
                        className="hover:bg-blue-50/50 cursor-pointer transition"
                      >
                        <td className="px-3 py-2 font-mono font-bold text-gray-900">{c.matricula || '—'}</td>
                        <td className="px-3 py-2">
                          <div className="font-bold text-gray-900">{c.nome_completo}</div>
                          <div className="text-[11px] font-mono text-gray-500">{formatCpfDisplay(c.cpf)}</div>
                        </td>
                        <td className="px-3 py-2 text-gray-700 font-medium">{c.cargo_nome || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 hidden xl:table-cell">{formatCentroCusto(c)}</td>
                        <td className="px-3 py-2 text-gray-600">
                          <div>{c.empresa_nome || '—'}</div>
                          <div className="text-[11px] font-semibold text-abz-blue">{c.embarcacao_nome || '—'}</div>
                        </td>
                        <td className="px-3 py-2 hidden lg:table-cell">
                          <span className="inline-flex px-2 py-0.5 rounded font-mono font-semibold bg-gray-100 text-gray-800 text-[11px]">
                            {formatRegime(c)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-start gap-0.5">
                            <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              c.ativo !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {c.ativo !== false ? 'Ativo' : 'Inativo'}
                            </span>
                            <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              EMBARQUE_STATUS_CLASS[c.status_embarque] || 'bg-gray-100 text-gray-700'
                            }`}>
                              {EMBARQUE_STATUS_LABEL[c.status_embarque] || c.status_embarque || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedColaboradorId(c.id);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                          >
                            <FiEdit2 className="w-3 h-3" /> Editar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
          </div>
        </div>
      )}

      {activeTab === 'fechamento' && (
        <div className={`${GT_PAGE_SCROLLPORT_CLASS} bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-6`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Fechamento Mensal de Escalas — DP & Folha</h2>
              <p className="text-xs text-gray-500">Cômputo diário exato de Dias ON, DBA (Dobra), FI (Folga Indenizada) e TRE (Treinamento) com aprovação digital</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="month"
                value={mesFechamento}
                onChange={(e) => setMesFechamento(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg font-bold text-gray-900"
              />
              <button
                onClick={() => loadFechamento(mesFechamento)}
                disabled={fechamentoLoading}
                className="p-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
                title="Recarregar fechamento"
              >
                <FiRefreshCw className={`w-4 h-4 ${fechamentoLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsFechamentoModalOpen(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-abz-blue hover:bg-blue-700 rounded-xl transition shadow-xs"
              >
                Abrir Painel de Fechamento & Assinaturas
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            <div className="p-3 rounded-xl border border-gray-200 bg-slate-50">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Colaboradores</span>
              <span className="text-xl font-black text-gray-900">
                {fechamentoLoading ? '…' : (fechamentoTotais?.totalColaboradores ?? '—')}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-blue-100 bg-blue-50">
              <span className="text-[10px] font-bold text-blue-700 uppercase block">Dias ON</span>
              <span className="text-xl font-black text-blue-900">
                {fechamentoLoading ? '…' : (fechamentoTotais?.totalON ?? '—')}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-amber-100 bg-amber-50">
              <span className="text-[10px] font-bold text-amber-700 uppercase block">Dias DBA</span>
              <span className="text-xl font-black text-amber-900">
                {fechamentoLoading ? '…' : (fechamentoTotais?.totalDBA ?? '—')}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block">Dias FI</span>
              <span className="text-xl font-black text-emerald-900">
                {fechamentoLoading ? '…' : (fechamentoTotais?.totalFI ?? '—')}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-sky-100 bg-sky-50">
              <span className="text-[10px] font-bold text-sky-700 uppercase block">Dias Folga</span>
              <span className="text-xl font-black text-sky-900">
                {fechamentoLoading ? '…' : (fechamentoTotais?.totalFOLGA ?? '—')}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-yellow-100 bg-yellow-50">
              <span className="text-[10px] font-bold text-yellow-800 uppercase block">Dias STB</span>
              <span className="text-xl font-black text-yellow-900">
                {fechamentoLoading ? '…' : (fechamentoTotais?.totalSTB ?? '—')}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50">
              <span className="text-[10px] font-bold text-indigo-700 uppercase block">TRE / FER</span>
              <span className="text-xl font-black text-indigo-900">
                {fechamentoLoading ? '…' : `${fechamentoTotais?.totalTRE ?? 0} / ${fechamentoTotais?.totalFER ?? 0}`}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-red-100 bg-red-50">
              <span className="text-[10px] font-bold text-red-700 uppercase block">Alertas NxN</span>
              <span className="text-xl font-black text-red-900">
                {fechamentoLoading ? '…' : (fechamentoTotais?.colaboradoresComAlerta ?? 0)}
              </span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2 text-slate-700">
            <p className="font-bold text-slate-900">Regras Contábeis do Fechamento DP:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Comparativo NxN</strong>: embarque 14 deve folgar 14 (28x28 e demais iguais). Cálculo usa dt início e dt fim de cada embarque.</li>
              <li><strong>Dobra (DBA)</strong>: dias a bordo acima da escala regular. Sem dt fim o embarque não entra no automático.</li>
              <li><strong>FI</strong>: folga não gozada (retorno antecipado) + eventos FI da escala, sem duplicar.</li>
              <li><strong>Folga / STB</strong>: intervalo entre embarques; StandBy marcado conta STB, não folga.</li>
              <li><strong>Check soma</strong>: ON + DBA = intervalo dt início/dt fim de cada ciclo.</li>
              <li><strong>Multi-Assinaturas</strong>: e-mail ao DP só sai com 100% das assinaturas da lista nominada.</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'asos' && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <AsoAgendamentoDpPanel
            asosPendentes={asosPendentes}
            loading={loading}
            antecedenciaDias={asoAntecedenciaDias}
            onOpenColaborador={(id) => setSelectedColaboradorId(id)}
            onRefreshVencimentos={loadData}
          />
        </div>
      )}

      {activeTab === 'folha' && podeVerFolha && (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto gap-3">
          <DpFolhaPanel />
        </div>
      )}

      {selectedColaboradorId && (
        <CollaboratorModal
          colaboradorId={selectedColaboradorId}
          onClose={() => {
            setSelectedColaboradorId(null);
            loadData();
          }}
        />
      )}

      {isFechamentoModalOpen && (
        <ModalAprovacaoFechamento
          isOpen={isFechamentoModalOpen}
          initialMesAno={mesFechamento}
          filters={{
            empresa: filterEmpresa || undefined,
            embarcacao: filterEmbarcacao || undefined,
            embarcacoes: filterEmbarcacao ? [filterEmbarcacao] : undefined,
            cargo: filterCargo || undefined,
            statusAtivo: (filterStatus as 'ativos' | 'inativos' | 'todos') || 'ativos',
            busca: searchTerm || undefined,
          }}
          onClose={() => setIsFechamentoModalOpen(false)}
        />
      )}
    </GtPageShell>
  );
}
