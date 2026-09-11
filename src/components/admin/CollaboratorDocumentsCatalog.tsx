'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiDownload, FiExternalLink, FiFileText, FiRefreshCw, FiShield,
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useI18n } from '@/contexts/I18nContext';
import { isQhseCatalogDocument } from '@/lib/document-catalog/qhse';
import type { CatalogDocument, CatalogDocCategory, DocumentCatalogSourceId } from '@/lib/document-catalog/types';

interface CatalogResponse {
  success: boolean;
  identity?: {
    userId: string | null;
    colaboradorId: string | null;
    fullName: string | null;
    matchedByCpf: boolean;
    matchedByEmail: boolean;
  };
  documents?: CatalogDocument[];
  sources?: Array<{ id: DocumentCatalogSourceId; label: string; count: number }>;
  total?: number;
  error?: string;
}

interface Props {
  userId?: string | null;
  colaboradorId?: string | null;
  excludeSources?: DocumentCatalogSourceId[];
  compact?: boolean;
  /** Ficha AN-HSE-005, entregas EPI e listas de presença QHSE. Never ASO/laudo. */
  onlyQhse?: boolean;
  /** Omit QHSE items (used by the generic Documentos tab). */
  hideQhse?: boolean;
}

const CATEGORY_LABEL: Record<CatalogDocCategory, string> = {
  qhse: 'QHSE',
  gt: 'Tripulantes',
  rh: 'RH',
  academy: 'Academia',
  contratos: 'Contratos',
  identidade: 'Identidade',
};

const CATEGORY_BADGE: Record<CatalogDocCategory, string> = {
  qhse: 'bg-amber-100 text-amber-800',
  gt: 'bg-blue-100 text-blue-800',
  rh: 'bg-slate-100 text-slate-700',
  academy: 'bg-violet-100 text-violet-800',
  contratos: 'bg-emerald-100 text-emerald-800',
  identidade: 'bg-gray-100 text-gray-700',
};

