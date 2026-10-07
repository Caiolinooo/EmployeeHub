'use client';

import React, { useMemo, useState } from 'react';
import { FiUpload, FiDownload, FiFile, FiAlertCircle, FiCheckCircle, FiClock, FiTrash2, FiArchive, FiEdit2, FiSave, FiX } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { uploadDocumentoGt } from '@/lib/gestao-tripulantes/upload-client';
import { toast } from 'react-hot-toast';
import { enviarOcrDocumento } from '@/components/gestao-tripulantes/ocr-client';
import { classificarValidadeCivil, documentoPertenceAba } from '@/lib/gestao-tripulantes/validade-civil';
import HistoricoColapsavel from '@/components/gestao-tripulantes/HistoricoColapsavel';
import { agruparDocumentosPorTipo } from '@/lib/gestao-tripulantes/documento-historico';
import {
  COLLABORATOR_MODAL_TAB_FILL_CLASS,
  COLLABORATOR_MODAL_TABLE_SCROLL_CLASS,
} from '@/components/gestao-tripulantes/collaborator-modal-layout';
import { useGtDocumentPermissions } from '@/components/gestao-tripulantes/use-gt-document-permissions';
import TituloDocumentoSelect from '@/components/gestao-tripulantes/TituloDocumentoSelect';
import {
  labelTipoDocumento,
  TIPOS_DOCUMENTO_UPLOAD_ABA,
  tipoInicialFormularioDocumento,
} from '@/lib/gestao-tripulantes/documento-tipos-ui';

interface Document {
  id: string;
  tipo_documento: string;
  subtipo?: string | null;
  titulo: string;
  descricao?: string | null;
  numero_documento: string;
  orgao_emissor: string;
  data_emissao: string;
  data_validade: string;
  status_validacao: string;
  ocr_status: string;
  arquivo_url: string;
  origem?: string | null;
  created_at?: string | null;
}

interface Props {
  colaboradorId: string;
  documentos: Document[];
  onRefresh?: () => void;
  highlightDocId?: string | null;
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  valido: FiCheckCircle,
  vencendo: FiClock,
  vencido: FiAlertCircle,
  pendente: FiClock,
};

const STATUS_COLORS: Record<string, string> = {
  valido: 'text-green-500',
  vencendo: 'text-orange-400',
  vencido: 'text-red-500',
  pendente: 'text-yellow-500',
};

const TIPO_COLORS: Record<string, string> = {
  pessoal: 'bg-blue-50 border-blue-200',
  contratual: 'bg-green-50 border-green-200',
  demissional: 'bg-red-50 border-red-200',
  ferias: 'bg-cyan-50 border-cyan-200',
  ponto: 'bg-purple-50 border-purple-200',
  certificado: 'bg-yellow-50 border-yellow-200',
};

