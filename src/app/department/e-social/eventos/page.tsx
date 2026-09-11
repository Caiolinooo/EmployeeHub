'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { ESocialEvento } from '@/types/e-social';
import EventosList from '@/components/e-social/EventosList';
import EventoRevisao from '@/components/e-social/EventoRevisao';
import NovoEventoModal from '@/components/e-social/NovoEventoModal';
import ImportarASOModal from '@/components/e-social/ImportarASOModal';
import NovoColaboradorModal from '@/components/e-social/NovoColaboradorModal';
import ESocialNavigation from '@/components/e-social/ESocialNavigation';
import { toast } from 'react-hot-toast';
import GtPageShell from '@/components/gestao-tripulantes/GtPageShell';
import {
  FiPlus,
  FiSearch,
  FiCpu,
  FiRefreshCw,
  FiUserPlus,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiLayers,
  FiX
} from 'react-icons/fi';

const PAGE_SIZE = 20;

export default function ESocialEventosPage() {
  const { user, isLoading: authLoading } = useSupabaseAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [eventos, setEventos] = useState<ESocialEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [filtroViewMode, setFiltroViewMode] = useState<'todos' | 'enviados' | 'pendencias' | 'erros'>('todos');
  const [filtroCodigo, setFiltroCodigo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroBusca, setFiltroBusca] = useState('');

  const [reviewEvento, setReviewEvento] = useState<ESocialEvento | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isNewColabModalOpen, setIsNewColabModalOpen] = useState(false);
  const [consultLoading, setConsultLoading] = useState<string | null>(null);
  const [batchConsultLoading, setBatchConsultLoading] = useState(false);
  const [isConsolidating, setIsConsolidating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const loadEventos = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));

      if (filtroCodigo) params.set('codigo', filtroCodigo);
      if (filtroBusca) params.set('search', filtroBusca);

      // Status logic: if specific filter is set, prioritize it. Otherwise use view mode.
      if (filtroStatus) {
        params.set('status', filtroStatus);
      } else if (filtroViewMode === 'enviados') {
        params.set('status', 'enviados');
      } else if (filtroViewMode === 'pendencias') {
        params.set('status', 'pendencias');
      } else if (filtroViewMode === 'erros') {
        params.set('status', 'erro');
      }

      const res = await fetchWithToken(`/api/e-social/eventos?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEventos(data.eventos || []);
        setTotalCount(data.total || 0);
      } else {
        toast.error(t('eSocial.errors.loadError', 'Erro ao carregar eventos'));
      }
    } catch {
      toast.error(t('eSocial.errors.loadError', 'Erro ao carregar eventos'));
    } finally {
      setLoading(false);
    }
  }, [page, filtroCodigo, filtroStatus, filtroBusca, filtroViewMode, t]);

  useEffect(() => {
    if (user) loadEventos();
  }, [user, loadEventos]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleClearFilters = () => {
    setFiltroCodigo('');
    setFiltroStatus('');
    setFiltroBusca('');
    setFiltroViewMode('todos');
    setPage(1);
  };

  const handleDelete = async (evento: ESocialEvento) => {
    if (!confirm(t('eSocial.eventosList.delete', 'Deseja excluir este evento?'))) return;
    try {
      const res = await fetchWithToken(`/api/e-social/eventos/${evento.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Evento excluído com sucesso');
        loadEventos();
      } else {
        toast.error('Erro ao excluir');
      }
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const handleApprove = async (eventoId: string, comentario?: string) => {
    setReviewLoading(true);
    try {
      const res = await fetchWithToken(`/api/e-social/eventos/${eventoId}/revisar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aprovado: true, comentario }),
      });
      if (res.ok) {
        toast.success(t('eSocial.revisao.approved', 'Evento homologado com sucesso!'));
        setReviewEvento(null);
        loadEventos();
      } else {
        toast.error(t('eSocial.errors.sendError', 'Erro ao homologar'));
      }
    } catch {
      toast.error(t('eSocial.errors.sendError', 'Erro ao homologar'));
    } finally {
      setReviewLoading(false);
    }
  };

  const handleReject = async (eventoId: string, comentario?: string) => {
    setReviewLoading(true);
    try {
      const res = await fetchWithToken(`/api/e-social/eventos/${eventoId}/revisar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aprovado: false, comentario }),
      });
      if (res.ok) {
        toast.success(t('eSocial.revisao.rejected', 'Evento rejeitado'));
        setReviewEvento(null);
        loadEventos();
      } else {
        toast.error(t('eSocial.errors.sendError', 'Erro ao rejeitar'));
      }
    } catch {
      toast.error(t('eSocial.errors.sendError', 'Erro ao rejeitar'));
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSend = async (evento: ESocialEvento, force = false) => {
    try {
      const url = `/api/e-social/eventos/${evento.id}/enviar${force ? '?force=true' : ''}`;
      const res = await fetchWithToken(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        toast.success(t('eSocial.envio.sentSuccess', 'Evento transmitido ao e-Social com sucesso!'));
        loadEventos();
      } else {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 400 && errData.code === 'HAS_PROTOCOL') {
          if (confirm('Este evento já possui um protocolo de envio e pode ter sido transmitido. Deseja ignorar o protocolo existente e forçar um novo envio?')) {
            handleSend(evento, true);
          }
        } else if (res.status === 409) {
          toast.error(`⚠️ ${errData.error}`);
        } else {
          toast.error(errData.error || t('eSocial.envio.sendError', 'Erro ao transmitir evento'));
        }
      }
    } catch {
      toast.error(t('eSocial.envio.sendError', 'Erro ao transmitir evento'));
    }
  };

  const handleConsult = async (evento: ESocialEvento) => {
    setConsultLoading(evento.id);
    try {
      const res = await fetchWithToken(`/api/e-social/eventos/${evento.id}/consultar`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        const situacao = data.resultado?.situacao || 'desconhecida';
        toast.success(`Protocolo ${evento.protocolo_envio}: ${situacao}`);
        loadEventos();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Erro ao consultar protocolo');
      }
    } catch {
      toast.error('Erro ao consultar e-Social');
    } finally {
      setConsultLoading(null);
    }
  };

  const handleBatchConsult = async () => {
    setBatchConsultLoading(true);
    try {
      const res = await fetchWithToken('/api/e-social/consultar-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.atualizados} de ${data.total} eventos atualizados`);
        loadEventos();
      } else {
        toast.error('Erro ao consultar lote');
      }
    } catch {
      toast.error('Erro ao consultar lote');
    } finally {
      setBatchConsultLoading(false);
    }
  };

  const handleConsolidate = async () => {
    try {
      setIsConsolidating(true);
      const res = await fetchWithToken('/api/e-social/consolidar', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Módulos sincronizados com sucesso!');
        loadEventos();
      } else {
        toast.error(data.error || 'Erro ao sincronizar eventos');
      }
    } catch {
      toast.error('Erro ao conectar com o servidor');
    } finally {
      setIsConsolidating(false);
    }
  };

  if (authLoading || !user) return null;

  const hasActiveFilters = Boolean(filtroCodigo || filtroStatus || filtroBusca || filtroViewMode !== 'todos');

  return (
    <GtPageShell>
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-7xl mx-auto gap-4">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t('eSocial.eventos', 'Eventos e-Social')}</h1>
            <p className="text-sm text-gray-500">Histórico de transmissões, validações e lançamentos</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleConsolidate}
              disabled={isConsolidating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
              title="Consolidar e sincronizar admissões, ASOs, afastamentos, acidentes e desligamentos de todos os módulos"
            >
              <FiRefreshCw size={15} className={isConsolidating ? 'animate-spin' : ''} />
              Sincronizar Módulos
            </button>
            <button
              onClick={handleBatchConsult}
              disabled={batchConsultLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all disabled:opacity-50"
            >
              <FiRefreshCw size={15} className={batchConsultLoading ? 'animate-spin' : ''} />
              Consultar Todos
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
            >
              <FiCpu size={15} />
              Importar ASO (OCR)
            </button>
            <button
              onClick={() => setIsNewColabModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm transition-all"
            >
              <FiUserPlus size={15} />
              Novo Colaborador
            </button>
            <button
              onClick={() => setIsNewEventModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all"
            >
              <FiPlus size={16} />
              {t('eSocial.eventosList.newEvent', 'Novo Evento')}
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="shrink-0">
          <ESocialNavigation />
        </div>

        {/* Quick View Modes */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 shrink-0">
          <button
            onClick={() => { setFiltroViewMode('todos'); setFiltroStatus(''); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filtroViewMode === 'todos' && !filtroStatus
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200/80'
            }`}
          >
            <FiLayers size={15} />
            Todos os Eventos
          </button>
          <button
            onClick={() => { setFiltroViewMode('enviados'); setFiltroStatus(''); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filtroViewMode === 'enviados' && !filtroStatus
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-700 hover:bg-emerald-50 bg-emerald-50/50 border border-emerald-200'
            }`}
          >
            <FiCheckCircle size={15} />
            Envios Realizados
          </button>
          <button
            onClick={() => { setFiltroViewMode('pendencias'); setFiltroStatus(''); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filtroViewMode === 'pendencias' && !filtroStatus
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-700 hover:bg-amber-50 bg-amber-50/50 border border-amber-200'
            }`}
          >
            <FiClock size={15} />
            Fila & Pendências
          </button>
          <button
            onClick={() => { setFiltroViewMode('erros'); setFiltroStatus(''); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filtroViewMode === 'erros' && !filtroStatus
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-700 hover:bg-rose-50 bg-rose-50/50 border border-rose-200'
            }`}
          >
            <FiAlertTriangle size={15} />
            Com Inconsistências
          </button>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <FiX size={14} />
              Limpar Filtros
            </button>
          )}
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-4 shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Search by Worker name or CPF */}
            <div className="relative">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por Nome do Trabalhador ou CPF..."
                value={filtroBusca}
                onChange={(e) => { setFiltroBusca(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Filter by Event Code */}
            <div className="relative">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Código (ex: S-2220, 2240, S-2200)..."
                value={filtroCodigo}
                onChange={(e) => { setFiltroCodigo(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Filter by Specific Status */}
            <select
              value={filtroStatus}
              onChange={(e) => { setFiltroStatus(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="">Status Específico (Todos)</option>
              <option value="rascunho">Rascunho</option>
              <option value="pendente_revisao">Pendente Revisão</option>
              <option value="revisao_aprovado">Homologado / Pronto p/ Envio</option>
              <option value="fila_envio">Fila de Envio</option>
              <option value="enviado">Enviado (Aguardando Protocolo)</option>
              <option value="processado">Processado (Com Sucesso / Recibo)</option>
              <option value="erro">Erro / Rejeitado</option>
              <option value="devolvido">Devolvido</option>
            </select>
          </div>
        </div>

        {/* List */}
        <EventosList
          className="flex-1 min-h-0"
          eventos={eventos}
          loading={loading}
          onView={(e) => setReviewEvento(e)}
          onEdit={(e) => setReviewEvento(e)}
          onSend={handleSend}
          onDelete={handleDelete}
          onConsult={handleConsult}
          consultLoading={consultLoading}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 shrink-0">
            <span className="text-xs text-slate-500 font-medium">
              Mostrando página <strong>{page}</strong> de <strong>{totalPages}</strong> ({totalCount} eventos no total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 bg-white transition-colors"
              >
                Anterior
              </button>
              <span className="px-3 py-1.5 text-xs text-slate-700 bg-slate-100 rounded-lg font-bold">
                {page}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 bg-white transition-colors"
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </div>

      {reviewEvento && (
        <EventoRevisao
          evento={reviewEvento}
          open={!!reviewEvento}
          onClose={() => setReviewEvento(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          loading={reviewLoading}
        />
      )}

      <NovoEventoModal
        isOpen={isNewEventModalOpen}
        onClose={() => setIsNewEventModalOpen(false)}
        onSuccess={loadEventos}
      />

      <ImportarASOModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={loadEventos}
      />

      <NovoColaboradorModal
        isOpen={isNewColabModalOpen}
        onClose={() => setIsNewColabModalOpen(false)}
        onSuccess={loadEventos}
      />
    </GtPageShell>
  );
}
