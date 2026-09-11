'use client';

import React, { useEffect, useState } from 'react';
import {
  FILTER_DATE_MAX,
  FILTER_DATE_MIN,
  isCompleteFilterDate,
} from '@/lib/gestao-tripulantes/filter-date';

interface ScheduleDateFilterInputProps {
  id?: string;
  value: string;
  onCommit: (completeYmd: string) => void;
  className?: string;
  'aria-label'?: string;
}

/**
 * Input de filtro de data: o rascunho fica local (Chrome `0002-…` ao digitar o ano)
 * e só commita no pai quando o valor é vazio ou YYYY-MM-DD completo/plausível.
 */
export default function ScheduleDateFilterInput({
  id,
  value,
  onCommit,
  className,
  'aria-label': ariaLabel,
}: ScheduleDateFilterInputProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <input
      id={id}
      type="date"
      min={FILTER_DATE_MIN}
      max={FILTER_DATE_MAX}
      aria-label={ariaLabel}
      value={draft}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw === '' || isCompleteFilterDate(raw)) {
          onCommit(raw);
        }
      }}
      onBlur={() => {
        if (draft === '' || isCompleteFilterDate(draft)) return;
        setDraft(value);
      }}
      className={className}
    />
  );
}