export default function DocumentosTab({ colaboradorId, documentos, onRefresh, highlightDocId }: Props) {
  const { t } = useI18n();
  const { canEdit, canDelete } = useGtDocumentPermissions();
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    tipo_documento: 'pessoal',
    titulo: '',
    numero_documento: '',
    orgao_emissor: '',
    data_emissao: '',
    data_validade: '',
  });
  const [newTipo, setNewTipo] = useState('pessoal');
  const [ocrRunning, setOcrRunning] = useState<string | null>(null);
  const [newTitulo, setNewTitulo] = useState('');
  const [historicoAberto, setHistoricoAberto] = useState<Record<string, boolean>>({});

  const grupos = useMemo(() => {
    const outros = documentos.filter(d => documentoPertenceAba(d.tipo_documento, 'documentos'));
    return agruparDocumentosPorTipo(outros);
  }, [documentos]);

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!newTitulo.trim()) {
      toast.error('Informe o título do documento antes de fazer upload');
      e.target.value = '';
      return;
    }
    try {
      setUploading(true);
      const json = await uploadDocumentoGt({
        file,
        colaboradorId,
        tipoDocumento: newTipo,
        titulo: newTitulo.trim(),
      });
      if (json.merged) {
        toast('Documento idêntico já existia — o registro anterior foi atualizado (sem duplicação)', { icon: 'ℹ️' });
      } else {
        toast.success(t('gestaoTripulantes.upload.success'));
      }
      setNewTitulo('');
      onRefresh?.();
      const docId = json.data?.id as string | undefined;
      const arquivoUrl = json.data?.arquivo_url as string | undefined;
      if (docId) {
        setOcrRunning(docId);
        enviarOcrDocumento(docId, arquivoUrl)
          .then(() => onRefresh?.())
          .catch(() => onRefresh?.())
          .finally(() => setOcrRunning(null));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error && err.message ? err.message : t('gestaoTripulantes.upload.error'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm(t('gestaoTripulantes.documents.confirmDelete'))) return;
    try {
      setDeletingId(docId);
      const res = await fetchWithToken(`/api/gestao-tripulantes/documentos/${docId}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Falha ao excluir');
      toast.success('Documento excluído');
      onRefresh?.();
    } catch {
      toast.error(t('gestaoTripulantes.errors.deleteError'));
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = (doc: Document) => {
    setEditingId(doc.id);
    setEditForm({
      tipo_documento: tipoInicialFormularioDocumento(doc.tipo_documento),
      titulo: doc.titulo || '',
      numero_documento: doc.numero_documento || '',
      orgao_emissor: doc.orgao_emissor || '',
      data_emissao: (doc.data_emissao || '').slice(0, 10),
      data_validade: (doc.data_validade || '').slice(0, 10),
    });
  };

  const handleSaveEdit = async (docId: string) => {
    try {
      setSaving(true);
      const res = await fetchWithToken(`/api/gestao-tripulantes/documentos/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_documento: editForm.tipo_documento,
          titulo: editForm.titulo.trim() || null,
          numero_documento: editForm.numero_documento.trim() || null,
          orgao_emissor: editForm.orgao_emissor.trim() || null,
          data_emissao: editForm.data_emissao || null,
          data_validade: editForm.data_validade || null,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Falha ao salvar');
      toast.success('Documento atualizado');
      setEditingId(null);
      onRefresh?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={COLLABORATOR_MODAL_TAB_FILL_CLASS}>
      {/* Upload area — visível apenas para quem pode editar documentos */}
      {canEdit ? (
      <div className="p-4 bg-gray-50/70 border-b border-gray-100 shrink-0">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 font-medium mb-1">Tipo do Documento</label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={newTipo}
              onChange={e => { setNewTipo(e.target.value); setNewTitulo(''); }}
            >
              {TIPOS_DOCUMENTO_UPLOAD_ABA.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 font-medium mb-1">Título</label>
            <TituloDocumentoSelect tipo={newTipo} value={newTitulo} onChange={setNewTitulo} disabled={uploading} />
          </div>
          <label className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-800 transition ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            <FiUpload className="w-3.5 h-3.5" />
            {uploading ? t('gestaoTripulantes.upload.uploading') : ocrRunning ? 'OCR…' : t('gestaoTripulantes.documents.uploadDocument')}
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      </div>
      ) : (
        <div className="p-3 bg-gray-50/70 border-b border-gray-100 shrink-0 text-xs text-gray-400">
          Somente leitura — você não tem permissão para incluir documentos.
        </div>
      )}

      <div className={COLLABORATOR_MODAL_TABLE_SCROLL_CLASS}>
      {grupos.length === 0 ? (
        <div className="p-12 text-center">
          <FiFile className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">{t('gestaoTripulantes.common.noResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {grupos.map(grupo => {
            const doc = grupo.primary;
            const alerta = classificarValidadeCivil(doc.data_validade);
            const statusKey = alerta === 'sem_validade' ? (doc.status_validacao || 'pendente') : alerta;
            const StatusIcon = STATUS_ICONS[statusKey] || FiFile;
            return (
              <div
                id={`gt-doc-${doc.id}`}
                key={grupo.key}
                className={`border rounded-xl overflow-hidden hover:shadow-md transition-shadow ${TIPO_COLORS[doc.tipo_documento] || 'bg-gray-50 border-gray-200'} ${
                  highlightDocId === doc.id ? 'ring-2 ring-red-400' : ''
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    {editingId === doc.id ? (
                      <select
                        aria-label="Tipo do Documento"
                        className="min-w-0 flex-1 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={editForm.tipo_documento}
                        onChange={(e) => setEditForm((f) => ({ ...f, tipo_documento: e.target.value }))}
                      >
                        {TIPOS_DOCUMENTO_UPLOAD_ABA.map((opcao) => (
                          <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                        ))}
                        {!TIPOS_DOCUMENTO_UPLOAD_ABA.some((opcao) => opcao.value === editForm.tipo_documento) && (
                          <option value={editForm.tipo_documento}>{editForm.tipo_documento}</option>
                        )}
                      </select>
                    ) : (
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{labelTipoDocumento(doc.tipo_documento)}</span>
                    )}
                    <StatusIcon className={`w-4 h-4 shrink-0 ${STATUS_COLORS[statusKey] || 'text-gray-400'}`} />
                  </div>
                  <p className="font-semibold text-gray-800 text-sm mb-1 line-clamp-2">{doc.titulo}</p>
                  {editingId === doc.id ? (
                    <div className="space-y-2 mb-2">
                      <input
                        className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1"
                        value={editForm.titulo}
                        onChange={(e) => setEditForm((f) => ({ ...f, titulo: e.target.value }))}
                        placeholder="Título"
                      />
                      <input
                        className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1"
                        value={editForm.numero_documento}
                        onChange={(e) => setEditForm((f) => ({ ...f, numero_documento: e.target.value }))}
                        placeholder="Número"
                      />
                      <input
                        className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1"
                        value={editForm.orgao_emissor}
                        onChange={(e) => setEditForm((f) => ({ ...f, orgao_emissor: e.target.value }))}
                        placeholder="Órgão emissor"
                      />
                      <div className="grid grid-cols-2 gap-1">
                        <input
                          type="date"
                          className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1"
                          value={editForm.data_emissao}
                          onChange={(e) => setEditForm((f) => ({ ...f, data_emissao: e.target.value }))}
                        />
                        <input
                          type="date"
                          className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1"
                          value={editForm.data_validade}
                          onChange={(e) => setEditForm((f) => ({ ...f, data_validade: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleSaveEdit(doc.id)}
                          disabled={saving}
                          className="flex items-center gap-1 px-2 py-1 text-[11px] text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          <FiSave className="w-3 h-3" /> Salvar
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-600 border border-gray-300 rounded"
                        >
                          <FiX className="w-3 h-3" /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                  {doc.numero_documento && (
                    <p className="text-xs text-gray-400 mb-2">Nº {doc.numero_documento}</p>
                  )}
                    </>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <p className="text-xs text-gray-400">Validade</p>
                      <p className="text-xs font-medium text-gray-700">{formatDate(doc.data_validade)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {doc.arquivo_url && (
                        <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition">
                          <FiDownload className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {canEdit && editingId !== doc.id && (
                        <button
                          onClick={() => startEditing(doc)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition"
                          title="Editar"
                        >
                          <FiEdit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded transition disabled:opacity-50"
                        title="Excluir"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                      )}
                    </div>
                  </div>
                </div>
                <HistoricoColapsavel
                  count={grupo.historico.length}
                  expanded={!!historicoAberto[grupo.key]}
                  onToggle={() => setHistoricoAberto((prev) => ({ ...prev, [grupo.key]: !prev[grupo.key] }))}
                >
                  {grupo.historico.map((hist) => (
                    <div key={hist.id} className="px-4 py-2 border-t border-slate-200 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{hist.titulo}</p>
                        <p className="text-[11px] text-slate-500">
                          {formatDate(hist.data_emissao)} → {formatDate(hist.data_validade)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <FiArchive className="w-3 h-3" /> Obsoleto
                        </span>
                        {hist.arquivo_url && (
                          <a href={hist.arquivo_url} target="_blank" rel="noopener noreferrer"
                            className="p-1 text-gray-400 hover:text-blue-600 rounded transition"
                            title="Baixar versão anterior">
                            <FiDownload className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </HistoricoColapsavel>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}

