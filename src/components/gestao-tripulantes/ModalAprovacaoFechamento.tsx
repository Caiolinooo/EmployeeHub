'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FiX,
  FiCheckCircle,
  FiDownload,
  FiSend,
  FiShield,
  FiSearch,
  FiRefreshCw,
  FiAlertTriangle,
  FiCalendar,
  FiFileText,
  FiUsers,
  FiCheck,
  FiClock,
  FiChevronDown,
  FiChevronUp,
  FiSliders,
  FiList,
  FiTrendingUp,
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useSignature } from '@/contexts/SignatureContext';
import { useI18n } from '@/contexts/I18nContext';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import { useGtLiveProbe } from '@/hooks/useGtLiveProbe';
import {
  assinaturaCobreAprovador,
  isFechamentoRole,
  isFechamentoStatus,
  labelFechamentoStatus,
  mensagemErroAssinaturaAusente,
  mensagemErroAssinaturaNegada,
  podeAssinarFechamento,
  type AprovadorObrigatorio,
  type AssinaturaFechamento,
} from '@/lib/gestao-tripulantes/fechamento-assinatura';
import PeriodoFechamentoEditor from './fechamento/PeriodoFechamentoEditor';
import MarcadosFechamentoPanel from './fechamento/MarcadosFechamentoPanel';
import PendenciasProximoPeriodo from './fechamento/PendenciasProximoPeriodo';
import FilaRevisaoEscala from './fechamento/FilaRevisaoEscala';
import MultiEmbarcacaoFilter from './fechamento/MultiEmbarcacaoFilter';
import FechamentoEmbarquesEditor from './fechamento/FechamentoEmbarquesEditor';
import {
  formatarDataBR,
  mesAnoAtualBRT,
  resolverColaboradorIdLinha,
  type ColaboradorTotaisLinha,
  type FechamentoPeriodoInfo,
  type PendenciasPayload,
} from './fechamento/fechamentoV2';

export interface ModalFilters {
  empresa?: string;
  embarcacao?: string;
  /** R8: multi-embarcação (csv no query `embarcacoes=`). Tem prioridade sobre `embarcacao`. */
  embarcacoes?: string[];
  cargo?: string;
  statusAtivo?: 'ativos' | 'inativos' | 'todos';
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
}

interface ModalAprovacaoFechamentoProps {
  isOpen: boolean;
  onClose: () => void;
  initialMesAno?: string;
  filters?: ModalFilters;
  onSuccess?: () => void;
}

type AbaFechamento = 'resumo' | 'colaboradores' | 'periodo' | 'fila';

const FECHAMENTO_MODAL_TAB_CLASS = 'no-scrollbar shrink-0 flex items-center gap-1 overflow-x-auto border-b border-gray-200 px-2 sm:px-4';

