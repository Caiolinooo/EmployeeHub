'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  FiAlertTriangle, FiCalendar, FiCheck, FiCheckCircle, FiChevronLeft, FiChevronRight,
  FiDollarSign, FiLock, FiRefreshCw, FiUnlock, FiUsers, FiXCircle,
} from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import AprovacaoFolhaModal from '@/components/payroll/AprovacaoFolhaModal';

// ─── Tipos (wire snake_case das rotas reais) ─────────────────────────────────

interface EmpresaItem {
  id: string;
  name: string;
}

type FolhaStatus = 'draft' | 'calculated' | 'approved' | 'paid' | 'cancelled';

interface FolhaSheet {
  id: string;
  reference_month: number;
  reference_year: number;
  status: FolhaStatus;
  department_id?: string | null;
}

interface StatusUltimoEvento {
  em: string;
  fonte: 'api' | 'arquivo';
  competencia: { mes: number; ano: number };
}

interface StatusCompetencia {
  sheetId: string;
  companyId: string;
  mes: number;
  ano: number;
  status: string;
  itensWk: number;
  itensGt: number;
  itensManual: number;
}

interface StatusWkData {
  ultimoEvento: StatusUltimoEvento | null;
  competencias: StatusCompetencia[];
}

interface ChecklistData {
  sheetId: string;
  escalaTravada: boolean;
  escalaStatus: string | null;
  semSalario: Array<{ id: string; nome: string; cpf: string | null; matricula: string | null }>;
  semVinculo: Array<{ cpf: string; nome: string; motivo: string }>;
  divergenciasWkGt: Array<{ code: string; nome: string; colaboradores: number }>;
}

export interface FechamentoDpWizardProps {
  /** Competência da aba (YYYY-MM, mês civil BRT). */
  mesAno: string;
  /** Status do fechamento de escala GT (gt_relatorios_aprovacoes.status). */
  escalaStatus: string | null;
  /** Abre o ModalAprovacaoFechamento (homologação da escala). */
  onAbrirFechamentoEscala: () => void;
  /** Navega para a aba de colaboradores (resolver pendências de vínculo). */
  onIrParaColaboradores: () => void;
}

const ETAPAS = [1, 2, 3, 4, 5] as const;

const ETAPA_ICONE: Record<number, React.ComponentType<{ className?: string }>> = {
  1: FiCalendar,
  2: FiRefreshCw,
  3: FiDollarSign,
  4: FiCheckCircle,
  5: FiLock,
};

function formatDataBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
}

/**
 * Wizard de fechamento unificado DP (design §4): Escala GT → Ingestão WK →
 * Cálculo → Checklist → Assinar/Bloquear. O checklist é impeditivo: salário
 * zerado bloqueia o avanço para a assinatura.
 */
