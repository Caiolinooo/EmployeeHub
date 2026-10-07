'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FiFile,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiCheck,
  FiX,
  FiRefreshCw,
  FiAlertCircle,
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';

interface TituloDoc {
  id: string;
  tipo_documento: string;
  titulo: string;
  ativo: boolean;
  ordem: number;
}

const TIPOS: { value: string; label: string }[] = [
  { value: 'pessoal', label: 'Documentos Pessoais' },
  { value: 'contratual', label: 'Documentos Contratuais (Admissão)' },
  { value: 'demissional', label: 'Documentos Demissionais (Desligamento)' },
  { value: 'ferias', label: 'Férias' },
  { value: 'ponto', label: 'Ponto' },
  { value: 'outro', label: 'Outro' },
];

export default function TitulosDocumentosAdminTab() {
  const [tipo, setTipo] = useState('contratual');
  const [titulos, setTitulos] = useState<TituloDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadTitulos = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchWithToken(
        `/api/gestao-tripulantes/documentos/titulos?tipo=${tipo}&inativos=true`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setTitulos(data.data);
      } else {
        setTitulos([]);
      }
    } catch (err: any) {
      console.error('Erro ao carregar títulos:', err);
      setErrorMsg('Falha ao carregar títulos do servidor.');
    } finally {
      setIsLoading(false);
    }
  }, [tipo]);

  useEffect(() => {
    loadTitulos();
  }, [loadTitulos]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTitulo.trim()) return;
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/documentos/titulos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_documento: tipo,
          titulo: novoTitulo.trim().toUpperCase(),
          ordem: (titulos.length + 1) * 10,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao cadastrar título.');
      }
      setSuccessMsg('Título cadastrado com sucesso!');
      setNovoTitulo('');
      await loadTitulos();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar título.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAtivo = async (t: TituloDoc) => {
    try {
      const res = await fetchWithToken(`/api/gestao-tripulantes/documentos/titulos/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !t.ativo }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTitulos(prev => prev.map(item => item.id === t.id ? { ...item, ativo: !t.ativo } : item));
      }
    } catch (err) {
      console.error('Erro ao alternar status:', err);
    }
  };

  const handleDelete = async (t: TituloDoc) => {
    if (!confirm(`Desativar o título "${t.titulo}"? Ele deixará de aparecer no upload.`)) return;
    try {
      const res = await fetchWithToken(`/api/gestao-tripulantes/documentos/titulos/${t.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTitulos(prev => prev.map(item => item.id === t.id ? { ...item, ativo: false } : item));
      }
    } catch (err) {
      console.error('Erro ao desativar título:', err);
    }
  };

  const filtered = titulos.filter(t =>
    (t.titulo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FiFile className="text-abz-blue text-xl" />
            Títulos de Documentos
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Lista padrão de títulos por tipo, exibida no upload da pasta do colaborador.
            Padroniza a nomenclatura dos documentos incluídos manualmente.
          </p>
        </div>
        <button
          onClick={loadTitulos}
          disabled={isLoading}
          className="p-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          title="Atualizar lista"
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

      {/* Seletor de tipo + novo título */}
      <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
        <div className="w-full lg:w-72">
          <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo de documento</label>
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-abz-blue"
          >
            {TIPOS.map(tp => (
              <option key={tp.value} value={tp.value}>{tp.label}</option>
            ))}
          </select>
        </div>
        <form onSubmit={handleAdd} className="flex-1 flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 mb-1">Novo título</label>
            <input
              type="text"
              placeholder="Ex: ACORDO DE BANCO DE HORAS"
              value={novoTitulo}
              onChange={e => setNovoTitulo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-abz-blue uppercase"
            />
          </div>
          <button
            type="submit"
            disabled={isSaving || !novoTitulo.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-abz-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition shadow-sm disabled:opacity-50"
          >
            {isSaving ? <FiRefreshCw className="animate-spin w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
            Adicionar
          </button>
        </form>
      </div>

      {/* Busca + métricas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar título..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-abz-blue focus:border-abz-blue"
          />
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold text-gray-500">
          <span>Total: <strong className="text-gray-900">{titulos.length}</strong></span>
          <span>Ativos: <strong className="text-emerald-700">{titulos.filter(t => t.ativo).length}</strong></span>
          <span>Inativos: <strong className="text-amber-700">{titulos.filter(t => !t.ativo).length}</strong></span>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
          <thead className="bg-gray-50 text-gray-700 font-semibold text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  <FiRefreshCw className="animate-spin inline w-5 h-5 mr-2 text-abz-blue" />
                  Carregando títulos...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  Nenhum título cadastrado para este tipo.
                </td>
              </tr>
            ) : (
              filtered.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-800">{t.titulo}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleAtivo(t)}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition ${
                        t.ativo
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title="Clique para alternar status"
                    >
                      {t.ativo ? <FiCheck className="w-3 h-3" /> : <FiX className="w-3 h-3 text-red-500" />}
                      {t.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(t)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition inline-flex items-center gap-1 text-xs font-semibold"
                      title="Desativar título"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                      Desativar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
