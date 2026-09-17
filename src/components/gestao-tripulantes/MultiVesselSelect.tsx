'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronDown, FiSearch, FiX } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { getToken } from '@/lib/tokenStorage';

/**
 * R8 — filtro multi-seleção de embarcações do Man Schedule (aba GT + /department/man-schedule).
 * Opções vêm de GET /api/gestao-tripulantes/embarcacoes mescladas com as embarcações
 * presentes nos dados carregados (dataVessels). Seleção = Set<string> de nomes exatos
 * (trim); matching via vesselMatchesSelection. Chips aparecem no controle e o banner
 * do cabeçalho da grade lista as selecionadas (formatVesselHeaderName).
 */

export function vesselMatchesSelection(vessel: string | null | undefined, selected: Set<string>): boolean {
    if (!selected || selected.size === 0) return true;
    const v = (vessel || '').trim().toLowerCase();
    if (!v) return false;
    // Case-insensitive (semântica do antigo filtro single): a grade mistura nomes
    // do catálogo (gt_embarcacoes.nome) com texto livre (local_desembarque).
    for (const s of selected) {
        if (s.trim().toLowerCase() === v) return true;
    }
    return false;
}

/** Nome composto exibido na primeira linha do cabeçalho da grade. */
export function formatVesselHeaderName(
    selected: Set<string>,
    company: string,
    allLabel: string,
    maxListed = 3,
): string {
    const vessels = Array.from(selected || []).filter(Boolean);
    const parts: string[] = [];
    if (company && company.trim()) parts.push(company.trim().toUpperCase());
    if (vessels.length > 0) {
        const upper = vessels.map((v) => v.toUpperCase());
        const listed = upper.slice(0, maxListed).join(', ');
        parts.push(upper.length > maxListed ? `${listed} +${upper.length - maxListed}` : listed);
    }
    if (parts.length === 0) return allLabel;
    return parts.join(' - ');
}

interface MultiVesselSelectProps {
    value: Set<string>;
    onChange: (next: Set<string>) => void;
    /** Embarcações presentes nos dados já carregados (fallback/extra opções). */
    dataVessels?: string[];
    disabled?: boolean;
    className?: string;
}

interface EmbarcacaoRow {
    id?: string;
    nome?: string | null;
}

export default function MultiVesselSelect({
    value,
    onChange,
    dataVessels = [],
    disabled = false,
    className,
}: MultiVesselSelectProps) {
    const { t } = useI18n();
    const rootRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [apiVessels, setApiVessels] = useState<string[]>([]);

    // Opções da tabela gt_embarcacoes (fail-soft: grades seguem com dataVessels).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const token = getToken();
                const headers: Record<string, string> = {};
                if (token) headers.Authorization = `Bearer ${token}`;
                const res = await fetch('/api/gestao-tripulantes/embarcacoes', { headers });
                if (!res.ok) return;
                const json = await res.json().catch(() => null);
                const rows = (json?.data || []) as EmbarcacaoRow[];
                if (cancelled || !Array.isArray(rows)) return;
                const nomes = rows
                    .map((r) => String(r?.nome || '').trim())
                    .filter(Boolean);
                if (!cancelled) setApiVessels(nomes);
            } catch {
                // fail-soft
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const options = useMemo(() => {
        const seen = new Set<string>();
        const merged: string[] = [];
        for (const v of [...apiVessels, ...dataVessels]) {
            const nome = String(v || '').trim();
            if (!nome) continue;
            const key = nome.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(nome);
        }
        merged.sort((a, b) => a.localeCompare(b));
        return merged;
    }, [apiVessels, dataVessels]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((v) => v.toLowerCase().includes(q));
    }, [options, query]);

    const selectedList = useMemo(() => Array.from(value || []).filter(Boolean), [value]);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    /** Seleção tolerante a caixa (catálogo vs texto livre da grade). */
    const findSelectedIgnoreCase = (nome: string): string | undefined => {
        const key = nome.trim().toLowerCase();
        for (const s of selectedList) {
            if (s.trim().toLowerCase() === key) return s;
        }
        return undefined;
    };

    const toggle = (nome: string) => {
        const next = new Set(value || []);
        const existing = findSelectedIgnoreCase(nome);
        if (existing !== undefined) next.delete(existing);
        else next.add(nome);
        onChange(next);
    };

    const controlLabel =
        selectedList.length === 0
            ? t('gtEscalaV2.vesselsAll', 'Todas as Embarcações')
            : t('gtEscalaV2.vesselsSelected', { count: selectedList.length }, `${selectedList.length} selecionada(s)`);

    return (
        <div ref={rootRef} className={`relative ${className || ''}`}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open}
                aria-label={t('manSchedule.vesselLabel', 'Embarcação')}
                className="w-full min-h-[44px] lg:min-h-[34px] px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-left focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white flex items-center justify-between gap-1.5 disabled:opacity-60"
            >
                <span className="flex items-center gap-1 min-w-0 flex-1">
                    {selectedList.length === 0 ? (
                        <span className="truncate text-gray-500">{controlLabel}</span>
                    ) : (
                        <>
                            <span className="truncate text-blue-900 font-semibold">
                                {selectedList[0]}
                                {selectedList.length > 1 && (
                                    <span className="text-blue-600"> +{selectedList.length - 1}</span>
                                )}
                            </span>
                            <span className="flex items-center gap-0.5 shrink-0">
                                {selectedList.slice(0, 2).map((v) => (
                                    <span
                                        key={v}
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-semibold max-w-[110px]"
                                        title={v}
                                    >
                                        <span className="truncate">{v}</span>
                                        <span
                                            role="button"
                                            tabIndex={-1}
                                            aria-label={`${t('gtEscalaV2.removerFiltro', 'Remover')} ${v}`}
                                            className="hover:text-rose-600 cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggle(v);
                                            }}
                                        >
                                            <FiX className="w-2.5 h-2.5" />
                                        </span>
                                    </span>
                                ))}
                            </span>
                        </>
                    )}
                </span>
                <FiChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute z-40 mt-1 w-full min-w-[240px] bg-white border border-gray-200 rounded-lg shadow-xl max-h-[min(60dvh,360px)] flex flex-col">
                    <div className="p-2 border-b border-gray-100 shrink-0">
                        <div className="relative">
                            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={t('gtEscalaV2.vesselsSearch', 'Buscar embarcação...')}
                                className="w-full pl-8 pr-2 py-2 min-h-[44px] lg:min-h-[32px] border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <p className="px-3 py-3 text-xs text-gray-400 text-center">
                                {t('gtEscalaV2.vesselsEmpty', 'Nenhuma embarcação encontrada')}
                            </p>
                        ) : (
                            filtered.map((nome) => {
                                const checked = findSelectedIgnoreCase(nome) !== undefined;
                                return (
                                    <label
                                        key={nome}
                                        className="flex items-center gap-2 px-3 py-2 min-h-[44px] lg:min-h-[36px] hover:bg-blue-50/60 cursor-pointer text-xs text-gray-800"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggle(nome)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="truncate font-medium" title={nome}>
                                            {nome}
                                        </span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                    {selectedList.length > 0 && (
                        <button
                            type="button"
                            onClick={() => onChange(new Set())}
                            className="shrink-0 border-t border-gray-100 px-3 py-2 min-h-[44px] lg:min-h-[34px] text-xs font-semibold text-blue-700 hover:bg-blue-50 text-left"
                        >
                            {t('gtEscalaV2.vesselsClear', 'Limpar seleção')}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
