'use client';

import React, { useState, useEffect } from 'react';
import {
  FiX,
  FiCheckCircle,
  FiDownload,
  FiSend,
  FiShield,
  FiSearch,
  FiRefreshCw,
  FiAlertTriangle,
  FiCalendar,
  FiFileText,
  FiUsers,
  FiCheck,
  FiClock,
} from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useSignature } from '@/contexts/SignatureContext';
import {
  assinaturaCobreAprovador,
  isFechamentoStatus,
  labelFechamentoStatus,
  mensagemErroAssinaturaAusente,
  mensagemErroAssinaturaNegada,
  podeAssinarFechamento,
  type AprovadorObrigatorio,
  type AssinaturaFechamento,
} from '@/lib/gestao-tripulantes/fechamento-assinatura';

export interface ModalFilters {
  empresa?: string;
  embarcacao?: string;
  cargo?: string;
  statusAtivo?: 'ativos' | 'inativos' | 'todos';
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
}

interface ModalAprovacaoFechamentoProps {
  isOpen: boolean;
  onClose: () => void;
  initialMesAno?: string;
  filters?: ModalFilters;
  onSuccess?: () => void;
}

export default function ModalAprovacaoFechamento({
  isOpen,
  onClose,
  initialMesAno,
  filters = {},
  onSuccess,
}: ModalAprovacaoFechamentoProps) {
  // Mês civil local (BRT): toISOString() viraria o mês em 21h do fim de mês.
  const _now = new Date();
  const currentMonthStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`;
  const [mesAno, setMesAno] = useState(initialMesAno || currentMonthStr);
  const [isLoading, setIsLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState(filters.busca || '');
  const [observacoes, setObservacoes] = useState('');
  const [enviarEmail, setEnviarEmail] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<{ success: boolean; text: string; hash?: string; pendentes?: any[] } | null>(null);

  const { requestSignature, hasSignature } = useSignature();
  const { user, profile } = useSupabaseAuth();
  const fechamentoUser = {
    id: profile?.id || user?.id,
    email: profile?.email || user?.email || '',
    role: profile?.role ?? null,
    first_name: profile?.first_name ?? null,
    last_name: profile?.last_name ?? null,
  };

  const buildQueryString = (targetMes: string) => {
    const params = new URLSearchParams();
    params.set('mesAno', targetMes);
    if (filters.empresa) params.set('empresa', filters.empresa);
    if (filters.embarcacao) params.set('embarcacao', filters.embarcacao);
    if (filters.cargo) params.set('cargo', filters.cargo);
    if (filters.statusAtivo) params.set('statusAtivo', filters.statusAtivo);
    if (filters.dataInicio) params.set('dataInicio', filters.dataInicio);
    if (filters.dataFim) params.set('dataFim', filters.dataFim);
    if (searchTerm) params.set('busca', searchTerm);
    return params.toString();
  };

  const loadPreview = async (targetMes: string, opts?: { keepResult?: boolean }) => {
    setIsLoading(true);
    setErrorMsg(null);
    if (!opts?.keepResult) setResultMsg(null);
    try {
      const q = buildQueryString(targetMes);
      const res = await fetchWithToken(`/api/gestao-tripulantes/relatorio-mensal?${q}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao carregar dados do mês.');
      }
      setPreviewData(data);
    } catch (err) {
      console.error('Erro no preview do fechamento:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao buscar dados do fechamento.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPreview(mesAno);
    }
  }, [isOpen, mesAno, filters.embarcacao, filters.empresa, filters.cargo, filters.statusAtivo]);

  const handleDownloadXlsx = () => {
    const q = buildQueryString(mesAno) + '&download=true';
    window.open(`/api/gestao-tripulantes/relatorio-mensal?${q}`, '_blank');
  };

  const executeApproval = async (signatureUrl: string) => {
    setIsApproving(true);
    try {
      const res = await fetchWithToken('/api/gestao-tripulantes/relatorio-mensal/aprovar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesAno,
          observacoes,
          enviarEmail,
          signature_url: signatureUrl,
          filtros: {
            empresa: filters.empresa,
            embarcacao: filters.embarcacao,
            cargo: filters.cargo,
            statusAtivo: filters.statusAtivo,
            busca: searchTerm,
            dataInicio: filters.dataInicio,
            dataFim: filters.dataFim,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Erro ao aprovar fechamento (${res.status}).`);
      }

      setResultMsg({
        success: true,
        text: data.message || 'Assinatura registrada com sucesso!',
        hash: data.signatureHash,
        pendentes: data.pendentes,
      });

      if (onSuccess) onSuccess();
      await loadPreview(mesAno, { keepResult: true });
    } catch (err) {
      console.error('Erro na aprovação do fechamento:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao processar aprovação.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleApprove = async () => {
    setErrorMsg(null);
    setResultMsg(null);
    const lista = (previewData?.aprovadoresObrigatorios || []) as AprovadorObrigatorio[];
    const gate = podeAssinarFechamento(lista, {
      userId: fechamentoUser.id,
      email: fechamentoUser.email,
      role: fechamentoUser.role,
    });
    if (!gate.permitido) {
      setErrorMsg(mensagemErroAssinaturaNegada(gate.motivo));
      return;
    }
    try {
      const sign = await requestSignature({
        title: 'Assinatura Digital de Fechamento de Escala',
        description: `Confirme sua assinatura digital para validar o fechamento de escala de ${mesAno} para o DP.`,
      });
      if (!sign) {
        if (!hasSignature) {
          setErrorMsg(mensagemErroAssinaturaAusente());
        }
        return;
      }
      await executeApproval(sign.signatureUrl);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao solicitar assinatura digital.');
    }
  };

  if (!isOpen) return null;

  const colabs = previewData?.colaboradoresTotais || [];
  const filteredColabs = colabs.filter((c: any) =>
    (c.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cpf || '').includes(searchTerm) ||
    (c.cargo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const obrigatorios: AprovadorObrigatorio[] = previewData?.aprovadoresObrigatorios || [];
  const assinaturas: AssinaturaFechamento[] = previewData?.assinaturasColetadas || [];
  const totalObrigatorios = obrigatorios.length > 0 ? obrigatorios.length : 1;
  const assinadosCount = assinaturas.length;
  const registroStatus = String(previewData?.registro?.status || '');
  const isFullyApproved = registroStatus === 'aprovado' || registroStatus === 'enviado';
  const isPartiallyApproved = registroStatus === 'em_aprovacao';
  const gateAssinatura = podeAssinarFechamento(obrigatorios, {
    userId: fechamentoUser.id,
    email: fechamentoUser.email,
    role: fechamentoUser.role,
  });
  const podeAssinarAgora = Boolean(previewData) && gateAssinatura.permitido;
  const motivoNaoAssinar = !gateAssinatura.permitido
    ? mensagemErroAssinaturaNegada(gateAssinatura.motivo)
    : null;
  const statusBadgeLabel = isFechamentoStatus(registroStatus)
    ? labelFechamentoStatus(registroStatus, { assinados: assinadosCount, obrigatorios: obrigatorios.length })
    : (isFullyApproved
      ? '✓ 100% Assinado & Aprovado'
      : (isPartiallyApproved ? `Em Aprovação (${assinadosCount}/${totalObrigatorios})` : 'Pendente de Assinatura'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150 border border-gray-200">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-sm">
              <FiShield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Fechamento Mensal de Escalas — DP & Folha
              </h2>
              <p className="text-xs text-gray-500">
                Cômputo individual de ON, DBA, FI e TRE com conferência de integrantes e aprovação digital obrigatória
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm">
          {/* Seletor de Mês e Filtros Ativos */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1">
                <FiCalendar className="text-abz-blue" />
                Mês de Referência:
              </label>
              <input
                type="month"
                value={mesAno}
                onChange={(e) => setMesAno(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg font-bold text-gray-900 text-sm focus:ring-2 focus:ring-abz-blue shadow-sm"
              />
              <button
                onClick={() => loadPreview(mesAno)}
                disabled={isLoading}
                className="p-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
                title="Recarregar dados"
              >
                <FiRefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadXlsx}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition shadow-sm"
              >
                <FiDownload className="w-4 h-4" />
                Baixar Planilha Filtrada (.xlsx)
              </button>
            </div>
          </div>

          {/* Tags de Filtros Ativos */}
          {(filters.embarcacao || filters.empresa || filters.cargo || filters.statusAtivo) && (
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200 flex-wrap">
              <span className="font-bold text-slate-800">Filtros Ativos Aplicados:</span>
              {filters.embarcacao && <span className="bg-white px-2 py-0.5 rounded border border-slate-300 font-semibold">Embarcação: {filters.embarcacao}</span>}
              {filters.empresa && <span className="bg-white px-2 py-0.5 rounded border border-slate-300 font-semibold">Empresa: {filters.empresa}</span>}
              {filters.cargo && <span className="bg-white px-2 py-0.5 rounded border border-slate-300 font-semibold">Cargo: {filters.cargo}</span>}
              {filters.statusAtivo && <span className="bg-white px-2 py-0.5 rounded border border-slate-300 font-semibold">Status: {filters.statusAtivo}</span>}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
              <FiAlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {resultMsg && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-2 text-green-800 text-sm">
              <div className="flex items-center gap-2 font-bold">
                <FiCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span>{resultMsg.text}</span>
              </div>
              {resultMsg.hash && (
                <div className="text-xs font-mono bg-green-100/70 p-2 rounded text-green-900 break-all">
                  Hash de Autenticidade da sua Assinatura: <strong>{resultMsg.hash}</strong>
                </div>
              )}
            </div>
          )}

          {/* Cards de KPIs Consolidados (Cálculo Diário) */}
          {previewData?.totaisConsolidados && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Tripulantes</span>
                <span className="text-xl font-black text-slate-900">
                  {previewData.totaisConsolidados.totalColaboradores}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Total filtrado</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase block">Dias ON</span>
                <span className="text-xl font-black text-emerald-800">
                  {previewData.totaisConsolidados.totalON} <span className="text-xs font-normal">dias</span>
                </span>
                <span className="text-[10px] text-emerald-600/70 block mt-0.5">A bordo regular</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-amber-700 uppercase block">Dias DBA</span>
                <span className="text-xl font-black text-amber-800">
                  {previewData.totaisConsolidados.totalDBA} <span className="text-xs font-normal">dias</span>
                </span>
                <span className="text-[10px] text-amber-600/70 block mt-0.5">Dobra (excede NxN)</span>
              </div>
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-blue-700 uppercase block">Dias FI</span>
                <span className="text-xl font-black text-blue-800">
                  {previewData.totaisConsolidados.totalFI} <span className="text-xs font-normal">dias</span>
                </span>
                <span className="text-[10px] text-blue-600/70 block mt-0.5">Folga indenizada</span>
              </div>
              <div className="bg-sky-50 border border-sky-200 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-sky-700 uppercase block">Dias Folga</span>
                <span className="text-xl font-black text-sky-800">
                  {previewData.totaisConsolidados.totalFOLGA ?? 0} <span className="text-xs font-normal">dias</span>
                </span>
                <span className="text-[10px] text-sky-600/70 block mt-0.5">Descanso do ciclo</span>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-yellow-800 uppercase block">Dias STB</span>
                <span className="text-xl font-black text-yellow-900">
                  {previewData.totaisConsolidados.totalSTB ?? 0} <span className="text-xs font-normal">dias</span>
                </span>
                <span className="text-[10px] text-yellow-700/70 block mt-0.5">StandBy</span>
              </div>
              <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl">
                <span className="text-[11px] font-semibold text-purple-700 uppercase block">TRE / FER</span>
                <span className="text-xl font-black text-purple-800">
                  {previewData.totaisConsolidados.totalTRE ?? 0}
                  <span className="text-xs font-normal"> / </span>
                  {previewData.totaisConsolidados.totalFER ?? 0}
                </span>
                <span className="text-[10px] text-purple-600/70 block mt-0.5">Treino / férias</span>
              </div>
              <div className={`border p-3 rounded-xl ${(previewData.totaisConsolidados.colaboradoresComAlerta ?? 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <span className="text-[11px] font-semibold uppercase block text-slate-600">Check escala</span>
                <span className="text-xl font-black text-slate-900">
                  {previewData.totaisConsolidados.colaboradoresComAlerta ?? 0}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Com alerta NxN</span>
              </div>
            </div>
          )}

          {/* Painel de Aprovadores Obrigatórios & Progresso de Assinaturas */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-gray-900 text-xs uppercase flex items-center gap-1.5">
                <FiUsers className="text-abz-blue" />
                Conferência de Integrantes & Assinaturas Obrigatórias
              </h4>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                isFullyApproved
                  ? 'bg-emerald-100 text-emerald-800'
                  : (isPartiallyApproved ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800')
              }`}>
                {isFullyApproved ? '✓ 100% Assinado & Aprovado' : statusBadgeLabel}
              </span>
            </div>

            {obrigatorios.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {obrigatorios.map((obr, idx) => {
                  const signature = assinaturaCobreAprovador(obr, assinaturas);
                  return (
                    <div
                      key={obr.email || idx}
                      className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                        signature
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                          : 'bg-white border-amber-200 text-amber-950'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold flex items-center gap-1">
                          {signature ? <FiCheck className="text-emerald-600 font-bold" /> : <FiClock className="text-amber-600" />}
                          <span className="truncate">{obr.nome}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {obr.email} {obr.cargo && `• ${obr.cargo}`}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                        signature ? 'bg-emerald-200/80 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {signature ? 'Assinado' : 'Pendente'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-gray-600">
                Nenhum aprovador específico fixado nas configurações. Qualquer gestor ou administrador pode assinar uma vez para concluir o fechamento e liberar o e-mail ao DP.
              </div>
            )}

            <p className="text-[11px] text-gray-500 pt-1">
              {obrigatorios.length > 0
                ? 'O e-mail ao DP só sai quando todas as pessoas desta lista tiverem assinado. Perfil USER/MANAGER/ADMIN não substitui a lista e assinaturas extras não fecham o fluxo.'
                : 'Sem lista nominada, a primeira assinatura de um gestor ou administrador conclui o fechamento e dispara o e-mail ao DP (se marcado). Usuários USER não concluem neste modo.'}
            </p>
          </div>

          {/* Tabela de Preview dos Colaboradores */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider">
                Detalhamento dos Colaboradores ({filteredColabs.length})
              </h3>
              <div className="relative w-64">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Filtrar por nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-abz-blue"
                />
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl min-w-0 max-h-56 overflow-auto">
              <table className="min-w-[1100px] w-full divide-y divide-gray-200 text-left text-xs">
                <thead className="bg-gray-100 text-gray-700 font-semibold sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Matrícula</th>
                    <th className="px-3 py-2">Tripulante</th>
                    <th className="px-3 py-2">CPF</th>
                    <th className="px-3 py-2">Cargo</th>
                    <th className="px-3 py-2">Centro de Custo</th>
                    <th className="px-3 py-2">Embarcação</th>
                    <th className="px-3 py-2 text-center">Escala</th>
                    <th className="px-3 py-2 text-center bg-emerald-100/50">ON</th>
                    <th className="px-3 py-2 text-center bg-amber-100/50">DBA</th>
                    <th className="px-3 py-2 text-center bg-blue-100/50">FI</th>
                    <th className="px-3 py-2 text-center bg-sky-100/50">Folga</th>
                    <th className="px-3 py-2 text-center bg-yellow-100/50">STB</th>
                    <th className="px-3 py-2 text-center bg-purple-100/50">TRE</th>
                    <th className="px-3 py-2 text-center bg-violet-100/50">FER</th>
                    <th className="px-3 py-2 text-center">Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {isLoading ? (
                    <tr>
                      <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
                        <FiRefreshCw className="animate-spin inline w-4 h-4 mr-1 text-abz-blue" />
                        Calculando comparativo NxN (dt início / dt fim)...
                      </td>
                    </tr>
                  ) : filteredColabs.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="px-4 py-6 text-center text-gray-500">
                        Nenhum registro encontrado para este filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredColabs.map((c: any, idx: number) => {
                      const escalaOk = c.checagens?.escala_ok !== false;
                      const somaOk = c.checagens?.soma_ok !== false;
                      const checkOk = escalaOk && somaOk;
                      return (
                      <tr key={c.cpf || idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono font-bold text-gray-800">{c.matricula || '-'}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{c.nome}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">{c.cpf_formatado || c.cpf}</td>
                        <td className="px-3 py-2 text-gray-600">{c.cargo}</td>
                        <td className="px-3 py-2 text-gray-600 text-[11px] font-semibold">{c.centro_custo || 'N/A'}</td>
                        <td className="px-3 py-2 text-gray-600">{c.embarcacao}</td>
                        <td className="px-3 py-2 text-center font-mono font-semibold text-gray-700">{c.regime_escala || '—'}</td>
                        <td className="px-3 py-2 text-center font-bold text-emerald-700 bg-emerald-50/30">
                          {c.total_dias_on ?? c.total_on ?? 0}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-amber-700 bg-amber-50/30">
                          {c.total_dias_dba ?? c.total_dba ?? 0}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-blue-700 bg-blue-50/30">
                          {c.total_dias_fi ?? c.total_fi ?? 0}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-sky-700 bg-sky-50/30">
                          {c.total_dias_folga ?? 0}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-yellow-800 bg-yellow-50/30">
                          {c.total_dias_stb ?? 0}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-purple-700 bg-purple-50/30">
                          {c.total_dias_tre ?? c.total_tre ?? 0}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-violet-700 bg-violet-50/30">
                          {c.total_dias_fer ?? c.total_fer ?? 0}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${checkOk ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}
                            title={(c.checagens?.alertas || []).join(' | ') || undefined}
                          >
                            {checkOk ? 'OK' : 'Alerta'}
                          </span>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Observações & Envio */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Observações da Aprovação (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Escala conferida com RH e Logística, autorizada para folha."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-abz-blue"
                />
              </div>

              <div className="flex flex-col justify-center space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enviarEmail}
                    onChange={(e) => setEnviarEmail(e.target.checked)}
                    className="h-4 w-4 text-abz-blue rounded border-gray-300 focus:ring-abz-blue"
                  />
                  <span className="text-xs font-semibold text-gray-800">
                    Disparar e-mail ao Departamento Pessoal quando todas as assinaturas forem concluídas
                  </span>
                </label>
                <p className="text-[11px] text-gray-500 pl-6">
                  Anexa a planilha XLSX oficial assinada por todos os aprovadores.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
          >
            Fechar
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadXlsx}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-emerald-600 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-50 transition"
            >
              <FiFileText className="w-4 h-4" />
              Baixar .xlsx Filtrado
            </button>

          <div className="flex flex-col items-end gap-2">
            {previewData && motivoNaoAssinar && (
              <p className="text-xs text-amber-800 max-w-sm text-right">{motivoNaoAssinar}</p>
            )}
            <button
              onClick={handleApprove}
              disabled={isApproving || isLoading || !podeAssinarAgora}
              className="inline-flex items-center gap-2 px-5 py-2 bg-abz-blue text-white rounded-lg text-sm font-bold hover:bg-blue-800 transition shadow-md disabled:opacity-50"
            >
              {isApproving ? (
                <FiRefreshCw className="animate-spin w-4 h-4" />
              ) : (
                <FiSend className="w-4 h-4" />
              )}
              {isFullyApproved ? 'Reassinar / Reenviar' : 'Assinar & Salvar Aprovação'}
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
