'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX, FiUser, FiBookOpen, FiHeart, FiFileText, FiAnchor, FiRepeat, FiUpload, FiBell, FiRefreshCw, FiLayers, FiShield, FiUserX
} from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { QHSE_MODULE_KEY } from '@/lib/document-catalog/permissions';
import { fetchWithToken } from '@/lib/tokenStorage';
import { toast } from 'react-hot-toast';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import { useEscapeCapture } from '@/hooks/useEscapeCapture';
import { useRestoreFocus } from '@/hooks/useRestoreFocus';
import { enviarOcrDocumento } from '@/components/gestao-tripulantes/ocr-client';
import SugestaoBackModal from './SugestaoBackModal';
import DesligamentoModal, { DesligamentoHistorico } from './DesligamentoModal';
import type { GTDesligamento } from '@/types/gestao-tripulantes';
import DadosPessoaisTab from './tabs/DadosPessoaisTab';
import TreinamentosTab from './tabs/TreinamentosTab';
import ASOTab from './tabs/ASOTab';
import PassaportesTab from './tabs/PassaportesTab';
import DocumentosTab from './tabs/DocumentosTab';
import QhseTab from './tabs/QhseTab';
import HistoricoEmbarquesTab from './tabs/HistoricoEmbarquesTab';
import SubstituicoesTab from './tabs/SubstituicoesTab';
import FichaUnificadaTab from './tabs/FichaUnificadaTab';
import type { DocumentoAlertaUI } from './DocsAlertasPanel';
import {
  COLLABORATOR_MODAL_BODY_CLASS,
  COLLABORATOR_MODAL_HEADER_CLASS,
  COLLABORATOR_MODAL_OVERLAY_CLASS,
  COLLABORATOR_MODAL_PANEL_CLASS,
  COLLABORATOR_MODAL_TABLIST_CLASS,
  COLLABORATOR_MODAL_TABLIST_SHELL_CLASS,
  COLLABORATOR_MODAL_TAB_BUTTON_CLASS,
} from './collaborator-modal-layout';

interface Document {
  id: string;
  tipo_documento: string;
  titulo: string;
  numero_documento: string;
  orgao_emissor: string;
  data_emissao: string;
  data_validade: string;
  status_validacao: string;
  ocr_status: string;
  arquivo_url: string;
  aso_data?: any;
}

interface Embarkation {
  id: string;
  embarcacao_nome: string;
  tipo: string;
  data_embarque: string;
  data_desembarque: string;
  data_prevista_desembarque: string;
  local_embarque: string;
  local_desembarque: string;
  voo_ida: string;
  voo_volta: string;
  observacoes: string;
  substituindo_id: string;
}

interface Substitution {
  id: string;
  substituto_nome: string;
  substituido_nome: string;
  periodo_inicio: string;
  periodo_fim: string;
  cargo_nome: string;
  embarcacao_nome: string;
}

// `type` (não `interface`): type aliases de objeto recebem index signature
// implícita e permanecem atribuíveis ao shape tolerante de DadosPessoaisTab
// (que usa `[key: string]: unknown`).
type CollaboratorDetail = {
  id: string;
  nome_completo: string;
  cpf: string;
  rg: string;
  data_nascimento: string;
  email: string;
  telefone: string;
  nacionalidade: string;
  naturalidade: string;
  nome_mae: string;
  nome_pai: string;
  estado_civil: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_uf: string;
  endereco_cep: string;
  matricula: string;
  matricula_esocial?: string | null;
  cargo_id?: string | null;
  cargo_nome: string;
  empresa_id?: string | null;
  empresa_nome: string;
  embarcacao_atual_id?: string | null;
  embarcacao_nome: string;
  centro_custo_id?: string | null;
  centro_custo_nome: string;
  status_embarque: string;
  standby: boolean;
  regime_trabalho?: string | null;
  escala_embarque?: number | string | null;
  escala_folga?: number | string | null;
  data_admissao: string;
  data_demissao?: string | null;
  motivo_demissao?: string | null;
  ativo?: boolean | null;
  data_ultimo_embarque?: string | null;
  data_ultimo_desembarque?: string | null;
  data_proximo_embarque: string;
  foto_url: string;
  qtd_docs_vencidos: number;
  qtd_docs_vencendo: number;
  documentos: Document[];
  documentos_alertas?: DocumentoAlertaUI[];
  embarques: Embarkation[];
  substituicoes: Substitution[];
};

