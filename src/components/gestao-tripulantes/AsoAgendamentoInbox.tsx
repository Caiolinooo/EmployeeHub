'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  FiCheck, FiRefreshCw, FiShield, FiXCircle,
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useSignature } from '@/contexts/SignatureContext';
import { formatCpf } from '@/lib/utils/identity';
import {
  isAsoAgendamentoStatus,
  labelAsoAgendamentoStatus,
  type AsoAgendamentoStatus,
} from '@/lib/gestao-tripulantes/aso-agendamento-status';
import { GT_PAGE_SCROLLPORT_CLASS } from '@/components/gestao-tripulantes/GtPageShell';

interface InboxRow {
  id: string;
  status: AsoAgendamentoStatus;
  data_solicitada: string | null;
  data_marcada: string | null;
  data_sugerida: string | null;
  data_validade: string | null;
  escala_codigo_solicitada: string | null;
  conflito_on: boolean;
  motivo_reprovacao: string | null;
  observacoes: string | null;
  solicitado_por_nome: string | null;
  aprovado_por_nome: string | null;
  assinatura_hash: string | null;
  colaborador?: {
    id: string;
    nome_completo: string;
    cpf: string;
    matricula: string | null;
    cargo_nome: string | null;
    embarcacao_nome: string | null;
  } | null;
}

function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export default function AsoAgendamentoInbox() {
  const { requestSignature } = useSignature();
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'solicitado' | 'marcado' | 'reprovado' | 'todos'>('solicitado');
  const [motivo, setMotivo] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hashOk, setHashOk] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filtro === 'todos' ? 'include_cancelados=1' : `status=${filtro}`;
      const res = await fetchWithToken(`/api/gestao-tripulantes/aso/agendamentos?${qs}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      setRows((json.data || []) as InboxRow[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar fila de ASO');
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    load();
  }, [load]);

  const pendentes = useMemo(
    () => rows.filter((r) => r.status === 'solicitado').length,
    [rows],
  );

  const decidir = async (row: InboxRow, acao: 'aprovar' | 'reprovar') => {
    if (acao === 'reprovar' && !String(motivo[row.id] || '').trim()) {
      toast.error('Informe o motivo da reprovação');
      return;
    }
    const dataLabel = formatDateBR(row.data_solicitada);
    const sign = await requestSignature({
      title: acao === 'aprovar' ? 'Assinar aprovação de ASO' : 'Assinar reprovação de ASO',
      description: `${acao === 'aprovar' ? 'Aprovar' : 'Reprovar'} ASO de ${row.colaborador?.nome_completo || 'colaborador'} em ${dataLabel}.`,
    });
    if (!sign) return;

    try {
      setBusyId(row.id);
      const path = acao === 'aprovar' ? 'aprovar' : 'reprovar';
      const res = await fetchWithToken(`/api/gestao-tripulantes/aso/agendamentos/${row.id}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature_url: sign.signatureUrl,
          motivo: motivo[row.id] || '',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      if (json.signatureHash) setHashOk((p) => ({ ...p, [row.id]: json.signatureHash }));
      toast.success(json.message || 'Registrado');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha na decisão');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FiShield className="text-abz-blue" />
            ASO — aprovação da logística
          </h2>
          <p className="text-xs text-gray-500">
            Solicitações do DP para não conflitar com ON/DBA. Aprovação gera carimbo SHA-256 (GT_ASO_AGENDAMENTO) e marca o exame.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as typeof filtro)}
            className="text-xs border rounded-lg px-2 py-1.5"
          >
            <option value="solicitado">Pendentes ({pendentes})</option>
            <option value="marcado">Marcados</option>
            <option value="reprovado">Reprovados</option>
            <option value="todos">Todos</option>
          </select>
          <button type="button" onClick={load} className="p-2 border rounded-lg">
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className={`bg-white border border-gray-200 rounded-xl ${GT_PAGE_SCROLLPORT_CLASS}`}>
        <table className="min-w-[720px] w-full text-xs text-left">
          <thead className="bg-gray-50 font-bold uppercase text-gray-600 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2">Colaborador</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Escala</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">DP</th>
              <th className="px-3 py-2">Decisão</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  <FiRefreshCw className="animate-spin inline mr-2" /> Carregando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Nenhuma solicitação neste filtro.</td>
              </tr>
            ) : (
              rows.map((row) => {
                const st = isAsoAgendamentoStatus(row.status) ? row.status : 'sugerido';
                return (
                  <tr key={row.id} className="align-top">
                    <td className="px-3 py-3">
                      <div className="font-bold text-gray-900">{row.colaborador?.nome_completo || '—'}</div>
                      <div className="font-mono text-gray-500">{formatCpf(row.colaborador?.cpf || '') || row.colaborador?.cpf}</div>
                      <div className="text-gray-500">{row.colaborador?.cargo_nome || '—'} · {row.colaborador?.embarcacao_nome || '—'}</div>
                    </td>
                    <td className="px-3 py-3 font-mono font-semibold">
                      {formatDateBR(row.data_solicitada || row.data_marcada || row.data_sugerida)}
                      <div className="text-[10px] text-gray-500 font-sans">Validade ASO {formatDateBR(row.data_validade)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`font-bold ${row.conflito_on ? 'text-red-700' : 'text-emerald-700'}`}>
                        {row.escala_codigo_solicitada || '—'}
                      </span>
                      {row.conflito_on && <div className="text-[10px] text-red-600">Conflito com ON</div>}
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-bold">{labelAsoAgendamentoStatus(st)}</span>
                      {row.motivo_reprovacao && (
                        <div className="text-red-700 mt-1 max-w-xs">Motivo: {row.motivo_reprovacao}</div>
                      )}
                      {(hashOk[row.id] || row.assinatura_hash) && st === 'marcado' && (
                        <div className="mt-1 font-mono text-[10px] break-all text-emerald-800">
                          {hashOk[row.id] || row.assinatura_hash}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">{row.solicitado_por_nome || '—'}</td>
                    <td className="px-3 py-3 space-y-2 min-w-[16rem]">
                      {st === 'solicitado' ? (
                        <>
                          <textarea
                            rows={2}
                            placeholder="Motivo se reprovar"
                            value={motivo[row.id] || ''}
                            onChange={(e) => setMotivo((p) => ({ ...p, [row.id]: e.target.value }))}
                            className="w-full border rounded-lg px-2 py-1 text-xs"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => decidir(row, 'aprovar')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold disabled:opacity-50"
                            >
                              <FiCheck /> Aprovar & marcar
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => decidir(row, 'reprovar')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg font-bold disabled:opacity-50"
                            >
                              <FiXCircle /> Reprovar
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="text-gray-500">
                          {row.aprovado_por_nome ? `Por ${row.aprovado_por_nome}` : '—'}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
