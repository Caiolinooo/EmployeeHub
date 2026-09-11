'use client';

import React, { useMemo, useState } from 'react';
import { FiUpload, FiDownload, FiGlobe, FiEdit2, FiSave, FiX, FiRefreshCw, FiArchive, FiTrash2 } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
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

function DaysToExpiry({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return null;
  const diff = Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (diff < 0) return <span className="text-xs text-red-600 font-semibold">Vencido há {Math.abs(diff)} dias</span>;
  if (diff <= 90) return <span className="text-xs text-orange-500 font-semibold">Vence em {diff} dias</span>;
  return <span className="text-xs text-gray-400">{new Date(dateStr).toLocaleDateString('pt-BR')}</span>;
}

export default function PassaportesTab({ colaboradorId, documentos, onRefresh, highlightDocId }: Props) {
  const { t } = useI18n();
  const { canEdit, canDelete } = useGtDocumentPermissions();
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ numero_documento: '', orgao_emissor: '', data_emissao: '', data_validade: '' });
  const [saving, setSaving] = useState(false);
  const [ocrRunning, setOcrRunning] = useState<string | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState<Record<string, boolean>>({});

  const grupos = useMemo(
    () => agruparDocumentosPorTipo(documentos.filter(d => documentoPertenceAba(d.tipo_documento, 'passaportes'))),
    [documentos],
  );

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
  };

  const toDateInput = (d: string | null | undefined) => (d ? String(d).slice(0, 10) : '');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('colaborador_id', colaboradorId);
      fd.append('tipo_documento', 'passaporte');
      fd.append('titulo', 'Passaporte');

      const res = await fetchWithToken('/api/gestao-tripulantes/documentos/upload', {
        method: 'POST',
        body: fd,
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.error || 'Upload falhou');
      }

      toast.success(t('gestaoTripulantes.upload.success'));
      onRefresh?.();

      const docId = result.data?.id as string | undefined;
      const arquivoUrl = result.data?.arquivo_url as string | undefined;
      if (docId) {
        void handleRunOcr(docId, arquivoUrl);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('gestaoTripulantes.upload.error');
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRunOcr = async (docId: string, arquivoUrl?: string) => {
    try {
      setOcrRunning(docId);
      toast.loading('OCR em andamento…', { id: `ocr-${docId}` });
      const res = await enviarOcrDocumento(docId, arquivoUrl);
      const json = await res.json().catch(() => ({}));
      toast.dismiss(`ocr-${docId}`);
      if (!res.ok) {
        toast.error(json.error || 'OCR não extraiu dados — preencha manualmente');
        onRefresh?.();
        return;
      }
      toast.success('OCR processado. Revise os campos se necessário.');
      onRefresh?.();
    } catch {
      toast.dismiss(`ocr-${docId}`);
      toast.error('Erro ao processar OCR — preencha os campos manualmente');
      onRefresh?.();
    } finally {
      setOcrRunning(null);
    }
  };

  const startEditing = (doc: Document) => {
    setEditingId(doc.id);
    setEditForm({
      numero_documento: doc.numero_documento || '',
      orgao_emissor: doc.orgao_emissor || '',
      data_emissao: toDateInput(doc.data_emissao),
      data_validade: toDateInput(doc.data_validade),
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (docId: string) => {
    try {
      setSaving(true);
      const payload = {
        numero_documento: editForm.numero_documento || null,
        orgao_emissor: editForm.orgao_emissor || null,
        data_emissao: editForm.data_emissao || null,
        data_validade: editForm.data_validade || null,
      };
      const res = await fetchWithToken(`/api/gestao-tripulantes/documentos/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Falha ao salvar');
      toast.success('Passaporte atualizado!');
      setEditingId(null);
      onRefresh?.();
    } catch {
      toast.error('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Excluir este passaporte do cadastro?')) return;
    try {
      setDeletingId(docId);
      const res = await fetchWithToken(`/api/gestao-tripulantes/documentos/${docId}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Falha ao excluir');
      toast.success('Passaporte excluído');
      onRefresh?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir passaporte');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={`${COLLABORATOR_MODAL_TAB_FILL_CLASS} divide-y divide-gray-100`}>
      {/* Upload bar */}
      <div className="p-4 flex items-center justify-between bg-gray-50/70 shrink-0">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FiGlobe className="text-indigo-500" />
          <span>{grupos.length} passaporte(s) cadastrado(s)</span>
        </div>
        <label className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg cursor-pointer hover:bg-indigo-700 transition ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          <FiUpload className="w-3.5 h-3.5" />
          {uploading ? t('gestaoTripulantes.upload.uploading') : t('gestaoTripulantes.passports.uploadPassport')}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleUpload} />
        </label>
      </div>

      <div className={COLLABORATOR_MODAL_TABLE_SCROLL_CLASS}>
      {grupos.length === 0 ? (
        <div className="p-12 text-center">
          <FiGlobe className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">{t('gestaoTripulantes.passports.noPassports')}</p>
        </div>
      ) : (
        grupos.map(grupo => {
          const doc = grupo.primary;
          return (
          <div key={grupo.key} id={`gt-doc-${doc.id}`}>
          <div className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${highlightDocId === doc.id ? 'ring-2 ring-red-400 bg-red-50/40' : ''}`}>
            {/* Passport icon area */}
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <FiGlobe className="w-5 h-5 text-indigo-600" />
            </div>

            <div className="flex-1 min-w-0">
              {editingId === doc.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Nº do Passaporte</label>
                      <input
                        className="w-full text-sm bg-white border border-gray-200 rounded px-2 py-1"
                        value={editForm.numero_documento}
                        onChange={e => setEditForm(f => ({ ...f, numero_documento: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Órgão Emissor</label>
                      <input
                        className="w-full text-sm bg-white border border-gray-200 rounded px-2 py-1"
                        value={editForm.orgao_emissor}
                        onChange={e => setEditForm(f => ({ ...f, orgao_emissor: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Data de Emissão</label>
                      <input
                        type="date"
                        className="w-full text-sm bg-white border border-gray-200 rounded px-2 py-1"
                        value={editForm.data_emissao}
                        onChange={e => setEditForm(f => ({ ...f, data_emissao: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Data de Validade</label>
                      <input
                        type="date"
                        className="w-full text-sm bg-white border border-gray-200 rounded px-2 py-1"
                        value={editForm.data_validade}
                        onChange={e => setEditForm(f => ({ ...f, data_validade: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleSaveEdit(doc.id)}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      <FiSave className="w-3 h-3" /> {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="flex items-center gap-1 px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      <FiX className="w-3 h-3" /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-semibold text-gray-800 text-sm">{doc.titulo}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-500">Nº {doc.numero_documento || '—'}</span>
                    {doc.orgao_emissor && <span className="text-xs text-gray-400">• {doc.orgao_emissor}</span>}
                    <span className="text-xs text-gray-400">Emissão: {formatDate(doc.data_emissao)}</span>
              {doc.ocr_status === 'pendente' && (
                      <span className="text-xs text-yellow-600 font-medium">• OCR pendente</span>
                    )}
                    {ocrRunning === doc.id && (
                      <span className="text-xs text-indigo-600 font-medium">• OCR em andamento</span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <DaysToExpiry dateStr={doc.data_validade} />
              <StatusBadge status={classificarValidadeCivil(doc.data_validade) === 'sem_validade' ? (doc.status_validacao || 'pendente') : classificarValidadeCivil(doc.data_validade)} />
              {(doc.ocr_status === 'pendente' || doc.ocr_status === 'erro' || ocrRunning === doc.id) && (
                <button
                  onClick={() => handleRunOcr(doc.id, doc.arquivo_url)}
                  disabled={ocrRunning === doc.id}
                  className="p-1.5 text-gray-400 hover:text-purple-600 rounded transition"
                  title="Processar OCR"
                >
                  <FiRefreshCw className={`w-4 h-4 ${ocrRunning === doc.id ? 'animate-spin' : ''}`} />
                </button>
              )}
              {doc.arquivo_url && (
                <a
                  href={doc.arquivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-gray-400 hover:text-indigo-600 rounded transition"
                >
                  <FiDownload className="w-4 h-4" />
                </a>
              )}
              {editingId !== doc.id && canEdit && (
                <button
                  onClick={() => startEditing(doc)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition"
                  title="Editar"
                >
                  <FiEdit2 className="w-4 h-4" />
                </button>
              )}
              {editingId !== doc.id && canDelete && (
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded transition disabled:opacity-50"
                  title="Excluir"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <HistoricoColapsavel
            count={grupo.historico.length}
            expanded={!!historicoAberto[grupo.key]}
            onToggle={() => setHistoricoAberto((prev) => ({ ...prev, [grupo.key]: !prev[grupo.key] }))}
          >
            {grupo.historico.map((hist) => (
              <div key={hist.id} className="flex items-center gap-4 px-5 py-2.5 bg-slate-50">
                <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <FiArchive className="w-4 h-4 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{hist.titulo}</p>
                  <p className="text-xs text-slate-500">
                    Nº {hist.numero_documento || '—'} · {formatDate(hist.data_emissao)} → {formatDate(hist.data_validade)}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Obsoleto</span>
                {hist.arquivo_url && (
                  <a
                    href={hist.arquivo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-indigo-600 rounded transition"
                    title="Baixar versão anterior"
                  >
                    <FiDownload className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </HistoricoColapsavel>
          </div>
          );
        })
      )}
      </div>
    </div>
  );
}