export type TabKey = 'dados' | 'ficha' | 'treinamentos' | 'aso' | 'passaportes' | 'documentos' | 'qhse' | 'embarques' | 'substituicoes' | 'desligamento';

interface CollaboratorModalProps {
  colaboradorId: string;
  onClose: () => void;
  initialTab?: TabKey;
  highlightDocId?: string | null;
  onUpdated?: () => void;
}

/**
 * Modal tab contract:
 * dados — cadastro RH/identidade (sem docs ASO/EPI)
 * ficha — Employee Hub (identidade + vigentes + cards; sem edição)
 * treinamentos — certificados/cursos (sem ASO/EPI)
 * aso — exames ocupacionais, upload, S-2220, agendamento DP (único lugar de laudo/ASO)
 * passaportes — documentos de viagem; não ocultar por cargo
 * documentos — só gt_documentos locais agrupados (sem dump QHSE/outros módulos)
 * qhse — ficha AN-HSE-005, entregas EPI, listas QHSE (`onlyQhse`); nunca ASO/laudo
 * embarques / substituicoes — operação
 * desligamento — processo de rescisão (histórico ou ação DP)
 */
const TABS: { key: TabKey; label: string; labelKey?: string; icon: React.ElementType }[] = [
  { key: 'dados', labelKey: 'gestaoTripulantes.profile.personalData', label: 'Dados Pessoais', icon: FiUser },
  { key: 'ficha', label: 'Ficha unificada', icon: FiLayers },
  { key: 'treinamentos', labelKey: 'gestaoTripulantes.profile.trainings', label: 'Treinamentos', icon: FiBookOpen },
  { key: 'aso', labelKey: 'gestaoTripulantes.profile.aso', label: 'ASO', icon: FiHeart },
  { key: 'passaportes', labelKey: 'gestaoTripulantes.profile.passports', label: 'Passaportes', icon: FiFileText },
  { key: 'documentos', labelKey: 'gestaoTripulantes.profile.documents', label: 'Documentos', icon: FiFileText },
  { key: 'qhse', labelKey: 'gestaoTripulantes.profile.qhse', label: 'QHSE / EPI', icon: FiShield },
  { key: 'embarques', labelKey: 'gestaoTripulantes.profile.embarkations', label: 'Embarques', icon: FiAnchor },
  { key: 'substituicoes', labelKey: 'gestaoTripulantes.profile.substitutions', label: 'Substituições', icon: FiRepeat },
  { key: 'desligamento', label: 'Desligamento', icon: FiUserX },
];

function SkeletonBlock() {
  return (
    <div className="animate-pulse space-y-3 p-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-200 rounded w-full" />
      ))}
    </div>
  );
}

class TabErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: unknown) {
    console.error('CollaboratorModal tab crash', err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <p className="text-sm text-red-600 p-6">
          Erro ao renderizar esta aba. Feche e abra o perfil novamente, ou troque de aba.
        </p>
      );
    }
    return this.props.children;
  }
}

const STATUS_BG: Record<string, string> = {
  embarcado: 'from-green-600 to-emerald-700',
  standby: 'from-orange-500 to-amber-600',
  folga: 'from-blue-600 to-indigo-700',
  desembarcado: 'from-gray-600 to-slate-700',
  afastado: 'from-red-600 to-rose-700',
  ferias: 'from-purple-600 to-violet-700',
  treinamento: 'from-yellow-500 to-orange-600',
};

