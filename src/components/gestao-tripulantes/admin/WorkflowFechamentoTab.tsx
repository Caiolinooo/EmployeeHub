'use client';

import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  FiCheckSquare,
  FiMail,
  FiCalendar,
  FiSave,
  FiRefreshCw,
  FiCheck,
  FiAlertCircle,
  FiDownload,
  FiShield,
  FiUserCheck,
  FiUserPlus,
  FiTrash2,
  FiUsers,
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import SearchableCreatableSelect from '@/components/gestao-tripulantes/SearchableCreatableSelect';
import {
  displayNameFromUser,
  isFechamentoStatus,
  labelFechamentoStatus,
} from '@/lib/gestao-tripulantes/fechamento-assinatura';

interface AprovadorItem {
  id?: string;
  nome: string;
  email: string;
  cargo?: string;
}

interface GestorOption {
  id: string;
  email: string;
  nome?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  role?: string;
  cargo?: string;
}

interface FechamentoConfig {
  dia_fechamento_mes: number;
  emails_destinatarios_dp: string[];
  emails_cc: string[];
  aprovadores_obrigatorios: AprovadorItem[];
  envio_automatico: boolean;
  assunto_email_template: string;
  corpo_email_template: string;
}

interface RelatorioRegistro {
  id: string;
  mes_referencia: string;
  ano: number;
  mes: number;
  status: 'pendente_revisao' | 'em_aprovacao' | 'aprovado' | 'rejeitado' | 'enviado';
  total_colaboradores: number;
  total_on: number;
  total_dba: number;
  total_fi: number;
  total_tre: number;
  aprovadores_obrigatorios?: AprovadorItem[];
  assinaturas?: any[];
  aprovado_por_nome?: string;
  aprovado_por_cpf?: string;
  aprovado_em?: string;
  aprovado_ip?: string;
  assinatura_hash?: string;
  emails_enviados?: string[];
  enviado_em?: string;
  created_at: string;
}

export type WorkflowFechamentoHandle = {
  save: () => Promise<{ ok: boolean; message: string }>;
  reload: () => Promise<void>;
};

