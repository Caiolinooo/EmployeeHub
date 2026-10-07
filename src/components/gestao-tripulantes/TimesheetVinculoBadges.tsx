'use client';

import React, { useEffect, useState } from 'react';
import { getToken } from '@/lib/tokenStorage';

interface Cadeia {
  completo: boolean;
  motivo: string | null;
  login: boolean;
  ponto: boolean;
  folha: boolean;
  empresa: boolean;
}

const LABELS: { key: keyof Pick<Cadeia, 'login' | 'ponto' | 'folha' | 'empresa'>; label: string }[] = [
  { key: 'login', label: 'Login' },
  { key: 'ponto', label: 'Ponto' },
  { key: 'folha', label: 'Folha' },
  { key: 'empresa', label: 'Empresa' },
];

/** Quatro elos da cadeia no cadastro GT. Falha de leitura não bloqueia o form. */
export default function TimesheetVinculoBadges({ colaboradorId }: { colaboradorId: string }) {
  const [cadeia, setCadeia] = useState<Cadeia | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    fetch(`/api/pontoflow/vinculo?colaboradorId=${encodeURIComponent(colaboradorId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.success) setCadeia(json.data as Cadeia);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [colaboradorId]);

  if (!cadeia) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {LABELS.map((item) => (
        <span
          key={item.key}
          className={`text-xs px-2 py-0.5 rounded-full border ${
            cadeia[item.key]
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
