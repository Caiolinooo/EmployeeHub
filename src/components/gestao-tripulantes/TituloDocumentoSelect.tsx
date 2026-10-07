'use client';

import React, { useEffect, useRef, useState } from 'react';
import { fetchWithToken } from '@/lib/tokenStorage';

interface TituloItem {
  id: string;
  titulo: string;
}

interface Props {
  tipo: string;
  value: string;
  onChange: (valor: string) => void;
  disabled?: boolean;
}

const OUTRO = '__outro__';
// Tipos com lista pré-cadastrada (seed DP). Demais caem em texto livre.
const TIPOS_COM_LISTA = new Set(['contratual', 'demissional', 'ferias']);

/**
 * Título do documento: select com os títulos pré-cadastrados do tipo
 * (gt_documento_titulos) + opção "Outro (digitar)" que revela input livre.
 * Tipos sem lista usam input livre direto.
 */
export default function TituloDocumentoSelect({ tipo, value, onChange, disabled }: Props) {
  const [titulos, setTitulos] = useState<TituloItem[]>([]);
  const [modoOutro, setModoOutro] = useState(false);
  const cache = useRef<Map<string, TituloItem[]>>(new Map());

  const temLista = TIPOS_COM_LISTA.has(tipo);

  useEffect(() => {
    setModoOutro(false);
    if (!temLista) {
      setTitulos([]);
      return;
    }
    const cached = cache.current.get(tipo);
    if (cached) {
      setTitulos(cached);
      return;
    }
    let cancelado = false;
    fetchWithToken(`/api/gestao-tripulantes/documentos/titulos?tipo=${encodeURIComponent(tipo)}`)
      .then(res => res.json())
      .then(json => {
        if (cancelado) return;
        const lista: TituloItem[] = (json?.data || []).map((d: any) => ({ id: d.id, titulo: d.titulo }));
        cache.current.set(tipo, lista);
        setTitulos(lista);
      })
      .catch(() => {
        if (!cancelado) setTitulos([]);
      });
    return () => {
      cancelado = true;
    };
  }, [tipo, temLista]);

  const inputLivre = (
    <input
      type="text"
      placeholder="Digite o título do documento"
      disabled={disabled}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );

  if (!temLista || titulos.length === 0) {
    return inputLivre;
  }

  return (
    <div className="space-y-2">
      <select
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
        value={modoOutro ? OUTRO : value}
        onChange={e => {
          if (e.target.value === OUTRO) {
            setModoOutro(true);
            onChange('');
          } else {
            setModoOutro(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="" disabled>Selecione o documento…</option>
        {titulos.map(t => (
          <option key={t.id} value={t.titulo}>{t.titulo}</option>
        ))}
        <option value={OUTRO}>Outro (digitar)</option>
      </select>
      {modoOutro && inputLivre}
    </div>
  );
}
