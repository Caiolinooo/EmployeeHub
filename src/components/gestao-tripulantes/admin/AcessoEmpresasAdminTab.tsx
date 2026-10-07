'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FiLock,
  FiSearch,
  FiCheck,
  FiRefreshCw,
  FiAlertCircle,
  FiSave,
  FiUser,
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';

interface Empresa {
  id: string;
  nome: string;
  ativo: boolean;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: string;
}

export default function AcessoEmpresasAdminTab() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [restricoes, setRestricoes] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Usuario[]>([]);
  const [usuarioSel, setUsuarioSel] = useState<Usuario | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const carregarBase = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/acesso-empresas');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Falha ao carregar');
      setEmpresas(json.data.empresas || []);
      const mapa: Record<string, string[]> = {};
      for (const r of json.data.restricoes || []) {
        (mapa[r.user_id] = mapa[r.user_id] || []).push(r.empresa_id);
      }
      setRestricoes(mapa);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao carregar dados.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarBase();
  }, [carregarBase]);

  const buscarUsuarios = async () => {
    if (!busca.trim()) return;
    setErrorMsg(null);
    try {
      const res = await fetchWithToken(
        `/api/gestao-tripulantes/acesso-empresas?search=${encodeURIComponent(busca.trim())}`
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Falha na busca');
      setResultados(json.data.usuarios || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao buscar usuários.');
    }
  };

  const selecionarUsuario = (u: Usuario) => {
    setUsuarioSel(u);
    setMarcadas(new Set(restricoes[u.id] || []));
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  const toggleEmpresa = (id: string) => {
    setMarcadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSalvar = async () => {
    if (!usuarioSel) return;
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/acesso-empresas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: usuarioSel.id, empresa_ids: [...marcadas] }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Erro ao salvar');
      setSuccessMsg(json.message || 'Restrição salva.');
      setRestricoes(prev => {
        const next = { ...prev };
        if (marcadas.size === 0) delete next[usuarioSel.id];
        else next[usuarioSel.id] = [...marcadas];
        return next;
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar restrição.');
    } finally {
      setIsSaving(false);
    }
  };

  const nomeEmpresa = (id: string) => empresas.find(e => e.id === id)?.nome || id;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FiLock className="text-abz-blue text-xl" />
            Acesso por Empresa (Documentos)
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Restringe quais empresas cada usuário do portal enxerga na Gestão de Tripulantes
            (lista, pasta do colaborador, documentos, alertas, exportação).
            <strong> Sem empresas marcadas = usuário vê TODAS as empresas</strong> (sem restrição).
            ADMIN/MANAGER não são afetados.
          </p>
        </div>
        <button
          onClick={carregarBase}
          disabled={isLoading}
          className="p-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          title="Recarregar"
        >
          <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
          <FiCheck className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Usuários atualmente restritos */}
      {Object.keys(restricoes).length > 0 && (
        <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-4">
          <p className="text-xs font-semibold text-amber-800 mb-2">Usuários com restrição ativa:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(restricoes).map(([uid, empIds]) => (
              <span key={uid} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-amber-300 rounded-md text-xs text-gray-700">
                <FiUser className="w-3 h-3" />
                <span className="font-mono">{uid.slice(0, 8)}…</span>
                <span className="text-gray-500">→ {empIds.map(nomeEmpresa).join(', ')}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Busca de usuário */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 max-w-md">
          <label className="block text-xs font-semibold text-gray-700 mb-1">Buscar usuário do portal</label>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Nome ou e-mail..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscarUsuarios()}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-abz-blue"
            />
          </div>
        </div>
        <button
          onClick={buscarUsuarios}
          className="px-4 py-2 bg-abz-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition"
        >
          Buscar
        </button>
      </div>

      {resultados.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
          {resultados.map(u => (
            <button
              key={u.id}
              onClick={() => selecionarUsuario(u)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition flex items-center justify-between ${
                usuarioSel?.id === u.id ? 'bg-blue-50 border-l-2 border-abz-blue' : ''
              }`}
            >
              <span>
                <span className="font-medium text-gray-800">{u.nome}</span>
                <span className="text-gray-400 ml-2">{u.email}</span>
              </span>
              <span className="text-xs text-gray-400">{u.role}</span>
            </button>
          ))}
        </div>
      )}

      {/* Checkboxes de empresas */}
      {usuarioSel && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <p className="text-sm font-semibold text-gray-800">
            Empresas liberadas para <span className="text-abz-blue">{usuarioSel.nome}</span>:
          </p>
          <p className="text-xs text-gray-500">
            Marque as empresas que este usuário pode ver. <strong>Desmarcar todas remove a restrição</strong> (volta a ver tudo).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {empresas.map(e => (
              <label
                key={e.id}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm transition ${
                  marcadas.has(e.id)
                    ? 'border-abz-blue bg-blue-50 text-gray-900'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                } ${!e.ativo ? 'opacity-50' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={marcadas.has(e.id)}
                  onChange={() => toggleEmpresa(e.id)}
                  className="h-4 w-4 text-abz-blue rounded border-gray-300 focus:ring-abz-blue"
                />
                {e.nome}
                {!e.ativo && <span className="text-[10px] text-gray-400">(inativa)</span>}
              </label>
            ))}
            {empresas.length === 0 && (
              <p className="text-sm text-gray-400 col-span-full">Nenhuma empresa cadastrada em gt_empresas.</p>
            )}
          </div>
          <div className="flex justify-end pt-2 border-t">
            <button
              onClick={handleSalvar}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-abz-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition disabled:opacity-50"
            >
              {isSaving ? <FiRefreshCw className="animate-spin w-4 h-4" /> : <FiSave className="w-4 h-4" />}
              Salvar restrição
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
