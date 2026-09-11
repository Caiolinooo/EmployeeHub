'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

export interface SearchableOption {
  id: string;
  label: string;
}

type ListItem =
  | { kind: 'clear' }
  | { kind: 'option'; option: SearchableOption }
  | { kind: 'create'; query: string }
  | { kind: 'empty' };

export interface SearchableCreatableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (id: string) => void;
  onCreate?: (label: string) => Promise<SearchableOption>;
  placeholder?: string;
  allowCreate?: boolean;
  allowClear?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_INPUT_CLASS =
  'w-full text-sm bg-white border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500';

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** When the query is empty, highlight "clear" (index 0). After typing, skip it so Enter picks the first real result. */
function firstResultHighlight(query: string, allowClear: boolean): number {
  if (!query.trim() || !allowClear) return 0;
  return 1;
}

export default function SearchableCreatableSelect({
  options,
  value,
  onChange,
  onCreate,
  placeholder = 'Buscar...',
  allowCreate = false,
  allowClear = true,
  emptyLabel = '—',
  disabled = false,
  className,
}: SearchableCreatableSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [creating, setCreating] = useState(false);

  const selected = useMemo(
    () => options.find(o => o.id === value) ?? null,
    [options, value],
  );

  useEffect(() => {
    if (!open) setQuery(selected?.label ?? '');
  }, [selected?.label, open]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter(o => normalize(o.label).includes(q));
  }, [options, query]);

  const exactMatch = useMemo(() => {
    const q = normalize(query);
    if (!q) return false;
    return options.some(o => normalize(o.label) === q);
  }, [options, query]);

  const showCreate = Boolean(allowCreate && onCreate && query.trim() && !exactMatch && !creating);

  const items = useMemo<ListItem[]>(() => {
    const list: ListItem[] = [];
    if (allowClear) list.push({ kind: 'clear' });
    for (const option of filtered) list.push({ kind: 'option', option });
    if (showCreate) list.push({ kind: 'create', query: query.trim() });
    if (list.length === 0 || (list.length === 1 && list[0].kind === 'clear' && filtered.length === 0 && !showCreate && query.trim())) {
      if (filtered.length === 0 && !showCreate) {
        return allowClear && !query.trim()
          ? [{ kind: 'clear' }]
          : [...(allowClear ? [{ kind: 'clear' as const }] : []), { kind: 'empty' }];
      }
    }
    return list;
  }, [allowClear, filtered, showCreate, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery(selected?.label ?? '');
    setHighlight(0);
  }, [selected?.label]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, close]);

  const pick = useCallback((id: string, label: string) => {
    onChange(id);
    setQuery(label);
    setOpen(false);
    setHighlight(0);
  }, [onChange]);

  const activate = useCallback(async (item: ListItem) => {
    switch (item.kind) {
      case 'clear':
        pick('', '');
        return;
      case 'option':
        pick(item.option.id, item.option.label);
        return;
      case 'empty':
        return;
      case 'create': {
        if (!onCreate || creating) return;
        setCreating(true);
        try {
          const created = await onCreate(item.query);
          pick(created.id, created.label);
        } catch {
          // parent reports the error (toast); keep the list open
        } finally {
          setCreating(false);
        }
        return;
      }
      default: {
        const _exhaustive: never = item;
        return _exhaustive;
      }
    }
  }, [creating, onCreate, pick]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlight(firstResultHighlight(query, allowClear));
        return;
      }
      setHighlight(i => (i + 1) % Math.max(items.length, 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlight(Math.max(items.length - 1, 0));
        return;
      }
      setHighlight(i => (i - 1 + items.length) % Math.max(items.length, 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlight(firstResultHighlight(query, allowClear));
        return;
      }
      const item = items[highlight];
      if (item) void activate(item);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
      setQuery(selected?.label ?? '');
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled || creating}
        className={className || DEFAULT_INPUT_CLASS}
        placeholder={placeholder}
        value={open ? query : (selected?.label ?? query)}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          setHighlight(firstResultHighlight(query, allowClear));
        }}
        onChange={e => {
          const nextQuery = e.target.value;
          setQuery(nextQuery);
          setOpen(true);
          setHighlight(firstResultHighlight(nextQuery, allowClear));
        }}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          onMouseDown={e => e.preventDefault()}
        >
          {items.map((item, index) => {
            const active = index === highlight;
            const base = `px-3 py-1.5 text-sm cursor-pointer ${active ? 'bg-blue-50 text-blue-800' : 'text-gray-800 hover:bg-gray-50'}`;
            switch (item.kind) {
              case 'clear':
                return (
                  <li
                    key="__clear__"
                    role="option"
                    aria-selected={value === ''}
                    className={`${base} text-gray-500`}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => void activate(item)}
                  >
                    {emptyLabel}
                  </li>
                );
              case 'option':
                return (
                  <li
                    key={item.option.id}
                    role="option"
                    aria-selected={item.option.id === value}
                    className={`${base} ${item.option.id === value ? 'font-medium' : ''}`}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => void activate(item)}
                  >
                    {item.option.label}
                  </li>
                );
              case 'create':
                return (
                  <li
                    key="__create__"
                    role="option"
                    aria-selected={false}
                    className={`${base} text-blue-700 font-medium`}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => void activate(item)}
                  >
                    {creating ? 'Adicionando…' : `Adicionar «${item.query}»`}
                  </li>
                );
              case 'empty':
                return (
                  <li key="__empty__" role="presentation" className="px-3 py-1.5 text-sm text-gray-400">
                    Nenhum resultado
                  </li>
                );
              default: {
                const _exhaustive: never = item;
                return _exhaustive;
              }
            }
          })}
        </ul>
      )}
    </div>
  );
}
