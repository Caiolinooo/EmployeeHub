'use client';

import React, { useEffect, useState } from 'react';
import { FiAlertTriangle, FiClock, FiX } from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';

export interface DocumentoAlertaUI {
  id: string;
  colaborador_id: string;
  colaborador_nome: string | null;
  colaborador_matricula: string | null;
  tipo_documento: string;
  titulo: string;
  data_validade: string;
  alerta: 'vencido' | 'vencendo';
  papel: 'vigente' | 'historico';
  aba: 'treinamentos' | 'aso' | 'passaportes' | 'documentos';
  status_stale: boolean;
  origem: string | null;
}

interface AlertasPayload {
  hoje: string;
  vencidos_vigentes: DocumentoAlertaUI[];
  vencendo_vigentes: DocumentoAlertaUI[];
  vencidos_historico: DocumentoAlertaUI[];
  totais: {
    vencidos_vigentes: number;
    vencendo_vigentes: number;
    vencidos_historico: number;
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenDocumento: (item: DocumentoAlertaUI) => void;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function Row({
  item,
  onOpen,
}: {
  item: DocumentoAlertaUI;
  onOpen: (item: DocumentoAlertaUI) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{item.colaborador_nome || '—'}</p>
          <p className="text-xs text-gray-500 truncate">
            {item.titulo} · {item.tipo_documento}
            {item.colaborador_matricula ? ` · matr. ${item.colaborador_matricula}` : ''}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Validade {formatDate(item.data_validade)} · aba {item.aba}
            {item.status_stale ? ' · status no banco desatualizado' : ''}
            {item.origem ? ` · origem ${item.origem}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
            item.papel === 'historico'
              ? 'bg-slate-100 text-slate-600'
              : item.alerta === 'vencido'
                ? 'bg-red-100 text-red-700'
                : 'bg-orange-100 text-orange-700'
          }`}
        >
          {item.papel === 'historico' ? 'Histórico' : item.alerta}
        </span>
      </div>
    </button>
  );
}

export default function DocsAlertasPanel({ open, onClose, onOpenDocumento }: Props) {
  const [data, setData] = useState<AlertasPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWithToken('/api/gestao-tripulantes/documentos/alertas')
      .then(async (res) => {
        if (!res.ok) throw new Error('Falha ao carregar alertas');
        const json = await res.json();
        if (!cancelled) setData(json.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-red-50/60">
        <div className="flex items-center gap-2 text-red-800">
          <FiAlertTriangle className="w-4 h-4" />
          <h3 className="text-sm font-bold">Documentos com alerta de validade</h3>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/80" aria-label="Fechar">
          <FiX className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      <p className="px-4 py-2 text-xs text-gray-500">
        O card conta só o documento <strong>vigente</strong> de cada tipo/curso. Cópias antigas aparecem como histórico — não somam no KPI.
      </p>
      {loading && <p className="px-4 py-6 text-sm text-gray-400">Carregando…</p>}
      {error && <p className="px-4 py-6 text-sm text-red-600">{error}</p>}
      {data && (
        <div className="max-h-[28rem] overflow-y-auto">
          <div className="px-4 py-2 text-xs font-bold text-red-700 uppercase tracking-wide">
            Vigentes vencidos ({data.totais.vencidos_vigentes})
          </div>
          {data.vencidos_vigentes.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">Nenhum documento vigente vencido.</p>
          )}
          {data.vencidos_vigentes.map((item) => (
            <Row key={item.id} item={item} onOpen={onOpenDocumento} />
          ))}
          <div className="px-4 py-2 text-xs font-bold text-orange-700 uppercase tracking-wide flex items-center gap-1">
            <FiClock className="w-3 h-3" /> Vigentes vencendo ({data.totais.vencendo_vigentes})
          </div>
          {data.vencendo_vigentes.map((item) => (
            <Row key={item.id} item={item} onOpen={onOpenDocumento} />
          ))}
          <div className="px-4 py-2 text-xs font-bold text-slate-600 uppercase tracking-wide">
            Histórico vencido — não entra no KPI ({data.totais.vencidos_historico})
          </div>
          {data.vencidos_historico.map((item) => (
            <Row key={item.id} item={item} onOpen={onOpenDocumento} />
          ))}
        </div>
      )}
    </div>
  );
}
