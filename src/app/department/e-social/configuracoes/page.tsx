'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { ESocialConfigGeral, ESocialConfigWS } from '@/types/e-social';
import ESocialNavigation from '@/components/e-social/ESocialNavigation';
import ImportadorTabelas from '@/components/e-social/ImportadorTabelas';
import { toast } from 'react-hot-toast';
import { FiSave, FiRefreshCw } from 'react-icons/fi';
import GtPageShell, { GT_PAGE_SCROLLPORT_CLASS } from '@/components/gestao-tripulantes/GtPageShell';

export default function ESocialConfiguracoesPage() {
  const { user, isLoading: authLoading } = useSupabaseAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configGeral, setConfigGeral] = useState<ESocialConfigGeral>({
    ambiente: 'homologacao',
    autonomia_envio: false,
    consultar_automatico: false,
  });
  const [configWS, setConfigWS] = useState<ESocialConfigWS>({
    url_homologacao: '',
    url_producao: '',
    timeout_segundos: 30,
    tentativas_maximas: 3,
  });
  const [subTab, setSubTab] = useState<'transmissao' | 'tabelas'>('transmissao');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const [geralRes, wsRes] = await Promise.all([
        fetchWithToken('/api/e-social/config/geral'),
        fetchWithToken('/api/e-social/config/ws'),
      ]);
      if (geralRes.ok) {
        const data = await geralRes.json();
        if (data.config) setConfigGeral(data.config);
      }
      if (wsRes.ok) {
        const data = await wsRes.json();
        if (data.config) setConfigWS(data.config);
      }
    } catch {
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadConfig();
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const [geralRes, wsRes] = await Promise.all([
        fetchWithToken('/api/e-social/config/geral', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configGeral),
        }),
        fetchWithToken('/api/e-social/config/ws', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configWS),
        }),
      ]);
      if (geralRes.ok && wsRes.ok) {
        toast.success(t('eSocial.config.saved'));
      } else {
        toast.error(t('eSocial.config.saveError'));
      }
    } catch {
      toast.error(t('eSocial.config.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) return null;

  if (loading) {
    return (
      <GtPageShell>
        <div className="flex flex-col flex-1 min-h-0 w-full max-w-3xl mx-auto gap-4">
          <div className="flex items-center justify-between shrink-0">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{t('eSocial.configuracoes', 'Configurações')}</h1>
              <p className="text-sm text-gray-500">{t('eSocial.config.title', 'Configurações do ambiente de transmissão')}</p>
            </div>
          </div>
          <div className="shrink-0">
            <ESocialNavigation />
          </div>
          <div className={`${GT_PAGE_SCROLLPORT_CLASS} space-y-4`}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </GtPageShell>
    );
  }

  return (
    <GtPageShell>
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-3xl mx-auto gap-4">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t('eSocial.configuracoes', 'Configurações')}</h1>
            <p className="text-sm text-gray-500">{t('eSocial.config.title', 'Configurações do ambiente de transmissão')}</p>
          </div>
          <button
            onClick={loadConfig}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border rounded-md hover:bg-gray-50"
          >
            <FiRefreshCw size={15} />
            Atualizar
          </button>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="shrink-0">
          <ESocialNavigation />
        </div>

        {/* Sub-tabs pills */}
        <div className="flex border-b border-slate-150 gap-6 shrink-0">
          <button
            onClick={() => setSubTab('transmissao')}
            className={`pb-2.5 px-1 font-semibold text-sm transition-all duration-200 border-b-2 ${
              subTab === 'transmissao'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Configurações de Transmissão
          </button>
          <button
            onClick={() => setSubTab('tabelas')}
            className={`pb-2.5 px-1 font-semibold text-sm transition-all duration-200 border-b-2 ${
              subTab === 'tabelas'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Tabelas Oficiais (CBO / Exames)
          </button>
        </div>

        <div className={GT_PAGE_SCROLLPORT_CLASS}>
        {subTab === 'transmissao' ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 space-y-6">
            <h2 className="text-lg font-semibold text-gray-800">{t('eSocial.config.ambiente', 'Ambiente de Transmissão')}</h2>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="ambiente"
                  value="homologacao"
                  checked={configGeral.ambiente === 'homologacao'}
                  onChange={() => setConfigGeral({ ...configGeral, ambiente: 'homologacao' })}
                  className="text-abz-blue"
                />
                <span className="text-sm text-gray-700">{t('eSocial.config.homologacao', 'Homologação (Testes)')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="ambiente"
                  value="producao"
                  checked={configGeral.ambiente === 'producao'}
                  onChange={() => setConfigGeral({ ...configGeral, ambiente: 'producao' })}
                  className="text-abz-blue"
                />
                <span className="text-sm text-gray-700">{t('eSocial.config.producao', 'Produção')}</span>
              </label>
            </div>

            <hr className="border-gray-200" />

            <h2 className="text-lg font-semibold text-gray-800">{t('eSocial.config.autonomiaEnvio', 'Envio e Consulta')}</h2>

            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('eSocial.config.autonomiaEnvioLabel', 'Autonomia de Envio')}</p>
                  <p className="text-xs text-gray-500">{t('eSocial.config.autonomiaEnvioDesc', 'Permitir envio automático de eventos homologados sem revisão manual')}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={configGeral.autonomia_envio}
                  onClick={() => setConfigGeral({ ...configGeral, autonomia_envio: !configGeral.autonomia_envio })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${configGeral.autonomia_envio ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${configGeral.autonomia_envio ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-700">{t('eSocial.config.consultarAutomatico', 'Consulta Automática de Recibos')}</p>
                  <p className="text-xs text-gray-500">{t('eSocial.config.consultarAutomaticoDesc', 'Consultar periodicamente o retorno do e-Social para eventos enviados')}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={configGeral.consultar_automatico}
                  onClick={() => setConfigGeral({ ...configGeral, consultar_automatico: !configGeral.consultar_automatico })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${configGeral.consultar_automatico ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${configGeral.consultar_automatico ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </label>
            </div>

            <hr className="border-gray-200" />

            <h2 className="text-lg font-semibold text-gray-800">Webservice</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('eSocial.config.urlHomologacao', 'URL de Homologação')}
                </label>
                <input
                  type="text"
                  value={configWS.url_homologacao || ''}
                  onChange={(e) => setConfigWS({ ...configWS, url_homologacao: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('eSocial.config.urlProducao', 'URL de Produção')}
                </label>
                <input
                  type="text"
                  value={configWS.url_producao || ''}
                  onChange={(e) => setConfigWS({ ...configWS, url_producao: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('eSocial.config.timeout', 'Timeout (segundos)')}
                </label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={configWS.timeout_segundos}
                  onChange={(e) => setConfigWS({ ...configWS, timeout_segundos: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('eSocial.config.maxTentativas', 'Máximo de Tentativas')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={configWS.tentativas_maximas}
                  onChange={(e) => setConfigWS({ ...configWS, tentativas_maximas: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <FiSave size={16} />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        ) : (
          <ImportadorTabelas />
        )}
        </div>
      </div>
    </GtPageShell>
  );
}