export default function ModalAprovacaoFechamento({
  isOpen,
  onClose,
  initialMesAno,
  filters = {},
  onSuccess,
}: ModalAprovacaoFechamentoProps) {
  const { t } = useI18n();
  useEscapeToClose(isOpen, onClose);
  // Mês civil local (BRT): toISOString() viraria o mês em 21h do fim de mês.
  const [mesAno, setMesAno] = useState(initialMesAno || mesAnoAtualBRT());
  const [aba, setAba] = useState<AbaFechamento>('resumo');
  const [isLoading, setIsLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState(filters.busca || '');
  // Edição em tempo real: linha do Tripulantes expandida mostra o editor
  // inline de embarques (FechamentoEmbarquesEditor) do colaborador.
  const [linhaExpandida, setLinhaExpandida] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<{ success: boolean; text: string; hash?: string; pendentes?: any[] } | null>(null);

  // R8: chips multi-embarcação (estado próprio; inicializa com os filtros da matriz/DP).
  // Callers legados podem mandar `embarcacao` como lista vírgula-junta (Man Schedule
  // multi-seleção) — quebramos em chips individuais.
  const [embarcacoesSelecionadas, setEmbarcacoesSelecionadas] = useState<string[]>(() => {
    if (filters.embarcacoes && filters.embarcacoes.length > 0) return filters.embarcacoes;
    return (filters.embarcacao || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  });
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  // R2: período resolvido (preview payload > editor local).
  const [periodoEditor, setPeriodoEditor] = useState<{
    dataInicio: string | null;
    dataFim: string | null;
    fonte: string;
  } | null>(null);

  const { requestSignature, hasSignature } = useSignature();
  const { user, profile, hasFeature } = useSupabaseAuth();
  const fechamentoUser = {
    id: profile?.id || user?.id,
    email: profile?.email || user?.email || '',
    role: profile?.role ?? null,
    first_name: profile?.first_name ?? null,
    last_name: profile?.last_name ?? null,
  };
  const podeRevisar = isFechamentoRole(profile?.role);
  // ACL: além da família de roles do fechamento, permissões granulares
  // (semeadas em src/config/modules.ts → POST /api/acl/init) liberam recursos
  // individuais. Checagens server-side espelham o mesmo OR (fail-closed).
  const podePeriodo = podeRevisar || hasFeature('gestao-tripulantes.fechamento.periodo');
  const podeMarcas = podeRevisar || hasFeature('gestao-tripulantes.fechamento.marcas');
  const podeRevisao = podeRevisar || hasFeature('gestao-tripulantes.fechamento.revisao');

  const loadSeqRef = useRef(0);

  const embarcacoesKey = embarcacoesSelecionadas.join(',');

  const buildQueryString = (targetMes: string) => {
    const params = new URLSearchParams();
    params.set('mesAno', targetMes);
    if (embarcacoesSelecionadas.length > 0) params.set('embarcacoes', embarcacoesSelecionadas.join(','));
    if (filters.empresa) params.set('empresa', filters.empresa);
    if (filters.cargo) params.set('cargo', filters.cargo);
    if (filters.statusAtivo) params.set('statusAtivo', filters.statusAtivo);
    if (filters.dataInicio) params.set('dataInicio', filters.dataInicio);
    if (filters.dataFim) params.set('dataFim', filters.dataFim);
    if (searchTerm) params.set('busca', searchTerm);
    return params.toString();
  };

  const loadPreview = async (targetMes: string, opts?: { keepResult?: boolean }) => {
    const seq = ++loadSeqRef.current;
    setIsLoading(true);
    setErrorMsg(null);
    if (!opts?.keepResult) setResultMsg(null);
    try {
      const q = buildQueryString(targetMes);
      const res = await fetchWithToken(`/api/gestao-tripulantes/relatorio-mensal?${q}`);
      const data = await res.json().catch(() => ({}));
      if (seq !== loadSeqRef.current) return;
      if (!res.ok || !data.success) {
        throw new Error(data.error || t('gtFechV2.msg.erroCarregar', 'Erro ao carregar dados do mês.'));
      }
      setPreviewData(data);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      console.error('Erro no preview do fechamento:', err);
      setErrorMsg(err instanceof Error ? err.message : t('gtFechV2.msg.erroCarregar', 'Falha ao buscar dados do fechamento.'));
    } finally {
      if (seq === loadSeqRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPreview(mesAno);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mesAno, embarcacoesKey, filters.empresa, filters.cargo, filters.statusAtivo, filters.dataInicio, filters.dataFim]);

  // R3: probe leve de 15s — escritas de escala/marcações refrescam preview + painéis.
  const [probeTick, setProbeTick] = useState(0);
  useGtLiveProbe({
    escopo: 'fechamento',
    enabled: isOpen,
    onChange: () => setProbeTick((v) => v + 1),
  });
  useEffect(() => {
    if (!isOpen) return;
    if (probeTick === 0) return; // 0 = baseline (o hook só notifica mudança real)
    loadPreview(mesAno, { keepResult: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probeTick, isOpen]);

  const periodoResolvido: FechamentoPeriodoInfo | null = (() => {
    if (filters.dataInicio && filters.dataFim) {
      return { dataInicio: filters.dataInicio, dataFim: filters.dataFim, fonte: 'explicit' };
    }
    const doPreview = previewData?.periodo as FechamentoPeriodoInfo | undefined;
    if (doPreview?.dataInicio && doPreview?.dataFim) return doPreview;
    if (periodoEditor?.dataInicio && periodoEditor?.dataFim) {
      return { dataInicio: periodoEditor.dataInicio, dataFim: periodoEditor.dataFim, fonte: periodoEditor.fonte };
    }
    return null;
  })();

  const handleDownloadXlsx = () => {
    const q = buildQueryString(mesAno) + '&download=true';
    window.open(`/api/gestao-tripulantes/relatorio-mensal?${q}`, '_blank');
  };

  const executeApproval = async (signatureUrl: string) => {
    setIsApproving(true);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/relatorio-mensal/aprovar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesAno,
          observacoes,
          enviarEmail,
          signature_url: signatureUrl,
          embarcacoes: embarcacoesSelecionadas,
          periodo: periodoResolvido
            ? { dataInicio: periodoResolvido.dataInicio, dataFim: periodoResolvido.dataFim }
            : undefined,
          filtros: {
            empresa: filters.empresa,
            embarcacoes: embarcacoesSelecionadas,
            cargo: filters.cargo,
            statusAtivo: filters.statusAtivo,
            busca: searchTerm,
            dataInicio: filters.dataInicio,
            dataFim: filters.dataFim,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || t('gtFechV2.msg.erroAprovar', `Erro ao aprovar fechamento (${res.status}).`));
      }

      setResultMsg({
        success: true,
        text: data.message || t('gtFechV2.msg.ok', 'Assinatura registrada com sucesso!'),
        hash: data.signatureHash,
        pendentes: data.pendentes,
      });

      if (onSuccess) onSuccess();
      await loadPreview(mesAno, { keepResult: true });
    } catch (err) {
      console.error('Erro na aprovação do fechamento:', err);
      setErrorMsg(err instanceof Error ? err.message : t('gtFechV2.msg.erroAprovar', 'Erro ao processar aprovação.'));
    } finally {
      setIsApproving(false);
    }
  };

  const handleApprove = async () => {
    setErrorMsg(null);
    setResultMsg(null);
    const lista = (previewData?.aprovadoresObrigatorios || []) as AprovadorObrigatorio[];
    const gate = podeAssinarFechamento(lista, {
      userId: fechamentoUser.id,
      email: fechamentoUser.email,
      role: fechamentoUser.role,
    });
    if (!gate.permitido) {
      setErrorMsg(mensagemErroAssinaturaNegada(gate.motivo));
      return;
    }
    try {
      // Sempre passa pelo modal global de assinatura antes do POST.
      const sign = await requestSignature({
        title: t('gtFechV2.assinatura.titulo', 'Assinatura Digital de Fechamento de Escala'),
        description: t(
          'gtFechV2.assinatura.descricao',
          { mes: mesAno },
          `Confirme sua assinatura digital para validar o fechamento de escala de ${mesAno} para o DP.`,
        ),
      });
      if (!sign) {
        if (!hasSignature) {
          setErrorMsg(mensagemErroAssinaturaAusente());
        }
        return;
      }
      await executeApproval(sign.signatureUrl);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('gtFechV2.msg.erroAssinatura', 'Erro ao solicitar assinatura digital.'));
    }
  };

  if (!isOpen) return null;

  const colabs: ColaboradorTotaisLinha[] = previewData?.colaboradoresTotais || [];
  const filteredColabs = colabs.filter((c) =>
    (c.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cpf || '').includes(searchTerm) ||
    (c.cargo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const obrigatorios: AprovadorObrigatorio[] = previewData?.aprovadoresObrigatorios || [];
  const assinaturas: AssinaturaFechamento[] = previewData?.assinaturasColetadas || [];
  const totalObrigatorios = obrigatorios.length > 0 ? obrigatorios.length : 1;
  const assinadosCount = assinaturas.length;
  const registroStatus = String(previewData?.registro?.status || '');
  const isFullyApproved = registroStatus === 'aprovado' || registroStatus === 'enviado';
  const isPartiallyApproved = registroStatus === 'em_aprovacao';
  const gateAssinatura = podeAssinarFechamento(obrigatorios, {
    userId: fechamentoUser.id,
    email: fechamentoUser.email,
    role: fechamentoUser.role,
  });
  const podeAssinarAgora = Boolean(previewData) && gateAssinatura.permitido;
  const motivoNaoAssinar = !gateAssinatura.permitido
    ? mensagemErroAssinaturaNegada(gateAssinatura.motivo)
    : null;
  const statusBadgeLabel = isFechamentoStatus(registroStatus)
    ? labelFechamentoStatus(registroStatus, { assinados: assinadosCount, obrigatorios: obrigatorios.length })
    : (isFullyApproved
      ? t('gtFechV2.status.total', '✓ 100% Assinado & Aprovado')
      : (isPartiallyApproved
        ? t('gtFechV2.status.parcial', { assinados: assinadosCount, obrigatorios: totalObrigatorios }, `Em Aprovação (${assinadosCount}/${totalObrigatorios})`)
        : t('gtFechV2.status.pendente', 'Pendente de Assinatura')));

  const pendencias: PendenciasPayload | undefined = previewData?.pendencias;
  const pendenciasCarregando = isLoading && !pendencias;
  const marcadosInfo = previewData?.marcados as { listaConfirmada?: boolean; total?: number } | undefined;
  const filtrosAtivosCount =
    (embarcacoesSelecionadas.length > 0 ? 1 : 0)
    + (filters.empresa ? 1 : 0)
    + (filters.cargo ? 1 : 0)
    + (filters.dataInicio || filters.dataFim ? 1 : 0);

  const tabsForRender: Array<{ id: AbaFechamento; label: string; icon: React.ReactNode }> = [
    { id: 'resumo', label: t('gtFechV2.tabs.resumo', 'Resumo & Assinaturas'), icon: <FiShield className="w-3.5 h-3.5" /> },
    { id: 'colaboradores', label: `${t('gtFechV2.tabs.colaboradores', 'Tripulantes')} (${filteredColabs.length})`, icon: <FiUsers className="w-3.5 h-3.5" /> },
    { id: 'periodo', label: t('gtFechV2.tabs.periodo', 'Período & Marcados'), icon: <FiCalendar className="w-3.5 h-3.5" /> },
    ...(podeRevisao
      ? [{ id: 'fila' as AbaFechamento, label: t('gtFechV2.tabs.fila', 'Fila de revisão'), icon: <FiList className="w-3.5 h-3.5" /> }]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 sm:p-2">
      <div
        className="flex w-full max-w-none flex-col overflow-hidden border-0 bg-white shadow-2xl h-[100dvh] rounded-none sm:h-[min(98dvh,calc(100dvh-1rem))] sm:rounded-2xl sm:border sm:border-gray-200 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-label={t('gtFechV2.title', 'Fechamento Mensal de Escalas — DP & Folha')}
      >
        {/* Cabeçalho (shrink-0) */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-900 text-white shadow-sm">
              <FiShield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">
                {t('gtFechV2.title', 'Fechamento Mensal de Escalas — DP & Folha')}
              </h2>
              <p className="hidden truncate text-xs text-gray-500 sm:block">
                {t('gtFechV2.subtitle', 'Cômputo individual de ON, DBA, FI e TRE com conferência de integrantes e aprovação digital obrigatória')}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`hidden rounded-full px-2.5 py-0.5 text-[11px] font-bold md:inline-flex ${
              isFullyApproved ? 'bg-emerald-100 text-emerald-800' : (isPartiallyApproved ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800')
            }`}>
              {statusBadgeLabel}
            </span>
            <button
              type="button"
              onClick={onClose}
              data-modal-close=""
              className="min-h-[44px] min-w-[44px] p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition"
              aria-label={t('gtFechV2.acoes.fechar', 'Fechar')}
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar do mês / período / marcados (shrink-0) */}
        <div className="shrink-0 space-y-2 border-b border-gray-100 bg-white px-3 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-gray-700">
              <FiCalendar className="text-abz-blue" />
              <span className="hidden sm:inline">{t('gtFechV2.toolbar.mesReferencia', 'Mês de referência')}</span>
            </label>
            <input
              type="month"
              value={mesAno}
              onChange={(e) => setMesAno(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-900 shadow-sm focus:ring-2 focus:ring-abz-blue"
            />
            {periodoResolvido && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-900"
                title={t('gtFechV2.periodo.titleBadge', 'Período usado por preview, aprovação e download')}
              >
                {formatarDataBR(periodoResolvido.dataInicio, { anoCurto: true })} → {formatarDataBR(periodoResolvido.dataFim, { anoCurto: true })}
                <span className="font-semibold text-blue-500">
                  ({periodoResolvido.fonte === 'explicit'
                    ? t('gtFechV2.periodo.fonteExplicita', 'filtro')
                    : periodoResolvido.fonte === 'config'
                      ? t('gtFechV2.periodo.fonteManual', 'manual')
                      : t('gtFechV2.periodo.fonteMes', 'mês civil')})
                </span>
              </span>
            )}
            {marcadosInfo && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  marcadosInfo.listaConfirmada ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                }`}
                title={t('gtFechV2.marcados.badgeHint', 'Estado da lista de marcados deste mês')}
              >
                <FiList className="h-3 w-3" />
                {marcadosInfo.listaConfirmada
                  ? t('gtFechV2.marcados.estadoConfirmada', 'Confirmada — só marcados entram')
                  : t('gtFechV2.marcados.estadoAberta', 'Aberta — todos entram')}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltrosAbertos((v) => !v)}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                  filtrosAbertos || filtrosAtivosCount > 0
                    ? 'border-abz-blue/40 bg-blue-50 text-abz-blue'
                    : 'border-gray-300 bg-white text-gray-600'
                }`}
              >
                <FiSliders className="w-3.5 h-3.5" />
                {filtrosAbertos
                  ? t('gtFechV2.toolbar.ocultarFiltros', 'Ocultar filtros')
                  : t('gtFechV2.toolbar.filtros', 'Filtros')}
                {filtrosAtivosCount > 0 && (
                  <span className="rounded-full bg-abz-blue px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {filtrosAtivosCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => loadPreview(mesAno)}
                disabled={isLoading}
                className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
                title={t('gtFechV2.toolbar.recarregar', 'Recarregar dados')}
              >
                <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleDownloadXlsx}
                disabled={isLoading}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                <FiDownload className="w-4 h-4" />
                <span className="hidden sm:inline">{t('gtFechV2.toolbar.baixar', 'Planilha (.xlsx)')}</span>
              </button>
            </div>
          </div>

          {/* R8 + R9: filtros colapsáveis */}
          {filtrosAbertos && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <MultiEmbarcacaoFilter
                selected={embarcacoesSelecionadas}
                onChange={setEmbarcacoesSelecionadas}
              />
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                <span className="font-bold text-slate-800">{t('gtFechV2.toolbar.filtrosAtivos', 'Filtros herdados da matriz:')}</span>
                {filters.empresa && <span className="rounded border border-slate-300 bg-white px-2 py-0.5 font-semibold">{t('gtFechV2.filtro.empresa', 'Empresa')}: {filters.empresa}</span>}
                {filters.cargo && <span className="rounded border border-slate-300 bg-white px-2 py-0.5 font-semibold">{t('gtFechV2.filtro.cargo', 'Cargo')}: {filters.cargo}</span>}
                {filters.statusAtivo && <span className="rounded border border-slate-300 bg-white px-2 py-0.5 font-semibold">{t('gtFechV2.filtro.status', 'Status')}: {filters.statusAtivo}</span>}
                {(filters.dataInicio || filters.dataFim) && (
                  <span className="rounded border border-slate-300 bg-white px-2 py-0.5 font-semibold">
                    {t('gtFechV2.filtro.periodoExplicito', 'Período explícito')}:{' '}
                    {filters.dataInicio ? formatarDataBR(filters.dataInicio, { anoCurto: true }) : '…'} → {filters.dataFim ? formatarDataBR(filters.dataFim, { anoCurto: true }) : '…'}
                  </span>
                )}
                {!filters.empresa && !filters.cargo && !filters.statusAtivo && !filters.dataInicio && !filters.dataFim && (
                  <span className="text-slate-400">{t('gtFechV2.filtro.nenhumHerdado', 'nenhum')}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Abas (shrink-0) */}
        <div className={FECHAMENTO_MODAL_TAB_CLASS} data-testid="fechamento-modal-tablist">
          {tabsForRender.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAba(tab.id)}
              className={`inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-bold transition ${
                aba === tab.id ? 'border-abz-blue text-abz-blue' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Corpo (flex-1 min-h-0 overflow-auto) */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm sm:p-5" data-testid="fechamento-modal-body">
          {aba === 'resumo' && (
            <div className="space-y-4">
              {errorMsg && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <FiAlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {resultMsg && (
                <div className="space-y-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  <div className="flex items-center gap-2 font-bold">
                    <FiCheckCircle className="w-5 h-5 flex-shrink-0 text-green-600" />
                    <span>{resultMsg.text}</span>
                  </div>
                  {resultMsg.hash && (
                    <div className="break-all rounded bg-green-100/70 p-2 font-mono text-xs text-green-900">
                      {t('gtFechV2.resumo.hash', 'Hash de Autenticidade da sua Assinatura')}: <strong>{resultMsg.hash}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Cards de KPIs Consolidados (Cálculo Diário) */}
              {previewData?.totaisConsolidados && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="block text-[11px] font-semibold uppercase text-slate-500">{t('gtFechV2.kpi.tripulantes', 'Tripulantes')}</span>
                    <span className="text-xl font-black text-slate-900">
                      {previewData.totaisConsolidados.totalColaboradores}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-400">{t('gtFechV2.kpi.totalFiltrado', 'Total filtrado')}</span>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <span className="block text-[11px] font-semibold uppercase text-emerald-700">{t('gtFechV2.kpi.diasOn', 'Dias ON')}</span>
                    <span className="text-xl font-black text-emerald-800">
                      {previewData.totaisConsolidados.totalON} <span className="text-xs font-normal">{t('gtFechV2.pendencias.dias', 'dias')}</span>
                    </span>
                    <span className="mt-0.5 block text-[10px] text-emerald-600/70">{t('gtFechV2.kpi.aBordoRegular', 'A bordo regular')}</span>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <span className="block text-[11px] font-semibold uppercase text-amber-700">{t('gtFechV2.kpi.diasDba', 'Dias DBA')}</span>
                    <span className="text-xl font-black text-amber-800">
                      {previewData.totaisConsolidados.totalDBA} <span className="text-xs font-normal">{t('gtFechV2.pendencias.dias', 'dias')}</span>
                    </span>
                    <span className="mt-0.5 block text-[10px] text-amber-600/70">{t('gtFechV2.kpi.dobraExcede', 'Dobra (excede NxN)')}</span>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <span className="block text-[11px] font-semibold uppercase text-blue-700">{t('gtFechV2.kpi.diasFi', 'Dias FI')}</span>
                    <span className="text-xl font-black text-blue-800">
                      {previewData.totaisConsolidados.totalFI} <span className="text-xs font-normal">{t('gtFechV2.pendencias.dias', 'dias')}</span>
                    </span>
                    <span className="mt-0.5 block text-[10px] text-blue-600/70">{t('gtFechV2.kpi.folgaIndenizada', 'Folga indenizada')}</span>
                  </div>
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                    <span className="block text-[11px] font-semibold uppercase text-sky-700">{t('gtFechV2.kpi.diasFolga', 'Dias Folga')}</span>
                    <span className="text-xl font-black text-sky-800">
                      {previewData.totaisConsolidados.totalFOLGA ?? 0} <span className="text-xs font-normal">{t('gtFechV2.pendencias.dias', 'dias')}</span>
                    </span>
                    <span className="mt-0.5 block text-[10px] text-sky-600/70">{t('gtFechV2.kpi.descanso', 'Descanso do ciclo')}</span>
                  </div>
                  <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3">
                    <span className="block text-[11px] font-semibold uppercase text-yellow-800">{t('gtFechV2.kpi.diasStb', 'Dias STB')}</span>
                    <span className="text-xl font-black text-yellow-900">
                      {previewData.totaisConsolidados.totalSTB ?? 0} <span className="text-xs font-normal">{t('gtFechV2.pendencias.dias', 'dias')}</span>
                    </span>
                    <span className="mt-0.5 block text-[10px] text-yellow-700/70">{t('gtFechV2.kpi.standby', 'StandBy')}</span>
                  </div>
                  <div className="rounded-xl border border-purple-200 bg-purple-50 p-3">
                    <span className="block text-[11px] font-semibold uppercase text-purple-700">{t('gtFechV2.kpi.treFer', 'TRE / FER')}</span>
                    <span className="text-xl font-black text-purple-800">
                      {previewData.totaisConsolidados.totalTRE ?? 0}
                      <span className="text-xs font-normal"> / </span>
                      {previewData.totaisConsolidados.totalFER ?? 0}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-purple-600/70">{t('gtFechV2.kpi.treinoFerias', 'Treino / férias')}</span>
                  </div>
                  <div className={`rounded-xl border p-3 ${(previewData.totaisConsolidados.colaboradoresComAlerta ?? 0) > 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                    <span className="block text-[11px] font-semibold uppercase text-slate-600">{t('gtFechV2.kpi.checkEscala', 'Check escala')}</span>
                    <span className="text-xl font-black text-slate-900">
                      {previewData.totaisConsolidados.colaboradoresComAlerta ?? 0}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">{t('gtFechV2.kpi.comAlerta', 'Com alerta NxN')}</span>
                  </div>
                </div>
              )}

              {/* R4: pendências do próximo período */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <PendenciasProximoPeriodo pendencias={pendencias} isLoading={pendenciasCarregando} />
              </div>

              {/* Painel de Aprovadores Obrigatórios & Progresso de Assinaturas */}
              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-900">
                    <FiUsers className="text-abz-blue" />
                    {t('gtFechV2.aprovadores.titulo', 'Conferência de Integrantes & Assinaturas Obrigatórias')}
                  </h4>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isFullyApproved ? 'bg-emerald-100 text-emerald-800' : (isPartiallyApproved ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800')
                  }`}>
                    {statusBadgeLabel}
                  </span>
                </div>

                {obrigatorios.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                    {obrigatorios.map((obr, idx) => {
                      const signature = assinaturaCobreAprovador(obr, assinaturas);
                      return (
                        <div
                          key={obr.email || idx}
                          className={`flex items-center justify-between rounded-lg border p-2.5 text-xs ${
                            signature
                              ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
                              : 'border-amber-200 bg-white text-amber-950'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1 font-bold">
                              {signature ? <FiCheck className="font-bold text-emerald-600" /> : <FiClock className="text-amber-600" />}
                              <span className="truncate">{obr.nome}</span>
                            </div>
                            <div className="truncate text-[11px] text-gray-500">
                              {obr.email} {obr.cargo && `• ${obr.cargo}`}
                            </div>
                          </div>
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            signature ? 'bg-emerald-200/80 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {signature ? t('gtFechV2.aprovadores.assinado', 'Assinado') : t('gtFechV2.aprovadores.pendente', 'Pendente')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-gray-600">
                    {t('gtFechV2.aprovadores.semLista', 'Nenhum aprovador específico fixado nas configurações. Qualquer gestor ou administrador pode assinar uma vez para concluir o fechamento e liberar o e-mail ao DP.')}
                  </div>
                )}

                <p className="pt-1 text-[11px] text-gray-500">
                  {obrigatorios.length > 0
                    ? t('gtFechV2.aprovadores.listaHint', 'O e-mail ao DP só sai quando todas as pessoas desta lista tiverem assinado. Perfil USER/MANAGER/ADMIN não substitui a lista e assinaturas extras não fecham o fluxo.')
                    : t('gtFechV2.aprovadores.semListaHint', 'Sem lista nominada, a primeira assinatura de um gestor ou administrador conclui o fechamento e dispara o e-mail ao DP (se marcado). Usuários USER não concluem neste modo.')}
                </p>
              </div>

              {/* Observações & Envio */}
              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      {t('gtFechV2.resumo.observacoes', 'Observações da Aprovação (Opcional)')}
                    </label>
                    <textarea
                      rows={2}
                      placeholder={t('gtFechV2.resumo.observacoesPlaceholder', 'Ex: Escala conferida com RH e Logística, autorizada para folha.')}
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:ring-2 focus:ring-abz-blue"
                    />
                  </div>

                  <div className="flex flex-col justify-center space-y-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={enviarEmail}
                        onChange={(e) => setEnviarEmail(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-abz-blue focus:ring-abz-blue"
                      />
                      <span className="text-xs font-semibold text-gray-800">
                        {t('gtFechV2.resumo.enviarEmail', 'Disparar e-mail ao Departamento Pessoal quando todas as assinaturas forem concluídas')}
                      </span>
                    </label>
                    <p className="pl-6 text-[11px] text-gray-500">
                      {t('gtFechV2.resumo.enviarEmailHint', 'Anexa a planilha XLSX oficial assinada por todos os aprovadores.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {aba === 'colaboradores' && (
            <div className="flex h-full min-h-0 flex-col gap-2">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                  {t('gtFechV2.resumo.detalhamento', 'Detalhamento dos Tripulantes')} ({filteredColabs.length})
                </h3>
                <div className="relative w-full sm:w-64">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t('gtFechV2.resumo.filtrarNomeCpf', 'Filtrar por nome ou CPF...')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-xs focus:ring-2 focus:ring-abz-blue"
                  />
                </div>
              </div>

              {/* Scrollport real da tabela: flex-1 min-h-0 + min-w nas colunas */}
              <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain rounded-xl border border-gray-200 min-h-[320px]">
                <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-gray-100 font-semibold text-gray-700">
                    <tr>
                      <th className="bg-gray-100 px-3 py-2">{t('gtFechV2.table.matricula', 'Matrícula')}</th>
                      <th className="bg-gray-100 px-3 py-2">{t('gtFechV2.table.tripulante', 'Tripulante')}</th>
                      <th className="bg-gray-100 px-3 py-2">CPF</th>
                      <th className="bg-gray-100 px-3 py-2">{t('gtFechV2.table.cargo', 'Cargo')}</th>
                      <th className="bg-gray-100 px-3 py-2">{t('gtFechV2.table.centroCusto', 'Centro de Custo')}</th>
                      <th className="bg-gray-100 px-3 py-2">{t('gtFechV2.table.embarcacao', 'Embarcação')}</th>
                      <th className="bg-gray-100 px-3 py-2 text-center">{t('gtFechV2.table.escala', 'Escala')}</th>
                      <th className="bg-emerald-100/50 px-3 py-2 text-center">ON</th>
                      <th className="bg-amber-100/50 px-3 py-2 text-center">DBA</th>
                      <th className="bg-blue-100/50 px-3 py-2 text-center">FI</th>
                      <th className="bg-sky-100/50 px-3 py-2 text-center">{t('gtFechV2.kpi.diasFolga', 'Folga')}</th>
                      <th className="bg-yellow-100/50 px-3 py-2 text-center">STB</th>
                      <th className="bg-purple-100/50 px-3 py-2 text-center">TRE</th>
                      <th className="bg-violet-100/50 px-3 py-2 text-center">FER</th>
                      <th className="bg-gray-100 px-3 py-2 text-center">{t('gtFechV2.table.check', 'Check')}</th>
                      <th className="bg-gray-100 px-3 py-2 text-center">{t('gtFechV2.table.embarques', 'Embarques')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {isLoading && colabs.length === 0 ? (
                      <tr>
                        <td colSpan={16} className="px-4 py-8 text-center text-gray-500">
                          <FiRefreshCw className="mr-1 inline h-4 w-4 animate-spin text-abz-blue" />
                          {t('gtFechV2.msg.calculando', 'Calculando comparativo NxN (dt início / dt fim)...')}
                        </td>
                      </tr>
                    ) : filteredColabs.length === 0 ? (
                      <tr>
                        <td colSpan={16} className="px-4 py-6 text-center text-gray-500">
                          {t('gtFechV2.msg.semRegistros', 'Nenhum registro encontrado para este filtro.')}
                        </td>
                      </tr>
                    ) : (
                      filteredColabs.map((c, idx: number) => {
                        const escalaOk = c.checagens?.escala_ok !== false;
                        const somaOk = c.checagens?.soma_ok !== false;
                        const checkOk = escalaOk && somaOk;
                        const colabId = resolverColaboradorIdLinha(c);
                        const expandido = colabId !== null && linhaExpandida === colabId;
                        return (
                          <React.Fragment key={`${c.cpf || 'sem-cpf'}-${colabId || idx}`}>
                            <tr className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-mono font-bold text-gray-800">{c.matricula || '-'}</td>
                              <td className="px-3 py-2 font-medium text-gray-900">{c.nome}</td>
                              <td className="px-3 py-2 font-mono text-gray-500">{c.cpf_formatado || c.cpf}</td>
                              <td className="px-3 py-2 text-gray-600">{c.cargo}</td>
                              <td className="px-3 py-2 text-[11px] font-semibold text-gray-600">{c.centro_custo || 'N/A'}</td>
                              <td className="px-3 py-2 text-gray-600">{c.embarcacao}</td>
                              <td className="px-3 py-2 text-center font-mono font-semibold text-gray-700">{c.regime_escala || '—'}</td>
                              <td className="bg-emerald-50/30 px-3 py-2 text-center font-bold text-emerald-700">
                                {Number(c.total_dias_on ?? c.total_on ?? 0)}
                              </td>
                              <td className="bg-amber-50/30 px-3 py-2 text-center font-bold text-amber-700">
                                {Number(c.total_dias_dba ?? c.total_dba ?? 0)}
                              </td>
                              <td className="bg-blue-50/30 px-3 py-2 text-center font-bold text-blue-700">
                                {Number(c.total_dias_fi ?? c.total_fi ?? 0)}
                              </td>
                              <td className="bg-sky-50/30 px-3 py-2 text-center font-bold text-sky-700">
                                {c.total_dias_folga ?? 0}
                              </td>
                              <td className="bg-yellow-50/30 px-3 py-2 text-center font-bold text-yellow-800">
                                {c.total_dias_stb ?? 0}
                              </td>
                              <td className="bg-purple-50/30 px-3 py-2 text-center font-bold text-purple-700">
                                {Number(c.total_dias_tre ?? c.total_tre ?? 0)}
                              </td>
                              <td className="bg-violet-50/30 px-3 py-2 text-center font-bold text-violet-700">
                                {Number(c.total_dias_fer ?? c.total_fer ?? 0)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${checkOk ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}
                                  title={(c.checagens?.alertas || []).join(' | ') || undefined}
                                >
                                  {checkOk ? 'OK' : t('gtFechV2.table.alerta', 'Alerta')}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                {colabId ? (
                                  <button
                                    type="button"
                                    onClick={() => setLinhaExpandida(expandido ? null : colabId)}
                                    className={`inline-flex min-h-[28px] items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
                                      expandido
                                        ? 'border-abz-blue/50 bg-blue-50 text-abz-blue'
                                        : 'border-gray-300 bg-white text-gray-600 hover:border-abz-blue/40 hover:text-abz-blue'
                                    }`}
                                    title={t('gtFechV2.editorEmb.titulo', 'Embarques do período')}
                                  >
                                    {expandido ? <FiChevronUp className="h-3.5 w-3.5" /> : <FiChevronDown className="h-3.5 w-3.5" />}
                                    {t('gtFechV2.table.editar', 'Editar')}
                                  </button>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            </tr>
                            {expandido && colabId && (
                              <tr>
                                <td colSpan={16} className="border-t border-gray-100 bg-gray-50/80 p-3">
                                  <FechamentoEmbarquesEditor
                                    colaboradorId={colabId}
                                    nome={c.nome}
                                    dataInicio={periodoResolvido?.dataInicio ?? null}
                                    dataFim={periodoResolvido?.dataFim ?? null}
                                    podeEditar={podeRevisar}
                                    onSaved={() => loadPreview(mesAno, { keepResult: true })}
                                  />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {aba === 'periodo' && (
            <div className="space-y-4">
              <PeriodoFechamentoEditor
                mesReferencia={mesAno}
                podeEditar={podePeriodo}
                onPeriodoChange={setPeriodoEditor}
                refreshTick={probeTick}
              />
              <MarcadosFechamentoPanel
                mesReferencia={mesAno}
                colaboradores={colabs}
                podeEditar={podeMarcas}
                refreshTick={probeTick}
              />
            </div>
          )}

          {aba === 'fila' && podeRevisao && (
            <div className="h-full min-h-0 space-y-3">
              <FilaRevisaoEscala
                podeRevisar={podeRevisao}
                refreshTick={probeTick}
                onEdicoesChanged={() => loadPreview(mesAno, { keepResult: true })}
              />
            </div>
          )}
        </div>

        {/* Rodapé de ações (shrink-0 / sticky footer) */}
        <div className="flex shrink-0 flex-col gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            {t('gtFechV2.acoes.fechar', 'Fechar')}
          </button>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={handleDownloadXlsx}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              <FiFileText className="w-4 h-4" />
              {t('gtFechV2.acoes.baixarXlsx', 'Baixar .xlsx')}
            </button>

            <div className="flex flex-col items-end gap-2">
              {previewData && motivoNaoAssinar && (
                <p className="max-w-sm text-right text-xs text-amber-800">{motivoNaoAssinar}</p>
              )}
              <button
                onClick={handleApprove}
                disabled={isApproving || isLoading || !podeAssinarAgora}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-abz-blue px-5 py-2 text-sm font-bold text-white shadow-md transition hover:bg-blue-800 disabled:opacity-50"
              >
                {isApproving ? (
                  <FiRefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FiSend className="w-4 h-4" />
                )}
                {isFullyApproved
                  ? t('gtFechV2.acoes.reassinar', 'Reassinar / Reenviar')
                  : t('gtFechV2.acoes.assinar', 'Assinar & Salvar Aprovação')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
