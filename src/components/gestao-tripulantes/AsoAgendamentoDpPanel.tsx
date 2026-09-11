'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { FiAlertTriangle, FiCalendar, FiCheck, FiRefreshCw, FiSend } from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useSignature } from '@/contexts/SignatureContext';
import { formatCpf } from '@/lib/utils/identity';
import {
  isAsoAgendamentoStatus,
  labelAsoAgendamentoStatus,
  type AsoAgendamentoStatus,
  type AsoSugestaoData,
} from '@/lib/gestao-tripulantes/aso-agendamento-status';
import { GT_PAGE_SCROLLPORT_CLASS } from '@/components/gestao-tripulantes/GtPageShell';

export interface AsoVencimentoRow {
  id: string;
  titulo: string;
  data_validade: string;
  alerta: 'vencido' | 'vencendo';
  colaborador?: {
    id: string;
    nome_completo: string;
    cpf: string;
    matricula: string | null;
    cargo_nome?: string | null;
    embarcacao_nome?: string | null;
  } | null;
}

interface AgendamentoRow {
  id: string;
  colaborador_id: string;
  documento_aso_id: string | null;
  status: AsoAgendamentoStatus;
  data_sugerida: string | null;
  data_solicitada: string | null;
  data_marcada: string | null;
  data_validade: string | null;
  datas_sugeridas: AsoSugestaoData[];
  escala_codigo_solicitada: string | null;
  conflito_on: boolean;
  motivo_reprovacao: string | null;
  observacoes: string | null;
  colaborador?: AsoVencimentoRow['colaborador'] & { id: string };
}

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatCpfDisplay(cpf: string | null | undefined): string {
  if (!cpf) return '—';
  return formatCpf(cpf) || cpf;
}

function statusBadgeClass(status: AsoAgendamentoStatus): string {
  switch (status) {
    case 'sugerido':
      return 'bg-slate-100 text-slate-800';
    case 'solicitado':
      return 'bg-amber-100 text-amber-900';
    case 'aprovado':
      return 'bg-sky-100 text-sky-900';
    case 'marcado':
      return 'bg-emerald-100 text-emerald-800';
    case 'reprovado':
      return 'bg-red-100 text-red-800';
    case 'cancelado':
      return 'bg-gray-100 text-gray-600';
    default: {
      const _e: never = status;
      return _e;
    }
  }
}

interface AsoAgendamentoDpPanelProps {
  asosPendentes: AsoVencimentoRow[];
  loading: boolean;
  antecedenciaDias: number;
  onOpenColaborador: (id: string) => void;
  onRefreshVencimentos: () => Promise<void>;
}