export default function CollaboratorDocumentsCatalog({
  userId,
  colaboradorId,
  excludeSources = [],
  compact = false,
  onlyQhse = false,
  hideQhse = false,
}: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<CatalogResponse | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    if (!userId && !colaboradorId) return;
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      if (colaboradorId) params.set('colaboradorId', colaboradorId);
      if (onlyQhse) params.set('qhse', '1');
      const res = await fetchWithToken(`/api/document-catalog?${params.toString()}`);
      const json = (await res.json()) as CatalogResponse;
      if (!res.ok || json.error) {
        setError(json.error || t('documentCatalog.error', 'Erro ao carregar documentos'));
        setPayload(null);
        return;
      }
      setPayload(json);
    } catch {
      setError(t('documentCatalog.error', 'Erro ao carregar documentos'));
    } finally {
      setLoading(false);
    }
  }, [userId, colaboradorId, onlyQhse, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const scopedDocuments = useMemo(() => {
    const all = payload?.documents || [];
    const excluded = new Set(excludeSources);
    return all.filter((doc) => {
      if (excluded.has(doc.source)) return false;
      const qhseDoc = isQhseCatalogDocument(doc);
      if (onlyQhse && !qhseDoc) return false;
      if (hideQhse && qhseDoc) return false;
      return true;
    });
  }, [payload, excludeSources, onlyQhse, hideQhse]);

  const documents = useMemo(() => {
    return scopedDocuments.filter((doc) => {
      if (filter === 'all') return true;
      if (filter === 'qhse') return isQhseCatalogDocument(doc);
      return doc.source === filter;
    });
  }, [scopedDocuments, filter]);

  const sourceTabs = useMemo(() => {
    const counts = new Map<DocumentCatalogSourceId, { id: DocumentCatalogSourceId; label: string; count: number }>();
    for (const doc of scopedDocuments) {
      const prev = counts.get(doc.source);
      if (prev) {
        prev.count += 1;
      } else {
        counts.set(doc.source, { id: doc.source, label: doc.sourceLabel, count: 1 });
      }
    }
    return Array.from(counts.values());
  }, [scopedDocuments]);

  const handleDownload = async (doc: CatalogDocument) => {
    if (doc.downloadKind === 'url' && doc.downloadUrl) {
      window.open(doc.downloadUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (doc.downloadKind === 'open' && doc.moduleHref) {
      window.open(doc.moduleHref, '_blank', 'noopener,noreferrer');
      return;
    }
    const href = doc.downloadApi;
    if (!href) return;
    const res = await fetchWithToken(href);
    if (res.redirected) {
      window.open(res.url, '_blank', 'noopener,noreferrer');
      return;
    }
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      return;
    }
    if (contentType.includes('application/json')) {
      const json = await res.json().catch(() => null) as { open?: string } | null;
      if (json?.open) window.open(json.open, '_blank', 'noopener,noreferrer');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/[^\w\-]+/g, '_')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!userId && !colaboradorId) return null;

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {!compact && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              {onlyQhse ? <FiShield className="text-amber-600" /> : <FiFileText className="text-abz-blue" />}
              {onlyQhse
                ? t('documentCatalog.qhseTitle', 'QHSE / EPI')
                : t('documentCatalog.title', 'Documentos do colaborador')}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {onlyQhse
                ? t('documentCatalog.qhseSubtitle', 'Ficha de EPI (AN-HSE-005), entregas e listas de presença QHSE. Exames ocupacionais (ASO/laudo) ficam na aba ASO.')
                : t('documentCatalog.subtitle', 'GT, QHSE/EPI, listas de presença assinadas e outros módulos — reconhecidos automaticamente por CPF, usuário e e-mail.')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="p-2 text-gray-500 hover:text-abz-blue rounded-lg hover:bg-gray-50"
            title={t('common.refresh', 'Atualizar')}
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      )}

      {payload?.identity && (
        <p className="text-xs text-gray-400">
          {payload.identity.fullName || '—'}
          {payload.identity.matchedByCpf ? ' · CPF' : ''}
          {payload.identity.matchedByEmail ? ' · e-mail' : ''}
          {payload.identity.colaboradorId ? ' · GT' : ''}
        </p>
      )}

      {!onlyQhse && (
        <div className="flex flex-wrap gap-2">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            {t('documentCatalog.all', 'Todos')} ({scopedDocuments.length})
          </FilterChip>
          {!hideQhse && (
            <FilterChip active={filter === 'qhse'} onClick={() => setFilter('qhse')}>
              <FiShield className="inline mr-1" /> QHSE / EPI
            </FilterChip>
          )}
          {sourceTabs.map((src) => (
            <FilterChip key={src.id} active={filter === src.id} onClick={() => setFilter(src.id)}>
              {src.label} ({src.count})
            </FilterChip>
          ))}
        </div>
      )}

      {loading && (
        <div className="py-8 text-center text-sm text-gray-500">
          {t('documentCatalog.loading', 'Carregando documentos...')}
        </div>
      )}
      {error && !loading && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {!loading && !error && documents.length === 0 && (
        <p className="text-sm text-gray-500 py-4">
          {onlyQhse
            ? t('documentCatalog.qhseEmpty', 'Nenhum documento QHSE/EPI encontrado para este colaborador.')
            : t('documentCatalog.empty', 'Nenhum documento encontrado para este colaborador.')}
        </p>
      )}

      {!loading && documents.length > 0 && (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${CATEGORY_BADGE[doc.category]}`}>
                    {CATEGORY_LABEL[doc.category]}
                  </span>
                  {doc.signed && (
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-green-100 text-green-800">
                      {t('documentCatalog.signed', 'Assinado')}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{doc.sourceLabel}</span>
                </div>
                <p className="text-sm font-medium text-gray-900 truncate mt-0.5">{doc.title}</p>
                {doc.subtitle && <p className="text-xs text-gray-500 truncate">{doc.subtitle}</p>}
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {doc.issuedAt ? new Date(doc.issuedAt).toLocaleDateString('pt-BR') : '—'}
                  {doc.status ? ` · ${doc.status}` : ''}
                  {doc.matchBy.length > 0 ? ` · ${doc.matchBy.join(', ')}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {doc.moduleHref && (
                  <a
                    href={doc.moduleHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-abz-blue rounded-lg"
                    title={t('documentCatalog.openModule', 'Abrir módulo')}
                  >
                    <FiExternalLink />
                  </a>
                )}
                {(doc.downloadKind === 'url' || doc.downloadKind === 'api' || doc.downloadKind === 'open') && (
                  <button
                    type="button"
                    onClick={() => void handleDownload(doc)}
                    className="p-2 text-gray-400 hover:text-abz-blue rounded-lg"
                    title={t('documentCatalog.download', 'Baixar')}
                  >
                    <FiDownload />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition ${
        active
          ? 'bg-abz-blue text-white border-abz-blue'
          : 'bg-white text-gray-600 border-gray-200 hover:border-abz-blue'
      }`}
    >
      {children}
    </button>
  );
}
