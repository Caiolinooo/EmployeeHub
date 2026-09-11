'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { ESocialEvento } from '@/types/e-social';
import EventoRevisao from '@/components/e-social/EventoRevisao';
import ESocialNavigation from '@/components/e-social/ESocialNavigation';
import { toast } from 'react-hot-toast';
import { FiRefreshCw, FiClock } from 'react-icons/fi';
import GtPageShell, { GT_PAGE_SCROLLPORT_CLASS } from '@/components/gestao-tripulantes/GtPageShell';

export default function ESocialRevisaoPage() {
  const { user, isLoading: authLoading } = useSupabaseAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [eventos, setEventos] = useState<ESocialEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewEvento, setReviewEvento] = useState<ESocialEvento | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const loadPendentes = async () => {
    try {
      setLoading(true);
      const res = await fetchWithToken('/api/e-social/eventos?status=pendente_revisao');
      if (res.ok) {
        const data = await res.json();
        setEventos(data.eventos || []);
      } else {
        toast.error(t('eSocial.errors.loadError'));
      }
    } catch {
      toast.error(t('eSocial.errors.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadPendentes();
  }, [user]);

  const handleApprove = async (eventoId: string, comentario?: string) => {
    setReviewLoading(true);
    try {
      const res = await fetchWithToken(`/api/e-social/eventos/${eventoId}/revisar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aprovado: true, comentario }),
      });
      if (res.ok) {
        toast.success(t('eSocial.revisao.approved'));
        setReviewEvento(null);
        loadPendentes();
      } else {
        toast.error(t('eSocial.errors.sendError'));
      }
    } catch {
      toast.error(t('eSocial.errors.sendError'));
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
        toast.success(t('eSocial.revisao.rejected'));
        setReviewEvento(null);
        loadPendentes();
      } else {
        toast.error(t('eSocial.errors.sendError'));
      }
    } catch {
      toast.error(t('eSocial.errors.sendError'));
    } finally {
      setReviewLoading(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <GtPageShell>
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-5xl mx-auto gap-4">
        
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t('eSocial.revisaoTitle', 'Fila de Revisão')}</h1>
            <p className="text-sm text-gray-500">{t('eSocial.revisao.title', 'Eventos aguardando homologação ou correção')}</p>
          </div>
          <button
            onClick={loadPendentes}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border rounded-md hover:bg-gray-50"
          >
            <FiRefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="shrink-0">
          <ESocialNavigation />
        </div>

        {/* List */}
        {loading ? (
          <div className={`${GT_PAGE_SCROLLPORT_CLASS} space-y-3`}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : eventos.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center">
            <FiClock className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-gray-500">{t('eSocial.revisao.noPending', 'Nenhum evento pendente de revisão')}</p>
          </div>
        ) : (
          <div className={`${GT_PAGE_SCROLLPORT_CLASS} space-y-3`}>
            {eventos.map((evento) => (
              <div
                key={evento.id}
                className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setReviewEvento(evento)}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-medium text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                      {evento.evento_codigo}
                    </span>
                    <span className="text-sm text-gray-500">|</span>
                    <span className="text-sm text-gray-700">{evento.evento_nome || evento.evento_codigo}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>CPF: {evento.cpf_trabalhador || '-'}</span>
                    <span>Módulo: {evento.modulo_origem || '-'}</span>
                    <span>Criação: {new Date(evento.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                  {t('eSocial.eventStatus.pendingReview', 'Pendente Revisão')}
                </span>
              </div>
            ))}
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
    </GtPageShell>
  );
}