export default function FechamentoDpWizard({
  mesAno,
  escalaStatus,
  onAbrirFechamentoEscala,
  onIrParaColaboradores,
}: FechamentoDpWizardProps) {
  const { hasFeature } = useSupabaseAuth();
  const { t } = useI18n();

  const podeVerFolha = hasFeature('folha.view');
  const podeEditar = hasFeature('folha.edit');

  const tf = useCallback(
    (key: string, fallback: string, params?: Record<string, string | number>) => t(key, params, fallback),
    [t]
  );

  const competencia = useMemo(() => {
    const [ano, mes] = mesAno.split('-');
    return { mes: parseInt(mes, 10), ano: parseInt(ano, 10) };
  }, [mesAno]);

  const [etapa, setEtapa] = useState<number>(1);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [sheet, setSheet] = useState<FolhaSheet | null>(null);
  const [statusWk, setStatusWk] = useState<StatusWkData | null>(null);
  const [checklist, setChecklist] = useState<ChecklistData | null>(null);
  const [checklistCarregando, setChecklistCarregando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [modalAprovacaoAberto, setModalAprovacaoAberto] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [formReabrirAberto, setFormReabrirAberto] = useState(false);

  const escalaHomologada = escalaStatus === 'aprovado' || escalaStatus === 'enviado';

  // ─── Cargas ────────────────────────────────────────────────────────────────

  const carregarEmpresas = useCallback(async () => {
    try {
      const res = await fetchWithToken('/api/payroll/companies?limit=100&isActive=true');
      const json = await res.json();
      if (res.ok && json.success) setEmpresas(json.data || []);
    } catch {
      setEmpresas([]);
    }
  }, []);

  const carregarSheet = useCallback(async (empresaId: string, comp: { mes: number; ano: number }) => {
    if (!empresaId) {
      setSheet(null);
      return;
    }
    try {
      const qs = `companyId=${encodeURIComponent(empresaId)}&referenceMonth=${comp.mes}&referenceYear=${comp.ano}&limit=5`;
      const res = await fetchWithToken(`/api/payroll/sheets?${qs}`);
      const json = await res.json();
      const lista: FolhaSheet[] = res.ok && json.success ? (json.data || []) : [];
      setSheet(lista.find((s) => !s.department_id) ?? lista[0] ?? null);
    } catch {
      setSheet(null);
    }
  }, []);

  const carregarStatusWk = useCallback(async (empresaId: string) => {
    if (!empresaId) {
      setStatusWk(null);
      return;
    }
    try {
      const res = await fetchWithToken(`/api/dp/wk/status?companyId=${encodeURIComponent(empresaId)}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setStatusWk({ ultimoEvento: json.data?.ultimoEvento ?? null, competencias: json.data?.competencias ?? [] });
      } else {
        setStatusWk(null);
      }
    } catch {
      setStatusWk(null);
    }
  }, []);

  const carregarChecklist = useCallback(async (sheetId: string) => {
    setChecklistCarregando(true);
    try {
      const res = await fetchWithToken(`/api/payroll/sheets/${sheetId}/checklist`);
      const json = await res.json();
      if (res.ok && json.success) {
        setChecklist(json.data as ChecklistData);
      } else {
        setChecklist(null);
        toast.error(json.error || tf('dp.fechamento.erroChecklist', 'Erro ao carregar o checklist'));
      }
    } catch {
      setChecklist(null);
      toast.error(tf('dp.fechamento.erroChecklist', 'Erro ao carregar o checklist'));
    } finally {
      setChecklistCarregando(false);
    }
  }, [tf]);

  useEffect(() => {
    if (podeVerFolha) carregarEmpresas();
  }, [podeVerFolha, carregarEmpresas]);

  useEffect(() => {
    setChecklist(null);
    setFormReabrirAberto(false);
    setJustificativa('');
    if (podeVerFolha && companyId) {
      carregarSheet(companyId, competencia);
      carregarStatusWk(companyId);
    } else {
      setSheet(null);
      setStatusWk(null);
    }
  }, [podeVerFolha, companyId, competencia, carregarSheet, carregarStatusWk]);

  // Entrar na etapa do checklist dispara a consulta (dados frescos a cada visita).
  useEffect(() => {
    if (etapa === 4 && sheet) carregarChecklist(sheet.id);
  }, [etapa, sheet, carregarChecklist]);

  // ─── Ações ─────────────────────────────────────────────────────────────────

  const sincronizarWk = async () => {
    if (!companyId || sincronizando) return;
    setSincronizando(true);
    try {
      const res = await fetchWithToken('/api/dp/wk/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fonte: 'api', competencia, companyId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || tf('dp.fechamento.erroSync', 'Erro na sincronização WK'));
        return;
      }
      toast.success(tf('dp.fechamento.sucessoSync', 'Sincronização WK concluída'));
      await Promise.all([carregarSheet(companyId, competencia), carregarStatusWk(companyId)]);
    } catch {
      toast.error(tf('dp.fechamento.erroSync', 'Erro na sincronização WK'));
    } finally {
      setSincronizando(false);
    }
  };

  const calcularFolha = async () => {
    if (!companyId || calculando) return;
    setCalculando(true);
    try {
      const res = await fetchWithToken('/api/dp/folha/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, competencia }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || tf('dp.fechamento.erroCalculo', 'Erro ao calcular a folha'));
        return;
      }
      toast.success(tf('dp.fechamento.sucessoCalculo', 'Folha calculada com sucesso'));
      await carregarSheet(companyId, competencia);
    } catch {
      toast.error(tf('dp.fechamento.erroCalculo', 'Erro ao calcular a folha'));
    } finally {
      setCalculando(false);
    }
  };

  const reabrirFolha = async () => {
    if (!sheet || reabrindo) return;
    const texto = justificativa.trim();
    if (texto.length < 5) {
      toast.error(tf('dp.fechamento.justificativaCurta', 'Informe a justificativa (mínimo 5 caracteres)'));
      return;
    }
    setReabrindo(true);
    try {
      const res = await fetchWithToken(`/api/payroll/sheets/${sheet.id}/reabrir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justificativa: texto }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || tf('dp.fechamento.erroReabrir', 'Erro ao reabrir a folha'));
        return;
      }
      toast.success(tf('dp.fechamento.sucessoReabrir', 'Folha reaberta para correção'));
      setFormReabrirAberto(false);
      setJustificativa('');
      setChecklist(null);
      await carregarSheet(companyId, competencia);
    } catch {
      toast.error(tf('dp.fechamento.erroReabrir', 'Erro ao reabrir a folha'));
    } finally {
      setReabrindo(false);
    }
  };

  const avancar = () => {
    if (etapa === 1) {
      setEtapa(2);
      return;
    }
    if (etapa === 2) {
      if (!companyId) {
        toast.error(tf('dp.fechamento.selecioneEmpresa', 'Selecione a empresa da folha'));
        return;
      }
      setEtapa(3);
      return;
    }
    if (etapa === 3) {
      if (!sheet) {
        toast.error(tf('dp.fechamento.calculeAntes', 'Calcule a folha para gerar a sheet da competência'));
        return;
      }
      setEtapa(4);
      return;
    }
    if (etapa === 4) {
      if (!checklist) return;
      if (checklist.semSalario.length > 0) {
        toast.error(tf('dp.fechamento.bloqueioSalario', 'Fechamento bloqueado: há colaboradores ativos sem salário base'));
        return;
      }
      setEtapa(5);
    }
  };

  const aoResultadoAprovacao = async (resultado: 'aprovado' | 'rejeitado' | 'cancelado') => {
    if (resultado === 'cancelado') return;
    toast.success(resultado === 'aprovado'
      ? tf('dp.fechamento.folhaAprovada', 'Folha aprovada e bloqueada')
      : tf('dp.fechamento.folhaRejeitada', 'Folha rejeitada'));
    await carregarSheet(companyId, competencia);
  };

  // ─── Derivados ─────────────────────────────────────────────────────────────

  const competenciaStatusWk = useMemo(() => {
    if (!statusWk || !companyId) return null;
    return statusWk.competencias.find(
      (c) => c.companyId === companyId && c.mes === competencia.mes && c.ano === competencia.ano
    ) || null;
  }, [statusWk, companyId, competencia]);

  const avancoBloqueadoChecklist = Boolean(checklist && checklist.semSalario.length > 0);
  const sheetAprovada = sheet?.status === 'approved' || sheet?.status === 'paid';

  const rotuloEtapa = (n: number): string => tf(`dp.fechamento.etapa${n}`, [
    'Escala GT',
    'Ingestão WK',
    'Cálculo',
    'Checklist',
    'Assinar/Bloquear',
  ][n - 1]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 shadow-xs shrink-0">
      {/* Stepper */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-slate-800">
        <ol className="flex flex-wrap items-center gap-1.5">
          {ETAPAS.map((n, idx) => {
            const Icone = ETAPA_ICONE[n];
            const ativa = etapa === n;
            const concluida = etapa > n;
            return (
              <li key={n} className="flex items-center gap-1.5">
                {idx > 0 && <FiChevronRight className="w-3 h-3 text-gray-300 dark:text-slate-600" />}
                <button
                  type="button"
                  onClick={() => setEtapa(n)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
                    ativa
                      ? 'bg-abz-blue text-white'
                      : concluida
                        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {concluida ? <FiCheck className="w-3 h-3" /> : <Icone className="w-3 h-3" />}
                  {n}. {rotuloEtapa(n)}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="p-4 space-y-3 text-xs text-gray-700 dark:text-slate-300">
        {/* Etapa 1 — Escala GT */}
        {etapa === 1 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-gray-900 dark:text-slate-100">{tf('dp.fechamento.escalaTitulo', 'Homologação da escala GT')}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                escalaHomologada
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                  : escalaStatus === 'em_aprovacao'
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
              }`}>
                {escalaHomologada && <FiCheckCircle className="w-3 h-3" />}
                {escalaHomologada
                  ? tf('dp.fechamento.escalaHomologada', 'Homologada e travada')
                  : escalaStatus === 'em_aprovacao'
                    ? tf('dp.fechamento.escalaEmAprovacao', 'Em aprovação')
                    : tf('dp.fechamento.escalaPendente', 'Pendente de homologação')}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              {tf('dp.fechamento.escalaDescricao', 'A escala da competência precisa estar assinada pelos aprovadores antes do fechamento da folha.')}
            </p>
            <button
              type="button"
              onClick={onAbrirFechamentoEscala}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-abz-blue hover:bg-blue-700 rounded-xl transition shadow-xs"
            >
              <FiCalendar className="w-3.5 h-3.5" />
              {tf('dp.fechamento.abrirFechamentoEscala', 'Abrir fechamento de escala & assinaturas')}
            </button>
          </div>
        )}

        {/* Etapa 2 — Ingestão WK */}
        {etapa === 2 && (
          <div className="space-y-3">
            {!podeVerFolha ? (
              <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                {tf('dp.fechamento.requerFolhaView', 'Requer permissão folha.view para as etapas da folha de pagamento.')}
              </p>
            ) : (
              <>
                <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase">
                  {tf('dp.fechamento.empresaFolha', 'Empresa da folha')}
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="block mt-0.5 w-64 max-w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 font-medium text-gray-700 dark:text-slate-200"
                  >
                    <option value="">{tf('dp.fechamento.selecioneEmpresaOpcao', 'Selecione uma empresa')}</option>
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    competenciaStatusWk && competenciaStatusWk.itensWk > 0
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}>
                    {competenciaStatusWk
                      ? tf('dp.fechamento.itensWk', `${competenciaStatusWk.itensWk} itens WK na competência`, { count: competenciaStatusWk.itensWk })
                      : tf('dp.fechamento.semItensWk', 'Nenhum item WK nesta competência')}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-slate-400">
                    {statusWk?.ultimoEvento
                      ? `${tf('dp.fechamento.ultimaSync', 'Última sync')}: ${formatDataBR(statusWk.ultimoEvento.em)}`
                      : tf('dp.fechamento.nuncaSincronizado', 'Nunca sincronizado')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={sincronizarWk}
                  disabled={!podeEditar || !companyId || sincronizando}
                  title={!podeEditar ? tf('dp.fechamento.requerFolhaEdit', 'Requer permissão folha.edit') : undefined}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-abz-blue hover:bg-blue-700 rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  <FiRefreshCw className={`w-3.5 h-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
                  {sincronizando
                    ? tf('dp.fechamento.sincronizandoWk', 'Sincronizando WK...')
                    : tf('dp.fechamento.sincronizarWk', 'Sincronizar WK Radar')}
                </button>
              </>
            )}
          </div>
        )}

        {/* Etapa 3 — Cálculo */}
        {etapa === 3 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-gray-900 dark:text-slate-100">{tf('dp.fechamento.calculoTitulo', 'Cálculo da folha da competência')}</span>
              {sheet && (
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  sheet.status === 'calculated' ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                    : sheetAprovada ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                }`}>
                  {tf(`dp.folha.status${sheet.status.charAt(0).toUpperCase()}${sheet.status.slice(1)}`, sheet.status)}
                </span>
              )}
            </div>
            {!sheet && (
              <p className="text-[11px] text-gray-500 dark:text-slate-400">
                {tf('dp.fechamento.semSheet', 'Nenhuma folha nesta competência — o cálculo cria a sheet e lê embarques, dobras, folgas e férias.')}
              </p>
            )}
            <button
              type="button"
              onClick={calcularFolha}
              disabled={!podeEditar || !companyId || calculando || sheetAprovada}
              title={!podeEditar ? tf('dp.fechamento.requerFolhaEdit', 'Requer permissão folha.edit') : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-indigo-900 dark:text-indigo-200 bg-indigo-100 dark:bg-indigo-950 hover:bg-indigo-200 dark:hover:bg-indigo-900 rounded-xl transition shadow-xs disabled:opacity-50"
            >
              <FiDollarSign className={`w-3.5 h-3.5 ${calculando ? 'animate-pulse' : ''}`} />
              {calculando
                ? tf('dp.fechamento.calculando', 'Calculando...')
                : tf('dp.fechamento.calcularFolha', 'Calcular / recalcular folha')}
            </button>
          </div>
        )}

        {/* Etapa 4 — Checklist */}
        {etapa === 4 && (
          <div className="space-y-3">
            {checklistCarregando ? (
              <p className="text-[11px] text-gray-500 dark:text-slate-400">
                <FiRefreshCw className="animate-spin inline w-3.5 h-3.5 mr-1.5 text-abz-blue" />
                {tf('dp.fechamento.checklistCarregando', 'Conferindo checklist da competência...')}
              </p>
            ) : !checklist ? (
              <p className="text-[11px] text-gray-500 dark:text-slate-400">{tf('dp.fechamento.checklistIndisponivel', 'Checklist indisponível — calcule a folha primeiro.')}</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className={`p-3 rounded-lg border ${checklist.escalaTravada ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950' : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950'}`}>
                    <div className="flex items-center gap-1.5 font-bold text-[11px]">
                      {checklist.escalaTravada ? <FiCheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <FiAlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                      {tf('dp.fechamento.chkEscala', 'Escala GT travada')}
                    </div>
                    <p className="text-[11px] mt-0.5">
                      {checklist.escalaTravada
                        ? tf('dp.fechamento.chkEscalaOk', 'Escala homologada na competência.')
                        : tf('dp.fechamento.chkEscalaPendente', 'Escala ainda não homologada — volte à etapa 1.')}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${checklist.semSalario.length === 0 ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950' : 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950'}`}>
                    <div className="flex items-center gap-1.5 font-bold text-[11px]">
                      {checklist.semSalario.length === 0 ? <FiCheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <FiXCircle className="w-3.5 h-3.5 text-red-600" />}
                      {tf('dp.fechamento.chkSalario', 'Salário base preenchido')}
                    </div>
                    <p className="text-[11px] mt-0.5">
                      {checklist.semSalario.length === 0
                        ? tf('dp.fechamento.chkSalarioOk', 'Todos os ativos têm salário base.')
                        : tf('dp.fechamento.chkSalarioBloqueio', `${checklist.semSalario.length} ativo(s) sem salário — BLOQUEIA o fechamento.`, { count: checklist.semSalario.length })}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${checklist.semVinculo.length === 0 ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950' : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950'}`}>
                    <div className="flex items-center gap-1.5 font-bold text-[11px]">
                      {checklist.semVinculo.length === 0 ? <FiCheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <FiAlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                      {tf('dp.fechamento.chkVinculo', 'Vínculo GT ↔ folha')}
                    </div>
                    <p className="text-[11px] mt-0.5">
                      {checklist.semVinculo.length === 0
                        ? tf('dp.fechamento.chkVinculoOk', 'Todos com escala têm ficha na folha.')
                        : tf('dp.fechamento.chkVinculoPendente', `${checklist.semVinculo.length} colaborador(es) com escala sem vínculo na folha.`, { count: checklist.semVinculo.length })}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${checklist.divergenciasWkGt.length === 0 ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950' : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950'}`}>
                    <div className="flex items-center gap-1.5 font-bold text-[11px]">
                      {checklist.divergenciasWkGt.length === 0 ? <FiCheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <FiAlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                      {tf('dp.fechamento.chkDivergencias', 'Precedência WK × GT')}
                    </div>
                    <p className="text-[11px] mt-0.5">
                      {checklist.divergenciasWkGt.length === 0
                        ? tf('dp.fechamento.chkDivergenciasOk', 'Nenhum código descartado por precedência.')
                        : tf('dp.fechamento.chkDivergenciasPendente', `${checklist.divergenciasWkGt.length} código(s) GT descartados — WK já lançou.`, { count: checklist.divergenciasWkGt.length })}
                    </p>
                  </div>
                </div>

                {checklist.semSalario.length > 0 && (
                  <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 p-3">
                    <p className="font-bold text-[11px] text-red-900 dark:text-red-200 mb-1">
                      {tf('dp.fechamento.semSalarioTitulo', 'Ativos sem salário base (impeditivo)')}
                    </p>
                    <ul className="text-[11px] text-red-800 dark:text-red-300 space-y-0.5">
                      {checklist.semSalario.map((p) => (
                        <li key={p.id} className="flex flex-wrap gap-2">
                          <span className="font-semibold">{p.nome}</span>
                          <span className="font-mono">{p.cpf || '—'}</span>
                          <span className="text-red-600 dark:text-red-400">{p.matricula || ''}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {checklist.semVinculo.length > 0 && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-3">
                    <p className="font-bold text-[11px] text-amber-900 dark:text-amber-200 mb-1">
                      {tf('dp.fechamento.semVinculoTitulo', 'Com escala e sem vínculo na folha')}
                    </p>
                    <ul className="text-[11px] text-amber-900 dark:text-amber-200 space-y-0.5">
                      {checklist.semVinculo.map((p) => (
                        <li key={p.cpf} className="flex flex-wrap gap-2">
                          <span className="font-mono font-bold">{p.cpf}</span>
                          <span className="font-semibold">{p.nome}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={onIrParaColaboradores}
                      className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-amber-900 dark:text-amber-200 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-slate-700 rounded-lg transition"
                    >
                      <FiUsers className="w-3 h-3" />
                      {tf('dp.fechamento.resolverNaAbaColaboradores', 'Resolver na aba Colaboradores')}
                    </button>
                  </div>
                )}

                {checklist.divergenciasWkGt.length > 0 && (
                  <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                    <p className="font-bold text-[11px] text-gray-900 dark:text-slate-100 mb-1">
                      {tf('dp.fechamento.divergenciasTitulo', 'Códigos GT descartados por precedência WK')}
                    </p>
                    <ul className="text-[11px] text-gray-700 dark:text-slate-300 space-y-0.5">
                      {checklist.divergenciasWkGt.map((d) => (
                        <li key={d.code} className="flex flex-wrap gap-2">
                          <span className="font-mono font-bold">{d.code}</span>
                          <span>{d.nome}</span>
                          <span className="text-gray-500 dark:text-slate-400">
                            {tf('dp.fechamento.divergenciasColaboradores', `${d.colaboradores} colaborador(es)`, { count: d.colaboradores })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Etapa 5 — Assinar/Bloquear */}
        {etapa === 5 && (
          <div className="space-y-3">
            {!sheet ? (
              <p className="text-[11px] text-gray-500 dark:text-slate-400">{tf('dp.fechamento.semSheetAssinar', 'Nenhuma folha calculada nesta competência.')}</p>
            ) : sheetAprovada ? (
              <div className="space-y-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  <FiLock className="w-3.5 h-3.5" />
                  {tf('dp.fechamento.folhaBloqueada', 'Folha aprovada e bloqueada')}
                </span>
                {!formReabrirAberto ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => setFormReabrirAberto(true)}
                      title={tf('dp.fechamento.requerFolhaApprove', 'Requer permissão folha.approve (verificado no servidor)')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950 hover:bg-amber-200 dark:hover:bg-amber-900 rounded-xl transition shadow-xs disabled:opacity-50"
                    >
                      <FiUnlock className="w-3.5 h-3.5" />
                      {tf('dp.fechamento.reabrirFolha', 'Reabrir folha para correção')}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-3 space-y-2">
                    <p className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                      {tf('dp.fechamento.reabrirTitulo', 'Reabertura auditada — a folha volta para "calculada" e as assinaturas são reiniciadas.')}
                    </p>
                    <textarea
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      rows={3}
                      placeholder={tf('dp.fechamento.justificativaPlaceholder', 'Justificativa obrigatória (ex.: rubrica lançada a maior para a matrícula 1234)')}
                      className="w-full px-2.5 py-1.5 text-xs border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={reabrirFolha}
                        disabled={reabrindo}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition shadow-xs disabled:opacity-50"
                      >
                        <FiUnlock className={`w-3.5 h-3.5 ${reabrindo ? 'animate-pulse' : ''}`} />
                        {reabrindo ? tf('dp.fechamento.reabrindo', 'Reabrindo...') : tf('dp.fechamento.confirmarReabrir', 'Confirmar reabertura')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFormReabrirAberto(false); setJustificativa(''); }}
                        disabled={reabrindo}
                        className="px-3 py-1.5 text-[11px] font-bold text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl transition"
                      >
                        {tf('dp.fechamento.cancelar', 'Cancelar')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  {sheet.status === 'calculated'
                    ? tf('dp.fechamento.assinarDescricao', 'A folha está calculada. Inicie a coleta de assinaturas para aprovar e bloquear a competência.')
                    : tf('dp.fechamento.assinarRascunho', 'A folha ainda está em rascunho — calcule na etapa 3 antes de assinar.')}
                </p>
                <button
                  type="button"
                  onClick={() => setModalAprovacaoAberto(true)}
                  disabled={sheet.status !== 'calculated'}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  <FiLock className="w-3.5 h-3.5" />
                  {tf('dp.fechamento.assinarBloquear', 'Assinar & bloquear folha')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Navegação */}
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => setEtapa((e) => Math.max(1, e - 1))}
            disabled={etapa <= 1}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:text-slate-300 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 transition"
          >
            <FiChevronLeft className="w-3.5 h-3.5" />
            {tf('dp.fechamento.voltar', 'Voltar')}
          </button>
          {etapa < 5 && (
            <button
              type="button"
              onClick={avancar}
              disabled={(etapa === 4 && (checklistCarregando || !checklist || avancoBloqueadoChecklist))}
              title={etapa === 4 && avancoBloqueadoChecklist
                ? tf('dp.fechamento.bloqueioSalario', 'Fechamento bloqueado: há colaboradores ativos sem salário base')
                : undefined}
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-white bg-abz-blue hover:bg-blue-700 rounded-lg transition disabled:opacity-40"
            >
              {tf('dp.fechamento.avancar', 'Avançar')}
              <FiChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <AprovacaoFolhaModal
        open={modalAprovacaoAberto}
        onClose={() => setModalAprovacaoAberto(false)}
        sheetId={sheet?.id || ''}
        sheetLabel={sheet ? `${String(sheet.reference_month).padStart(2, '0')}/${sheet.reference_year}` : undefined}
        onResultado={aoResultadoAprovacao}
      />
    </div>
  );
}
