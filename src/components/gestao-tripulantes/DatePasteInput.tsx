'use client';

import React, { useState } from 'react';
import { formatDataBr, mascaraDataBr, parseDataColavel } from '@/lib/gestao-tripulantes/date-paste';

interface Props {
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
}

/** Campo de data que aceita colar DD/MM/AAAA e também o calendário nativo. */
export default function DatePasteInput({ value, onChange, disabled }: Props) {
  const [texto, setTexto] = useState(() => formatDataBr(value));
  const [focado, setFocado] = useState(false);
  const exibido = focado ? texto : (formatDataBr(value) || texto);

  const aplicar = (bruto: string) => {
    const mascarado = mascaraDataBr(bruto);
    setTexto(mascarado);
    if (!mascarado) {
      onChange('');
      return;
    }
    const iso = parseDataColavel(mascarado);
    if (iso) onChange(iso);
  };

  return (
    <div className="flex gap-1">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/AAAA"
        disabled={disabled}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
        value={exibido}
        onFocus={() => {
          setFocado(true);
          setTexto(formatDataBr(value));
        }}
        onBlur={() => {
          setFocado(false);
          const iso = parseDataColavel(texto);
          if (iso) {
            onChange(iso);
            setTexto(formatDataBr(iso));
          } else if (!texto.trim()) {
            onChange('');
          } else {
            setTexto(formatDataBr(value));
          }
        }}
        onChange={(e) => aplicar(e.target.value)}
        onPaste={(e) => {
          const colado = e.clipboardData.getData('text');
          if (!colado) return;
          e.preventDefault();
          aplicar(colado);
        }}
      />
      <input
        type="date"
        disabled={disabled}
        aria-label="Abrir calendário"
        className="w-10 border border-gray-300 rounded-lg px-1 text-sm bg-white disabled:bg-gray-50"
        value={/^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : ''}
        onChange={(e) => {
          onChange(e.target.value);
          setTexto(formatDataBr(e.target.value));
        }}
      />
    </div>
  );
}
