'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { ESocialDashboardResumo, ESocialEvento } from '@/types/e-social';
import DashboardESocial from '@/components/e-social/DashboardESocial';
import EventosList from '@/components/e-social/EventosList';
import EventoRevisao from '@/components/e-social/EventoRevisao';
import ESocialNavigation from '@/components/e-social/ESocialNavigation';
import ImportarASOModal from '@/components/e-social/ImportarASOModal';
import NovoEventoModal from '@/components/e-social/NovoEventoModal';
import NovoColaboradorModal from '@/components/e-social/NovoColaboradorModal';
import GtPageShell from '@/components/gestao-tripulantes/GtPageShell';
import { toast } from 'react-hot-toast';
import { FiRefreshCw, FiCpu, FiPlus, FiUserPlus } from 'react-icons/fi';

export default function ESocialDashboardPage() {
  const { user, isLoading: authLoading } = useSupabaseAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [resumo, setResumo] = useState<ESocialDashboardResumo | null>(null);
  const [recentes, setRecentes] = useState<ESocialEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewEvento, setViewEvento] = useState<ESocialEvento | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [isNewColabModalOpen, setIsNewColabModalOpen] = useState(false);
  const [isConsolidating, setIsConsolidating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchWithToken('/api/e-social/eventos?limit=10');
      if (res.ok) {
        const data = await res.json();
        setResumo(data.resumo || null);
        setRecentes(data.eventos || []);
      } else {
        toast.error(t('eSocial.errors.loadError'));
      }
    } catch {
      toast.error(t('eSocial.errors.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleConsolidate = async () => {
    try {
      setIsConsolidating(true);
      const res = await fetchWithToken('/api/e-social/consolidar', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Módulos sincronizados com sucesso!');
        loadData();
      } else {
        toast.error(data.error || 'Erro ao sincronizar eventos');
      }
    } catch {
      toast.error('Erro ao conectar com o servidor');
    } finally {
      setIsConsolidating(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  if (authLoading || !user) return null;

  return (
    <GtPageShell>
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-7xl mx-auto gap-4">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t('eSocial.title', 'e-Social')}</h1>
            <p className="text-sm text-gray-500">{t('eSocial.subtitle', 'Gestão de eventos e integrações e-Social')}</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleConsolidate}
              disabled={isConsolidating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
              title="Consolidar e sincronizar admissões, ASOs, afastamentos, acidentes e desligamentos de todos os módulos"
            >
              <FiRefreshCw size={15} className={isConsolidating ? 'animate-spin' : ''} />
              Sincronizar Módulos
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
            >
              <FiCpu size={15} />
              Importar ASO (OCR)
            </button>
            <button
              onClick={() => setIsNewColabModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-all"
            >
              <FiUserPlus size={15} />
              Novo Colaborador
            </button>
            <button
              onClick={() => setIsNewEventModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all"
            >
              <FiPlus size={15} />
              Novo Evento
            </button>
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
            >
              <FiRefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="shrink-0">
          <ESocialNavigation />
        </div>

        {/* Dashboard Cards */}
        <div className="shrink-0">
          <DashboardESocial data={resumo} loading={loading} />
        </div>

        {/* Recent Events List */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 shrink-0">{t('eSocial.eventosList.title', 'Eventos Recentes')}</h2>
          <EventosList
            className="flex-1 min-h-0"
            eventos={recentes}
            loading={loading}
            onView={(e) => setViewEvento(e)}
            onDelete={async (e) => {
              if (!confirm('Excluir evento?')) return;
              try {
                const res = await fetchWithToken(`/api/e-social/eventos/${e.id}`, { method: 'DELETE' });
                if (res.ok) {
                  toast.success('Evento excluído');
                  loadData();
                } else {
                  toast.error('Erro ao excluir');
                }
              } catch {
                toast.error('Erro ao excluir');
              }
            }}
          />
        </div>
      </div>

      {viewEvento && (
        <EventoRevisao
          evento={viewEvento}
          open={!!viewEvento}
          onClose={() => setViewEvento(null)}
          onApprove={() => {}}
          onReject={() => {}}
        />
      )}

      {/* Modals */}
      <ImportarASOModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={loadData}
      />

      <NovoEventoModal
        isOpen={isNewEventModalOpen}
        onClose={() => setIsNewEventModalOpen(false)}
        onSuccess={loadData}
      />

      <NovoColaboradorModal
        isOpen={isNewColabModalOpen}
        onClose={() => setIsNewColabModalOpen(false)}
        onSuccess={loadData}
      />
    </GtPageShell>
  );
}
