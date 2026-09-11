'use client';

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  FiUpload,
  FiDownload,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiBookOpen,
  FiEdit2,
  FiTrash2,
  FiX,
  FiFileText,
  FiCheck,
  FiPaperclip,
  FiCalendar,
  FiAward,
  FiArchive,
  FiUsers
} from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken, getToken } from '@/lib/tokenStorage';
import { toast } from 'react-hot-toast';
import { enviarOcrDocumento } from '@/components/gestao-tripulantes/ocr-client';
import { documentoPertenceAba } from '@/lib/gestao-tripulantes/validade-civil';
import HistoricoColapsavel from '@/components/gestao-tripulantes/HistoricoColapsavel';
import {
  agruparDocumentosPorTipo,
  contarDocsPorStatusPrimario,
} from '@/lib/gestao-tripulantes/documento-historico';
import {
  COLLABORATOR_MODAL_TAB_FILL_CLASS,
  COLLABORATOR_MODAL_TABLE_SCROLL_CLASS,
} from '@/components/gestao-tripulantes/collaborator-modal-layout';
import { useGtDocumentPermissions } from '@/components/gestao-tripulantes/use-gt-document-permissions';
import MatrizConformidadeColaboradorCard, {
  type MatrizConformidadeData,
} from '@/components/gestao-tripulantes/MatrizConformidadeColaboradorCard';
import ModalListaPresencaTreinamento from '@/components/gestao-tripulantes/ModalListaPresencaTreinamento';

export interface Document {
  id: string;
  tipo_documento: string;
  subtipo?: string | null;
  titulo: string;
  numero_documento?: string | null;
  orgao_emissor?: string | null;
  data_emissao?: string | null;
  data_validade?: string | null;
  status_validacao?: string | null;
  ocr_status?: string | null;
  arquivo_url?: string | null;
  arquivo_path?: string | null;
  numero_rastreio?: string | null;
  descricao?: string | null;
  origem?: string | null;
  papel_conformidade?: 'vigente' | 'historico';
  created_at?: string | null;
  treinamento_data?: {
    nome_curso?: string | null;
    instituicao?: string | null;
    carga_horaria?: number | null;
    tipo_curso?: string | null;
  } | null;
}

interface Props {
  colaboradorId: string;
  colaborador?: any;
  documentos: Document[];
  onRefresh?: () => void;
  highlightDocId?: string | null;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

type BadgeKind = 'permanente' | 'valido' | 'vencendo' | 'vencido' | 'pendente' | 'obsoleto' | 'outro';

function resolveBadgeKind(status?: string | null, hasValidade?: boolean, obsoleto?: boolean): BadgeKind {
  if (obsoleto) return 'obsoleto';
  if (!hasValidade) return 'permanente';
  switch (status) {
    case 'valido':
      return 'valido';
    case 'vencendo':
      return 'vencendo';
    case 'vencido':
      return 'vencido';
    case 'pendente':
    case 'reprovado':
    case 'cancelado':
      return 'pendente';
    case undefined:
    case null:
    case '':
      return 'valido';
    default:
      return 'outro';
  }
}

function StatusBadge({
  status,
  hasValidade,
  obsoleto,
}: {
  status?: string | null;
  hasValidade: boolean;
  obsoleto?: boolean;
}) {
  const kind = resolveBadgeKind(status, hasValidade, obsoleto);
  switch (kind) {
    case 'obsoleto':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          <FiArchive className="w-3 h-3" /> Obsoleto
        </span>
      );
    case 'permanente':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <FiCheck className="w-3 h-3 text-indigo-600" /> Permanente
        </span>
      );
    case 'valido':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <FiCheckCircle className="w-3 h-3 shrink-0" /> Válido
        </span>
      );
    case 'vencendo':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
          <FiClock className="w-3 h-3 shrink-0" /> Vencendo
        </span>
      );
    case 'vencido':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <FiAlertCircle className="w-3 h-3 shrink-0" /> Vencido
        </span>
      );
    case 'pendente':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
          <FiClock className="w-3 h-3 shrink-0" /> Pendente
        </span>
      );
    case 'outro':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
          <FiClock className="w-3 h-3 shrink-0" /> {status || '—'}
        </span>
      );
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function DaysToExpiry({ dateStr }: { dateStr?: string | null }) {
  if (!dateStr) return <span className="text-xs text-indigo-600 font-medium">Sem expiração</span>;
  const diff = Math.ceil((new Date(`${dateStr}T00:00:00`).getTime() - Date.now()) / 86400000);
  if (diff < 0) return <span className="text-xs text-red-600 font-bold">Vencido há {Math.abs(diff)} dias</span>;
  if (diff <= 30) return <span className="text-xs text-orange-600 font-bold">Vence em {diff} dias</span>;
  return <span className="text-xs text-emerald-700 font-medium">{diff} dias restantes</span>;
}

