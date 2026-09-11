'use client';

import React, { useState, useEffect } from 'react';
import {
  FiFolder,
  FiPlus,
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiCheck,
  FiX,
  FiRefreshCw,
  FiAlertCircle,
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';

interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function CentrosCustoAdminTab() {
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadCentros = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/centros-custo');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCentros(data.data);
      } else if (Array.isArray(data.centros_custo)) {
        setCentros(data.centros_custo);
      } else if (data.data) {
        setCentros(data.data);
      }
    } catch (err: any) {
      console.error('Erro ao carregar centros de custo:', err);
      setErrorMsg('Falha ao carregar centros de custo do servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCentros();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setCodigo('');
    setNome('');
    setAtivo(true);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: CentroCusto) => {
    setEditingId(c.id);
    setCodigo(c.codigo);
    setNome(c.nome);
    setAtivo(c.ativo);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim() || !nome.trim()) {
      setErrorMsg('Preencha o código e o nome do Centro de Custo.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (editingId) {
        const res = await fetchWithToken(`/api/gestao-tripulantes/centros-custo/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: codigo.trim().toUpperCase(), nome: nome.trim(), ativo }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Erro ao atualizar centro de custo.');
        }
        setSuccessMsg('Centro de Custo atualizado com sucesso!');
      } else {
        const res = await fetchWithToken('/api/gestao-tripulantes/centros-custo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: codigo.trim().toUpperCase(), nome: nome.trim(), ativo }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Erro ao cadastrar centro de custo.');
        }
        setSuccessMsg('Centro de Custo cadastrado com sucesso!');
      }

      setIsModalOpen(false);
      await loadCentros();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar centro de custo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAtivo = async (c: CentroCusto) => {
    try {
      const res = await fetchWithToken(`/api/gestao-tripulantes/centros-custo/${c.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: c.codigo, nome: c.nome, ativo: !c.ativo }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCentros(prev => prev.map(item => item.id === c.id ? { ...item, ativo: !c.ativo } : item));
      }
    } catch (err) {
      console.error('Erro ao alternar status:', err);
    }
  };

  const filtered = centros.filter(c =>
    (c.codigo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.nome || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FiFolder className="text-abz-blue text-xl" />
            Centros de Custo Globais
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Gestão unificada de centros de custo compartilhados entre Gestão de Tripulantes, Departamento Pessoal, Finanças e Logística.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadCentros}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            title="Atualizar lista"
          >
            <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-abz-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition shadow-sm"
          >
            <FiPlus className="w-4 h-4" />
            Novo Centro de Custo
          </button>
        </div>
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

      {/* Barra de Busca e Métricas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por código ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-abz-blue focus:border-abz-blue"
          />
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold text-gray-500">
          <span>Total: <strong className="text-gray-900">{centros?.length ?? 0}</strong></span>
          <span>Ativos: <strong className="text-emerald-700">{(centros || []).filter(c => c.ativo).length}</strong></span>
          <span>Inativos: <strong className="text-amber-700">{(centros || []).filter(c => !c.ativo).length}</strong></span>
        </div>
      </div>

      {/* Tabela de Centros de Custo */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
          <thead className="bg-gray-50 text-gray-700 font-semibold text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nome / Descrição</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  <FiRefreshCw className="animate-spin inline w-5 h-5 mr-2 text-abz-blue" />
                  Carregando centros de custo...
                </td>
              </tr>
            ) : (!filtered || filtered.length === 0) ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Nenhum centro de custo encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900">
                    {c.codigo}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {c.nome}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleAtivo(c)}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition ${
                        c.ativo
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title="Clique para alternar status"
                    >
                      {c.ativo ? <FiCheck className="w-3 h-3" /> : <FiX className="w-3 h-3 text-red-500" />}
                      {c.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleOpenEdit(c)}
                      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition inline-flex items-center gap-1 text-xs font-semibold"
                    >
                      <FiEdit2 className="w-3.5 h-3.5" />
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Criação / Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {editingId ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Código *
                </label>
                <input
                  type="text"
                  placeholder="Ex: CC-OP-001"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-abz-blue uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nome / Descrição *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Operações Embarcação Alpha"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-abz-blue"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="modal-ativo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="h-4 w-4 text-abz-blue rounded border-gray-300 focus:ring-abz-blue"
                />
                <label htmlFor="modal-ativo" className="text-sm font-medium text-gray-700">
                  Centro de Custo Ativo
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-abz-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isSaving && <FiRefreshCw className="animate-spin w-4 h-4" />}
                  {editingId ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
