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

// Mesmas categorias exibidas na página desktop /politicas
const ALLOWED_CATEGORIES = ['HSE', 'Qualidade', 'Políticas'];

// Fallback idêntico ao desktop quando a API não retorna documentos
const FALLBACK_POLICIES: DocumentItem[] = [
  {
    id: 'hse-pt',
    title: 'Política de HSE',
    description: 'Diretrizes de Saúde, Segurança e Meio Ambiente do ABZ Group',
    language: 'Português',
    category: 'HSE',
    file: '/documentos/politicas/PL-HSE-R0 - Política de HSE_ABZ Group-PORT.pdf',
  },
  {
    id: 'qua-pt',
    title: 'Política da Qualidade',
    description: 'Política de Qualidade e Gestão do ABZ Group',
    language: 'Português',
    category: 'Qualidade',
    file: '/documentos/politicas/PL-QUA-R8 - Politica da Qualidade_ABZ Group-PORT.pdf',
  },
  {
    id: 'qua-en',
    title: 'Quality Policy',
    description: 'ABZ Group Quality Management Policy',
    language: 'English',
    category: 'Qualidade',
    file: '/documentos/politicas/PL-QUA-a-R8 - Quality Policy_ABZ Group-ENG.pdf',
  },
];

const FILTERS = ['Todas', 'HSE', 'Qualidade'] as const;

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

export default function MobilePoliticas() {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Todas');
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
      setError('Não foi possível carregar as políticas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const source = docs.length ? docs : FALLBACK_POLICIES;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return source.filter((d) => {
      if (filter !== 'Todas' && d.category !== filter) return false;
      if (!q) return true;
      return [d.title, d.description, d.category, d.language]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [source, query, filter]);

  return (
    <MobileShell title="Políticas">
      <div className="flex flex-col gap-3" data-abz-mobile-politicas="">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar política…"
          aria-label="Buscar política"
          className="touch-target w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-base"
        />

        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <TouchButton
              key={f}
              variant={filter === f ? 'primary' : 'ghost'}
              className="px-3 text-sm"
              onClick={() => setFilter(f)}
            >
              {f}
            </TouchButton>
          ))}
        </div>

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
            Nenhuma política encontrada.
          </p>
        ) : null}
      </div>

      <BottomSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title || 'Política'}
      >
        {selected ? (
          <div className="flex flex-col gap-3" data-abz-mobile-politicas-viewer="">
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