/** Shared across React Strict Mode remounts so two effects 1ms apart hit the server once. */
const colaboradorDetailInflight = new Map<string, Promise<CollaboratorDetail>>();

function fetchColaboradorDetail(colaboradorId: string, opts?: { force?: boolean }): Promise<CollaboratorDetail> {
  if (opts?.force) colaboradorDetailInflight.delete(colaboradorId);
  const existing = colaboradorDetailInflight.get(colaboradorId);
  if (existing) return existing;
  const pending = (async () => {
    const res = await fetchWithToken(`/api/gestao-tripulantes/colaboradores/${colaboradorId}?include=all`);
    if (!res.ok) throw new Error('Erro ao carregar dados');
    const json = await res.json();
    const payload = json?.data;
    if (!payload || typeof payload !== 'object' || !payload.id) {
      throw new Error('Resposta sem dados do colaborador');
    }
    return payload as CollaboratorDetail;
  })();
  colaboradorDetailInflight.set(colaboradorId, pending);
  void pending.finally(() => {
    if (colaboradorDetailInflight.get(colaboradorId) === pending) {
      colaboradorDetailInflight.delete(colaboradorId);
    }
  });
  return pending;
}

export default function CollaboratorModal({ colaboradorId, onClose, initialTab, highlightDocId, onUpdated }: CollaboratorModalProps) {
  const { t } = useI18n();
  const { hasAccess } = useSupabaseAuth();
  const canSeeQhseTab = hasAccess(QHSE_MODULE_KEY);
  const visibleTabs = useMemo(
    () => TABS.filter((tab) => tab.key !== 'qhse' || canSeeQhseTab),
    [canSeeQhseTab]
  );
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab || 'dados');
  const [focusDocId, setFocusDocId] = useState<string | null>(highlightDocId || null);
  const [data, setData] = useState<CollaboratorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBackModal, setShowBackModal] = useState(false);
  const [showDesligamentoModal, setShowDesligamentoModal] = useState(false);
  const overlayOpen = !showBackModal && !showDesligamentoModal;
  useEscapeToClose(overlayOpen, onClose);
  useEscapeCapture(overlayOpen, onClose);
  useRestoreFocus(overlayOpen);
  const [desligamento, setDesligamento] = useState<GTDesligamento | null>(null);
  const [podeDesligar, setPodeDesligar] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [tabOverflow, setTabOverflow] = useState({ left: false, right: false });
  const tablistRef = useRef<HTMLDivElement>(null);
  const tablistShellRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const payload = await fetchColaboradorDetail(colaboradorId, { force: Boolean(opts?.silent) });
      setData(payload);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error(err);
      toast.error(t('gestaoTripulantes.errors.loadError'));
    } finally {
      setLoading(false);
    }
  }, [colaboradorId, t]);

  const silentRefresh = useCallback(() => fetchData({ silent: true }), [fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    let cancelled = false;
    void fetchWithToken(`/api/gestao-tripulantes/colaboradores/${colaboradorId}/desligamento`)
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          data?: GTDesligamento | null;
          pode_registrar?: boolean;
        };
        if (cancelled || !res.ok) return;
        setDesligamento(json.data || null);
        setPodeDesligar(Boolean(json.pode_registrar));
      })
      .catch(() => {
        if (!cancelled) setPodeDesligar(false);
      });
    return () => {
      cancelled = true;
    };
  }, [colaboradorId]);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
    if (highlightDocId) setFocusDocId(highlightDocId);
  }, [initialTab, highlightDocId]);

  useEffect(() => {
    if (!focusDocId || loading) return;
    const el = document.getElementById(`gt-doc-${focusDocId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusDocId, activeTab, loading, data]);

  useEffect(() => {
    if (activeTab === 'qhse' && !canSeeQhseTab) setActiveTab('documentos');
  }, [activeTab, canSeeQhseTab]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const updateTabOverflow = useCallback(() => {
    const shell = tablistShellRef.current;
    const inner = tablistRef.current;
    const el =
      shell && shell.scrollWidth > shell.clientWidth + 2 ? shell : inner;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setTabOverflow({
      left: scrollLeft > 2,
      right: scrollLeft + clientWidth < scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const targets = [tablistShellRef.current, tablistRef.current].filter(
      (el): el is HTMLDivElement => Boolean(el),
    );
    if (targets.length === 0) return;
    updateTabOverflow();
    const ro = new ResizeObserver(updateTabOverflow);
    for (const el of targets) {
      el.addEventListener('scroll', updateTabOverflow, { passive: true });
      ro.observe(el);
    }
    return () => {
      for (const el of targets) {
        el.removeEventListener('scroll', updateTabOverflow);
      }
      ro.disconnect();
    };
  }, [updateTabOverflow, visibleTabs, activeTab]);

  useEffect(() => {
    const selected = tablistRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    selected?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeTab]);

  const onTabListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') {
      return;
    }
    const keys = visibleTabs.map((tab) => tab.key);
    const current = keys.indexOf(activeTab);
    if (current < 0) return;
    e.preventDefault();
    let next = current;
    if (e.key === 'ArrowRight') next = (current + 1) % keys.length;
    else if (e.key === 'ArrowLeft') next = (current - 1 + keys.length) % keys.length;
    else if (e.key === 'Home') next = 0;
    else next = keys.length - 1;
    setActiveTab(keys[next]);
    requestAnimationFrame(() => {
      tablistRef.current?.querySelector<HTMLElement>(`[data-tab-key="${keys[next]}"]`)?.focus();
    });
  };

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !data) return;
    try {
      setUploadingDoc(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('colaborador_id', data.id);
      fd.append('tipo_documento', 'outro');
      fd.append('titulo', file.name.replace(/\.[^.]+$/, ''));

      const res = await fetchWithToken('/api/gestao-tripulantes/documentos/upload', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Upload falhou');
      toast.success(t('gestaoTripulantes.upload.success'));
      await silentRefresh();
      const docId = json.data?.id as string | undefined;
      if (docId) {
        void enviarOcrDocumento(docId, json.data?.arquivo_url).then(() => silentRefresh());
      }
    } catch {
      toast.error(t('gestaoTripulantes.upload.error'));
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  const renderTabContent = () => {
    if (loading && !data) return <SkeletonBlock />;
    if (!data) return <p className="text-gray-400 text-sm p-6">{t('gestaoTripulantes.errors.loadError')}</p>;

    switch (activeTab) {
      case 'dados':
        return (
          <>
            {(data.documentos_alertas || []).length > 0 && (
              <div className="mx-6 mt-4 rounded-xl border border-red-100 bg-red-50/70 p-3 space-y-2">
                <p className="text-xs font-bold text-red-800">Documentos com validade vencida ou a vencer</p>
                {data.documentos_alertas!.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(a.aba);
                      setFocusDocId(a.id);
                    }}
                    className="block w-full text-left text-xs text-red-900 hover:underline"
                  >
                    {a.titulo} · {a.tipo_documento} · {a.data_validade} · {a.papel} · abrir {a.aba}
                    {a.status_stale ? ' (status no banco desatualizado)' : ''}
                  </button>
                ))}
              </div>
            )}
            <DadosPessoaisTab
              data={data}
              onUpdate={(updated) => setData(prev => prev ? { ...prev, ...updated } : prev)}
              onRefresh={silentRefresh}
            />
          </>
        );
      case 'ficha':
        return (
          <FichaUnificadaTab
            colaboradorId={data.id}
            onOpenTab={(tab, docId) => {
              setActiveTab(tab as TabKey);
              if (docId) setFocusDocId(docId);
            }}
          />
        );
      case 'treinamentos':
        return <TreinamentosTab colaboradorId={data.id} colaborador={data} documentos={data.documentos || []} onRefresh={silentRefresh} highlightDocId={focusDocId} />;
      case 'aso':
        return (
          <ASOTab
            colaboradorId={data.id}
            colaboradorCpf={data.cpf}
            documentos={data.documentos || []}
            esocialAsos={(data as any).esocial_asos || []}
            onRefresh={silentRefresh}
            highlightDocId={focusDocId}
          />
        );
      case 'passaportes':
        return <PassaportesTab colaboradorId={data.id} documentos={data.documentos || []} onRefresh={silentRefresh} highlightDocId={focusDocId} />;
      case 'documentos':
        return <DocumentosTab colaboradorId={data.id} documentos={data.documentos || []} onRefresh={silentRefresh} highlightDocId={focusDocId} />;
      case 'qhse':
        return <QhseTab colaboradorId={data.id} />;
      case 'embarques':
        return <HistoricoEmbarquesTab embarques={data.embarques || []} colaboradorId={data.id} colaboradorNome={data.nome_completo} onRefresh={silentRefresh} />;
      case 'substituicoes':
        return <SubstituicoesTab colaboradorId={data.id} substituicoes={data.substituicoes || []} />;
      case 'desligamento':
        if (desligamento || data.ativo === false) {
          return desligamento ? (
            <DesligamentoHistorico desligamento={desligamento} />
          ) : (
            <p className="p-6 text-sm text-gray-500">
              Colaborador inativo sem processo de desligamento no portal (legado / MIO).
              {data.data_demissao ? ` Data de demissão: ${data.data_demissao}.` : ''}
            </p>
          );
        }
        if (podeDesligar) {
          return (
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600">
                Registre a rescisão aqui. O colaborador será inativado, a folha tentará gerar as
                rubricas típicas e o e-Social S-2299 será disparado.
              </p>
              <button
                type="button"
                onClick={() => setShowDesligamentoModal(true)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Desligar colaborador
              </button>
            </div>
          );
        }
        return (
          <p className="p-6 text-sm text-gray-500">
            Sem registro de desligamento. Apenas o DP (gestor ou setor DP/RH com o módulo Gestão de Tripulantes) pode iniciar o processo.
          </p>
        );
      default: {
        const _exhaustive: never = activeTab;
        void _exhaustive;
        return null;
      }
    }
  };

  const gradientClass = STATUS_BG[data?.status_embarque || ''] || 'from-blue-600 to-indigo-700';

  return (
    <AnimatePresence>
      <motion.div
        key="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={COLLABORATOR_MODAL_OVERLAY_CLASS}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 15, scale: 0.98 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className={COLLABORATOR_MODAL_PANEL_CLASS}
          data-testid="collaborator-modal-panel"
          data-modal-panel=""
        >
          {/* Header */}
          <div className={`${COLLABORATOR_MODAL_HEADER_CLASS} bg-gradient-to-r ${gradientClass} px-4 py-3 sm:px-6 sm:py-4`}>
            <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-2 border-white/30 flex-shrink-0">
                  {data?.foto_url ? (
                    <img src={data.foto_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-white">
                      {data?.nome_completo?.charAt(0) || '?'}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white truncate">
                    {loading && !data ? 'Carregando...' : data?.nome_completo}
                  </h2>
                  <p className="text-sm text-white/70 truncate">
                    {data?.cargo_nome}
                    {data?.empresa_nome && ` • ${data.empresa_nome}`}
                    {data?.embarcacao_nome && ` • ${data.embarcacao_nome}`}
                  </p>
                  {/* Doc warning badges */}
                  <div className="flex gap-2 mt-1">
                    {(data?.qtd_docs_vencidos || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('ficha')}
                        className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-medium hover:bg-red-600"
                      >
                        {data!.qtd_docs_vencidos} doc(s) vencido(s) — ver ficha
                      </button>
                    )}
                    {(data?.qtd_docs_vencendo || 0) > 0 && (
                      <span className="px-2 py-0.5 bg-orange-400 text-white text-xs rounded-full font-medium">
                        {data!.qtd_docs_vencendo} vencendo
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                <button
                  onClick={() => { void fetchData(); }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Atualizar"
                >
                  <FiRefreshCw className="w-4 h-4 text-white" />
                </button>

                <label className={`flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs rounded-lg transition-colors cursor-pointer ${uploadingDoc ? 'opacity-50 pointer-events-none' : ''}`}>
                  <FiUpload className="w-3.5 h-3.5" />
                  {uploadingDoc ? 'Enviando...' : t('gestaoTripulantes.profile.uploadDocument')}
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleQuickUpload} />
                </label>

                <button
                  onClick={() => setShowBackModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs rounded-lg transition-colors"
                >
                  <FiRepeat className="w-3.5 h-3.5" />
                  {t('gestaoTripulantes.profile.suggestBack')}
                </button>

                {desligamento || data?.ativo === false ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab('desligamento')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/90 hover:bg-red-600 text-white text-xs rounded-lg transition-colors"
                  >
                    <FiUserX className="w-3.5 h-3.5" />
                    Desligado
                  </button>
                ) : podeDesligar ? (
                  <button
                    type="button"
                    onClick={() => setShowDesligamentoModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/90 hover:bg-red-600 text-white text-xs rounded-lg transition-colors"
                    data-testid="desligar-colaborador"
                  >
                    <FiUserX className="w-3.5 h-3.5" />
                    Desligar
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={onClose}
                  data-modal-close=""
                  aria-label="Fechar"
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors ml-1"
                >
                  <FiX className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div
            ref={tablistShellRef}
            className={COLLABORATOR_MODAL_TABLIST_SHELL_CLASS}
            data-overflow-left={tabOverflow.left ? 'true' : 'false'}
            data-overflow-right={tabOverflow.right ? 'true' : 'false'}
          >
            <div
              ref={tablistRef}
              role="tablist"
              aria-label="Abas do colaborador"
              data-testid="collaborator-modal-tablist"
              onKeyDown={onTabListKeyDown}
              className={COLLABORATOR_MODAL_TABLIST_CLASS}
            >
              {visibleTabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    data-tab-key={tab.key}
                    id={`collaborator-modal-tab-${tab.key}`}
                    aria-selected={isActive}
                    aria-controls={`collaborator-modal-panel-${tab.key}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveTab(tab.key)}
                    className={`${COLLABORATOR_MODAL_TAB_BUTTON_CLASS} ${
                      isActive
                        ? 'text-blue-600 border-blue-600 bg-white'
                        : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100/50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {tab.labelKey ? t(tab.labelKey) : tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div
            className={COLLABORATOR_MODAL_BODY_CLASS}
            role="tabpanel"
            id={`collaborator-modal-panel-${activeTab}`}
            aria-labelledby={`collaborator-modal-tab-${activeTab}`}
            data-testid="collaborator-modal-body"
          >
            <TabErrorBoundary key={activeTab}>
              {renderTabContent()}
            </TabErrorBoundary>
          </div>
        </motion.div>
      </motion.div>

      {/* Back modal */}
      {showBackModal && data && (
        <SugestaoBackModal
          colaboradorId={data.id}
          colaboradorNome={data.nome_completo}
          onClose={() => setShowBackModal(false)}
          onSelect={(candidateId) => {
            console.log('Substituto selecionado:', candidateId);
            fetchData();
          }}
        />
      )}

      {showDesligamentoModal && data && !desligamento && (
        <DesligamentoModal
          colaboradorId={data.id}
          colaboradorNome={data.nome_completo}
          dataAdmissao={data.data_admissao}
          onClose={() => setShowDesligamentoModal(false)}
          onConcluido={(result) => {
            setDesligamento(result.desligamento);
            setPodeDesligar(false);
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    ativo: false,
                    data_demissao: result.data_desligamento,
                    motivo_demissao: result.mtv_deslig || prev.motivo_demissao,
                  }
                : prev,
            );
            onUpdated?.();
            void silentRefresh();
            setActiveTab('desligamento');
          }}
        />
      )}
    </AnimatePresence>
  );
}
