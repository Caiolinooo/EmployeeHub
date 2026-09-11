'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  FiRefreshCw, FiCheck, FiX, FiExternalLink, FiAlertCircle, FiActivity
} from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { toast } from 'react-hot-toast';

interface ASOPendente {
  id: string;
  colaborador_id: string | null;
  colaborador_nome: string | null;
  cpf: string;
  tipo_exame: string;
  resultado: string;
  data_realizacao: string;
  data_validade: string | null;
  medico_nome: string | null;
  medico_crm: string | null;
  nome_clinica: string | null;
  poliweb_id: string;
  status_revisao: string;
  arquivo_url: string | null;
}

interface Props {
  compact?: boolean;
}

export default function AsoReviewPanel({ compact = false }: Props) {
  const { t } = useI18n();
  const [asos, setAsos] = useState<ASOPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [warning, setWarning] = useState<string | null>(null);

  const fetchAsos = useCallback(async (sync = false) => {
    try {
      setLoading(true);
      setWarning(null);
      const url = sync
        ? '/api/gestao-tripulantes/poliweb/asos-pendentes?sync=1'
        : '/api/gestao-tripulantes/poliweb/asos-pendentes';
      const res = await fetchWithToken(url);
      const json = await res.json().catch(() => ({} as Record<string, unknown>));
      const payload = json as {
        ok?: boolean;
        data?: unknown;
        warning?: string;
        error?: string;
      };
      const raw = payload.data;
      const list: ASOPendente[] = Array.isArray(raw)
        ? raw
        : raw && typeof raw === 'object' && Array.isArray((raw as { importados?: unknown }).importados)
          ? (raw as { importados: ASOPendente[] }).importados
          : [];
      setAsos(list);
      if (!res.ok || payload.ok === false) {
        setWarning(payload.warning || payload.error || 'Não foi possível carregar ASOs do PoliWeb');
      } else if (payload.warning) {
        setWarning(payload.warning);
      }
    } catch {
      setAsos([]);
      setWarning('Não foi possível carregar ASOs do PoliWeb');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAsos(); }, [fetchAsos]);

  const handleReview = async (id: string, acao: 'aprovado' | 'rejeitado') => {
    try {
      setProcessing(id);
      const res = await fetchWithToken(`/api/gestao-tripulantes/poliweb/revisar/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, comentario: comment[id] || '' }),
      });
      if (!res.ok) {
        toast.error(t('gestaoTripulantes.errors.saveError'));
        return;
      }
      toast.success(acao === 'aprovado' ? 'ASO aprovado e importado!' : 'ASO rejeitado');
      setAsos(prev => prev.filter(a => a.id !== id));
    } catch {
      toast.error(t('gestaoTripulantes.errors.saveError'));
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="animate-pulse flex gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (asos.length === 0) {
    if (compact && !warning) return null;
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center space-y-2">
        {warning ? (
          <p className="flex items-center justify-center gap-2 text-amber-700 text-sm">
            <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
            {warning}
          </p>
        ) : (
          <>
            <FiActivity className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">{t('gestaoTripulantes.aso.pendingReview', 'Nenhum ASO pendente de revisão')}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-orange-50 border-b border-orange-200">
        <div className="flex items-center gap-2">
          <FiAlertCircle className="text-orange-500 w-4 h-4" />
          <span className="text-sm font-semibold text-orange-800">
            {asos.length} ASO(s) {t('gestaoTripulantes.aso.pendingReview', 'pendentes de revisão')}
          </span>
        </div>
        <button
          onClick={() => fetchAsos(true)}
          className="p-1.5 text-orange-500 hover:bg-orange-100 rounded transition"
          title="Atualizar"
        >
          <FiRefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {warning && (
        <p className="px-5 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">
          {warning}
        </p>
      )}

      {/* List */}
      <div className="divide-y divide-gray-100">
        {asos.map(aso => (
          <div key={aso.id} className="p-4 hover:bg-gray-50">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-semibold text-sm text-gray-800 truncate">
                    {aso.colaborador_nome || aso.cpf}
                  </p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    aso.tipo_exame === 'admissional' ? 'bg-blue-100 text-blue-700' :
                    aso.tipo_exame === 'periodico' ? 'bg-purple-100 text-purple-700' :
                    aso.tipo_exame === 'demissional' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {aso.tipo_exame}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    aso.resultado === 'apto' ? 'bg-green-100 text-green-700' :
                    aso.resultado === 'inapto' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {aso.resultado}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                  <span>CPF: {aso.cpf}</span>
                  {aso.data_realizacao && (
                    <span>Realizado: {new Date(aso.data_realizacao).toLocaleDateString('pt-BR')}</span>
                  )}
                  {aso.data_validade && (
                    <span>Válido até: {new Date(aso.data_validade).toLocaleDateString('pt-BR')}</span>
                  )}
                  {aso.medico_nome && <span>Dr. {aso.medico_nome}</span>}
                </div>

                {/* Comment field */}
                <input
                  type="text"
                  placeholder="Comentário (opcional)..."
                  className="mt-2 w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={comment[aso.id] || ''}
                  onChange={e => setComment(prev => ({ ...prev, [aso.id]: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {aso.arquivo_url && (
                  <a
                    href={aso.arquivo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition"
                    title="Ver PDF"
                  >
                    <FiExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => handleReview(aso.id, 'aprovado')}
                  disabled={processing === aso.id}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                >
                  <FiCheck className="w-3.5 h-3.5" />
                  {processing === aso.id ? '...' : 'Aprovar'}
                </button>
                <button
                  onClick={() => handleReview(aso.id, 'rejeitado')}
                  disabled={processing === aso.id}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
                >
                  <FiX className="w-3.5 h-3.5" />
                  {processing === aso.id ? '...' : 'Rejeitar'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
