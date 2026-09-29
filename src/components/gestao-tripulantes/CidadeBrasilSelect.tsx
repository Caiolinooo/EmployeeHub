'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { fetchWithToken } from '@/lib/tokenStorage';
import SearchableCreatableSelect from '@/components/gestao-tripulantes/SearchableCreatableSelect';

interface Cidade {
  nome: string;
  uf: string;
}

interface Props {
  cidade: string;
  uf: string;
  onCidade: (cidade: string) => void;
  onUf: (uf: string) => void;
}

/** Busca municípios do IBGE. Sem UF, busca pelo texto (mínimo 2 letras). */
export default function CidadeBrasilSelect({ cidade, uf, onCidade, onUf }: Props) {
  const [cidades, setCidades] = useState<Cidade[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams();
    if (uf) params.set('uf', uf);
    fetchWithToken(`/api/ibge/municipios?${params.toString()}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => setCidades(Array.isArray(json.data) ? json.data : []))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setCidades([]);
      });
    return () => ctrl.abort();
  }, [uf]);

  const options = useMemo(() => {
    const lista = cidades.map((c) => ({
      id: `${c.uf}|${c.nome}`,
      label: uf ? c.nome : `${c.nome} - ${c.uf}`,
    }));
    if (cidade && !lista.some((o) => o.label === cidade || o.id.endsWith(`|${cidade}`))) {
      lista.unshift({ id: `livre|${cidade}`, label: cidade });
    }
    return lista;
  }, [cidades, cidade, uf]);

  const valor = cidade
    ? (options.find((o) => o.id === `${uf}|${cidade}`)?.id || `livre|${cidade}`)
    : '';

  return (
    <SearchableCreatableSelect
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
      options={options}
      value={valor}
      allowCreate
      placeholder={uf ? 'Buscar cidade...' : 'Selecione a UF para buscar a cidade'}
      onChange={(id) => {
        if (!id) {
          onCidade('');
          return;
        }
        const [sigla, nome] = id.split('|');
        if (sigla && sigla !== 'livre' && nome) {
          onCidade(nome);
          if (sigla.length === 2) onUf(sigla);
          return;
        }
        onCidade(nome || id);
      }}
      onCreate={async (label) => {
        const nome = label.trim();
        onCidade(nome);
        return { id: `livre|${nome}`, label: nome };
      }}
    />
  );
}
