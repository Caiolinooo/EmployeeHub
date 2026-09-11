'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FiUsers,
  FiCheck,
  FiX,
  FiCheckSquare,
  FiSquare,
  FiExternalLink,
  FiAward
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface ColaboradorOption {
  id: string;
  nome_completo: string;
  cargo_nome?: string;
  embarcacao_nome?: string;
  matricula?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialColaborador?: {
    id: string;
    nome_completo: string;
    cargo_nome?: string;
  } | null;
  onTreinamentoLancado?: () => void;
}

export default function ModalListaPresencaTreinamento({
  isOpen,
  onClose,
  initialColaborador,
  onTreinamentoLancado,
}: Props) {
  const router = useRouter();
  const [cursoNome, setCursoNome] = useState('');
  const [instrutor, setInstrutor] = useState('');
  const [dataEvento, setDataEvento] = useState(new Date().toISOString().split('T')[0]);
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFim, setHoraFim] = useState('12:00');
  const [local, setLocal] = useState('');
  const [cargaHoraria, setCargaHoraria] = useState('4');
  const [permanente, setPermanente] = useState(false);
  const [dataValidade, setDataValidade] = useState('');

  // Tripulantes list and selection
  const [colaboradores, setColaboradores] = useState<ColaboradorOption[]>([]);
  const [selectedColabIds, setSelectedColabIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingColabs, setLoadingColabs] = useState(false);

  // Creation state
  const [creating, setCreating] = useState(false);
  const [createdLista, setCreatedLista] = useState<{ id: string; titulo: string } | null>(null);
  const [lancarAutomatico, setLancarAutomatico] = useState(true);

  // Load collaborators
  const loadColaboradores = useCallback(async () => {
    try {
      setLoadingColabs(true);
      const res = await fetchWithToken('/api/gestao-tripulantes/colaboradores?limit=500');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setColaboradores(json.data);
      }
    } catch {
      /* fail-soft */
    } finally {
      setLoadingColabs(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadColaboradores();
      setCreatedLista(null);
      if (initialColaborador?.id) {
        setSelectedColabIds(new Set([initialColaborador.id]));
      } else {
        setSelectedColabIds(new Set());
      }
    }
  }, [isOpen, initialColaborador, loadColaboradores]);

  if (!isOpen) return null;

  const toggleSelectColab = (id: string) => {
    setSelectedColabIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedColabIds);
    filteredColabs.forEach(c => next.add(c.id));
    setSelectedColabIds(next);
  };

  const clearSelection = () => {
    setSelectedColabIds(new Set());
  };

  const filteredColabs = colaboradores.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.nome_completo || '').toLowerCase().includes(term) ||
      (c.cargo_nome || '').toLowerCase().includes(term) ||
      (c.embarcacao_nome || '').toLowerCase().includes(term) ||
      (c.matricula || '').includes(term)
    );
  });

  // Handle submit and create attendance list
  const handleCreateLista = async () => {
    if (!cursoNome.trim()) {
      toast.error('Informe o nome do treinamento');
      return;
    }
    if (!dataEvento) {
      toast.error('Informe a data do treinamento');
      return;
    }
    if (selectedColabIds.size === 0) {
      toast.error('Selecione ao menos um participante');
      return;
    }

    try {
      setCreating(true);
      const tituloLista = `Treinamento Interno: ${cursoNome.trim()}`;
      const pautaTexto = `Treinamento interno de capacitação e conformidade.\nCurso: ${cursoNome.trim()}\nInstrutor/Responsável: ${instrutor || 'Não informado'}\nCarga Horária: ${cargaHoraria || '4'}h`;

      // 1. Create lista_presenca
      const resLista = await fetchWithToken('/api/lista-presenca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: tituloLista,
          data_evento: dataEvento,
          hora_inicio: horaInicio || null,
          hora_fim: horaFim || null,
          local: local || 'Base / Embarcação ABZ Group',
          pauta: pautaTexto,
          acesso_publico: true,
        }),
      });

      const jsonLista = await resLista.json();
      if (!resLista.ok || !jsonLista.lista?.id) {
        throw new Error(jsonLista.error || 'Falha ao criar lista de presença');
      }

      const listaId = jsonLista.lista.id;
      setCreatedLista({ id: listaId, titulo: tituloLista });

      // 2. Add participants to registros_presenca
      const selectedColabsList = colaboradores.filter(c => selectedColabIds.has(c.id));
      let registrosInseridos = 0;

      for (const colab of selectedColabsList) {
        try {
          await fetchWithToken('/api/lista-presenca/registros', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lista_id: listaId,
              nome_completo: colab.nome_completo,
              funcao: colab.cargo_nome || 'Tripulante',
              empresa: 'ABZ Group',
            }),
          });
          registrosInseridos++;
        } catch {
          /* continue inserting rest */
        }
      }

      // 3. If auto-launch is checked, create training records for each participant
      if (lancarAutomatico) {
        let lancadosCount = 0;
        for (const colab of selectedColabsList) {
          try {
            await fetchWithToken('/api/gestao-tripulantes/documentos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                colaborador_id: colab.id,
                tipo_documento: 'treinamento',
                titulo: cursoNome.trim(),
                subtipo: 'TREINAMENTO INTERNO',
                orgao_emissor: instrutor ? `ABZ Group / ${instrutor}` : 'ABZ Group',
                data_emissao: dataEvento,
                data_validade: permanente ? null : (dataValidade || null),
                origem: 'local',
                descricao: `Concluído via Lista de Presença Interna (${tituloLista})`,
                treinamento_data: {
                  nome_curso: cursoNome.trim(),
                  instituicao: 'ABZ Group',
                  carga_horaria: cargaHoraria ? Number(cargaHoraria) : 4,
                  tipo_curso: 'interno',
                },
              }),
            });
            lancadosCount++;
          } catch {
            /* continue */
          }
        }
        toast.success(`Lista criada e treinamento lançado para ${lancadosCount} colaboradores!`);
        onTreinamentoLancado?.();
      } else {
        toast.success(`Lista de presença criada com ${registrosInseridos} participantes!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar lista de presença');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[95dvh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2">
            <FiAward className="w-5 h-5 shrink-0" />
            <div>
              <h3 className="font-bold text-sm sm:text-base">Lista de Presença — Treinamento Interno</h3>
              <p className="text-xs text-blue-100 hidden sm:block">
                Gere a lista de presença e lance automaticamente o treinamento para a equipe.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
          {createdLista ? (
            <div className="space-y-4 text-center py-6">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <FiCheck className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-gray-900 text-base">Lista de Presença Criada com Sucesso!</h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                A lista foi registrada e vinculada aos participantes. Você pode abrir a lista para coletar assinaturas digitais ou baixar o formulário em PDF.
              </p>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => router.push(`/lista-presenca/${createdLista.id}`)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <FiExternalLink className="w-4 h-4" />
                  Abrir Lista de Presença
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold"
                >
                  Concluir
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Informações do Treinamento */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-gray-700 uppercase">Dados do Treinamento</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Nome do Treinamento / Tema *
                    </label>
                    <input
                      type="text"
                      value={cursoNome}
                      onChange={e => setCursoNome(e.target.value)}
                      list="sugestoes-treinamento-interno"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      placeholder="Ex: BOAS PRÁTICAS, DDS, INTEGRAÇÃO"
                    />
                    <datalist id="sugestoes-treinamento-interno">
                      <option value="BOAS PRÁTICAS" />
                      <option value="INTEGRAÇÃO OPERACIONAL" />
                      <option value="DDS - DIÁLOGO DIÁRIO DE SEGURANÇA" />
                      <option value="TREINAMENTO BÁSICO DE SEGURANÇA" />
                      <option value="PROCEDIMENTOS DE EMERGÊNCIA" />
                      <option value="MANUSEIO SEGURO DE PRODUTOS QUÍMICOS" />
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Instrutor / Responsável
                    </label>
                    <input
                      type="text"
                      value={instrutor}
                      onChange={e => setInstrutor(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      placeholder="Nome do instrutor ou técnico"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Data *</label>
                    <input
                      type="date"
                      value={dataEvento}
                      onChange={e => setDataEvento(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Início</label>
                    <input
                      type="time"
                      value={horaInicio}
                      onChange={e => setHoraInicio(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Fim</label>
                    <input
                      type="time"
                      value={horaFim}
                      onChange={e => setHoraFim(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Carga Horária</label>
                    <input
                      type="number"
                      value={cargaHoraria}
                      onChange={e => setCargaHoraria(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      placeholder="Ex: 4"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Local / Unidade</label>
                  <input
                    type="text"
                    value={local}
                    onChange={e => setLocal(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    placeholder="Ex: Sala de Reuniões / Base Macaé / Embarcação"
                  />
                </div>
              </div>

              {/* Seleção de Participantes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <FiUsers className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-gray-700 uppercase">
                      Participantes Selecionados ({selectedColabIds.size})
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button onClick={selectAllFiltered} className="text-blue-600 hover:underline font-semibold">
                      Selecionar visíveis
                    </button>
                    <span className="text-gray-300">|</span>
                    <button onClick={clearSelection} className="text-gray-500 hover:underline">
                      Limpar
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar colaborador por nome, cargo ou matrícula..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />

                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white">
                  {loadingColabs ? (
                    <div className="p-4 text-center text-xs text-gray-400">Carregando colaboradores...</div>
                  ) : filteredColabs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">Nenhum colaborador encontrado.</div>
                  ) : (
                    filteredColabs.map(c => {
                      const isSelected = selectedColabIds.has(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleSelectColab(c.id)}
                          className={`p-2.5 px-3 flex items-center justify-between text-xs cursor-pointer hover:bg-blue-50/60 transition ${
                            isSelected ? 'bg-blue-50/80 font-semibold text-blue-900' : 'text-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isSelected ? (
                              <FiCheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                            ) : (
                              <FiSquare className="w-4 h-4 text-gray-400 shrink-0" />
                            )}
                            <span className="truncate">{c.nome_completo}</span>
                            {c.cargo_nome && (
                              <span className="text-[11px] text-gray-400 font-normal truncate">
                                · {c.cargo_nome}
                              </span>
                            )}
                          </div>
                          {c.embarcacao_nome && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded shrink-0">
                              {c.embarcacao_nome}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Opções de Lançamento Automático */}
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto-launch-chk"
                    checked={lancarAutomatico}
                    onChange={e => setLancarAutomatico(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <label htmlFor="auto-launch-chk" className="font-bold text-gray-900 cursor-pointer">
                    Lançar automaticamente o certificado/conclusão no cadastro dos participantes selecionados
                  </label>
                </div>

                {lancarAutomatico && (
                  <div className="grid grid-cols-2 gap-3 pl-6 pt-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="permanente-chk"
                        checked={permanente}
                        onChange={e => setPermanente(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <label htmlFor="permanente-chk" className="text-gray-700 font-medium">
                        Treinamento Permanente (sem validade)
                      </label>
                    </div>

                    {!permanente && (
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                          Data de Validade
                        </label>
                        <input
                          type="date"
                          value={dataValidade}
                          onChange={e => setDataValidade(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!createdLista && (
          <div className="p-3 sm:p-4 bg-slate-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 shrink-0">
            <span className="text-xs text-gray-500 self-start sm:self-auto">
              <strong>{selectedColabIds.size}</strong> participante(s) selecionado(s)
            </span>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateLista}
                disabled={creating}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {creating ? 'Gerando...' : 'Gerar Lista de Presença'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
