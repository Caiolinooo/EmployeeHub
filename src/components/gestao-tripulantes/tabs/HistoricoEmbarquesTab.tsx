'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiAnchor,
  FiArrowRight,
  FiCalendar,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiEdit2,
  FiMapPin,
  FiMessageSquare,
  FiRotateCcw,
  FiTrash2,
  FiXCircle,
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { fetchWithToken, getToken } from '@/lib/tokenStorage';
import EscalaEventoForm, {
  EscalaEventoFooter,
  isValidEscalaEventoForm,
  type EscalaEventoFormValues,
} from '@/components/gestao-tripulantes/EscalaEventoForm';
import ConfirmarExclusaoMarcacaoModal from '@/components/gestao-tripulantes/ConfirmarExclusaoMarcacaoModal';
import { reverterEdicoesEmCadeia, type ReverterEdicoesOpcoes } from '@/components/gestao-tripulantes/reverter-edicoes';
import { toastComAcaoDesfazer } from '@/components/gestao-tripulantes/toast-desfazer';
import {
  COLLABORATOR_MODAL_TAB_FILL_CLASS,
  COLLABORATOR_MODAL_TABLE_SCROLL_CLASS,
} from '@/components/gestao-tripulantes/collaborator-modal-layout';
import { isFechamentoRole } from '@/lib/gestao-tripulantes/fechamento-assinatura';
import { mapDbTipoToCodigo } from '@/lib/gestao-tripulantes/escala-tipos';
import { parseCivilDate } from '@/lib/gestao-tripulantes/escala-contagem';

interface Embarkation {
  id: string;
  colaborador_id?: string;
  embarcacao_nome?: string;
  // API returns embarcacao as nested object from JOIN
  embarcacao?: { nome?: string } | null;
  tipo: string;
  data_embarque: string;
  data_desembarque: string;
  data_prevista_desembarque: string;
  local_embarque: string;
  local_desembarque?: string;
  exibir_dia_inicio?: boolean;
  voo_ida: string;
  voo_volta: string;
  observacoes: string;
  substituindo_id: string;
}

interface Props {
  embarques: Embarkation[];
  /** Id do colaborador (para GET /escala-edicoes?colaboradorId=). Fallback: embarques[0].colaborador_id. */
  colaboradorId?: string;
  /** Nome para o modal de confirmação de exclusão (opcional). */
  colaboradorNome?: string;
  /** Atualiza a ficha (CollaboratorModal.silentRefresh) após salvar/excluir. */
  onRefresh?: () => void;
}

/** Linha de gt_escala_edicoes (R7 — contrato compartilhado da API). */
interface EscalaEdicaoItem {
  id: string;
  embarque_id?: string | null;
  operacao: 'create' | 'update' | 'delete' | 'restore' | 'rejeicao' | 'reversao';
  status: 'aplicada' | 'revertida' | 'rejeitada';
  dados_anteriores?: Record<string, unknown> | null;
  dados_novos?: Record<string, unknown> | null;
  motivo?: string | null;
  ator_nome?: string | null;
  created_at?: string | null;
}

