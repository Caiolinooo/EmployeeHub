'use client';

import React, { useEffect, useState } from 'react';
import { FiSave, FiRefreshCw, FiAlertCircle, FiCheck, FiClock } from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { DEFAULT_ASO_AGENDAMENTO_CONFIG, type AsoAgendamentoConfig } from '@/lib/gestao-tripulantes/aso-agendamento-status';

const EMPTY: AsoAgendamentoConfig = DEFAULT_ASO_AGENDAMENTO_CONFIG;

export default function AsoAgendamentoConfigTab() {
  const [config, setConfig] = useState<AsoAgendamentoConfig>(EMPTY);
  const [logisticaInput, setLogisticaInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/aso/agendamento/config');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Falha ao carregar');
      setConfig(json.config);
      setLogisticaInput((json.config.emails_logistica || []).join(', '));
      setCcInput((json.config.emails_cc || []).join(', '));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao carregar configuração');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/aso/agendamento/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          emails_logistica: logisticaInput,
          emails_cc: ccInput,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Falha ao salvar');
      setConfig(json.config);
      setSuccessMsg('Configuração de ASO salva. Alertas e sugestões usam esta antecedência.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <FiRefreshCw className="animate-spin mr-2" /> Carregando configuração de ASO…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h3 className="text-lg font-bold text-gray-900">Agendamento de ASO — antecedência e logística</h3>
        <p className="text-sm text-gray-500">
          A janela de vencimento, os alertas e as datas sugeridas (preferência STB, evitando ON) usam estes valores.
          Padrão: 60 dias. Persistido em <code>gt_configuracoes.gt_aso_agendamento_config</code>.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex gap-2">
          <FiAlertCircle className="shrink-0 mt-0.5" /> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex gap-2">
          <FiCheck className="shrink-0 mt-0.5" /> {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Antecedência (dias)</span>
          <input
            type="number"
            min={1}
            max={365}
            value={config.antecedencia_dias}
            onChange={(e) => setConfig((c) => ({ ...c, antecedencia_dias: parseInt(e.target.value, 10) || 60 }))}
            className="mt-1 w-full px-3 py-2 border rounded-md"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Lead mínimo (dias)</span>
          <input
            type="number"
            min={0}
            max={30}
            value={config.min_lead_dias}
            onChange={(e) => setConfig((c) => ({ ...c, min_lead_dias: parseInt(e.target.value, 10) || 0 }))}
            className="mt-1 w-full px-3 py-2 border rounded-md"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Máx. sugestões</span>
          <input
            type="number"
            min={1}
            max={15}
            value={config.max_sugestoes}
            onChange={(e) => setConfig((c) => ({ ...c, max_sugestoes: parseInt(e.target.value, 10) || 5 }))}
            className="mt-1 w-full px-3 py-2 border rounded-md"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-medium text-gray-700">E-mails da logística</span>
        <input
          type="text"
          value={logisticaInput}
          onChange={(e) => setLogisticaInput(e.target.value)}
          placeholder="logistica@groupabz.com, outro@groupabz.com"
          className="mt-1 w-full px-3 py-2 border rounded-md"
        />
        <span className="text-xs text-gray-500">Além destes, gestores ADMIN/MANAGER do portal também são notificados.</span>
      </label>

      <label className="block text-sm">
        <span className="font-medium text-gray-700">Cópia (CC)</span>
        <input
          type="text"
          value={ccInput}
          onChange={(e) => setCcInput(e.target.value)}
          className="mt-1 w-full px-3 py-2 border rounded-md"
        />
      </label>

      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="font-medium text-gray-900 flex items-center gap-2">
            <FiClock /> Gerar sugestões automaticamente (cron)
          </p>
          <p className="text-sm text-gray-500">Quando o ASO entra na janela de antecedência, grava datas STB sugeridas.</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={config.gerar_sugestoes_automatico}
            onChange={(e) => setConfig((c) => ({ ...c, gerar_sugestoes_automatico: e.target.checked }))}
          />
          <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-abz-blue after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="inline-flex items-center gap-2 px-4 py-2 bg-abz-blue text-white rounded-lg text-sm font-semibold disabled:opacity-50"
      >
        {isSaving ? <FiRefreshCw className="animate-spin" /> : <FiSave />}
        Salvar configuração de ASO
      </button>
    </div>
  );
}
