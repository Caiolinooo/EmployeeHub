'use client';

import React, { useEffect, useState } from 'react';
import { FiAnchor, FiX } from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useI18n } from '@/contexts/I18nContext';

interface MultiEmbarcacaoFilterProps {
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

/**
 * R8: chips multi-select de embarcação (substitui o tag único `embarcacao`).
 * Fonte: GET /api/gestao-tripulantes/embarcacoes. Query final: `embarcacoes=csv`.
 * Touch targets ≥ 44px (R9).
 */
export default function MultiEmbarcacaoFilter({
  selected,
  onChange,
  className,
}: MultiEmbarcacaoFilterProps) {
  const { t } = useI18n();
  const [opcoes, setOpcoes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetchWithToken('/api/gestao-tripulantes/embarcacoes');
        const json = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const rows = Array.isArray(json.data) ? json.data : [];
        const nomes = rows
          .map((r: { nome?: string }) => String(r?.nome || '').trim())
          .filter(Boolean)
          .sort((a: string, b: string) => a.localeCompare(b, 'pt-BR'));
        if (!cancelled) setOpcoes(nomes);
      } catch {
        // fail-soft: chips ficam vazios, filtro manual continua possível
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (nome: string) => {
    if (selected.includes(nome)) {
      onChange(selected.filter((s) => s !== nome));
    } else {
      onChange([...selected, nome]);
    }
  };

  const chipBase =
    'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition select-none';

  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        <FiAnchor className="w-3.5 h-3.5 text-abz-blue" />
        {t('gtFechV2.filtro.embarcacoes', 'Embarcações')}
        {selected.length > 0 && (
          <span className="rounded-full bg-abz-blue px-2 py-0.5 text-[10px] font-bold text-white">
            {selected.length}
          </span>
        )}
        {isLoading && <span className="font-normal normal-case text-slate-400">…</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange([])}
          className={`${chipBase} ${
            selected.length === 0
              ? 'border-abz-blue bg-abz-blue text-white shadow-sm'
              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {t('gtFechV2.filtro.embarcacoesTodas', 'Todas')}
          {selected.length > 0 && <FiX className="w-3 h-3" aria-hidden />}
        </button>
        {opcoes.map((nome) => {
          const ativo = selected.includes(nome);
          return (
            <button
              key={nome}
              type="button"
              aria-pressed={ativo}
              onClick={() => toggle(nome)}
              className={`${chipBase} max-w-[220px] ${
                ativo
                  ? 'border-abz-blue bg-abz-blue text-white shadow-sm'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              title={nome}
            >
              <span className="truncate">{nome}</span>
            </button>
          );
        })}
        {opcoes.length === 0 && !isLoading && (
          <span className="self-center text-[11px] text-slate-400">
            {t('gtFechV2.filtro.embarcacoesVazia', 'Nenhuma embarcação cadastrada.')}
          </span>
        )}
      </div>
    </div>
  );
}