const WorkflowFechamentoTab = forwardRef<WorkflowFechamentoHandle>(function WorkflowFechamentoTab(_, ref) {
  const [config, setConfig] = useState<FechamentoConfig>({
    dia_fechamento_mes: 25,
    emails_destinatarios_dp: ['dp@groupabz.com'],
    emails_cc: [],
    aprovadores_obrigatorios: [],
    envio_automatico: false,
    assunto_email_template: 'Fechamento de Escala Gestão de Tripulantes - {Mes_Ano}',
    corpo_email_template: 'Prezados,\n\nSegue em anexo o relatório oficial consolidado de escalas da Gestão de Tripulantes para o período de {Mes_Ano}.\n\nAtenciosamente,\nGestão de Tripulantes - ABZ Group'
  });

  const [availableManagers, setAvailableManagers] = useState<GestorOption[]>([]);
  const [destinatariosInput, setDestinatariosInput] = useState('dp@groupabz.com');
  const [ccInput, setCcInput] = useState('');
  const [historico, setHistorico] = useState<RelatorioRegistro[]>([]);

  // Formulário para adicionar aprovador obrigatório
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [customNome, setCustomNome] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [customCargo, setCustomCargo] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const resConfig = await fetchWithToken('/api/gestao-tripulantes/relatorio-mensal/config');
      const dataConfig = await resConfig.json().catch(() => ({}));
      if (Array.isArray(dataConfig.availableUsers) && dataConfig.availableUsers.length > 0) {
        setAvailableManagers(dataConfig.availableUsers);
      } else if (Array.isArray(dataConfig.availableManagers)) {
        setAvailableManagers(dataConfig.availableManagers);
      }
      if (dataConfig.success && dataConfig.config) {
        setConfig(dataConfig.config);
        setDestinatariosInput(
          Array.isArray(dataConfig.config.emails_destinatarios_dp)
            ? dataConfig.config.emails_destinatarios_dp.join(', ')
            : dataConfig.config.emails_destinatarios_dp || ''
        );
        setCcInput(
          Array.isArray(dataConfig.config.emails_cc)
            ? dataConfig.config.emails_cc.join(', ')
            : dataConfig.config.emails_cc || ''
        );
      } else if (!resConfig.ok) {
        throw new Error(dataConfig.error || 'Falha ao carregar configurações de fechamento.');
      }

      // Carregar preview e histórico
      const currentMes = new Date().toISOString().slice(0, 7);
      const resRel = await fetchWithToken(`/api/gestao-tripulantes/relatorio-mensal?mesAno=${currentMes}`);
      const dataRel = await resRel.json();
      if (dataRel.registro) {
        setHistorico([dataRel.registro]);
      }
    } catch (err) {
      console.error('Erro ao carregar dados de fechamento:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao carregar configurações de fechamento.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const persistConfig = async (
    override?: Partial<FechamentoConfig>,
  ): Promise<{ ok: boolean; message: string }> => {
    const emailsDp = destinatariosInput
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    const emailsCc = ccInput
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    const payload: FechamentoConfig = {
      ...config,
      ...override,
      emails_destinatarios_dp: emailsDp,
      emails_cc: emailsCc,
    };
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/relatorio-mensal/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const message = data.error || 'Erro ao salvar configurações de fechamento.';
        setErrorMsg(message);
        return { ok: false, message };
      }
      setConfig(payload);
      setSuccessMsg('Configurações de fechamento mensal salvas com sucesso!');
      return { ok: true, message: 'Configurações de fechamento mensal salvas com sucesso!' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar.';
      setErrorMsg(message);
      return { ok: false, message };
    } finally {
      setIsSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({
    save: () => persistConfig(),
    reload: loadData,
  }));

  const handleAddAprovador = async () => {
    const list = config.aprovadores_obrigatorios || [];
    if (selectedManagerId) {
      const mgr = availableManagers.find((m) => m.id === selectedManagerId);
      if (mgr) {
        const email = String(mgr.email || '').trim();
        if (!email) {
          setErrorMsg('Este colaborador não tem e-mail cadastrado.');
          return;
        }
        const jaExiste = list.some((a) =>
          (mgr.id && a.id && a.id === mgr.id)
          || (a.email && a.email.toLowerCase() === email.toLowerCase()),
        );
        if (jaExiste) {
          setErrorMsg('Este aprovador já está na lista.');
          return;
        }
        const nextList = [
          ...list,
          {
            id: mgr.id,
            nome: mgr.nome || displayNameFromUser(mgr) || email,
            email,
            cargo: mgr.cargo || mgr.role || undefined,
          },
        ];
        setConfig((prev) => ({ ...prev, aprovadores_obrigatorios: nextList }));
        setSelectedManagerId('');
        await persistConfig({ aprovadores_obrigatorios: nextList });
        return;
      }
      setErrorMsg('Selecione um colaborador válido na busca.');
      return;
    }
    if (customNome.trim() && customEmail.trim()) {
      const jaExiste = list.some((a) => a.email && a.email.toLowerCase() === customEmail.trim().toLowerCase());
      if (jaExiste) {
        setErrorMsg('Este e-mail já está na lista de aprovadores.');
        return;
      }
      const nextList = [
        ...list,
        {
          nome: customNome.trim(),
          email: customEmail.trim().toLowerCase(),
          cargo: customCargo.trim() || undefined,
        },
      ];
      setConfig((prev) => ({ ...prev, aprovadores_obrigatorios: nextList }));
      setCustomNome('');
      setCustomEmail('');
      setCustomCargo('');
      await persistConfig({ aprovadores_obrigatorios: nextList });
      return;
    }
    setErrorMsg('Busque e selecione um colaborador para adicionar.');
  };

  const handleRemoveAprovador = async (apr: AprovadorItem) => {
    const nextList = (config.aprovadores_obrigatorios || []).filter((a) => {
      if (apr.id && a.id) return a.id !== apr.id;
      return (a.email || '').toLowerCase() !== (apr.email || '').toLowerCase();
    });
    setConfig((prev) => ({ ...prev, aprovadores_obrigatorios: nextList }));
    await persistConfig({ aprovadores_obrigatorios: nextList });
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistConfig();
  };

  const colaboradorOptions = availableManagers
    .filter((m) => m.id && m.email)
    .map((m) => ({
      id: m.id,
      label: `${m.nome || displayNameFromUser(m)} — ${m.email}${m.role || m.cargo ? ` (${m.role || m.cargo})` : ''}`,
    }));

  const handleDownloadPlanilha = async (mesAno: string) => {
    try {
      window.open(`/api/gestao-tripulantes/relatorio-mensal?mesAno=${mesAno}&download=true`, '_blank');
    } catch (err) {
      console.error('Erro ao baixar relatório:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bloco de Configuração */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FiCheckSquare className="text-abz-blue text-xl" />
              Workflow de Fechamento de Escalas & Envio DP
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Configure a lista de aprovadores obrigatórios (múltiplas assinaturas), data de corte e envio por e-mail ao DP.
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            title="Atualizar"
          >
            <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
            <FiCheck className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveConfig} className="space-y-6">
          {/* Seção 1: Aprovadores Obrigatórios (Múltiplas Assinaturas) */}
          <div className="bg-blue-50/40 border border-blue-100 p-4 rounded-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <FiUsers className="text-abz-blue" />
                Integrantes / Aprovadores Obrigatórios para o Fechamento
              </h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Quem estiver nesta lista precisa assinar — <strong>o perfil no portal (USER, MANAGER, ADMIN) não importa</strong>. Extra-assinaturas de quem não está na lista não fecham o fluxo. O e-mail ao DP <strong>só sai quando essas pessoas exatas tiverem assinado</strong>.
              </p>
            </div>

            {/* Lista Atual de Aprovadores */}
            <div className="space-y-2">
              {(!config.aprovadores_obrigatorios || config.aprovadores_obrigatorios.length === 0) ? (
                <div className="p-3 bg-white border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 text-center">
                  Nenhum aprovador específico cadastrado. Qualquer gestor ou administrador poderá assinar uma vez e concluir o fechamento.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(config.aprovadores_obrigatorios || []).map((apr, idx) => (
                    <div
                      key={apr.id || apr.email || idx}
                      className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg shadow-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-xs text-gray-900 truncate">
                          {apr.nome}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {apr.email} {apr.cargo && `• ${apr.cargo}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAprovador(apr)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                        title="Remover aprovador obrigatório"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Adicionar Aprovador */}
            <div className="pt-2 border-t border-blue-200/60">
              <span className="block text-xs font-bold text-gray-700 mb-2">Adicionar Integrante à Lista de Aprovadores:</span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div className="sm:col-span-2">
                  <SearchableCreatableSelect
                    options={colaboradorOptions}
                    value={selectedManagerId}
                    onChange={(id) => {
                      setSelectedManagerId(id);
                      if (id) {
                        setCustomNome('');
                        setCustomEmail('');
                        setCustomCargo('');
                      }
                    }}
                    placeholder="Digite nome, e-mail ou cargo para buscar colaborador..."
                    allowCreate={false}
                    allowClear
                    emptyLabel="Nenhum colaborador encontrado"
                    className="text-xs"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    {availableManagers.length} colaboradores/usuários com e-mail. Digite para filtrar.
                  </p>
                </div>

                <div className="sm:col-span-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddAprovador}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-blue-900 text-white rounded-lg text-xs font-semibold hover:bg-blue-800 transition w-full shadow-xs"
                  >
                    <FiUserPlus className="w-3.5 h-3.5" />
                    Adicionar Aprovador
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Parâmetros Gerais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <FiCalendar className="text-abz-blue" />
                Dia do Fechamento no Mês (Data de Corte) *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={config.dia_fechamento_mes}
                  onChange={(e) =>
                    setConfig(prev => ({ ...prev, dia_fechamento_mes: parseInt(e.target.value, 10) || 25 }))
                  }
                  required
                  className="w-24 px-3 py-2 text-sm border border-gray-300 rounded-lg font-bold text-gray-900 focus:ring-2 focus:ring-abz-blue"
                />
                <span className="text-xs text-gray-500">Todo dia {config.dia_fechamento_mes} de cada mês</span>
              </div>
            </div>

            <div className="flex items-center pt-5">
              <label className="relative flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.envio_automatico}
                  onChange={(e) => setConfig(prev => ({ ...prev, envio_automatico: e.target.checked }))}
                  className="h-4 w-4 text-abz-blue rounded border-gray-300 focus:ring-abz-blue"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-900">Disparo Automático no Dia de Corte</span>
                  <p className="text-xs text-gray-500">Notificar e gerar fechamento automático via Cron</p>
                </div>
              </label>
            </div>
          </div>

          {/* Seção 3: E-mails Destinatários */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <FiMail className="text-abz-blue" />
                E-mails do Departamento Pessoal (Destinatários do Relatório Final) *
              </label>
              <input
                type="text"
                placeholder="dp@groupabz.com, folha@groupabz.com"
                value={destinatariosInput}
                onChange={(e) => setDestinatariosInput(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-abz-blue"
              />
              <span className="text-[11px] text-gray-500">Separe múltiplos e-mails por vírgula</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <FiMail className="text-gray-400" />
                E-mails em Cópia (CC)
              </label>
              <input
                type="text"
                placeholder="gerencia.operacoes@groupabz.com"
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-abz-blue"
              />
              <span className="text-[11px] text-gray-500">Opcional</span>
            </div>
          </div>

          {/* Seção 4: Templates */}
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Assunto do E-mail (Template)
              </label>
              <input
                type="text"
                value={config.assunto_email_template}
                onChange={(e) => setConfig(prev => ({ ...prev, assunto_email_template: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-abz-blue font-mono"
              />
              <span className="text-[11px] text-gray-500">Variáveis: <code>&#123;Mes_Ano&#125;</code></span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Mensagem Padrão do E-mail (Corpo)
              </label>
              <textarea
                rows={3}
                value={config.corpo_email_template}
                onChange={(e) => setConfig(prev => ({ ...prev, corpo_email_template: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-abz-blue font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-abz-blue text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition shadow-sm disabled:opacity-50"
            >
              {isSaving ? <FiRefreshCw className="animate-spin w-4 h-4" /> : <FiSave className="w-4 h-4" />}
              Salvar Configurações
            </button>
          </div>
        </form>
      </div>

      {/* Histórico e Auditoria de Fechamentos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <FiShield className="text-emerald-600" />
          Histórico de Fechamentos & Auditoria Digital
        </h3>
        <p className="text-xs text-gray-500">
          Relatórios mensais de escala aprovados, com rastreabilidade criptográfica de quem aprovou, IP de origem e protocolo de envio ao DP.
        </p>

        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 text-gray-700 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Mês/Ano</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Totais (ON / DBA / FI / TRE)</th>
                <th className="px-4 py-3">Assinaturas Coletadas</th>
                <th className="px-4 py-3 text-right">Planilha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {historico.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                    Nenhum fechamento registrado até o momento.
                  </td>
                </tr>
              ) : (
                historico.map((h) => {
                  const assinaturas = Array.isArray(h.assinaturas) ? h.assinaturas : [];
                  const obrigatorios = Array.isArray(h.aprovadores_obrigatorios) ? h.aprovadores_obrigatorios : [];
                  return (
                    <tr key={h.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-bold text-gray-900 font-mono">
                        {h.mes_referencia}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          h.status === 'enviado' || h.status === 'aprovado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : (h.status === 'em_aprovacao' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800')
                        }`}>
                          {isFechamentoStatus(h.status)
                            ? labelFechamentoStatus(h.status, {
                              assinados: assinaturas.length,
                              obrigatorios: obrigatorios.length,
                            })
                            : h.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-700">
                        ON: <span className="text-emerald-700 font-bold">{h.total_on}</span> | 
                        DBA: <span className="text-amber-700 font-bold ml-1">{h.total_dba}</span> | 
                        FI: <span className="text-blue-700 font-bold ml-1">{h.total_fi}</span> | 
                        TRE: <span className="text-gray-900 font-bold ml-1">{h.total_tre}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {assinaturas.length > 0 ? (
                          <div className="space-y-1">
                            {assinaturas.map((s, sIdx) => (
                              <div key={sIdx} className="flex items-center gap-1 font-medium text-gray-900">
                                <FiUserCheck className="text-emerald-600 flex-shrink-0" />
                                <span>{s.nome}</span>
                                <span className="text-[10px] text-gray-400 font-mono">({s.dataHora || s.assinado_em?.slice(0, 10)})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">Nenhuma assinatura registrada</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDownloadPlanilha(h.mes_referencia)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded text-xs font-semibold transition"
                        >
                          <FiDownload className="w-3.5 h-3.5" />
                          Baixar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export default WorkflowFechamentoTab;
