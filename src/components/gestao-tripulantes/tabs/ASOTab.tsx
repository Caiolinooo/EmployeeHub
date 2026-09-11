'use client';

import React, { useState } from 'react';
import { FiUpload, FiDownload, FiSend, FiHeart, FiAlertCircle, FiCheckCircle, FiClock, FiEye, FiFileText, FiEdit2, FiTrash2, FiX, FiSave } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { toast } from 'react-hot-toast';
import { cpfsMatch, formatCpf, isEsocialGlobalVisible, normalizeCpf } from '@/lib/gestao-tripulantes/cpf';
import { enviarOcrDocumento } from '@/components/gestao-tripulantes/ocr-client';
import AsoOcrDetailsModal from '@/components/gestao-tripulantes/AsoOcrDetailsModal';
import { classificarValidadeCivil, documentoPertenceAba } from '@/lib/gestao-tripulantes/validade-civil';
import {
  COLLABORATOR_MODAL_TAB_FILL_CLASS,
  COLLABORATOR_MODAL_TABLE_SCROLL_CLASS,
} from '@/components/gestao-tripulantes/collaborator-modal-layout';
import { useGtDocumentPermissions } from '@/components/gestao-tripulantes/use-gt-document-permissions';

interface Document {
  id: string;
  tipo_documento: string;
  titulo: string;
  numero_documento: string;
  orgao_emissor: string;
  data_emissao: string | null;
  data_validade: string | null;
  status_validacao: string;
  ocr_status: string;
  arquivo_url: string;
  ocr_dados_extraidos?: {
    cpf?: string;
    nome_completo?: string;
  } | null;
  aso_data?: {
    tipo_exame?: string;
    resultado?: string;
    data_realizacao?: string;
    medico_nome?: string;
    medico_crm?: string;
    nome_clinica?: string;
    esocial_status?: string;
    cpf_documento?: string | null;
    identity_match?: string | null;
    esocial_evento_id?: string | null;
    esocial_protocolo?: string | null;
    esocial_numero_recibo?: string | null;
    esocial_data_envio?: string | null;
    /** Cross-reference resolvido pelo backend (colaboradores/[id]) */
    esocial_evento_ref?: {
      id: string;
      evento_codigo: string;
      status: string;
      numero_recibo: string | null;
      protocolo_envio: string | null;
      data_envio: string | null;
      data_processamento: string | null;
    } | null;
  };
}

interface Props {
  colaboradorId: string;
  colaboradorCpf?: string;
  documentos: Document[];
  esocialAsos?: any[];
  onRefresh?: () => void;
  highlightDocId?: string | null;
}

const TIPO_EXAME_COLORS: Record<string, string> = {
  admissional: 'bg-blue-100 text-blue-700',
  periodico: 'bg-purple-100 text-purple-700',
  demissional: 'bg-red-100 text-red-700',
  retorno: 'bg-orange-100 text-orange-700',
  mudanca_funcao: 'bg-yellow-100 text-yellow-700',
};

const RESULTADO_COLORS: Record<string, string> = {
  apto: 'bg-green-100 text-green-700',
  inapto: 'bg-red-100 text-red-700',
  apto_condicional: 'bg-yellow-100 text-yellow-700',
};

