'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiAward,
  FiPlus,
  FiUpload,
  FiTrash2,
  FiEdit2,
  FiX,
  FiSearch,
  FiCheckCircle,
  FiLayers,
  FiBriefcase
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { toast } from 'react-hot-toast';

interface Requisito {
  id?: string;
  matriz_id?: string;
  cargo_id?: string | null;
  cargo_nome: string;
  regime: string;
  treinamento_nome: string;
  sigla?: string | null;
  obrigatorio: boolean;
  validade_meses?: number | null;
  especialidade?: string | null;
}

interface Matriz {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  centro_resultado?: string | null;
  cliente?: string | null;
  contrato?: string | null;
  responsavel?: string | null;
  ativo: boolean;
  total_requisitos?: number;
  total_cargos?: number;
  total_treinamentos?: number;
  requisitos?: Requisito[];
}

interface Props {
  readOnly?: boolean;
}

export default function MatrizTreinamentoConfigTab({ readOnly = false }: Props = {}) {
  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  const [selectedMatrizId, setSelectedMatrizId] = useState<string | null>(null);
  const [selectedMatriz, setSelectedMatriz] = useState<Matriz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cargosList, setCargosList] = useState<{ id: string; nome: string }[]>([]);

  // Modal Import XLSX
  const [showImportModal, setShowImportModal] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal Nova / Editar Matriz
  const [showMatrizModal, setShowMatrizModal] = useState(false);
  const [matrizForm, setMatrizForm] = useState({
    id: '',
    codigo: '',
    nome: '',
    descricao: '',
    centro_resultado: '',
    cliente: '',
    contrato: '',
    responsavel: '',
    ativo: true,
  });

  // Modal Novo Requisito
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqForm, setReqForm] = useState<Requisito>({
    cargo_nome: '',
    regime: 'Offshore',
    treinamento_nome: '',
    sigla: '',
    obrigatorio: true,
    validade_meses: null,
    especialidade: 'ND',
  });

  const loadMatrizes = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetchWithToken('/api/gestao-tripulantes/matrizes');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setMatrizes(data.data);
        if (data.data.length > 0 && !selectedMatrizId) {
          setSelectedMatrizId(data.data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar matrizes de treinamento');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMatrizId]);

  const loadCargos = useCallback(async () => {
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/cargos');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCargosList(data.data);
      }
    } catch {
      /* fail-soft */
    }
  }, []);

  const loadMatrizDetail = useCallback(async (id: string) => {
    try {
      const res = await fetchWithToken(`/api/gestao-tripulantes/matrizes/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setSelectedMatriz(data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar detalhes da matriz');
    }
  }, []);

  useEffect(() => {
    loadMatrizes();
    loadCargos();
  }, [loadMatrizes, loadCargos]);

  useEffect(() => {
    if (selectedMatrizId) {
      loadMatrizDetail(selectedMatrizId);
    }
  }, [selectedMatrizId, loadMatrizDetail]);

  // Importar XLSX do MIO
  const handleUploadXlsx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportingFile(true);
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetchWithToken('/api/gestao-tripulantes/matrizes/import', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Falha ao importar planilha');
      }

      toast.success(json.message || 'Matriz importada com sucesso!');
      setShowImportModal(false);
      await loadMatrizes();
      if (json.data?.matriz_id) {
        setSelectedMatrizId(json.data.matriz_id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao importar matriz');
    } finally {
      setImportingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Salvar Matriz (Create/Update)
  const handleSaveMatriz = async () => {
    if (!matrizForm.nome.trim()) {
      toast.error('O nome da matriz é obrigatório');
      return;
    }

    try {
      const isEdit = Boolean(matrizForm.id);
      const url = isEdit
        ? `/api/gestao-tripulantes/matrizes/${matrizForm.id}`
        : '/api/gestao-tripulantes/matrizes';

      const res = await fetchWithToken(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matrizForm),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar matriz');

      toast.success(isEdit ? 'Matriz atualizada com sucesso!' : 'Matriz criada com sucesso!');
      setShowMatrizModal(false);
      await loadMatrizes();
      if (json.data?.id) setSelectedMatrizId(json.data.id);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar matriz');
    }
  };

  // Excluir Matriz
  const handleDeleteMatriz = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta matriz e todos os seus requisitos?')) return;
    try {
      const res = await fetchWithToken(`/api/gestao-tripulantes/matrizes/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao excluir matriz');

      toast.success('Matriz excluída com sucesso');
      setSelectedMatrizId(null);
      setSelectedMatriz(null);
      loadMatrizes();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir matriz');
    }
  };

  // Salvar Novo Requisito
  const handleSaveRequisito = async () => {
    if (!selectedMatrizId) return;
    if (!reqForm.cargo_nome.trim() || !reqForm.treinamento_nome.trim()) {
      toast.error('Cargo e Nome do Treinamento são obrigatórios');
      return;
    }

    try {
      const currentReqs = selectedMatriz?.requisitos || [];
      const updatedReqs = [
        ...currentReqs,
        {
          cargo_nome: reqForm.cargo_nome.trim(),
          regime: reqForm.regime,
          treinamento_nome: reqForm.treinamento_nome.trim(),
          sigla: reqForm.sigla?.trim() || null,
          obrigatorio: reqForm.obrigatorio,
          validade_meses: reqForm.validade_meses ? Number(reqForm.validade_meses) : null,
          especialidade: reqForm.especialidade || 'ND',
        },
      ];

      const res = await fetchWithToken(`/api/gestao-tripulantes/matrizes/${selectedMatrizId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requisitos: updatedReqs }),
      });

      if (!res.ok) throw new Error('Falha ao adicionar requisito');

      toast.success('Treinamento adicionado à matriz!');
      setShowReqModal(false);
      setReqForm({
        cargo_nome: reqForm.cargo_nome,
        regime: 'Offshore',
        treinamento_nome: '',
        sigla: '',
        obrigatorio: true,
        validade_meses: null,
        especialidade: 'ND',
      });
      loadMatrizDetail(selectedMatrizId);
      loadMatrizes();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar requisito');
    }
  };

  // Remover Requisito individual
  const handleDeleteRequisito = async (reqIdx: number) => {
    if (!selectedMatrizId || !selectedMatriz?.requisitos) return;
    if (!confirm('Remover este treinamento da matriz do cargo?')) return;

    try {
      const updatedReqs = selectedMatriz.requisitos.filter((_, idx) => idx !== reqIdx);

      const res = await fetchWithToken(`/api/gestao-tripulantes/matrizes/${selectedMatrizId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requisitos: updatedReqs }),
      });

      if (!res.ok) throw new Error('Falha ao remover requisito');

      toast.success('Treinamento removido da matriz');
      loadMatrizDetail(selectedMatrizId);
      loadMatrizes();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover requisito');
    }
  };

  // Filtragem dos requisitos
  const requisitosFiltrados = (selectedMatriz?.requisitos || []).filter(r => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.cargo_nome.toLowerCase().includes(term) ||
      r.treinamento_nome.toLowerCase().includes(term) ||
      (r.sigla && r.sigla.toLowerCase().includes(term)) ||
      r.regime.toLowerCase().includes(term)
    );
  });

  // Agrupamento por Cargo
  const requisitosPorCargo = React.useMemo(() => {
    const groups: Record<string, Requisito[]> = {};
    for (const req of requisitosFiltrados) {
      const cargo = req.cargo_nome || 'OUTROS';
      if (!groups[cargo]) groups[cargo] = [];
      groups[cargo].push(req);
    }
    return groups;
  }, [requisitosFiltrados]);

  return (
    <div className="space-y-6">
      {/* Header Cards & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FiAward className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-gray-900">Matrizes de Treinamento por Função</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Configure quais cursos e treinamentos são exigidos para cada cargo e regime operacional da frota.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!readOnly ? (
            <>
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-sm"
                title="Importar planilha XLSX gerada pelo MIO"
              >
                <FiUpload className="w-4 h-4" />
                Importar Planilha MIO (XLSX)
              </button>

              <button
                onClick={() => {
                  setMatrizForm({
                    id: '',
                    codigo: '',
                    nome: '',
                    descricao: '',
                    centro_resultado: '',
                    cliente: '',
                    contrato: '',
                    responsavel: '',
                    ativo: true,
                  });
                  setShowMatrizModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-xs font-bold transition shadow-sm"
              >
                <FiPlus className="w-4 h-4" />
                Nova Matriz
              </button>
            </>
          ) : (
            <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold border border-slate-200">
              Modo Visualização (Somente Leitura)
            </span>
          )}
        </div>
      </div>

      {/* Selector of Matrices */}
      {matrizes.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {matrizes.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedMatrizId(m.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 border ${
                selectedMatrizId === m.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <FiLayers className="w-4 h-4" />
              <span>{m.nome}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                selectedMatrizId === m.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {m.total_requisitos || 0} reqs
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      {selectedMatriz && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Matriz Info Header */}
          <div className="p-5 bg-slate-50/80 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-gray-900">{selectedMatriz.nome}</h3>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-mono text-[11px] font-bold">
                  {selectedMatriz.codigo}
                </span>
                {selectedMatriz.ativo ? (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-semibold flex items-center gap-1">
                    <FiCheckCircle className="w-3 h-3" /> Ativa
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[11px] font-semibold">
                    Inativa
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap">
                {selectedMatriz.cliente && (
                  <span><strong>Cliente:</strong> {selectedMatriz.cliente}</span>
                )}
                {selectedMatriz.contrato && (
                  <span><strong>Contrato:</strong> {selectedMatriz.contrato}</span>
                )}
                {selectedMatriz.centro_resultado && (
                  <span><strong>Centro de Resultado:</strong> {selectedMatriz.centro_resultado}</span>
                )}
                {selectedMatriz.responsavel && (
                  <span><strong>Responsável:</strong> {selectedMatriz.responsavel}</span>
                )}
              </div>
            </div>

            {!readOnly && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setMatrizForm({
                      id: selectedMatriz.id,
                      codigo: selectedMatriz.codigo,
                      nome: selectedMatriz.nome,
                      descricao: selectedMatriz.descricao || '',
                      centro_resultado: selectedMatriz.centro_resultado || '',
                      cliente: selectedMatriz.cliente || '',
                      contrato: selectedMatriz.contrato || '',
                      responsavel: selectedMatriz.responsavel || '',
                      ativo: selectedMatriz.ativo,
                    });
                    setShowMatrizModal(true);
                  }}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg border border-gray-200 transition"
                  title="Editar dados cadastrais da matriz"
                >
                  <FiEdit2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDeleteMatriz(selectedMatriz.id)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-200 transition"
                  title="Excluir matriz"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setShowReqModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition"
                >
                  <FiPlus className="w-3.5 h-3.5" />
                  Adicionar Treinamento ao Cargo
                </button>
              </div>
            )}
          </div>

          {/* Search bar within matrix */}
          <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por cargo ou nome do treinamento..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="text-xs text-gray-500 font-medium">
              Total de <strong>{requisitosFiltrados.length}</strong> requisito(s) em <strong>{Object.keys(requisitosPorCargo).length}</strong> cargo(s)
            </div>
          </div>

          {/* Requirements list grouped by Cargo */}
          <div className="divide-y divide-gray-100 p-4 space-y-4">
            {Object.keys(requisitosPorCargo).length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                Nenhum treinamento configurado nesta matriz para os filtros selecionados.
              </div>
            ) : (
              Object.entries(requisitosPorCargo).map(([cargo, reqs]) => (
                <div key={cargo} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                  <div className="bg-slate-50 px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <FiBriefcase className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-bold text-gray-900 text-sm">{cargo}</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                        {reqs.length} curso(s) exigido(s)
                      </span>
                    </div>

                    {!readOnly && (
                      <button
                        onClick={() => {
                          setReqForm(p => ({ ...p, cargo_nome: cargo }));
                          setShowReqModal(true);
                        }}
                        className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <FiPlus className="w-3 h-3" /> Adicionar curso
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-gray-100">
                    {reqs.map((r, rIdx) => {
                      const globalIdx = (selectedMatriz.requisitos || []).findIndex(x => x === r);
                      return (
                        <div key={r.id || rIdx} className="p-3 px-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors gap-2">
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                                {r.treinamento_nome}
                              </span>
                              {r.sigla && (
                                <span className="px-2 py-0.2 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                                  {r.sigla}
                                </span>
                              )}
                              <span className="px-2 py-0.2 bg-indigo-50 text-indigo-700 rounded text-[10px] font-semibold">
                                {r.regime}
                              </span>
                              {r.obrigatorio ? (
                                <span className="px-2 py-0.2 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold">
                                  Obrigatório
                                </span>
                              ) : (
                                <span className="px-2 py-0.2 bg-yellow-50 text-yellow-700 rounded text-[10px] font-bold">
                                  Recomendado
                                </span>
                              )}
                            </div>
                          </div>

                          {!readOnly && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDeleteRequisito(globalIdx)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Remover este curso da matriz do cargo"
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: IMPORTAR PLANILHA XLSX DO MIO                                  */}
      {/* ===================================================================== */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <FiUpload className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-gray-900">Importar Matriz MIO (XLSX)</h3>
              </div>
              <button onClick={() => setShowImportModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Selecione a planilha Excel exportada do MIO ou PoliWeb (ex: <code>Matriz - Modelo 002_usr_4753.xlsx</code>).
              O portal irá extrair automaticamente os cargos, regimes e requisitos de treinamentos.
            </p>

            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-emerald-500 transition-colors bg-slate-50">
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls"
                onChange={handleUploadXlsx}
                className="hidden"
                id="mio-matrix-file-input"
              />
              <label htmlFor="mio-matrix-file-input" className="cursor-pointer space-y-2 block">
                <FiUpload className="w-8 h-8 text-gray-400 mx-auto" />
                <span className="block text-xs font-bold text-gray-700">
                  {importingFile ? 'Importando dados...' : 'Clique para selecionar a planilha (.xlsx)'}
                </span>
                <span className="block text-[11px] text-gray-400">
                  Compatível com o modelo oficial MIO
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: NOVA / EDITAR MATRIZ                                           */}
      {/* ===================================================================== */}
      {showMatrizModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900">
                {matrizForm.id ? 'Editar Matriz' : 'Nova Matriz de Treinamentos'}
              </h3>
              <button onClick={() => setShowMatrizModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nome da Matriz *</label>
                <input
                  type="text"
                  value={matrizForm.nome}
                  onChange={e => setMatrizForm(p => ({ ...p, nome: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ex: CASTORONE - LUZ MARÍTIMA"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Código</label>
                  <input
                    type="text"
                    value={matrizForm.codigo}
                    onChange={e => setMatrizForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ex: CASTORONE"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Cliente</label>
                  <input
                    type="text"
                    value={matrizForm.cliente}
                    onChange={e => setMatrizForm(p => ({ ...p, cliente: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ex: LUZ MARÍTIMA"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Contrato</label>
                  <input
                    type="text"
                    value={matrizForm.contrato}
                    onChange={e => setMatrizForm(p => ({ ...p, contrato: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ex: CASTORONE - L.M (3)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Responsável</label>
                  <input
                    type="text"
                    value={matrizForm.responsavel}
                    onChange={e => setMatrizForm(p => ({ ...p, responsavel: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ex: JANAINA"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="matriz-ativo-chk"
                  checked={matrizForm.ativo}
                  onChange={e => setMatrizForm(p => ({ ...p, ativo: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <label htmlFor="matriz-ativo-chk" className="text-xs font-bold text-gray-700">
                  Matriz Ativa (utilizada para cômputo de conformidade da tripulação)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => setShowMatrizModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveMatriz}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
              >
                Salvar Matriz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: ADICIONAR TREINAMENTO AO CARGO                                 */}
      {/* ===================================================================== */}
      {showReqModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900">Adicionar Curso à Matriz do Cargo</h3>
              <button onClick={() => setShowReqModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Cargo / Função *</label>
                <input
                  type="text"
                  value={reqForm.cargo_nome}
                  onChange={e => setReqForm(p => ({ ...p, cargo_nome: e.target.value.toUpperCase() }))}
                  list="cargos-suggestions"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ex: COZINHEIRO, AJUDANTE DE COZINHA, PADEIRO"
                />
                <datalist id="cargos-suggestions">
                  {cargosList.map(c => (
                    <option key={c.id} value={c.nome} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Treinamento / Curso *</label>
                <input
                  type="text"
                  value={reqForm.treinamento_nome}
                  onChange={e => setReqForm(p => ({ ...p, treinamento_nome: e.target.value }))}
                  list="treinamentos-suggestions"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ex: Curso básico de segurança de plataforma (CBSP)"
                />
                <datalist id="treinamentos-suggestions">
                  <option value="Curso básico de segurança de plataforma" />
                  <option value="T-HUET" />
                  <option value="CA-EBS" />
                  <option value="BOAS PRÁTICAS" />
                  <option value="COZINHEIRO OFFSHORE" />
                  <option value="PADEIRO - OFFSHORE" />
                  <option value="TAIFEIRO - OFFSHORE " />
                  <option value="Treinamento Básico de Segurança (TBS-I)" />
                  <option value="BOSIET C/ CAE-BS" />
                  <option value="NR-33 Espaço Confinado" />
                  <option value="NR-35 Trabalho em Altura" />
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Regime</label>
                  <select
                    value={reqForm.regime}
                    onChange={e => setReqForm(p => ({ ...p, regime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="Offshore">Offshore</option>
                    <option value="Onshore">Onshore</option>
                    <option value="Geral">Geral (Todos)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Sigla STCW / Código</label>
                  <input
                    type="text"
                    value={reqForm.sigla || ''}
                    onChange={e => setReqForm(p => ({ ...p, sigla: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ex: CBSP, HUET"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="req-obrigatorio-chk"
                  checked={reqForm.obrigatorio}
                  onChange={e => setReqForm(p => ({ ...p, obrigatorio: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <label htmlFor="req-obrigatorio-chk" className="text-xs font-bold text-gray-700">
                  Treinamento Obrigatório para Embarque / Função
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => setShowReqModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRequisito}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
              >
                Adicionar à Matriz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