export default function TreinamentosTab({ colaboradorId, colaborador, documentos, onRefresh, highlightDocId }: Props) {
  const { t } = useI18n();
  const { canEdit, canDelete } = useGtDocumentPermissions();
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Edit modal state
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [editForm, setEditForm] = useState<{
    titulo: string;
    subtipo: string;
    numero_documento: string;
    orgao_emissor: string;
    carga_horaria: string;
    data_emissao: string;
    data_validade: string;
    permanente: boolean;
    file: File | null;
  }>({
    titulo: '',
    subtipo: '',
    numero_documento: '',
    orgao_emissor: '',
    carga_horaria: '',
    data_emissao: '',
    data_validade: '',
    permanente: false,
    file: null,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // New Training modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState<{
    titulo: string;
    subtipo: string;
    numero_documento: string;
    orgao_emissor: string;
    carga_horaria: string;
    data_emissao: string;
    data_validade: string;
    permanente: boolean;
    file: File | null;
  }>({
    titulo: '',
    subtipo: '',
    numero_documento: '',
    orgao_emissor: 'MARINHA DO BRASIL',
    carga_horaria: '',
    data_emissao: new Date().toISOString().split('T')[0],
    data_validade: '',
    permanente: false,
    file: null,
  });
  const [creatingNew, setCreatingNew] = useState(false);

  // File input refs for 1-click attach
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [historicoAberto, setHistoricoAberto] = useState<Record<string, boolean>>({});

  // Matriz de Treinamentos e Conformidade
  const [conformidade, setConformidade] = useState<MatrizConformidadeData | null>(null);
  const [loadingConformidade, setLoadingConformidade] = useState(false);
  const [showListaPresencaModal, setShowListaPresencaModal] = useState(false);

  const fetchConformidade = React.useCallback(async () => {
    if (!colaboradorId) return;
    try {
      setLoadingConformidade(true);
      const res = await fetchWithToken(`/api/gestao-tripulantes/colaboradores/${colaboradorId}/matriz-conformidade`);
      const json = await res.json();
      if (json.success && json.data) {
        setConformidade(json.data);
      }
    } catch {
      /* fail-soft */
    } finally {
      setLoadingConformidade(false);
    }
  }, [colaboradorId]);

  useEffect(() => {
    fetchConformidade();
  }, [fetchConformidade]);

  const handleLancarCursoFromMatriz = (nomeCurso: string, sigla?: string | null) => {
    setNewForm(prev => ({
      ...prev,
      titulo: nomeCurso,
      subtipo: sigla || '',
      orgao_emissor: 'ABZ Group',
    }));
    setShowNewModal(true);
  };

  const treinamentos = Array.isArray(documentos)
    ? documentos.filter(d => documentoPertenceAba(d.tipo_documento, 'treinamentos'))
    : [];

  const grupos = useMemo(() => agruparDocumentosPorTipo(treinamentos), [treinamentos]);
  const stats = useMemo(() => contarDocsPorStatusPrimario(treinamentos), [treinamentos]);
  const totalValidos = stats.qtd_docs_validos;
  const totalVencidos = stats.qtd_docs_vencidos;
  const totalVencendo = stats.qtd_docs_vencendo;
  const totalPermanentes = stats.permanentes;

  // --------------------------------------------------------------------------
  // Download Handler (PDF / Original)
  // --------------------------------------------------------------------------
  const handleDownload = async (doc: Document) => {
    try {
      setDownloadingDocId(doc.id);
      const safeTitle = (doc.titulo || 'Treinamento').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
      const safeName = (colaborador?.nome_completo || 'Colaborador').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
      const filename = `Treinamento_${safeTitle}_${safeName}.pdf`;

      const token = getToken();
      const res = await fetch(`/api/gestao-tripulantes/documentos/${doc.id}/pdf?download=true`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'same-origin',
      });

      if (!res.ok) throw new Error('Falha no download');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Download concluído com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao baixar documento');
    } finally {
      setDownloadingDocId(null);
    }
  };

  // --------------------------------------------------------------------------
  // Export Excel Handler
  // --------------------------------------------------------------------------
  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const token = getToken();
      const res = await fetch(`/api/gestao-tripulantes/colaboradores/${colaboradorId}/treinamentos/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'same-origin',
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || contentType.includes('application/json')) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha na exportação');
      }

      const blob = await res.blob();
      if (!blob || blob.size === 0) throw new Error('Planilha vazia');

      const rawName = typeof colaborador?.nome_completo === 'string' ? colaborador.nome_completo : 'Tripulante';
      const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) || 'Tripulante';
      const filename = `Treinamentos_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;

      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
      toast.success('Planilha de treinamentos exportada com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar planilha de treinamentos');
    } finally {
      setExportingExcel(false);
    }
  };

  // --------------------------------------------------------------------------
  // 1-Click Attach File directly to existing training row
  // --------------------------------------------------------------------------
  const handleDirectAttach = async (docId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingDocId(docId);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('colaborador_id', colaboradorId);
      fd.append('documento_id', docId);
      fd.append('tipo_documento', 'treinamento');

      const res = await fetchWithToken('/api/gestao-tripulantes/documentos/upload', {
        method: 'POST',
        body: fd,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Upload falhou');
      }

      toast.success('Certificado anexado com sucesso!');
      onRefresh?.();
      const attachedId = json.data?.id || docId;
      const arquivoUrl = json.data?.arquivo_url;
      if (attachedId && arquivoUrl) {
        void enviarOcrDocumento(attachedId, arquivoUrl).then(() => onRefresh?.());
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao anexar certificado');
    } finally {
      setUploadingDocId(null);
      e.target.value = '';
    }
  };

  // --------------------------------------------------------------------------
  // Open Edit Modal
  // --------------------------------------------------------------------------
  const handleOpenEdit = (doc: Document) => {
    const treExtra = doc.treinamento_data || {};
    setEditingDoc(doc);
    setEditForm({
      titulo: doc.titulo || '',
      subtipo: doc.subtipo || '',
      numero_documento: doc.numero_documento || '',
      orgao_emissor: doc.orgao_emissor || treExtra.instituicao || '',
      carga_horaria: treExtra.carga_horaria ? String(treExtra.carga_horaria) : '',
      data_emissao: doc.data_emissao ? doc.data_emissao.split('T')[0] : '',
      data_validade: doc.data_validade ? doc.data_validade.split('T')[0] : '',
      permanente: !doc.data_validade,
      file: null,
    });
  };

  // --------------------------------------------------------------------------
  // Save Edit Handler
  // --------------------------------------------------------------------------
  const handleSaveEdit = async () => {
    if (!editingDoc) return;
    if (!editForm.titulo.trim()) {
      toast.error('O título do treinamento é obrigatório');
      return;
    }

    try {
      setSavingEdit(true);

      if (editForm.file) {
        const fd = new FormData();
        fd.append('file', editForm.file);
        fd.append('colaborador_id', colaboradorId);
        fd.append('documento_id', editingDoc.id);
        fd.append('titulo', editForm.titulo.trim());
        fd.append('subtipo', editForm.subtipo.trim());
        fd.append('numero_documento', editForm.numero_documento.trim());
        fd.append('orgao_emissor', editForm.orgao_emissor.trim());
        fd.append('data_emissao', editForm.data_emissao || '');
        fd.append('data_validade', editForm.permanente ? '' : editForm.data_validade);

        const upRes = await fetchWithToken('/api/gestao-tripulantes/documentos/upload', {
          method: 'POST',
          body: fd,
        });
        if (!upRes.ok) {
          const errJson = await upRes.json().catch(() => ({}));
          throw new Error(errJson.error || 'Erro ao enviar arquivo');
        }
      }

      const payload = {
        titulo: editForm.titulo.trim(),
        subtipo: editForm.subtipo.trim() || null,
        numero_documento: editForm.numero_documento.trim() || null,
        orgao_emissor: editForm.orgao_emissor.trim() || null,
        data_emissao: editForm.data_emissao || null,
        data_validade: editForm.permanente ? null : (editForm.data_validade || null),
        treinamento_data: {
          nome_curso: editForm.titulo.trim(),
          instituicao: editForm.orgao_emissor.trim() || null,
          carga_horaria: editForm.carga_horaria ? Number(editForm.carga_horaria) : null,
        },
      };

      const res = await fetchWithToken(`/api/gestao-tripulantes/documentos/${editingDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao atualizar dados do treinamento');
      }

      toast.success('Treinamento atualizado com sucesso!');
      setEditingDoc(null);
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar alterações');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Excluir este treinamento do cadastro?')) return;
    try {
      setDeletingId(docId);
      const res = await fetchWithToken(`/api/gestao-tripulantes/documentos/${docId}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Falha ao excluir');
      toast.success('Treinamento excluído');
      onRefresh?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir treinamento');
    } finally {
      setDeletingId(null);
    }
  };

  // --------------------------------------------------------------------------
  // Save New Training Handler
  // --------------------------------------------------------------------------
  const handleSaveNew = async () => {
    if (!newForm.titulo.trim()) {
      toast.error('Informe o nome do curso / treinamento');
      return;
    }

    try {
      setCreatingNew(true);

      if (newForm.file) {
        const fd = new FormData();
        fd.append('file', newForm.file);
        fd.append('colaborador_id', colaboradorId);
        fd.append('tipo_documento', 'treinamento');
        fd.append('titulo', newForm.titulo.trim());
        fd.append('subtipo', newForm.subtipo.trim());
        fd.append('numero_documento', newForm.numero_documento.trim());
        fd.append('orgao_emissor', newForm.orgao_emissor.trim());
        fd.append('data_emissao', newForm.data_emissao || new Date().toISOString().split('T')[0]);
        fd.append('data_validade', newForm.permanente ? '' : (newForm.data_validade || ''));

        const res = await fetchWithToken('/api/gestao-tripulantes/documentos/upload', {
          method: 'POST',
          body: fd,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error || 'Erro ao cadastrar treinamento com arquivo');
        }
        const newId = json.data?.id as string | undefined;
        const arquivoUrl = json.data?.arquivo_url as string | undefined;
        if (newId && arquivoUrl) {
          void enviarOcrDocumento(newId, arquivoUrl).then(() => onRefresh?.());
        }
      } else {
        const payload = {
          colaborador_id: colaboradorId,
          tipo_documento: 'treinamento',
          titulo: newForm.titulo.trim(),
          subtipo: newForm.subtipo.trim() || null,
          numero_documento: newForm.numero_documento.trim() || null,
          orgao_emissor: newForm.orgao_emissor.trim() || null,
          data_emissao: newForm.data_emissao || new Date().toISOString().split('T')[0],
          data_validade: newForm.permanente ? null : (newForm.data_validade || null),
          origem: 'manual',
          treinamento_data: {
            nome_curso: newForm.titulo.trim(),
            instituicao: newForm.orgao_emissor.trim() || null,
            carga_horaria: newForm.carga_horaria ? Number(newForm.carga_horaria) : null,
          },
        };

        const res = await fetchWithToken(`/api/gestao-tripulantes/colaboradores/${colaboradorId}/documentos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'Erro ao cadastrar treinamento');
        }
      }

      toast.success('Treinamento cadastrado com sucesso!');
      setShowNewModal(false);
      setNewForm({
        titulo: '',
        subtipo: '',
        numero_documento: '',
        orgao_emissor: 'MARINHA DO BRASIL',
        carga_horaria: '',
        data_emissao: new Date().toISOString().split('T')[0],
        data_validade: '',
        permanente: false,
        file: null,
      });
      onRefresh?.();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cadastrar treinamento');
    } finally {
      setCreatingNew(false);
    }
  };

  const toggleHistorico = (key: string) => {
    setHistoricoAberto((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderTreinamentoCard = (doc: Document, idx: number, obsoleto: boolean) => {
    const treExtra = doc.treinamento_data || {};
    const numeroDoc = typeof doc.numero_documento === 'string' ? doc.numero_documento : '';
    const isCodeLike = Boolean(numeroDoc) && /^[A-Z0-9.\-_ /]{1,15}$/.test(numeroDoc) && !/^\d{5,}$/.test(numeroDoc);
    const codeAcronym = doc.subtipo || (isCodeLike ? numeroDoc : null);
    const hasExplicitNumber = Boolean(numeroDoc) && numeroDoc !== doc.subtipo && (!isCodeLike || Boolean(doc.subtipo));
    const isUploadingThis = uploadingDocId === doc.id;
    const isDownloadingThis = downloadingDocId === doc.id;
    const hasAttachedFile = !!doc.arquivo_url;
    const isPrimaryVencido = !obsoleto && doc.status_validacao === 'vencido';

    return (
      <div
        key={doc.id}
        className={`p-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          highlightDocId === doc.id ? 'ring-2 ring-red-400 ' : ''
        }${
          obsoleto
            ? 'bg-slate-50/90 py-3'
            : isPrimaryVencido
              ? 'bg-red-50/50 hover:bg-red-50/80 transition-colors'
              : 'hover:bg-slate-50/70 transition-colors'
        }`}
        id={`gt-doc-${doc.id}`}
      >
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {!obsoleto && <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>}
            <h3 className={`tracking-tight ${obsoleto ? 'font-semibold text-gray-700 text-sm' : 'font-bold text-gray-900 text-sm'}`}>
              {doc.titulo}
            </h3>
            {codeAcronym && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[11px] font-bold">
                {codeAcronym}
              </span>
            )}
            {hasAttachedFile ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <FiPaperclip className="w-3 h-3" /> Anexo PDF
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                Ficha Digital
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
            <div className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono font-medium">
              <span className="text-slate-400 font-sans text-[10px] uppercase font-bold">Nº:</span>
              {hasExplicitNumber ? (
                <span>{doc.numero_documento}</span>
              ) : (
                <button
                  onClick={() => handleOpenEdit(doc)}
                  className="text-blue-600 hover:underline inline-flex items-center gap-0.5 font-sans text-xs italic"
                  title="Clique para cadastrar o número do certificado"
                >
                  Informar Nº
                </button>
              )}
            </div>
            <span className="text-gray-600 font-medium">
              🏛️ {doc.orgao_emissor || treExtra.instituicao || 'MARINHA DO BRASIL'}
            </span>
            {treExtra.carga_horaria && (
              <span className="text-gray-500">⏱️ {treExtra.carga_horaria}h</span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap pt-0.5">
            {doc.data_emissao && (
              <span className="flex items-center gap-1">
                <FiCalendar className="w-3 h-3 text-gray-400" />
                <span>Realizado em: <strong className="text-gray-700">{formatDate(doc.data_emissao)}</strong></span>
              </span>
            )}
            {doc.data_validade ? (
              <span className="flex items-center gap-1">
                <FiClock className="w-3 h-3 text-gray-400" />
                <span>Válido até: <strong className="text-gray-700">{formatDate(doc.data_validade)}</strong></span>
                {!obsoleto && (
                  <span className="ml-1">(<DaysToExpiry dateStr={doc.data_validade} />)</span>
                )}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-indigo-700 font-medium">
                <FiCheck className="w-3 h-3 text-indigo-600" />
                <span>Treinamento Permanente (Sem data de expiração)</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 self-start md:self-center">
          <StatusBadge status={doc.status_validacao} hasValidade={!!doc.data_validade} obsoleto={obsoleto} />
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            ref={el => { fileInputRefs.current[doc.id] = el; }}
            onChange={e => handleDirectAttach(doc.id, e)}
          />
          <button
            onClick={() => handleDownload(doc)}
            disabled={isDownloadingThis}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50"
            title={hasAttachedFile ? 'Baixar arquivo original anexado' : 'Gerar e baixar Ficha Oficial de Treinamento em PDF'}
          >
            <FiDownload className="w-3.5 h-3.5" />
            {isDownloadingThis ? 'Baixando...' : (hasAttachedFile ? 'Baixar PDF' : 'Baixar Ficha')}
          </button>
          <button
            onClick={() => fileInputRefs.current[doc.id]?.click()}
            disabled={isUploadingThis}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition border border-transparent hover:border-gray-200"
            title={hasAttachedFile ? 'Substituir arquivo anexado' : 'Anexar certificado em PDF ou imagem'}
          >
            <FiUpload className="w-4 h-4" />
          </button>
          {canEdit && (
            <button
              onClick={() => handleOpenEdit(doc)}
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition border border-transparent hover:border-gray-200"
              title="Editar número, validade e dados do curso"
            >
              <FiEdit2 className="w-4 h-4" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => handleDelete(doc.id)}
              disabled={deletingId === doc.id}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition border border-transparent hover:border-red-200 disabled:opacity-50"
              title={obsoleto ? "Excluir lançamento incorreto ou duplicado do histórico" : "Excluir treinamento"}
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`${COLLABORATOR_MODAL_TAB_FILL_CLASS} divide-y divide-gray-100 bg-white`}>
      {/* Top Header & Actions Bar */}
      <div className="p-4 bg-slate-50/80 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        {/* Stats summary */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-600">
          <div className="flex items-center gap-1.5 font-bold text-gray-800 text-sm mr-2">
            <FiAward className="w-4 h-4 text-blue-600" />
            <span>{stats.total_grupos} treinamento(s)</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
            {totalValidos} válido(s)
          </span>
          {totalPermanentes > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold">
              {totalPermanentes} permanente(s)
            </span>
          )}
          {totalVencendo > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-semibold">
              {totalVencendo} vencendo
            </span>
          )}
          {totalVencidos > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-semibold">
              {totalVencidos} vencido(s)
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowListaPresencaModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold rounded-lg shadow-sm transition"
            title="Gerar lista de presença para treinamento interno com assinatura digital"
          >
            <FiUsers className="w-3.5 h-3.5" />
            Lista de Presença
          </button>

          {treinamentos.length > 0 && (
            <button
              onClick={handleExportExcel}
              disabled={exportingExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 shadow-sm transition disabled:opacity-50"
              title="Exportar planilha Excel de todos os treinamentos"
            >
              <FiFileText className="w-3.5 h-3.5 text-emerald-600" />
              {exportingExcel ? 'Exportando...' : 'Exportar Excel'}
            </button>
          )}

          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition"
          >
            <FiUpload className="w-3.5 h-3.5" />
            Novo Treinamento / Upload
          </button>
        </div>
      </div>

      {/* Matriz de Conformidade do Cargo */}
      <MatrizConformidadeColaboradorCard
        conformidade={conformidade}
        isLoading={loadingConformidade}
        onLancarCurso={handleLancarCursoFromMatriz}
      />

      {/* Training Cards List */}
      {treinamentos.length === 0 ? (
        <div className="p-12 text-center">
          <FiBookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium text-sm">Nenhum treinamento cadastrado para este tripulante.</p>
          <p className="text-gray-400 text-xs mt-1">Clique no botão acima para cadastrar ou anexar certificados.</p>
        </div>
      ) : (
        <div className={`${COLLABORATOR_MODAL_TABLE_SCROLL_CLASS} divide-y divide-gray-100`}>

          {grupos.map((grupo, idx) => (
            <div key={grupo.key} className="bg-white">
              {renderTreinamentoCard(grupo.primary, idx, false)}
              <HistoricoColapsavel
                count={grupo.historico.length}
                expanded={!!historicoAberto[grupo.key]}
                onToggle={() => toggleHistorico(grupo.key)}
              >
                {grupo.historico.map((hist, histIdx) => renderTreinamentoCard(hist, histIdx, true))}
              </HistoricoColapsavel>
            </div>
          ))}

        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: EDITAR TREINAMENTO                                             */}
      {/* ===================================================================== */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <FiEdit2 className="w-5 h-5" />
                <h3 className="font-bold text-base">Editar Treinamento</h3>
              </div>
              <button
                onClick={() => setEditingDoc(null)}
                className="p-1 hover:bg-white/20 rounded-lg transition"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Título do Treinamento */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Nome do Treinamento / Curso *
                </label>
                <input
                  type="text"
                  value={editForm.titulo}
                  onChange={e => setEditForm(p => ({ ...p, titulo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ex: Treinamento Básico de Segurança (TBS-I)"
                />
              </div>

              {/* Sigla STCW & Nº Certificado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Código / Sigla STCW
                  </label>
                  <input
                    type="text"
                    value={editForm.subtipo}
                    onChange={e => setEditForm(p => ({ ...p, subtipo: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ex: TBS-I, CESS, CIR"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Nº do Certificado / Registro
                  </label>
                  <input
                    type="text"
                    value={editForm.numero_documento}
                    onChange={e => setEditForm(p => ({ ...p, numero_documento: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ex: 12345/2026"
                  />
                </div>
              </div>

              {/* Órgão Emissor & Carga Horária */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Órgão Emissor / Instituição
                  </label>
                  <input
                    type="text"
                    value={editForm.orgao_emissor}
                    onChange={e => setEditForm(p => ({ ...p, orgao_emissor: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ex: MARINHA DO BRASIL"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Carga Horária (Horas)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.carga_horaria}
                    onChange={e => setEditForm(p => ({ ...p, carga_horaria: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ex: 40"
                  />
                </div>
              </div>

              {/* Datas: Emissão e Validade */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Data de Conclusão / Emissão
                    </label>
                    <input
                      type="date"
                      value={editForm.data_emissao}
                      onChange={e => setEditForm(p => ({ ...p, data_emissao: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Data de Validade
                    </label>
                    <input
                      type="date"
                      disabled={editForm.permanente}
                      value={editForm.permanente ? '' : editForm.data_validade}
                      onChange={e => setEditForm(p => ({ ...p, data_validade: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </div>
                </div>

                {/* Checkbox Permanente */}
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={editForm.permanente}
                    onChange={e => setEditForm(p => ({ ...p, permanente: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-gray-700">
                    Treinamento Permanente / Sem Data de Expiração
                  </span>
                </label>
              </div>

              {/* Anexar / Substituir Arquivo */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Anexar / Substituir Arquivo (PDF ou Imagem)
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl cursor-pointer transition text-xs text-gray-600 font-medium">
                    <FiPaperclip className="w-4 h-4 text-blue-600" />
                    <span>{editForm.file ? editForm.file.name : (editingDoc.arquivo_url ? 'Substituir arquivo anexado...' : 'Selecionar arquivo PDF/imagem...')}</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) setEditForm(p => ({ ...p, file: f }));
                      }}
                    />
                  </label>
                  {editForm.file && (
                    <button
                      onClick={() => setEditForm(p => ({ ...p, file: null }))}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Remover anexo selecionado"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setEditingDoc(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <FiCheck className="w-4 h-4" />
                {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: NOVO TREINAMENTO / UPLOAD                                      */}
      {/* ===================================================================== */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <FiAward className="w-5 h-5" />
                <h3 className="font-bold text-base">Cadastrar Novo Treinamento</h3>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Título do Treinamento */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Nome do Treinamento / Curso *
                </label>
                <input
                  type="text"
                  value={newForm.titulo}
                  onChange={e => setNewForm(p => ({ ...p, titulo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ex: Treinamento Básico de Segurança (TBS-I)"
                />
              </div>

              {/* Sigla STCW & Nº Certificado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Código / Sigla STCW
                  </label>
                  <input
                    type="text"
                    value={newForm.subtipo}
                    onChange={e => setNewForm(p => ({ ...p, subtipo: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ex: TBS-I, CESS, CIR"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Nº do Certificado / Registro
                  </label>
                  <input
                    type="text"
                    value={newForm.numero_documento}
                    onChange={e => setNewForm(p => ({ ...p, numero_documento: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ex: 12345/2026"
                  />
                </div>
              </div>

              {/* Órgão Emissor & Carga Horária */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Órgão Emissor / Instituição
                  </label>
                  <input
                    type="text"
                    value={newForm.orgao_emissor}
                    onChange={e => setNewForm(p => ({ ...p, orgao_emissor: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ex: MARINHA DO BRASIL"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Carga Horária (Horas)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newForm.carga_horaria}
                    onChange={e => setNewForm(p => ({ ...p, carga_horaria: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ex: 40"
                  />
                </div>
              </div>

              {/* Datas: Emissão e Validade */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Data de Conclusão / Emissão
                    </label>
                    <input
                      type="date"
                      value={newForm.data_emissao}
                      onChange={e => setNewForm(p => ({ ...p, data_emissao: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Data de Validade
                    </label>
                    <input
                      type="date"
                      disabled={newForm.permanente}
                      value={newForm.permanente ? '' : newForm.data_validade}
                      onChange={e => setNewForm(p => ({ ...p, data_validade: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </div>
                </div>

                {/* Checkbox Permanente */}
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={newForm.permanente}
                    onChange={e => setNewForm(p => ({ ...p, permanente: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-gray-700">
                    Treinamento Permanente / Sem Data de Expiração
                  </span>
                </label>
              </div>

              {/* Upload de Arquivo Opcional */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Arquivo do Certificado (PDF ou Imagem)
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl cursor-pointer transition text-xs text-gray-600 font-medium">
                    <FiPaperclip className="w-4 h-4 text-blue-600" />
                    <span>{newForm.file ? newForm.file.name : 'Selecionar arquivo PDF ou foto do certificado...'}</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) setNewForm(p => ({ ...p, file: f }));
                      }}
                    />
                  </label>
                  {newForm.file && (
                    <button
                      onClick={() => setNewForm(p => ({ ...p, file: null }))}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Remover arquivo"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNew}
                disabled={creatingNew}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <FiCheck className="w-4 h-4" />
                {creatingNew ? 'Cadastrando...' : 'Cadastrar Treinamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lista de Presença para Treinamento Interno */}
      <ModalListaPresencaTreinamento
        isOpen={showListaPresencaModal}
        onClose={() => setShowListaPresencaModal(false)}
        initialColaborador={
          colaboradorId
            ? {
                id: colaboradorId,
                nome_completo: colaborador?.nome_completo || 'Tripulante',
                cargo_nome: colaborador?.cargo_nome || '',
              }
            : null
        }
        onTreinamentoLancado={() => {
          onRefresh?.();
          fetchConformidade();
        }}
      />
    </div>
  );
}
