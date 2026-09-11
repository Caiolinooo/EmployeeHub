'use client';

import React from 'react';
import { FiChevronDown, FiChevronRight } from 'react-icons/fi';

interface Props {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export default function HistoricoColapsavel({ count, expanded, onToggle, children }: Props) {
  if (count <= 0) return null;

  return (
    <div className="bg-slate-50 border-t border-slate-200">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 sm:px-6 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100/80 transition"
        aria-expanded={expanded}
      >
        {expanded ? (
          <FiChevronDown className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <FiChevronRight className="w-3.5 h-3.5 shrink-0" />
        )}
        Histórico ({count}) — versões anteriores, só para rastreio
      </button>
      {expanded ? <div className="pb-2">{children}</div> : null}
    </div>
  );
}
