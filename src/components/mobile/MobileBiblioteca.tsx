'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiSearch } from 'react-icons/fi';
import DataCard from './DataCard';
import MobileShell from './MobileShell';
import TouchButton from './TouchButton';

type LibraryItem = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  type?: 'video' | 'image' | 'pdf' | 'document' | 'text' | 'link' | string | null;
  created_at?: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  video: 'Vídeo',
  image: 'Imagem',
  pdf: 'PDF',
  document: 'Documento',
  text: 'Texto',
  link: 'Link',
};

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

export default function MobileBiblioteca() {
  const router = useRouter();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/library/items');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setError('Não foi possível carregar a biblioteca.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      item.title?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q),
    );
  }, [items, searchQuery]);

  return (
    <MobileShell title="Biblioteca">
      <div className="flex flex-col gap-3" data-abz-mobile-biblioteca="">
        <div className="relative">
          <FiSearch
            aria-hidden
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Buscar documentos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-12 pr-4 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-[#005B96] focus:outline-none"
          />
        </div>

        {error ? (
          <div className="abz-m-alert-error rounded-xl p-3 text-sm" role="alert">
            {error}
            <TouchButton variant="ghost" className="mt-1" onClick={load}>
              Tentar de novo
            </TouchButton>
          </div>
        ) : null}

        {filteredItems.map((item) => (
          <DataCard
            key={item.id}
            title={item.title}
            subtitle={item.description || undefined}
            meta={formatDate(item.created_at)}
            onClick={() => router.push(`/biblioteca/${item.slug}`)}
          >
            {item.type ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <span className="abz-m-chip rounded-full px-2 py-0.5 font-medium">
                  {TYPE_LABELS[item.type] || item.type}
                </span>
              </div>
            ) : null}
          </DataCard>
        ))}

        {!loading && filteredItems.length === 0 && !error ? (
          <p className="py-8 text-center text-sm text-gray-500">
            {searchQuery
              ? `Nenhum item encontrado para "${searchQuery}".`
              : 'A biblioteca está vazia no momento.'}
          </p>
        ) : null}

        {loading ? (
          <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
        ) : null}
      </div>
    </MobileShell>
  );
}