export default function AsoAgendamentoDpPanel({
  asosPendentes,
  loading,
  antecedenciaDias,
  onOpenColaborador,
  onRefreshVencimentos,
}: AsoAgendamentoDpPanelProps) {
  const { requestSignature, hasSignature } = useSignature();
  const [agendamentos, setAgendamentos] = useState<AgendamentoRow[]>([]);
  const [loadingAg, setLoadingAg] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sugestoes, setSugestoes] = useState<Record<string, AsoSugestaoData[]>>({});
  const [dataPick, setDataPick] = useState<Record<string, string>>({});
  const [obs, setObs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAgendamentos = useCallback(async () => {
    setLoadingAg(true);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/aso/agendamentos?include_cancelados=1');
      const json = await res.json();
      if (res.ok && json.success) {
        setAgendamentos((json.data || []) as AgendamentoRow[]);
      }
    } catch {
      toast.error('Erro ao carregar agendamentos de ASO');
    } finally {
      setLoadingAg(false);
    }
  }, []);

  useEffect(() => {
    loadAgendamentos();
  }, [loadAgendamentos]);

  const byColab = useMemo(() => {
    const map = new Map<string, AgendamentoRow>();
    for (const row of agendamentos) {
      const prev = map.get(row.colaborador_id);
      if (!prev) {
        map.set(row.colaborador_id, row);
        continue;
      }
      const rank = (s: AsoAgendamentoStatus) => {
        switch (s) {
          case 'solicitado': return 5;
          case 'marcado': return 4;
          case 'aprovado': return 3;
          case 'sugerido': return 2;
          case 'reprovado': return 1;
          case 'cancelado': return 0;
          default: {
            const _e: never = s;
            return _e;
          }
        }
      };
      if (rank(row.status) >= rank(prev.status)) map.set(row.colaborador_id, row);
    }
    return map;
  }, [agendamentos]);

  const loadSugestoes = async (colaboradorId: string, dataValidade: string) => {
    try {
      const q = new URLSearchParams({ colaborador_id: colaboradorId, data_validade: dataValidade });
      const res = await fetchWithToken(`/api/gestao-tripulantes/aso/agendamentos/sugestoes?${q}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setSugestoes((prev) => ({ ...prev, [colaboradorId]: json.sugestoes || [] }));
        const first = (json.sugestoes as AsoSugestaoData[] | undefined)?.find((s) => !s.bloqueado) || json.sugestoes?.[0];
        if (first?.data) {
          setDataPick((prev) => ({ ...prev, [colaboradorId]: prev[colaboradorId] || first.data }));
        }
      }
    } catch {
      toast.error('Erro ao sugerir datas');
    }
  };

  const handleGerarLote = async () => {
    try {
      setBusyId('lote');
      const res = await fetchWithToken('/api/gestao-tripulantes/aso/agendamentos/sugestoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      toast.success(json.message || 'Sugestões geradas');
      await Promise.all([loadAgendamentos(), onRefreshVencimentos()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao gerar sugestões');
    } finally {
      setBusyId(null);
    }
  };

  const handleSolicitar = async (aso: AsoVencimentoRow) => {
    const colaboradorId = aso.colaborador?.id;
    if (!colaboradorId) return;
    const data = dataPick[colaboradorId];
    if (!data) {
      toast.error('Escolha uma data');
      return;
    }

    const sign = await requestSignature({
      title: 'Assinar solicitação de ASO',
      description: `Confirme a solicitação de ASO em ${formatDateBR(data)} para ${aso.colaborador?.nome_completo}. A logística receberá e-mail e notificação.`,
    });
    if (!sign && !hasSignature) {
      toast.error('Assinatura digital é obrigatória para enviar à logística');
      return;
    }
    if (!sign) return;

    try {
      setBusyId(colaboradorId);
      const res = await fetchWithToken('/api/gestao-tripulantes/aso/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaborador_id: colaboradorId,
          documento_aso_id: aso.id,
          data_validade: aso.data_validade,
          data_solicitada: data,
          observacoes: obs[colaboradorId] || '',
          signature_url: sign.signatureUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      toast.success(json.message || 'Enviado à logística');
      await loadAgendamentos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao solicitar');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col flex-1 min-h-0 overflow-hidden gap-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Controle e agendamento de ASO</h2>
          <p className="text-xs text-gray-500">
            Vencidos ou vencendo em até {antecedenciaDias} dias. Sugestões preferem STB e evitam ON.
            Após escolher a data, a logística aprova com assinatura digital.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGerarLote}
          disabled={busyId === 'lote'}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-abz-blue bg-blue-50 hover:bg-blue-100 rounded-xl disabled:opacity-50"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${busyId === 'lote' ? 'animate-spin' : ''}`} />
          Gerar sugestões pela escala
        </button>
      </div>

      <div className={`border border-gray-200 rounded-xl ${GT_PAGE_SCROLLPORT_CLASS}`}>
        <table className="min-w-[860px] w-full divide-y divide-gray-200 text-left text-xs">
          <thead className="bg-gray-50 text-gray-700 font-bold uppercase sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3">Colaborador</th>
              <th className="px-4 py-3">CPF</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3">Embarcação</th>
              <th className="px-4 py-3 text-center">Validade</th>
              <th className="px-4 py-3 text-center">Alerta</th>
              <th className="px-4 py-3 text-center">Agendamento</th>
              <th className="px-4 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading || loadingAg ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  <FiRefreshCw className="animate-spin inline w-5 h-5 mr-2 text-abz-blue" />
                  Carregando vencimentos de ASO...
                </td>
              </tr>
            ) : asosPendentes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-emerald-700 font-medium">
                  ✓ Todos os ASOs estão em dia e conformes!
                </td>
              </tr>
            ) : (
              asosPendentes.map((a, idx) => {
                const isV = a.alerta === 'vencido';
                const colabId = a.colaborador?.id || '';
                const ag = colabId ? byColab.get(colabId) : undefined;
                const st = ag && isAsoAgendamentoStatus(ag.status) ? ag.status : null;
                const open = expandedId === a.id;
                return (
                  <React.Fragment key={a.id || idx}>
                    <tr className="hover:bg-gray-50">
                      <td
                        className={`px-4 py-3 font-bold text-gray-900 ${colabId ? 'cursor-pointer' : ''}`}
                        onClick={() => colabId && onOpenColaborador(colabId)}
                      >
                        {a.colaborador?.nome_completo || 'N/A'}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-600">{formatCpfDisplay(a.colaborador?.cpf)}</td>
                      <td className="px-4 py-3 text-gray-600">{a.colaborador?.cargo_nome || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{a.colaborador?.embarcacao_nome || '—'}</td>
                      <td className="px-4 py-3 text-center font-bold font-mono text-gray-900">{formatDateBR(a.data_validade)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          isV ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isV ? 'VENCIDO' : 'VENCENDO'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {st ? (
                          <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[10px] ${statusBadgeClass(st)}`}>
                            {labelAsoAgendamentoStatus(st)}
                            {st === 'marcado' && ag?.data_marcada ? ` · ${formatDateBR(ag.data_marcada)}` : ''}
                            {st === 'solicitado' && ag?.data_solicitada ? ` · ${formatDateBR(ag.data_solicitada)}` : ''}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                        {st === 'reprovado' && ag?.motivo_reprovacao && (
                          <div className="mt-1 text-[10px] text-red-700 font-medium max-w-[14rem] mx-auto">
                            Motivo: {ag.motivo_reprovacao}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const next = open ? null : a.id;
                            setExpandedId(next);
                            if (next && colabId) loadSugestoes(colabId, a.data_validade);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg"
                        >
                          <FiCalendar className="w-3 h-3" />
                          {st === 'marcado' ? 'Ver' : 'Agendar'}
                        </button>
                      </td>
                    </tr>
                    {open && colabId && (
                      <tr className="bg-slate-50">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="space-y-3">
                            <p className="text-[11px] font-semibold text-slate-600 uppercase">Datas sugeridas (STB preferido, ON evitado)</p>
                            <div className="flex flex-wrap gap-2">
                              {(sugestoes[colabId] || ag?.datas_sugeridas || []).map((s) => (
                                <button
                                  key={s.data}
                                  type="button"
                                  onClick={() => setDataPick((p) => ({ ...p, [colabId]: s.data }))}
                                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold ${
                                    dataPick[colabId] === s.data
                                      ? 'border-abz-blue bg-blue-100 text-abz-blue'
                                      : s.bloqueado
                                        ? 'border-red-200 bg-red-50 text-red-800'
                                        : 'border-slate-200 bg-white text-slate-800'
                                  }`}
                                >
                                  {formatDateBR(s.data)} · {s.codigo_escala}
                                  {s.bloqueado ? ' (conflito)' : ''}
                                </button>
                              ))}
                            </div>
                            <div className="flex flex-wrap items-end gap-3">
                              <label className="text-xs">
                                <span className="block font-semibold text-gray-700 mb-1">Data escolhida</span>
                                <input
                                  type="date"
                                  value={dataPick[colabId] || ''}
                                  onChange={(e) => setDataPick((p) => ({ ...p, [colabId]: e.target.value }))}
                                  className="px-2 py-1.5 border rounded-lg text-xs"
                                />
                              </label>
                              <label className="text-xs flex-1 min-w-[12rem]">
                                <span className="block font-semibold text-gray-700 mb-1">Observação</span>
                                <input
                                  type="text"
                                  value={obs[colabId] || ''}
                                  onChange={(e) => setObs((p) => ({ ...p, [colabId]: e.target.value }))}
                                  className="w-full px-2 py-1.5 border rounded-lg text-xs"
                                  placeholder="Clínica, turno, restrição…"
                                />
                              </label>
                              {st !== 'marcado' && st !== 'solicitado' && (
                                <button
                                  type="button"
                                  disabled={busyId === colabId}
                                  onClick={() => handleSolicitar(a)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-abz-blue text-white rounded-lg text-xs font-bold disabled:opacity-50"
                                >
                                  {busyId === colabId ? <FiRefreshCw className="animate-spin w-3.5 h-3.5" /> : <FiSend className="w-3.5 h-3.5" />}
                                  Enviar à logística
                                </button>
                              )}
                              {st === 'solicitado' && (
                                <span className="text-xs text-amber-800 font-semibold flex items-center gap-1">
                                  <FiAlertTriangle /> Aguardando aprovação da logística
                                </span>
                              )}
                              {st === 'marcado' && (
                                <span className="text-xs text-emerald-800 font-semibold flex items-center gap-1">
                                  <FiCheck /> Marcado em {formatDateBR(ag?.data_marcada)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
