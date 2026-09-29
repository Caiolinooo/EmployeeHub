'use client';

import React, { useEffect, useState } from 'react';
import { FiPlus, FiSearch, FiRefreshCw } from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';

interface Cargo {
  id: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
}

/** Onde o DP cadastra cargo/função que ainda não existe na lista do colaborador. */
export default function CargosAdminTab() {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/cargos');
      const data = await res.json();
      setCargos(Array.isArray(data.data) ? data.data : []);
    } catch {
      setErro('Falha ao carregar cargos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const criar = async () => {
    const texto = nome.trim();
    if (!texto) {
      setErro('Informe o nome do cargo ou função.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/cargos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: texto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar cargo');
      setNome('');
      setOk(`«${texto}» cadastrado. Já aparece no vínculo do colaborador.`);
      await carregar();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar cargo');
    } finally {
      setSalvando(false);
    }
  };

  const filtrados = cargos.filter((c) => c.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Cargos / Funções</h2>
        <p className="text-sm text-gray-600">
          Cadastre aqui a função que não aparece no colaborador. No formulário também dá para digitar o nome e escolher Adicionar.
        </p>
      </div>

      {erro && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}
      {ok && <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{ok}</p>}

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: AUXILIAR DE SERVIÇOS GERAIS"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={criar}
          disabled={salvando}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <FiPlus /> {salvando ? 'Salvando...' : 'Cadastrar cargo'}
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cargo..."
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <button type="button" onClick={carregar} className="px-3 border border-gray-300 rounded-lg" title="Recarregar">
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Cargo / Função</th>
              <th className="px-3 py-2 w-24">Situação</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={2} className="px-3 py-6 text-gray-500">Carregando cargos...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={2} className="px-3 py-6 text-gray-500">Nenhum cargo encontrado.</td></tr>
            ) : filtrados.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">{c.nome}</td>
                <td className="px-3 py-2">{c.ativo === false ? 'Inativo' : 'Ativo'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