const ESOCIAL_STATUS_COLORS: Record<string, string> = {
  nao_enviado: 'text-gray-400',
  pendente: 'text-orange-500',
  pendente_revisao: 'text-orange-500',
  aprovado: 'text-blue-600',
  enviado: 'text-green-600',
  processado: 'text-green-700',
  erro: 'text-red-600',
  quarentena: 'text-red-700',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    valido: 'bg-green-100 text-green-700',
    vencendo: 'bg-orange-100 text-orange-700',
    vencido: 'bg-red-100 text-red-700',
    pendente: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

interface EsocialRefData {
  evento_codigo?: string;
  status?: string;
  numero_recibo?: string | null;
  protocolo_envio?: string | null;
  data_envio?: string | null;
  data_processamento?: string | null;
}

/** Selo e-Social do ASO com tooltip de cross-reference (recibo, protocolo, processamento). */
function EsocialSeal({ status, ref: refData }: { status: string; ref?: EsocialRefData | null }) {
  const sealColors: Record<string, string> = {
    pendente: 'bg-orange-100 text-orange-800 border-orange-300',
    pendente_revisao: 'bg-orange-100 text-orange-800 border-orange-300',
    enviado: 'bg-blue-100 text-blue-800 border-blue-300',
    processado: 'bg-green-100 text-green-800 border-green-300',
    erro: 'bg-red-100 text-red-800 border-red-300',
    quarentena: 'bg-red-100 text-red-900 border-red-400',
  };
  const color = sealColors[status] || 'bg-gray-100 text-gray-600 border-gray-300';
  return (
    <span className="relative inline-flex group cursor-help">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${color}`}
      >
        e-Social {refData?.evento_codigo ? refData.evento_codigo : ''}
      </span>
      {/* Tooltip / painel de cross-reference */}
      <div
        className="absolute z-30 left-1/2 -translate-x-1/2 top-full mt-2 w-64 rounded-lg border border-slate-200 bg-white shadow-xl p-3 text-left hidden group-hover:block"
        role="tooltip"
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
          Cross-reference e-Social ↔ ASO
        </p>
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-gray-400">Evento</dt>
            <dd className="font-medium text-gray-700">{refData?.evento_codigo || 'S-2220'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-gray-400">Status evento</dt>
            <dd className="font-medium text-gray-700">{(refData?.status || status).replace(/_/g, ' ')}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-gray-400">Nº recibo</dt>
            <dd className="font-mono text-[11px] text-gray-700 break-all text-right">
              {refData?.numero_recibo || '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-gray-400">Protocolo</dt>
            <dd className="font-mono text-[11px] text-gray-700 break-all text-right">
              {refData?.protocolo_envio || '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-gray-400">Envio</dt>
            <dd className="font-medium text-gray-700">{formatDateStatic(refData?.data_envio)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-gray-400">Processamento</dt>
            <dd className="font-medium text-gray-700">{formatDateStatic(refData?.data_processamento)}</dd>
          </div>
        </dl>
      </div>
    </span>
  );
}

function formatDateStatic(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('pt-BR'); } catch { return d; }
}

function isDraftStatus(status: string): boolean {
  return !isEsocialGlobalVisible(status);
}

export function isAsoLockedForEdit(status?: string | null): boolean {
  const normalized = (status || '').toLowerCase();
  return normalized === 'enviado' || normalized === 'processado';
}

function toDateInput(value?: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function ASOTab({ colaboradorId, colaboradorCpf, documentos, esocialAsos = [], onRefresh, highlightDocId }: Props) {
  const { t } = useI18n();
  const { canEdit, canDelete } = useGtDocumentPermissions();
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [runningOcr, setRunningOcr] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState('');
  const [selectedAsoForDetails, setSelectedAsoForDetails] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingAso, setEditingAso] = useState<Document | null>(null);
  const [savingAso, setSavingAso] = useState(false);
  const [asoEditForm, setAsoEditForm] = useState({
    tipo_exame: '',
    resultado: '',
    data_realizacao: '',
    data_emissao: '',
    data_validade: '',
    medico_nome: '',
    medico_crm: '',
    nome_clinica: '',
  });

  const rawAsos = documentos.filter(d => documentoPertenceAba(d.tipo_documento, 'aso'));
  const profileCpf = normalizeCpf(colaboradorCpf || '');

  // Deduplicação e Agrupamento dos ASOs por documento/data de realização
  const dedupedMap = new Map<string, Document>();
  rawAsos.forEach((doc) => {
    const dRealiz = (doc.aso_data?.data_realizacao || doc.data_emissao || '').trim();
    const dValid = (doc.data_validade || '').trim();
    const normTitle = (doc.titulo || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/(\.pdf|\.jpg|\.png|_rotated|\(1\)|\(2\))/gi, '')
      .trim();
    const cleanUrl = (doc.arquivo_url || '').split('?')[0];

    const key = cleanUrl ? `url_${cleanUrl}` : `${normTitle}_${dRealiz || 'SEM_DATA'}_${dValid || 'SEM_VALID'}`;

    const existing = dedupedMap.get(key);
    if (!existing) {
      dedupedMap.set(key, doc);
    } else {
      const existingScore =
        (existing.aso_data?.esocial_evento_ref?.numero_recibo || existing.aso_data?.esocial_status === 'processado' ? 1000 : 0) +
        (existing.aso_data?.esocial_status === 'enviado' ? 500 : 0) +
        (existing.ocr_status === 'concluido' ? 50 : 0) +
        (existing.ocr_dados_extraidos ? 20 : 0);

      const currentScore =
        (doc.aso_data?.esocial_evento_ref?.numero_recibo || doc.aso_data?.esocial_status === 'processado' ? 1000 : 0) +
        (doc.aso_data?.esocial_status === 'enviado' ? 500 : 0) +
        (doc.ocr_status === 'concluido' ? 50 : 0) +
        (doc.ocr_dados_extraidos ? 20 : 0);

      const winner = currentScore > existingScore ? doc : existing;
      const loser = currentScore > existingScore ? existing : doc;

      const merged = {
        ...winner,
        aso_data: {
          ...(loser.aso_data || {}),
          ...(winner.aso_data || {}),
          esocial_evento_ref: winner.aso_data?.esocial_evento_ref || loser.aso_data?.esocial_evento_ref || null,
        },
        ocr_dados_extraidos: winner.ocr_dados_extraidos || loser.ocr_dados_extraidos || null,
        data_validade: winner.data_validade || loser.data_validade || null,
      };
      dedupedMap.set(key, merged);
    }
  });

  // Ordenação cronológica (do mais recente para o mais antigo)
  const asos = Array.from(dedupedMap.values()).sort((a, b) => {
    const dateA = a.aso_data?.data_realizacao || a.data_emissao || '';
    const dateB = b.aso_data?.data_realizacao || b.data_emissao || '';
    return dateB.localeCompare(dateA);
  });

  const getOcrIdentity = (doc: Document) => {
    const cpfDoc = normalizeCpf(doc.aso_data?.cpf_documento || doc.ocr_dados_extraidos?.cpf || '');
    const nomeOcr = doc.ocr_dados_extraidos?.nome_completo || '';
    const match = doc.aso_data?.identity_match;
    // Prova real de identidade exige CPF extraído batendo com o perfil —
    // identity_match='match' legado SEM CPF não é prova (docs antigos).
    const matchesProfile = cpfDoc.length === 11 && profileCpf.length === 11
      ? cpfsMatch(cpfDoc, profileCpf)
      : false;
    return { cpfDoc, nomeOcr, match, matchesProfile };
  };

  const availableAsos = asos.filter(d => isEsocialGlobalVisible(d.aso_data?.esocial_status || 'nao_enviado'));
  const draftAsos = asos.filter(d => isDraftStatus(d.aso_data?.esocial_status || 'nao_enviado'));

  const getEventField = (event: any, fieldName: string) => {
    const dados = event.dados_evento || {};
    if (dados[fieldName] !== undefined) return dados[fieldName];
    const exam = dados.exameOcupacional || {};
    if (fieldName === 'data_realizacao') return exam.dtExame || exam.aso?.dtAso || event.created_at?.split('T')[0];
    if (fieldName === 'tipo_exame') {
      const tp = exam.tpExame;
      if (tp === 1) return 'admissional';
      if (tp === 2) return 'periodico';
      if (tp === 3) return 'retorno';
      if (tp === 4) return 'mudanca_funcao';
      if (tp === 5) return 'demissional';
      return 'periodico';
    }
    if (fieldName === 'resultado') {
      const res = exam.aso?.resAso;
      if (res === 1) return 'apto';
      if (res === 2) return 'apto_condicional';
      if (res === 3) return 'inapto';
      return 'apto';
    }
    if (fieldName === 'medico_nome') return exam.medico?.nmMed || '';
    if (fieldName === 'medico_crm') return exam.medico?.nrCRM || '';
    if (fieldName === 'medico_uf') return exam.medico?.ufCRM || '';
    return '';
  };

  const linkedDocIds = new Set(asos.map(d => d.id));
  const linkedRecibos = new Set(
    asos
      .map(d => d.aso_data?.esocial_numero_recibo || d.aso_data?.esocial_evento_ref?.numero_recibo)
      .filter(Boolean)
  );
  const linkedDates = new Set(
    asos
      .map(d => d.aso_data?.data_realizacao || d.data_emissao)
      .filter(Boolean)
  );

  const unlinkedEsocialAsos = (esocialAsos || []).filter(evt => {
    const docId = evt.entidade_origem_id || evt.dados_evento?.documento_id || evt.dados_evento?.documentoId;
    if (docId && linkedDocIds.has(docId)) return false;
    if (evt.numero_recibo && linkedRecibos.has(evt.numero_recibo)) return false;
    const evtDate = getEventField(evt, 'data_realizacao');
    if (evtDate && linkedDates.has(evtDate)) return false;
    return true;
  });

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('colaborador_id', colaboradorId);
      fd.append('tipo_documento', 'aso');
      fd.append('titulo', 'ASO');

      const res = await fetchWithToken('/api/gestao-tripulantes/documentos/upload', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) throw new Error('Upload falhou');

      const json = await res.json();
      const doc = json.data;

      toast.success(t('gestaoTripulantes.upload.success'));
      onRefresh?.();

      if (doc && doc.id && doc.arquivo_url) {
        handleRunOCR(doc.id, doc.arquivo_url);
      }
    } catch {
      toast.error(t('gestaoTripulantes.upload.error'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRunOCR = async (docId: string, arquivoUrl: string) => {
    try {
      setRunningOcr(docId);
      setOcrProgress('Preparando...');

      const res = await enviarOcrDocumento(docId, arquivoUrl, setOcrProgress);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao processar OCR');
      }
      const json = await res.json();
      // Contrato de integridade: OCR sem CPF extraído ⇒ documento vai para QUARENTENA.
      // O usuário precisa saber disso — não pode parecer que tudo ficou normal.
      const gate = json?.data?.identity_gate as { identity_match?: string | null; cpf_documento?: string | null } | undefined;
      if (gate?.identity_match === 'quarantine') {
        toast.error(
          '⚠️ Documento enviado para QUARENTENA: CPF não extraído / identidade não verificada. Resolva em Auditoria > Quarentena.',
          { duration: 8000 }
        );
      } else {
        toast.success('Processamento OCR executado com sucesso!');
      }
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar OCR');
    } finally {
      setRunningOcr(null);
      setOcrProgress('');
    }
  };

  const handleSendESocial = async (doc: Document) => {
    const { cpfDoc, matchesProfile, match } = getOcrIdentity(doc);
    if (match === 'quarantine' || doc.aso_data?.esocial_status === 'quarentena') {
      toast.error('ASO em quarentena de identidade — não pode enviar ao e-Social.');
      return;
    }
    if (!cpfDoc) {
      toast.error('Execute o OCR / identidade não verificada: CPF do documento não extraído.');
      return;
    }
    if (cpfDoc && profileCpf && !matchesProfile) {
      toast.error(`CPF do ASO (${formatCpf(cpfDoc)}) difere do perfil (${formatCpf(profileCpf)}). Envio bloqueado.`);
      return;
    }

    try {
      setSending(doc.id);
      const res = await fetchWithToken(`/api/gestao-tripulantes/documentos/${doc.id}/esocial`, { method: 'POST' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Falha ao enviar E-Social');
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success('Evento E-Social criado para revisão!');
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || t('gestaoTripulantes.errors.saveError'));
    } finally {
      setSending(null);
    }
  };

  const openAsoEdit = (doc: Document) => {
    const meta = doc.aso_data || {};
    setEditingAso(doc);
    setAsoEditForm({
      tipo_exame: meta.tipo_exame || '',
      resultado: meta.resultado || '',
      data_realizacao: toDateInput(meta.data_realizacao),
      data_emissao: toDateInput(doc.data_emissao),
      data_validade: toDateInput(doc.data_validade),
      medico_nome: meta.medico_nome || '',
      medico_crm: meta.medico_crm || '',
      nome_clinica: meta.nome_clinica || '',
    });
  };

  const handleSaveAsoEdit = async () => {
    if (!editingAso) return;
    try {
      setSavingAso(true);
      const res = await fetchWithToken(`/api/gestao-tripulantes/documentos/${editingAso.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_emissao: asoEditForm.data_emissao || null,
          data_validade: asoEditForm.data_validade || null,
          aso: {
            tipo_exame: asoEditForm.tipo_exame || null,
            resultado: asoEditForm.resultado || null,
            data_realizacao: asoEditForm.data_realizacao || null,
            medico_nome: asoEditForm.medico_nome || null,
            medico_crm: asoEditForm.medico_crm || null,
            nome_clinica: asoEditForm.nome_clinica || null,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Falha ao salvar ASO');
      toast.success('ASO atualizado');
      setEditingAso(null);
      onRefresh?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar ASO');
    } finally {
      setSavingAso(false);
    }
  };

  const handleDeleteAso = async (doc: Document) => {
    if (isAsoLockedForEdit(doc.aso_data?.esocial_status)) {
      toast.error('ASO já enviado ao e-Social — não editável');
      return;
    }
    if (!confirm('Excluir este ASO do cadastro?')) return;
    try {
      setDeletingId(doc.id);
      const res = await fetchWithToken(`/api/gestao-tripulantes/documentos/${doc.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Falha ao excluir');
      toast.success('ASO excluído');
      onRefresh?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir ASO');
    } finally {
      setDeletingId(null);
    }
  };

  const renderAsoCard = (doc: Document, section: 'available' | 'draft') => {
    const meta = doc.aso_data || {};
    const eSocialStatus = meta.esocial_status || 'nao_enviado';
    const locked = isAsoLockedForEdit(eSocialStatus);
    const { cpfDoc, nomeOcr, match, matchesProfile } = getOcrIdentity(doc);
    const semCpfExtraido = cpfDoc.length !== 11; // sem prova de identidade
    const identityBlocked =
      match === 'quarantine' ||
      eSocialStatus === 'quarentena' ||
      semCpfExtraido ||
      (cpfDoc.length === 11 && profileCpf.length === 11 && !matchesProfile);
    // Motivo do bloqueio — aviso exigido pelo contrato de integridade
    const motivoBloqueio =
      match === 'quarantine' || eSocialStatus === 'quarentena'
        ? 'Identidade em quarentena — resolva na Auditoria antes de enviar'
        : semCpfExtraido
          ? 'Execute o OCR / identidade não verificada'
          : 'Bloqueado: CPF OCR ≠ perfil';

    // Cross-reference: evento e-Social deste ASO (recibo/protocolo/processamento)
    const esocialRef: EsocialRefData | null =
      meta.esocial_evento_ref ||
      (esocialAsos || []).find(evt => {
        const docId = evt.entidade_origem_id || evt.dados_evento?.documento_id || evt.dados_evento?.documentoId;
        if (docId === doc.id) return true;
        return !!(meta.esocial_evento_id && evt.id === meta.esocial_evento_id);
      }) ||
      null;
    const showEsocialSeal = eSocialStatus !== 'nao_enviado';

    const displayTitle = nomeOcr
      ? `ASO — ${nomeOcr}`
      : (doc.titulo?.startsWith('ASO -') ? 'ASO' : doc.titulo);

    return (
      <div id={`gt-doc-${doc.id}`} key={doc.id} className={`p-5 hover:bg-gray-50 transition-colors ${highlightDocId === doc.id ? 'ring-2 ring-red-400 bg-red-50/40' : ''}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-800 text-sm">{displayTitle}</p>
              {section === 'draft' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                  {eSocialStatus === 'quarentena' ? 'quarentena' : 'não enviado / rascunho'}
                </span>
              )}
              {section === 'available' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-800">
                  disponível
                </span>
              )}
              {meta.tipo_exame && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_EXAME_COLORS[meta.tipo_exame.toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>
                  {t(`gestaoTripulantes.aso.${meta.tipo_exame}`, meta.tipo_exame)}
                </span>
              )}
              {meta.resultado && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RESULTADO_COLORS[meta.resultado.toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>
                  {t(`gestaoTripulantes.aso.${meta.resultado}`, meta.resultado)}
                </span>
              )}
              {showEsocialSeal && <EsocialSeal status={eSocialStatus} ref={esocialRef} />}
            </div>

            {/* Identity from OCR — never treat filename as identity */}
            <div className={`rounded-lg border px-3 py-2 text-xs ${
              identityBlocked
                ? 'border-red-200 bg-red-50 text-red-800'
                : match === 'match' || matchesProfile
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}>
              <div className="flex items-start gap-2">
                {identityBlocked ? (
                  <FiAlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                ) : (
                  <FiCheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                )}
                <div className="space-y-0.5">
                  <p>
                    <span className="font-semibold">Identidade OCR:</span>{' '}
                    {nomeOcr || '—'} · CPF {cpfDoc ? formatCpf(cpfDoc) : 'não extraído'}
                  </p>
                  <p className="opacity-80">
                    Match: {match || '—'}
                    {profileCpf ? ` · Perfil: ${formatCpf(profileCpf)}` : ''}
                    {doc.titulo?.includes('.') || doc.titulo?.startsWith('ASO -')
                      ? ` · Arquivo: ${doc.titulo}`
                      : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
              <div>
                <p className="text-xs text-gray-400">Realização</p>
                <p className="text-xs font-medium text-gray-700">{formatDate(meta.data_realizacao || doc.data_emissao)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Validade</p>
                <p className="text-xs font-medium text-gray-700">{formatDate(doc.data_validade)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Médico</p>
                <p className="text-xs font-medium text-gray-700">{meta.medico_nome || '—'}{meta.medico_crm ? ` (${meta.medico_crm})` : ''}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Clínica</p>
                <p className="text-xs font-medium text-gray-700">{meta.nome_clinica || '—'}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">{t('gestaoTripulantes.aso.eSocialStatus')}:</span>
                <span className={`text-xs font-semibold ${ESOCIAL_STATUS_COLORS[eSocialStatus] || 'text-gray-500'}`}>
                  {eSocialStatus.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">OCR:</span>
                <span className={`text-xs font-semibold ${
                  doc.ocr_status === 'concluido' ? 'text-green-600' :
                  doc.ocr_status === 'processando' ? 'text-blue-600 animate-pulse' :
                  doc.ocr_status === 'erro' ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {runningOcr === doc.id ? ocrProgress : (doc.ocr_status || 'pendente').toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <StatusBadge status={classificarValidadeCivil(doc.data_validade) === 'sem_validade' ? (doc.status_validacao || 'pendente') : classificarValidadeCivil(doc.data_validade)} />

            <button
              onClick={() => setSelectedAsoForDetails(doc)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition shadow-sm"
            >
              <FiEye className="w-3.5 h-3.5 text-blue-600" />
              Visualizar OCR & Dados
            </button>

            {doc.arquivo_url && (
              <a
                href={doc.arquivo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition"
              >
                <FiDownload className="w-3 h-3 text-blue-600" /> Baixar PDF
              </a>
            )}

            {(!doc.ocr_status || doc.ocr_status === 'pendente' || doc.ocr_status === 'erro') && (
              <button
                onClick={() => handleRunOCR(doc.id, doc.arquivo_url)}
                disabled={runningOcr === doc.id || uploading}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
              >
                <FiClock className="w-3.5 h-3.5" />
                {runningOcr === doc.id ? 'Processando...' : 'Executar OCR'}
              </button>
            )}

            {eSocialStatus === 'nao_enviado' && doc.ocr_status === 'concluido' && (
              <>
                <button
                  onClick={() => handleSendESocial(doc)}
                  disabled={sending === doc.id || identityBlocked}
                  title={identityBlocked ? motivoBloqueio : undefined}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                >
                  <FiSend className="w-3 h-3" />
                  {sending === doc.id ? 'Enviando...' : t('gestaoTripulantes.aso.sendESocial')}
                </button>
                {identityBlocked && !sending && (
                  <p className="flex items-center gap-1 max-w-[180px] text-right text-[10px] font-semibold text-red-600">
                    <FiAlertCircle className="w-3 h-3 shrink-0" />
                    {motivoBloqueio}
                  </p>
                )}
              </>
            )}

            {locked ? (
              <p className="max-w-[180px] text-right text-[10px] font-semibold text-slate-500">
                Já enviado ao e-Social — não editável
              </p>
            ) : (
              <>
                {canEdit && (
                  <button
                    onClick={() => openAsoEdit(doc)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                    title="Editar ASO"
                  >
                    <FiEdit2 className="w-3 h-3" /> Editar
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDeleteAso(doc)}
                    disabled={deletingId === doc.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    title="Excluir ASO"
                  >
                    <FiTrash2 className="w-3 h-3" /> Excluir
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const totalCount = asos.length + unlinkedEsocialAsos.length;

  return (
    <div className={`${COLLABORATOR_MODAL_TAB_FILL_CLASS} divide-y divide-gray-100`}>
      <div className="p-4 flex items-center justify-between bg-gray-50/70 shrink-0">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FiHeart className="text-red-500" />
          <span>
            {availableAsos.length} disponível(is) · {draftAsos.length} rascunho(s)
            {unlinkedEsocialAsos.length > 0 ? ` · ${unlinkedEsocialAsos.length} e-Social` : ''}
            {' '}({totalCount} total)
          </span>
        </div>
        <label className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg cursor-pointer hover:bg-red-700 transition ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          <FiUpload className="w-3.5 h-3.5" />
          {uploading ? t('gestaoTripulantes.upload.uploading') : t('gestaoTripulantes.aso.uploadAso')}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleUpload} />
        </label>
      </div>

      {totalCount === 0 ? (
        <div className="p-12 text-center">
          <FiHeart className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">{t('gestaoTripulantes.aso.noAso')}</p>
        </div>
      ) : (
        <div className={`${COLLABORATOR_MODAL_TABLE_SCROLL_CLASS} divide-y divide-gray-100`}>
          {availableAsos.length > 0 && (
            <div>
              <div className="px-5 py-2 bg-green-50/80 border-b border-green-100">
                <p className="text-xs font-bold uppercase tracking-wide text-green-800">
                  Disponíveis (enviado / processado no e-Social)
                </p>
              </div>
              {availableAsos.map(doc => renderAsoCard(doc, 'available'))}
            </div>
          )}

          {draftAsos.length > 0 && (
            <div>
              <div className="px-5 py-2 bg-amber-50/80 border-b border-amber-100">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                  Rascunhos / não enviados (não entram no uso global)
                </p>
              </div>
              {draftAsos.map(doc => renderAsoCard(doc, 'draft'))}
            </div>
          )}

          {unlinkedEsocialAsos.map(evt => {
            const tipo = getEventField(evt, 'tipo_exame');
            const res = getEventField(evt, 'resultado');
            const dataRealizacao = getEventField(evt, 'data_realizacao');
            const dataValidade = evt.dados_evento?.data_validade || null;
            const medicoNome = getEventField(evt, 'medico_nome');
            const medicoCrm = getEventField(evt, 'medico_crm');
            const medicoUf = getEventField(evt, 'medico_uf');
            const clinica = evt.dados_evento?.nome_clinica || 'Sincronizado e-Social';

            const eventStatus = evt.status || 'pendente';
            const statusValidadeStr = dataValidade
              ? (new Date(dataValidade) < new Date() ? 'vencido' : 'valido')
              : 'valido';
            const isGlobal = eventStatus === 'processado' || eventStatus === 'enviado' || eventStatus === 'sucesso';

            return (
              <div key={evt.id} className={`p-5 hover:bg-gray-50 transition-colors border-l-4 ${isGlobal ? 'border-l-green-400 bg-green-50/5' : 'border-l-blue-400 bg-blue-50/5'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isGlobal ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                        ASO e-Social (S-2220)
                      </p>
                      {!isGlobal && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                          não enviado / rascunho
                        </span>
                      )}
                      {tipo && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_EXAME_COLORS[tipo.toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>
                          {t(`gestaoTripulantes.aso.${tipo}`, tipo)}
                        </span>
                      )}
                      {res && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RESULTADO_COLORS[res.toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>
                          {t(`gestaoTripulantes.aso.${res}`, res)}
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-bold uppercase">
                        e-Social
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                      <div>
                        <p className="text-xs text-gray-400">Realização</p>
                        <p className="text-xs font-medium text-gray-700">{formatDate(dataRealizacao)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Validade</p>
                        <p className="text-xs font-medium text-gray-700">{formatDate(dataValidade)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Médico</p>
                        <p className="text-xs font-medium text-gray-700">{medicoNome || '—'}{medicoCrm ? ` (${medicoCrm}-${medicoUf || 'RJ'})` : ''}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Origem</p>
                        <p className="text-xs font-medium text-gray-700 truncate">{clinica}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 pt-1 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">Status e-Social:</span>
                        <span className={`text-xs font-bold ${
                          isGlobal ? 'text-green-600' :
                          eventStatus === 'pendente_revisao' || eventStatus === 'pendente' ? 'text-orange-500' :
                          eventStatus === 'erro' || eventStatus === 'erro_validacao' ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {eventStatus.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                      {(evt.numero_recibo || evt.protocolo_envio) && (
                        <div className="flex items-center gap-3 text-xs">
                          {evt.numero_recibo && (
                            <span className="text-gray-400">Recibo: <span className="font-mono text-gray-700">{evt.numero_recibo}</span></span>
                          )}
                          {evt.protocolo_envio && (
                            <span className="text-gray-400">Protocolo: <span className="font-mono text-gray-700">{evt.protocolo_envio}</span></span>
                          )}
                          {evt.data_processamento && (
                            <span className="text-gray-400">Proc.: <span className="text-gray-700">{formatDate(evt.data_processamento)}</span></span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <StatusBadge status={statusValidadeStr} />

                    <button
                      onClick={() => setSelectedAsoForDetails({
                        id: evt.id,
                        titulo: `ASO e-Social (S-2220) — ${formatDate(dataRealizacao)}`,
                        tipo_documento: 'aso',
                        data_emissao: dataRealizacao,
                        data_validade: dataValidade,
                        ocr_status: 'concluido',
                        ocr_dados_extraidos: evt.dados_evento,
                        aso_data: {
                          tipo_exame: tipo,
                          resultado: res,
                          data_realizacao: dataRealizacao,
                          medico_nome: medicoNome,
                          medico_crm: medicoCrm,
                          medico_uf: medicoUf,
                          nome_clinica: clinica,
                          esocial_status: isGlobal ? 'processado' : eventStatus,
                          esocial_numero_recibo: evt.numero_recibo,
                          esocial_protocolo: evt.protocolo_envio,
                          esocial_data_envio: evt.data_envio,
                          esocial_evento_ref: evt,
                        }
                      })}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition shadow-sm"
                    >
                      <FiEye className="w-3.5 h-3.5 text-blue-600" />
                      Visualizar Dados
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedAsoForDetails && (
        <AsoOcrDetailsModal
          isOpen={!!selectedAsoForDetails}
          onClose={() => setSelectedAsoForDetails(null)}
          documento={selectedAsoForDetails}
          colaboradorCpf={colaboradorCpf}
        />
      )}

      {editingAso && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden my-auto">
            <div className="bg-gradient-to-r from-rose-700 to-red-800 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <FiEdit2 className="w-5 h-5" />
                <h3 className="font-bold text-base">Editar ASO</h3>
              </div>
              <button onClick={() => setEditingAso(null)} className="p-1 hover:bg-white/20 rounded-lg transition">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3 max-h-[75vh] overflow-y-auto">
              <label className="block text-xs font-bold text-gray-700 uppercase">Tipo de exame</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={asoEditForm.tipo_exame}
                onChange={(e) => setAsoEditForm((f) => ({ ...f, tipo_exame: e.target.value }))}
              >
                <option value="">—</option>
                <option value="admissional">Admissional</option>
                <option value="periodico">Periódico</option>
                <option value="demissional">Demissional</option>
                <option value="retorno">Retorno</option>
                <option value="mudanca_funcao">Mudança de função</option>
              </select>
              <label className="block text-xs font-bold text-gray-700 uppercase">Resultado</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={asoEditForm.resultado}
                onChange={(e) => setAsoEditForm((f) => ({ ...f, resultado: e.target.value }))}
              >
                <option value="">—</option>
                <option value="apto">Apto</option>
                <option value="inapto">Inapto</option>
                <option value="apto_condicional">Apto condicional</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Realização</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    value={asoEditForm.data_realizacao}
                    onChange={(e) => setAsoEditForm((f) => ({ ...f, data_realizacao: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Validade</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    value={asoEditForm.data_validade}
                    onChange={(e) => setAsoEditForm((f) => ({ ...f, data_validade: e.target.value }))}
                  />
                </div>
              </div>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={asoEditForm.data_emissao}
                onChange={(e) => setAsoEditForm((f) => ({ ...f, data_emissao: e.target.value }))}
              />
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="Médico"
                value={asoEditForm.medico_nome}
                onChange={(e) => setAsoEditForm((f) => ({ ...f, medico_nome: e.target.value }))}
              />
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="CRM"
                value={asoEditForm.medico_crm}
                onChange={(e) => setAsoEditForm((f) => ({ ...f, medico_crm: e.target.value }))}
              />
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="Clínica"
                value={asoEditForm.nome_clinica}
                onChange={(e) => setAsoEditForm((f) => ({ ...f, nome_clinica: e.target.value }))}
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setEditingAso(null)} className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg">
                Cancelar
              </button>
              <button
                onClick={handleSaveAsoEdit}
                disabled={savingAso}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-rose-700 rounded-lg disabled:opacity-50"
              >
                <FiSave className="w-4 h-4" /> {savingAso ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
