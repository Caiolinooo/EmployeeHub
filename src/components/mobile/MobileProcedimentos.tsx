'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BottomSheet from './BottomSheet';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type DocumentItem = {
  id?: string | number;
  title: string;
  description?: string | null;
  category?: string | null;
  language?: string | null;
  file: string;
  created_at?: string | null;
  updated_at?: string | null;
};

// Mesmas categorias exibidas na página desktop /procedimentos
const ALLOWED_CATEGORIES = ['Logística', 'Compras', 'RH', 'Procedimentos'];

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

export default function MobileProcedimentos() {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<DocumentItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: DocumentItem[] = Array.isArray(data) ? data : data.documents || data.data || [];
      setDocs(list.filter((d) => d.category && ALLOWED_CATEGORIES.includes(d.category)));
    } catch {
      setError('Não foi possível carregar os procedimentos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) =>
      [d.title, d.description, d.category, d.language]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [docs, query]);

  return (
    <MobileShell title="Procedimentos">
      <div className="flex flex-col gap-3" data-abz-mobile-procedimentos="">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar procedimento…"
          aria-label="Buscar procedimento"
          className="touch-target w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-base"
        />

        {error ? (
          <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
            {error}
            <TouchButton variant="ghost" className="mt-1" onClick={load}>
              Tentar de novo
            </TouchButton>
          </div>
        ) : null}

        {filtered.map((doc) => (
          <DataCard
            key={doc.id ?? doc.title}
            title={doc.title}
            subtitle={doc.description || undefined}
            meta={doc.category || undefined}
            onClick={() => setSelected(doc)}
          >
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              {formatDate(doc.updated_at || doc.created_at) ? (
                <span>{formatDate(doc.updated_at || doc.created_at)}</span>
              ) : null}
              {doc.language ? <span>{doc.language}</span> : null}
            </div>
          </DataCard>
        ))}

        {loading ? (
          <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
        ) : null}
        {!loading && filtered.length === 0 && !error ? (
          <p className="py-8 text-center text-sm text-gray-500">
            {query ? 'Nenhum procedimento encontrado.' : 'Documentos em preparação.'}
          </p>
        ) : null}
      </div>

      <BottomSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title || 'Procedimento'}
      >
        {selected ? (
          <div className="flex flex-col gap-3" data-abz-mobile-procedimentos-viewer="">
            {selected.description ? (
              <p className="text-sm text-gray-600">{selected.description}</p>
            ) : null}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {selected.category ? (
                <span className="abz-m-chip rounded-full px-2 py-0.5 font-medium">
                  {selected.category}
                </span>
              ) : null}
              {selected.language ? <span>{selected.language}</span> : null}
            </div>
            <iframe
              src={selected.file}
              title={selected.title}
              className="h-96 w-full rounded-xl border border-gray-200"
            />
            <TouchButton asChild variant="ghost" className="w-full justify-center">
              <a href={selected.file} download>
                Baixar PDF
              </a>
            </TouchButton>
            <TouchButton asChild variant="link" className="w-full justify-center">
              <a href={selected.file} target="_blank" rel="noreferrer">
                Abrir em nova aba
              </a>
            </TouchButton>
          </div>
        ) : null}
      </BottomSheet>
    </MobileShell>
  );
}