const TIPO_CONFIG: Record<string, { color: string; label: string }> = {
  normal: { color: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Normal' },
  dobra: { color: 'bg-orange-100 text-orange-700 border-orange-300', label: 'Dobra' },
  dba: { color: 'bg-orange-100 text-orange-700 border-orange-300', label: 'Dobra' },
  folga_indenizada: { color: 'bg-green-100 text-green-700 border-green-300', label: 'Folga Indenizada' },
  fi: { color: 'bg-green-100 text-green-700 border-green-300', label: 'Folga Indenizada' },
  standby: { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', label: 'StandBy' },
  stb: { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', label: 'StandBy' },
  offc: { color: 'bg-red-100 text-red-700 border-red-300', label: 'Troca de Turma (OFF-C)' },
  substituicao: { color: 'bg-purple-100 text-purple-700 border-purple-300', label: 'Substituição' },
  treinamento: { color: 'bg-gray-100 text-gray-700 border-gray-300', label: 'Treinamento' },
};

const DOT_COLORS: Record<string, string> = {
  normal: 'bg-blue-500',
  dobra: 'bg-orange-500',
  dba: 'bg-orange-500',
  folga_indenizada: 'bg-green-500',
  fi: 'bg-green-500',
  standby: 'bg-yellow-500',
  stb: 'bg-yellow-500',
  offc: 'bg-red-500',
  substituicao: 'bg-purple-500',
  treinamento: 'bg-gray-500',
};

/** Férias/afastamento vivem em gt_afastamentos — PUT/DELETE /embarques/<id> daria 404. */
function isEmbarqueEditavel(tipo: string | null | undefined): boolean {
  const codigo = mapDbTipoToCodigo(tipo);
  return codigo !== 'ferias' && codigo !== 'afastamento';
}

function durationDays(start: string, end: string | null): string {
  if (!start || !end) return '';
  const d = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  return `${d} dias`;
}

/** Campos exibidos no diff compacto (antes → depois) do histórico de alterações. */
const CAMPOS_DIFF: Array<{ key: string; labelKey: string; defaultLabel: string }> = [
  { key: 'tipo', labelKey: 'campoTipo', defaultLabel: 'Tipo' },
  { key: 'data_embarque', labelKey: 'campoDataEmbarque', defaultLabel: 'Data de embarque' },
  { key: 'data_desembarque', labelKey: 'campoDataDesembarque', defaultLabel: 'Data de desembarque' },
  { key: 'local_embarque', labelKey: 'campoLocalEmbarque', defaultLabel: 'Local de embarque' },
  { key: 'local_desembarque', labelKey: 'campoLocalDesembarque', defaultLabel: 'Embarcação/Destino' },
  { key: 'observacoes', labelKey: 'campoObservacoes', defaultLabel: 'Observações' },
];

/** Operações da trilha que aceitam Reverter/Rejeitar (rejeicao/reversao não). */
const OPERACOES_REVERSIVEIS: ReadonlyArray<EscalaEdicaoItem['operacao']> = [
  'create',
  'update',
  'delete',
  'restore',
];

function formatDiffValue(key: string, raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '—';
  if (key === 'tipo') {
    const codigo = mapDbTipoToCodigo(String(raw));
    return TIPO_CONFIG[codigo]?.label || TIPO_CONFIG[String(raw)]?.label || String(raw).toUpperCase();
  }
  if (key === 'data_embarque' || key === 'data_desembarque') {
    const civil = parseCivilDate(String(raw).slice(0, 10));
    if (civil) {
      const dd = String(civil.getDate()).padStart(2, '0');
      const mm = String(civil.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${civil.getFullYear()}`;
    }
    return String(raw);
  }
  if (key === 'exibir_dia_inicio') return raw === true || raw === 'true' ? 'Sim' : 'Não';
  return String(raw);
}

export default function HistoricoEmbarquesTab({ embarques, colaboradorId, colaboradorNome, onRefresh }: Props) {
  const { t } = useI18n();
  const { profile } = useSupabaseAuth();
  // Mesmo critério da FilaRevisaoEscala (client pre-gate; o servidor reforça).
  const podeRevisar = isFechamentoRole(profile?.role);

  const colabId = colaboradorId || embarques.find((e) => e.colaborador_id)?.colaborador_id || '';

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EscalaEventoFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [edicoes, setEdicoes] = useState<EscalaEdicaoItem[] | null>(null);
  const [edicoesLoading, setEdicoesLoading] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState<Set<string>>(() => new Set());
  // Reverter/Rejeitar na trilha (mini-form de motivo obrigatório).
  const [acaoEdicao, setAcaoEdicao] = useState<{ id: string; modo: 'reverter' | 'rejeitar' } | null>(null);
  const [motivoAcao, setMotivoAcao] = useState('');
  const [processandoAcao, setProcessandoAcao] = useState(false);
  // Exclusão com confirmação (modal compartilhado com a grade; evento completo).
  const [exclusaoModal, setExclusaoModal] = useState<{ emb: Embarkation } | null>(null);

  // Datas 'YYYY-MM-DD' parseadas como UTC exibem a véspera no fuso BRT; parse civil local.
  const formatDate = useCallback((d: string | null | undefined) => {
    if (!d) return '—';
    const civil = parseCivilDate(d);
    if (!civil) return d;
    const dd = String(civil.getDate()).padStart(2, '0');
    const mm = String(civil.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${civil.getFullYear()}`;
  }, []);

  const formatQuando = useCallback((iso: string | null | undefined) => {
    if (!iso) return '—';
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return String(iso);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const aa = dt.getFullYear();
    const hh = String(dt.getHours()).padStart(2, '0');
    const mi = String(dt.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${aa} ${hh}:${mi}`;
  }, []);

  // ─── Histórico de alterações (gt_escala_edicoes) — paginado, fail-soft ───
  const carregarEdicoes = useCallback(async () => {
    if (!colabId) {
      setEdicoes([]);
      return;
    }
    setEdicoesLoading(true);
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const acumulado: EscalaEdicaoItem[] = [];
      const pageSize = 100;
      for (let page = 1; page <= 5; page++) {
        const res = await fetch(
          `/api/gestao-tripulantes/escala-edicoes?colaboradorId=${encodeURIComponent(colabId)}&page=${page}&pageSize=${pageSize}&_t=${Date.now()}`,
          { headers, cache: 'no-store' }
        );
        if (!res.ok) break;
        const json = await res.json().catch(() => null);
        // Contrato da rota: { rows: [...] } (fallback data p/ robustez).
        const rows = (json?.rows ?? json?.data ?? []) as EscalaEdicaoItem[];
        if (!Array.isArray(rows)) break;
        acumulado.push(...rows);
        if (rows.length < pageSize) break;
      }
      setEdicoes(acumulado);
    } catch {
      setEdicoes((prev) => prev ?? []);
    } finally {
      setEdicoesLoading(false);
    }
  }, [colabId]);

  useEffect(() => {
    void carregarEdicoes();
  }, [carregarEdicoes]);

  // Desfazer (ação do toast): reverte as edições da ação — PUT com o evento
  // salvo NA FRENTE da fila (salvarEventoPrimeiro), DELETE em LIFO puro; para
  // no primeiro erro (mensagem do servidor, 409/403) e recarrega a ficha.
  const executarDesfazer = useCallback(async (edicoesIds: string[], opcoes?: ReverterEdicoesOpcoes) => {
    if (edicoesIds.length === 0) return;
    const resultado = await reverterEdicoesEmCadeia(
      edicoesIds,
      t('gtEscalaV2.desfazerMotivoDefault', 'Desfazer pelo próprio autor'),
      opcoes
    );
    if (resultado.erro !== undefined) {
      toast.error(resultado.erro || t('gtEscalaV2.desfazerErro', 'Não foi possível desfazer.'));
    } else {
      toast.success(t('gtEscalaV2.desfeito', 'Desfeito'));
    }
    onRefresh?.();
    void carregarEdicoes();
  }, [carregarEdicoes, onRefresh, t]);

  const acaoDesfazerToast = (edicoesIds: string[], mensagem: string, opcoes?: ReverterEdicoesOpcoes) => {
    toastComAcaoDesfazer({
      mensagem,
      labelDesfazer: t('gtEscalaV2.desfazer', 'Desfazer'),
      onDesfazer: () => void executarDesfazer(edicoesIds, opcoes),
    });
  };

  const edicoesPorEmbarque = useMemo(() => {
    const map = new Map<string, EscalaEdicaoItem[]>();
    for (const ed of edicoes || []) {
      const keys = new Set<string>();
      if (ed.embarque_id) keys.add(ed.embarque_id);
      const antesId = (ed.dados_anteriores as { id?: unknown } | null)?.id;
      const depoisId = (ed.dados_novos as { id?: unknown } | null)?.id;
      if (typeof antesId === 'string' && antesId) keys.add(antesId);
      if (typeof depoisId === 'string' && depoisId) keys.add(depoisId);
      for (const key of keys) {
        const list = map.get(key) || [];
        list.push(ed);
        map.set(key, list);
      }
    }
    return map;
  }, [edicoes]);

  const toggleHistorico = (id: string) => {
    setHistoricoAberto((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const abrirEdicao = (emb: Embarkation) => {
    if (!isEmbarqueEditavel(emb.tipo)) {
      toast.error(t(
        'gtEscalaV2.bloqueioFerias',
        'Férias e afastamentos são gerenciados pelo módulo de Férias/DP e não podem ser editados aqui.'
      ));
      return;
    }
    setEditingId(emb.id);
    setEditValues({
      tipo: mapDbTipoToCodigo(emb.tipo),
      dataInicio: String(emb.data_embarque || '').slice(0, 10),
      dataFim: String(emb.data_desembarque || emb.data_prevista_desembarque || '').slice(0, 10),
      embarcacao: emb.local_desembarque || emb.embarcacao_nome || emb.embarcacao?.nome || '',
      localEmbarque: emb.local_embarque || '',
      observacoes: emb.observacoes || '',
      exibirDiaInicio: emb.exibir_dia_inicio !== false,
    });
  };

  const salvarEdicao = async (emb: Embarkation) => {
    if (!editValues || !isValidEscalaEventoForm(editValues)) return;
    setSaving(true);
    try {
      const res = await fetchWithToken(`/api/gestao-tripulantes/embarques/${emb.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: editValues.tipo,
          data_embarque: editValues.dataInicio,
          data_desembarque: editValues.dataFim,
          local_embarque: editValues.localEmbarque,
          local_desembarque: editValues.embarcacao,
          observacoes: editValues.observacoes,
          exibir_dia_inicio: editValues.exibirDiaInicio,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar evento.');
      // R7: toda edição aplica na hora e fica auditada — reversível pela fila.
      // PUT: 1º id = evento salvo, resto = efeitos de recorte — desfazer o
      // SALVO primeiro; em LIFO puro o un-delete da original recortada bate na
      // guarda de sobreposição (409) com o salvo ainda vivo.
      const edicoesSalvas = Array.isArray(data?.edicoes) ? (data.edicoes as string[]) : [];
      if (edicoesSalvas.length > 0) {
        acaoDesfazerToast(
          edicoesSalvas,
          t('gtEscalaV2.alteracaoRegistrada', 'Alteração registrada no histórico (reversível)'),
          { salvarEventoPrimeiro: true }
        );
      } else {
        toast.success(t('gtEscalaV2.alteracaoRegistrada', 'Alteração registrada no histórico (reversível)'));
      }
      setEditingId(null);
      setEditValues(null);
      onRefresh?.();
      void carregarEdicoes();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar evento.');
    } finally {
      setSaving(false);
    }
  };

  /** Abre o modal de confirmação (evento completo — sem checkbox na ficha). */
  const pedirExclusao = (emb: Embarkation) => {
    if (!isEmbarqueEditavel(emb.tipo)) {
      toast.error(t(
        'gtEscalaV2.bloqueioFerias',
        'Férias e afastamentos são gerenciados pelo módulo de Férias/DP e não podem ser editados aqui.'
      ));
      return;
    }
    setExclusaoModal({ emb });
  };

  const excluirEmbarque = async () => {
    const alvo = exclusaoModal?.emb;
    if (!alvo) return;
    setDeletingId(alvo.id);
    try {
      const res = await fetchWithToken(`/api/gestao-tripulantes/embarques/${alvo.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'completo' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir evento.');
      const edicoesSalvas = Array.isArray(data?.edicoes) ? (data.edicoes as string[]) : [];
      if (edicoesSalvas.length > 0) {
        acaoDesfazerToast(
          edicoesSalvas,
          t('gtEscalaV2.eventoRemovido', 'Evento removido (reversível via histórico de alterações)')
        );
      } else {
        toast.success(t('gtEscalaV2.eventoRemovido', 'Evento removido (reversível via histórico de alterações)'));
      }
      if (editingId === alvo.id) {
        setEditingId(null);
        setEditValues(null);
      }
      onRefresh?.();
      void carregarEdicoes();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao remover evento.');
    } finally {
      setExclusaoModal(null);
      setDeletingId(null);
    }
  };

  /** Reverter/Rejeitar na trilha — motivo obrigatório, mesma ação da fila de revisão. */
  const executarAcaoEdicao = async () => {
    if (!acaoEdicao) return;
    const m = motivoAcao.trim();
    if (!m) {
      toast.error(t('gtEscalaV2.motivoObrigatorio', 'Motivo é obrigatório.'));
      return;
    }
    setProcessandoAcao(true);
    try {
      const endpoint =
        acaoEdicao.modo === 'rejeitar'
          ? `/api/gestao-tripulantes/escala-edicoes/${acaoEdicao.id}/rejeitar`
          : `/api/gestao-tripulantes/escala-edicoes/${acaoEdicao.id}/reverter`;
      const res = await fetchWithToken(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: m }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t('gtEscalaV2.revisaoErro', 'Erro ao processar a ação.'));
      }
      toast.success(
        acaoEdicao.modo === 'rejeitar'
          ? t('gtEscalaV2.rejeicaoOk', 'Edição rejeitada: estado anterior da escala restaurado.')
          : t('gtEscalaV2.reversaoOk', 'Edição revertida: estado anterior da escala restaurado.')
      );
      setAcaoEdicao(null);
      setMotivoAcao('');
      onRefresh?.();
      void carregarEdicoes();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('gtEscalaV2.revisaoErro', 'Erro ao processar a ação.'));
    } finally {
      setProcessandoAcao(false);
    }
  };

  const statusBadgeClass = (status: string): string => {
    switch (status) {
      case 'aplicada':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'revertida':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rejeitada':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const operacaoLabel = (operacao: string): string => {
    switch (operacao) {
      case 'create':
        return t('gtEscalaV2.opCreate', 'Criação');
      case 'update':
        return t('gtEscalaV2.opUpdate', 'Alteração');
      case 'delete':
        return t('gtEscalaV2.opDelete', 'Exclusão');
      case 'restore':
        return t('gtEscalaV2.opRestore', 'Restauração');
      case 'rejeicao':
        return t('gtEscalaV2.opRejeicao', 'Rejeição');
      case 'reversao':
        return t('gtEscalaV2.opReversao', 'Reversão');
      default:
        return operacao;
    }
  };

  const statusLabel = (status: string): string => {
    switch (status) {
      case 'aplicada':
        return t('gtEscalaV2.statusAplicada', 'Aplicada');
      case 'revertida':
        return t('gtEscalaV2.statusRevertida', 'Revertida');
      case 'rejeitada':
        return t('gtEscalaV2.statusRejeitada', 'Rejeitada');
      default:
        return status;
    }
  };

  if (embarques.length === 0) {
    return (
      <div className="p-12 text-center">
        <FiAnchor className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">{t('gestaoTripulantes.embarkations.noHistory')}</p>
      </div>
    );
  }

  return (
    <div className={`${COLLABORATOR_MODAL_TAB_FILL_CLASS} p-6`}>
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6 shrink-0">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{embarques.length}</p>
          <p className="text-xs text-blue-600 mt-1">Total de Escalas</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-700">
            {embarques.filter(e => mapDbTipoToCodigo(e.tipo) === 'dba').length}
          </p>
          <p className="text-xs text-orange-600 mt-1">Dobras</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">
            {embarques.filter(e => mapDbTipoToCodigo(e.tipo) === 'fi').length}
          </p>
          <p className="text-xs text-green-600 mt-1">Folgas Indenizadas</p>
        </div>
      </div>

      {/* Timeline */}
      <div className={`${COLLABORATOR_MODAL_TABLE_SCROLL_CLASS} relative pl-6`}>
        <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-gray-200" />

        {embarques.map((emb) => {
          const tipoCfg = TIPO_CONFIG[emb.tipo] || TIPO_CONFIG.normal;
          const dotColor = DOT_COLORS[emb.tipo] || 'bg-gray-500';
          const duration = durationDays(emb.data_embarque, emb.data_desembarque);
          const editavel = isEmbarqueEditavel(emb.tipo);
          const emEdicao = editingId === emb.id;
          const edicoesDoEvento = edicoesPorEmbarque.get(emb.id) || [];
          const historicoExpandido = historicoAberto.has(emb.id);

          return (
            <div key={emb.id} className="relative mb-5">
              {/* Dot */}
              <div className={`absolute -left-4 top-3 w-3 h-3 rounded-full ${dotColor} border-2 border-white shadow ring-2 ring-white`} />

              <div className={`bg-white border rounded-xl p-4 hover:shadow-md transition-shadow ml-2 ${emEdicao ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <p className="font-semibold text-gray-800 text-sm">{emb.embarcacao_nome || emb.embarcacao?.nome || '—'}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${tipoCfg.color}`}>
                        {t(`gestaoTripulantes.embarkations.types.${emb.tipo}`, tipoCfg.label)}
                      </span>
                      {duration && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <FiClock className="w-3 h-3" /> {duration}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <FiCalendar className="w-3 h-3 text-green-500" />
                        <span className="font-medium text-gray-700">{formatDate(emb.data_embarque)}</span>
                      </span>
                      <FiArrowRight className="w-3 h-3 text-gray-300" />
                      <span className="flex items-center gap-1">
                        <FiCalendar className="w-3 h-3 text-red-400" />
                        <span className="font-medium text-gray-700">
                          {formatDate(emb.data_desembarque || emb.data_prevista_desembarque)}
                          {!emb.data_desembarque && emb.data_prevista_desembarque && ' (prev.)'}
                        </span>
                      </span>

                      {emb.local_embarque && (
                        <span className="flex items-center gap-1">
                          <FiMapPin className="w-3 h-3" /> {emb.local_embarque}
                        </span>
                      )}
                    </div>

                    {(emb.voo_ida || emb.voo_volta) && (
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        {emb.voo_ida && <span>✈️ Ida: <span className="font-medium">{emb.voo_ida}</span></span>}
                        {emb.voo_volta && <span>↩️ Volta: <span className="font-medium">{emb.voo_volta}</span></span>}
                      </div>
                    )}

                    {emb.observacoes && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2 text-xs text-slate-700 shadow-2xs">
                        <FiMessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Observação</span>
                          <p className="text-xs text-slate-700 italic leading-relaxed">{emb.observacoes}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ações (R7): Editar / Excluir — imediato + auditado (reversível) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {editavel ? (
                      <>
                        <button
                          type="button"
                          onClick={() => (emEdicao ? setEditingId(null) : abrirEdicao(emb))}
                          disabled={saving || deletingId !== null}
                          className="min-h-[44px] lg:min-h-[30px] w-9 lg:w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-blue-700 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-40 transition-colors"
                          title={t('gtEscalaV2.editar', 'Editar')}
                          aria-label={t('gtEscalaV2.editar', 'Editar')}
                        >
                          <FiEdit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => pedirExclusao(emb)}
                          disabled={saving || deletingId !== null}
                          className="min-h-[44px] lg:min-h-[30px] w-9 lg:w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 disabled:opacity-40 transition-colors"
                          title={t('gtEscalaV2.excluirCurto', 'Excluir')}
                          aria-label={t('gtEscalaV2.excluirCurto', 'Excluir')}
                        >
                          {deletingId === emb.id ? (
                            <span className="w-3 h-3 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <FiTrash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </>
                    ) : (
                      <span
                        className="text-[10px] text-slate-400 border border-slate-200 rounded-md px-2 py-1 bg-slate-50 whitespace-nowrap"
                        title={t('gtEscalaV2.bloqueioFerias', 'Férias e afastamentos são gerenciados pelo módulo de Férias/DP.')}
                      >
                        {t('gtEscalaV2.bloqueadoFeriasCurto', 'Férias/DP')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Editor inline (mesmo formulário da grade — EscalaEventoForm) */}
                {emEdicao && editValues && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <EscalaEventoForm
                      value={editValues}
                      onChange={setEditValues}
                      idPrefix={`gt-escala-ficha-${emb.id}`}
                      disabled={saving}
                    />
                    <div className="mt-3 pt-3 border-t border-slate-200 bg-white rounded-b-xl">
                      <EscalaEventoFooter
                        editing
                        submitting={saving}
                        disabled={!isValidEscalaEventoForm(editValues)}
                        onDelete={() => pedirExclusao(emb)}
                        onCancel={() => {
                          setEditingId(null);
                          setEditValues(null);
                        }}
                        onSave={() => void salvarEdicao(emb)}
                      />
                    </div>
                  </div>
                )}

                {/* Histórico de alterações (R7 — fila de revisão/rollback) */}
                {colabId && (
                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => toggleHistorico(emb.id)}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-blue-700 transition-colors min-h-[44px] lg:min-h-0 py-1"
                      aria-expanded={historicoExpandido}
                    >
                      {historicoExpandido ? <FiChevronUp className="w-3.5 h-3.5" /> : <FiChevronDown className="w-3.5 h-3.5" />}
                      {t('gtEscalaV2.historicoAlteracoes', 'Histórico de alterações')}
                      {edicoesDoEvento.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold">
                          {edicoesDoEvento.length}
                        </span>
                      )}
                    </button>

                    {historicoExpandido && (
                      <div className="mt-1.5 space-y-2">
                        {edicoesLoading && edicoes === null && (
                          <p className="text-[11px] text-slate-400">{t('gtEscalaV2.historicoCarregando', 'Carregando histórico...')}</p>
                        )}
                        {!edicoesLoading && edicoesDoEvento.length === 0 && (
                          <p className="text-[11px] text-slate-400 italic">
                            {t('gtEscalaV2.historicoVazio', 'Sem alterações registradas para este evento.')}
                          </p>
                        )}
                        {edicoesDoEvento.map((ed) => {
                          const antes = ed.dados_anteriores || null;
                          const depois = ed.dados_novos || null;
                          const acaoAtual = acaoEdicao && acaoEdicao.id === ed.id ? acaoEdicao : null;
                          const diffs = CAMPOS_DIFF
                            .map(({ key, labelKey, defaultLabel }) => {
                              const valorAntes = antes ? antes[key] : undefined;
                              const valorDepois = depois ? depois[key] : undefined;
                              const antesTxt = formatDiffValue(key, valorAntes);
                              const depoisTxt = formatDiffValue(key, valorDepois);
                              return { label: t(`gtEscalaV2.${labelKey}`, defaultLabel), antesTxt, depoisTxt, mudou: antesTxt !== depoisTxt };
                            })
                            .filter((d) => d.mudou);
                          return (
                            <div key={ed.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 text-[11px]">
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <span className="font-bold text-slate-700">{operacaoLabel(ed.operacao)}</span>
                                <span className={`px-1.5 py-0.5 rounded border font-semibold uppercase text-[9px] ${statusBadgeClass(ed.status)}`}>
                                  {statusLabel(ed.status)}
                                </span>
                                {ed.ator_nome && (
                                  <span className="text-slate-500">
                                    {t('gtEscalaV2.historicoAtor', 'Por')}: <span className="font-semibold text-slate-600">{ed.ator_nome}</span>
                                  </span>
                                )}
                                <span className="text-slate-400 ml-auto font-mono text-[10px]">{formatQuando(ed.created_at)}</span>
                              </div>

                              {diffs.length > 0 && (
                                <div className="space-y-0.5">
                                  {diffs.map((d) => (
                                    <div key={d.label} className="flex items-start gap-1.5 flex-wrap">
                                      <span className="text-slate-400 font-semibold min-w-[110px]">{d.label}:</span>
                                      <span className="text-rose-600 line-through decoration-rose-300">{d.antesTxt}</span>
                                      <FiArrowRight className="w-3 h-3 text-slate-300 mt-0.5" />
                                      <span className="text-emerald-700 font-semibold">{d.depoisTxt}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {ed.motivo && (
                                <p className="mt-1.5 text-slate-500 italic">
                                  {t('gtEscalaV2.motivo', 'Motivo')}: {ed.motivo}
                                </p>
                              )}

                              {/* Reverter/Rejeitar — mesmo critério da Fila de Revisão
                                  (isFechamentoRole; o servidor reforça). */}
                              {podeRevisar && ed.status === 'aplicada' && OPERACOES_REVERSIVEIS.includes(ed.operacao) && (
                                <div className="mt-2">
                                  {!acaoAtual ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAcaoEdicao({ id: ed.id, modo: 'rejeitar' });
                                          setMotivoAcao('');
                                        }}
                                        disabled={processandoAcao}
                                        className="inline-flex min-h-[44px] lg:min-h-[28px] items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 lg:py-1 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-50"
                                      >
                                        <FiXCircle className="h-3.5 w-3.5" />
                                        {t('gtEscalaV2.rejeitar', 'Rejeitar')}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAcaoEdicao({ id: ed.id, modo: 'reverter' });
                                          setMotivoAcao('');
                                        }}
                                        disabled={processandoAcao}
                                        className="inline-flex min-h-[44px] lg:min-h-[28px] items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-2 lg:py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                                      >
                                        <FiRotateCcw className="h-3.5 w-3.5" />
                                        {t('gtEscalaV2.reverter', 'Reverter')}
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="w-full space-y-2 rounded-lg border border-slate-200 bg-white p-2">
                                      <label
                                        htmlFor={`gt-edicao-motivo-${ed.id}`}
                                        className="block text-[11px] font-bold text-slate-700"
                                      >
                                        {acaoAtual.modo === 'rejeitar'
                                          ? t('gtEscalaV2.confirmarRejeitar', 'Confirmar rejeição')
                                          : t('gtEscalaV2.confirmarReverter', 'Confirmar reversão')}
                                        {' — '}
                                        {t('gtEscalaV2.motivo', 'Motivo')} *
                                      </label>
                                      <textarea
                                        id={`gt-edicao-motivo-${ed.id}`}
                                        rows={2}
                                        value={motivoAcao}
                                        onChange={(e) => setMotivoAcao(e.target.value)}
                                        placeholder={t('gtEscalaV2.motivoPlaceholder', 'Ex.: data de desembarque errada — lançamento correto é 12/09.')}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => void executarAcaoEdicao()}
                                          disabled={processandoAcao}
                                          className={`inline-flex min-h-[44px] lg:min-h-[28px] items-center gap-1.5 rounded-lg px-3 py-2 lg:py-1 text-[11px] font-bold text-white disabled:opacity-50 ${
                                            acaoAtual.modo === 'rejeitar'
                                              ? 'bg-red-600 hover:bg-red-700'
                                              : 'bg-amber-600 hover:bg-amber-700'
                                          }`}
                                        >
                                          {processandoAcao && (
                                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                          )}
                                          {acaoAtual.modo === 'rejeitar'
                                            ? t('gtEscalaV2.confirmarRejeitar', 'Confirmar rejeição')
                                            : t('gtEscalaV2.confirmarReverter', 'Confirmar reversão')}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setAcaoEdicao(null);
                                            setMotivoAcao('');
                                          }}
                                          disabled={processandoAcao}
                                          className="min-h-[44px] lg:min-h-[28px] rounded-lg border border-slate-300 bg-white px-3 py-2 lg:py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                                        >
                                          {t('gtEscalaV2.cancelar', 'Cancelar')}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmação de exclusão — na ficha é sempre o evento inteiro (sem checkbox).
          z-[60] acima do CollaboratorModal. */}
      <ConfirmarExclusaoMarcacaoModal
        open={exclusaoModal !== null}
        tripulanteNome={colaboradorNome}
        trechoInicio={exclusaoModal ? String(exclusaoModal.emb.data_embarque || '').slice(0, 10) || null : null}
        trechoFim={
          exclusaoModal
            ? String(exclusaoModal.emb.data_desembarque || exclusaoModal.emb.data_prevista_desembarque || '').slice(0, 10) || null
            : null
        }
        eventoInicio={exclusaoModal ? String(exclusaoModal.emb.data_embarque || '').slice(0, 10) || null : null}
        eventoFim={
          exclusaoModal
            ? String(exclusaoModal.emb.data_desembarque || '').slice(0, 10) || null
            : null
        }
        escopo="evento"
        submitting={deletingId !== null}
        onConfirm={() => void excluirEmbarque()}
        onCancelar={() => setExclusaoModal(null)}
      />
    </div>
  );
}
