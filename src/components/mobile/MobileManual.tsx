'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FiExternalLink } from 'react-icons/fi';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type ManualDocument = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  language?: string | null;
  file?: string | null;
  enabled?: boolean;
  order?: number;
};

export default function MobileManual() {
  const [docs, setDocs] = useState<ManualDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/documents?category=' + encodeURIComponent('Manual'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: ManualDocument[] = (Array.isArray(data) ? data : [])
        .filter((d) => d.enabled !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      setDocs(list);
    } catch {
      setError('Não foi possível carregar os documentos do manual.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <MobileShell title="Manual do Colaborador">
      <div className="flex flex-col gap-3" data-abz-mobile-manual="">
        {error ? (
          <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
            {error}
            <TouchButton variant="ghost" className="mt-1" onClick={load}>
              Tentar de novo
            </TouchButton>
          </div>
        ) : null}

        {docs.map((doc) => (
          <DataCard
            key={doc.id}
            title={doc.title}
            subtitle={doc.description || undefined}
            meta={doc.language || undefined}
          >
            {doc.file ? (
              <div className="mt-3">
                <TouchButton asChild>
                  <a href={doc.file} target="_blank" rel="noopener noreferrer">
                    <FiExternalLink aria-hidden className="mr-2 h-4 w-4" />
                    Abrir documento
                  </a>
                </TouchButton>
              </div>
            ) : null}
          </DataCard>
        ))}

        {!loading && docs.length === 0 && !error ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Nenhum documento disponível no momento.
          </p>
        ) : null}

        {loading ? (
          <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
        ) : null}
      </div>
    </MobileShell>
  );
}
