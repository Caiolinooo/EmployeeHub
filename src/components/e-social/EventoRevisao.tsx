'use client';

import React, { useState, useEffect } from 'react';
import { ESocialEvento } from '@/types/e-social';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { FiX, FiCheck, FiXCircle, FiAlertTriangle, FiRefreshCw, FiCode, FiList, FiCopy, FiCheckCircle, FiSend } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

interface EventoRevisaoProps {
  evento: ESocialEvento;
  open: boolean;
  onClose: () => void;
  onApprove: (eventoId: string, comentario?: string) => void;
  onReject: (eventoId: string, comentario?: string) => void;
  loading?: boolean;
}

export default function EventoRevisao({ evento, open, onClose, onApprove, onReject, loading }: EventoRevisaoProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'dados' | 'xml' | 'logs'>('dados');
  const [comentario, setComentario] = useState('');
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);

  // Matrícula Correction State
  const [matriculaCorreta, setMatriculaCorreta] = useState('');
  const [correcting, setCorrecting] = useState(false);
  const [correctError, setCorrectError] = useState<string | null>(null);
  const [correctSuccess, setCorrectSuccess] = useState(false);

  // Validation State
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [camposPreenchidos, setCamposPreenchidos] = useState<Record<string, string>>({});
  const [savingCampos, setSavingCampos] = useState(false);
  const [sending, setSending] = useState(false);

  // Logs State
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [copiedXml, setCopiedXml] = useState(false);

  useEffect(() => {
    if (open && evento?.id) {
      loadLogs();
    }
  }, [open, evento?.id]);

  const loadLogs = async () => {
    if (!evento?.id) return;
    try {
      setLoadingLogs(true);
      const res = await fetchWithToken(`/api/e-social/eventos/${evento.id}/logs`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // Silently catch
    } finally {
      setLoadingLogs(false);
    }
  };

  if (!open) return null;

  const handleConfirm = () => {
    if (confirmAction === 'approve') {
      onApprove(evento.id, comentario || undefined);
    } else if (confirmAction === 'reject') {
      onReject(evento.id, comentario || undefined);
    }
    setConfirmAction(null);
    setComentario('');
  };

  const handleClose = () => {
    setConfirmAction(null);
    setComentario('');
    setMatriculaCorreta('');
    setCorrectError(null);
    setCorrectSuccess(false);
    setActiveTab('dados');
    onClose();
  };

  const handleCopyXml = () => {
    if (!evento.xml_gerado) return;
    navigator.clipboard.writeText(evento.xml_gerado);
    setCopiedXml(true);
    toast.success('XML copiado para a área de transferência!');
    setTimeout(() => setCopiedXml(false), 2000);
  };

  const handleCorrectMatricula = async () => {
    if (!matriculaCorreta.trim()) return;
    setCorrecting(true);
    setCorrectError(null);
    try {
      const response = await fetchWithToken('/api/e-social/corrigir-matricula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: evento.id,
          matriculaCorreta: matriculaCorreta.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao corrigir matrícula');
      }
      setCorrectSuccess(true);
      toast.success('Matrícula corrigida com sucesso!');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setCorrectError(err.message || 'Erro ao conectar ao servidor');
    } finally {
      setCorrecting(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    setValidationResult(null);
    try {
      const response = await fetchWithToken(`/api/e-social/eventos/${evento.id}/validar`, { method: 'POST' });
      const data = await response.json();
      setValidationResult(data);
      if (data.pronto) {
        if (data.xml) evento.xml_gerado = data.xml;
        if (data.evento) Object.assign(evento, data.evento);
        toast.success('Evento validado. XML corrigido. Pode transmitir.');
      } else {
        toast.error('O evento possui pendências a serem corrigidas.');
      }
    } catch (err: any) {
      setValidationResult({ pronto: false, erros: [err.message || 'Erro de conexão'] });
    } finally {
      setValidating(false);
    }
  };

  const handleSend = async (force = false) => {
    setSending(true);
    try {
      const response = await fetchWithToken(
        `/api/e-social/eventos/${evento.id}/enviar${force ? '?force=true' : ''}`,
        { method: 'POST' },
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        toast.success('Evento transmitido ao e-Social.');
        setTimeout(() => window.location.reload(), 1200);
        return;
      }
      if (response.status === 400 && data.code === 'HAS_PROTOCOL') {
        if (confirm('Este evento já possui protocolo de envio. Forçar novo envio com o XML corrigido?')) {
          await handleSend(true);
        }
        return;
      }
      toast.error(data.error || 'Erro ao transmitir evento');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao transmitir evento');
    } finally {
      setSending(false);
    }
  };

  const handleSaveCampos = async () => {
    setSavingCampos(true);
    try {
      const response = await fetchWithToken(`/api/e-social/eventos/${evento.id}/corrigir-campos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campos: camposPreenchidos })
      });
      const data = await response.json();
      setValidationResult(data);
      if (data.pronto) {
        toast.success('Campos atualizados e evento homologado!');
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err: any) {
      setValidationResult({ pronto: false, erros: [err.message || 'Erro ao salvar campos'] });
    } finally {
      setSavingCampos(false);
    }
  };

  const errorMsg = evento.ultimo_erro || (Array.isArray(evento.erros_processamento) ? evento.erros_processamento.join('; ') : '');
  const isMatriculaError = evento.status === 'erro' && (
    errorMsg.toLowerCase().includes('não foi localizado o contrato de trabalho') ||
    errorMsg.toLowerCase().includes('contrato de trabalho não localizado') ||
    errorMsg.toLowerCase().includes('não localizado o contrato de trabalho')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono font-bold text-xs bg-blue-600 text-white px-2.5 py-0.5 rounded-md">
                {evento.evento_codigo}
              </span>
              <h2 className="text-lg font-bold text-gray-800">
                {evento.evento_nome || t('eSocial.revisao.title', 'Revisão do Evento')}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Colaborador: <strong>{evento.colaborador_nome || 'N/A'}</strong> ({evento.cpf_trabalhador || 'Sem CPF'})
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-slate-200 transition-colors">
            <FiX size={22} />
          </button>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex border-b border-slate-200 px-6 gap-6 bg-white shrink-0">
          <button
            onClick={() => setActiveTab('dados')}
            className={`py-3 font-semibold text-sm transition-all duration-200 border-b-2 flex items-center gap-2 ${
              activeTab === 'dados'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FiList size={16} />
            Detalhes & Validação
          </button>
          <button
            onClick={() => setActiveTab('xml')}
            className={`py-3 font-semibold text-sm transition-all duration-200 border-b-2 flex items-center gap-2 ${
              activeTab === 'xml'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FiCode size={16} />
            XML do Evento
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 font-semibold text-sm transition-all duration-200 border-b-2 flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FiRefreshCw size={16} />
            Histórico & Logs ({logs.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/30">

          {activeTab === 'dados' && (
            <>
              {/* Receipt / Protocol Card if already sent */}
              {(evento.numero_recibo || evento.protocolo_envio || evento.data_envio) && (
                <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 flex flex-wrap gap-4 items-center justify-between text-xs text-blue-900">
                  <div className="flex flex-wrap gap-4">
                    {evento.numero_recibo && (
                      <div>
                        <span className="text-slate-500 block">Número do Recibo:</span>
                        <span className="font-mono font-bold text-sm text-emerald-700">{evento.numero_recibo}</span>
                      </div>
                    )}
                    {evento.protocolo_envio && (
                      <div>
                        <span className="text-slate-500 block">Protocolo de Envio:</span>
                        <span className="font-mono font-bold text-sm text-blue-800">{evento.protocolo_envio}</span>
                      </div>
                    )}
                    {evento.data_envio && (
                      <div>
                        <span className="text-slate-500 block">Transmitido em:</span>
                        <span className="font-medium text-slate-800">
                          {new Date(evento.data_envio).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Erro de Matrícula e Correção Assistida */}
              {isMatriculaError && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                    <FiAlertTriangle size={18} className="text-amber-600 animate-pulse" />
                    <span>Erro Crítico: Matrícula Rejeitada pelo e-Social</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    O governo retornou o erro indicando que este CPF não possui a matrícula <strong>{evento.matricula || 'enviada'}</strong> cadastrada no e-Social.
                    <br /><br />
                    <strong>Como resolver:</strong>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>Acesse o portal do e-Social usando seu certificado.</li>
                      <li>Vá em <strong>Empregado &gt; Gestão de Empregados</strong> e filtre pelo CPF <strong>{evento.cpf_trabalhador}</strong>.</li>
                      <li>Copie o número da matrícula que consta no portal (ex: <code>17784306000189.000541</code>).</li>
                      <li>Insira o valor correto abaixo e clique em Corrigir.</li>
                    </ol>
                  </p>
                  
                  <div className="flex gap-2 items-end pt-2">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-amber-800 mb-1">Matrícula Correta (do portal e-Social)</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500 bg-white"
                        placeholder="Ex: 17784306000189.000541"
                        value={matriculaCorreta}
                        onChange={(e) => setMatriculaCorreta(e.target.value)}
                        disabled={correcting || correctSuccess}
                      />
                    </div>
                    <button
                      onClick={handleCorrectMatricula}
                      disabled={!matriculaCorreta.trim() || correcting || correctSuccess}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer shadow-sm"
                    >
                      {correcting ? (
                        <FiRefreshCw className="animate-spin" />
                      ) : correctSuccess ? (
                        <FiCheck />
                      ) : null}
                      {correcting ? 'Corrigindo...' : correctSuccess ? 'Corrigido!' : 'Corrigir e Recompilar XML'}
                    </button>
                  </div>

                  {correctError && (
                    <p className="text-xs text-red-600 font-medium">{correctError}</p>
                  )}
                  {correctSuccess && (
                    <p className="text-xs text-emerald-600 font-medium">Sucesso! A matrícula foi atualizada no colaborador e o XML foi regenerado.</p>
                  )}
                </div>
              )}

              {/* UI de Validação & Auto-Correção */}
              {validationResult && (
                <div className={`p-4 rounded-xl border ${validationResult.pronto ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'} space-y-3`}>
                  <div className={`flex items-center gap-2 font-bold text-sm ${validationResult.pronto ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {validationResult.pronto ? <FiCheck size={18} /> : <FiAlertTriangle size={18} />}
                    <span>{validationResult.pronto ? 'Validação Concluída com Sucesso! XML Homologado.' : 'Atenção Necessária'}</span>
                  </div>

                  {validationResult.correcoesAplicadas && validationResult.correcoesAplicadas.length > 0 && (
                    <div className="text-xs text-emerald-800 bg-emerald-100/60 p-3 rounded-lg">
                      <p className="font-semibold mb-1">Correções Automáticas Aplicadas:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {validationResult.correcoesAplicadas.map((c: any, i: number) => (
                          <li key={i}>{c.descricao}: <span className="line-through opacity-70">{c.de}</span> → <strong>{c.para}</strong></li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResult.erros && validationResult.erros.length > 0 && (
                    <div className="text-xs text-red-700 bg-red-100/60 p-3 rounded-lg">
                      <p className="font-semibold mb-1">Erros Críticos:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {validationResult.erros.map((e: string, i: number) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResult.camposPendentes && validationResult.camposPendentes.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-amber-200/50">
                      <p className="text-xs font-bold text-amber-900">Preencha os campos obrigatórios pendentes:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {validationResult.camposPendentes.map((c: any) => (
                          <div key={c.campo} className="space-y-1">
                            <label className="block text-xs font-semibold text-amber-900">
                              {c.label} {c.dica && <span className="text-amber-600/70 font-normal">({c.dica})</span>}
                            </label>
                            {c.tipo === 'select' ? (
                              <select
                                className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white focus:ring-amber-500 focus:border-amber-500"
                                value={camposPreenchidos[c.campo] || ''}
                                onChange={(e) => setCamposPreenchidos({ ...camposPreenchidos, [c.campo]: e.target.value })}
                              >
                                <option value="">Selecione...</option>
                                {c.opcoes?.map((o: any) => (
                                  <option key={o.valor} value={o.valor}>{o.label}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={c.tipo === 'date' ? 'date' : 'text'}
                                className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white focus:ring-amber-500 focus:border-amber-500"
                                value={camposPreenchidos[c.campo] || ''}
                                onChange={(e) => setCamposPreenchidos({ ...camposPreenchidos, [c.campo]: e.target.value })}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={handleSaveCampos}
                        disabled={savingCampos || Object.keys(camposPreenchidos).length === 0}
                        className="mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                      >
                        {savingCampos ? 'Salvando...' : 'Salvar e Revalidar'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Informações Básicas do Evento */}
              <div className="bg-white p-5 rounded-xl border border-slate-200/80 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Código do Evento</span>
                  <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">{evento.evento_codigo}</p>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">CPF do Trabalhador</span>
                  <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">{evento.cpf_trabalhador || '-'}</p>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Matrícula</span>
                  <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">{evento.colaborador_matricula || evento.matricula || '-'}</p>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Módulo de Origem</span>
                  <p className="font-medium text-slate-800 text-sm mt-0.5 capitalize">{evento.modulo_origem || '-'}</p>
                </div>
              </div>

              {/* Inconsistências Retornadas */}
              {(evento.status === 'erro' || evento.ultimo_erro) && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
                    <FiXCircle size={18} />
                    <span>Inconsistências Retornadas pelo e-Social</span>
                  </div>
                  
                  {evento.protocolo_envio && (
                    <div className="text-xs text-red-700 font-medium">
                      Protocolo de Envio: <span className="font-mono bg-red-100 px-1.5 py-0.5 rounded">{evento.protocolo_envio}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {Array.isArray(evento.erros_processamento) && evento.erros_processamento.length > 0 ? (
                      <ul className="list-disc list-inside text-xs text-red-700 space-y-1 pl-1">
                        {evento.erros_processamento.map((err: string, idx: number) => (
                          <li key={idx} className="leading-relaxed whitespace-pre-line">
                            {err}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-red-700 whitespace-pre-line leading-relaxed">
                        {evento.ultimo_erro || 'Erro desconhecido no processamento do lote.'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Dados Estruturados em JSON */}
              {evento.dados_evento && (
                <div>
                  <h3 className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">Payload Estruturado (JSON)</h3>
                  <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs font-mono max-h-48 overflow-auto border border-slate-800">
                    {JSON.stringify(evento.dados_evento, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}

          {activeTab === 'xml' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">XML Formatado (e-Social v_S_01_03_00)</span>
                {evento.xml_gerado && (
                  <button
                    onClick={handleCopyXml}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                  >
                    {copiedXml ? <FiCheckCircle size={14} className="text-emerald-600" /> : <FiCopy size={14} />}
                    {copiedXml ? 'Copiado!' : 'Copiar XML'}
                  </button>
                )}
              </div>

              {evento.xml_gerado ? (
                <pre className="bg-slate-900 text-emerald-400 border border-slate-800 rounded-xl p-4 text-xs font-mono max-h-[50vh] overflow-auto whitespace-pre-wrap leading-relaxed shadow-inner">
                  {evento.xml_gerado}
                </pre>
              ) : (
                <div className="bg-white border rounded-xl p-8 text-center text-slate-400 text-xs">
                  Nenhum XML gerado para este evento. Clique em "Validar Auto-Correção" para gerar o XML automaticamente.
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Histórico de Transmissões e Consultas</span>
                <button
                  onClick={loadLogs}
                  disabled={loadingLogs}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <FiRefreshCw size={13} className={loadingLogs ? 'animate-spin' : ''} />
                  Atualizar Logs
                </button>
              </div>

              {loadingLogs ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="bg-white border rounded-xl p-8 text-center text-slate-400 text-xs">
                  Nenhum log de transmissão registrado para este evento até o momento.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {logs.map((log: any) => (
                    <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                            log.sucesso ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {log.acao} • {log.sucesso ? 'SUCESSO' : 'FALHA'}
                          </span>
                          {log.status_code && (
                            <span className="text-slate-500 font-mono">HTTP {log.status_code}</span>
                          )}
                        </div>
                        <span className="text-slate-400 text-[11px]">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>

                      {log.mensagem_erro && (
                        <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2 rounded">
                          {log.mensagem_erro}
                        </p>
                      )}

                      {log.response_body && (
                        <details className="group">
                          <summary className="text-[11px] font-semibold text-slate-600 cursor-pointer hover:underline list-none flex items-center justify-between">
                            <span>Ver Resposta do WebService</span>
                            <span className="transition-transform group-open:rotate-180">▼</span>
                          </summary>
                          <pre className="mt-2 bg-slate-900 text-slate-200 rounded-lg p-3 text-[10px] font-mono max-h-40 overflow-auto whitespace-pre-wrap">
                            {typeof log.response_body === 'string' ? log.response_body : JSON.stringify(log.response_body, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Confirmação de Aprovação / Reprovação */}
          {confirmAction && (
            <div className="bg-white border-2 border-blue-200 rounded-xl p-5 space-y-3 shadow-md">
              <p className="text-sm font-bold text-gray-800">
                {confirmAction === 'approve'
                  ? t('eSocial.revisao.approveConfirm', 'Deseja aprovar e homologar este evento para envio?')
                  : t('eSocial.revisao.rejectConfirm', 'Deseja rejeitar este evento?')}
              </p>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder={t('eSocial.revisao.commentPlaceholder', 'Insira uma observação opcional...')}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className={`px-4 py-2 text-sm text-white font-bold rounded-lg disabled:opacity-50 transition-colors shadow-sm ${
                    confirmAction === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {loading ? 'Processando...' : confirmAction === 'approve' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!confirmAction && (
          <div className="p-4 border-t border-slate-200/80 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleValidate}
              disabled={validating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-xl transition-all disabled:opacity-50 shadow-xs cursor-pointer"
            >
              <FiRefreshCw size={15} className={validating ? 'animate-spin' : ''} />
              {validating ? 'Validando & Corrigindo...' : 'Validar Auto-Correção'}
            </button>
            
            <div className="flex items-center gap-2">
              {(['erro', 'revisao_aprovado', 'fila_envio'].includes(evento.status) || validationResult?.pronto) && (
                <button
                  onClick={() => handleSend(false)}
                  disabled={sending || validating}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  <FiSend size={15} />
                  {sending ? 'Transmitindo...' : 'Enviar ao e-Social'}
                </button>
              )}
              {['pendente_revisao', 'erro', 'rascunho', 'revisao_rejeitado'].includes(evento.status) ? (
                <>
                  <button
                    onClick={() => setConfirmAction('reject')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors"
                  >
                    <FiXCircle size={16} />
                    {t('eSocial.revisao.reject', 'Rejeitar')}
                  </button>
                  <button
                    onClick={() => setConfirmAction('approve')}
                    className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm"
                  >
                    <FiCheck size={16} />
                    {t('eSocial.revisao.approve', 'Aprovar / Homologar')}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleClose}
                  className="px-5 py-2 text-sm font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
