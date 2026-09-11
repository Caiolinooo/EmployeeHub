'use client';

import React, { useState } from 'react';
import {
  FiX,
  FiDownload,
  FiCopy,
  FiCheck,
  FiHeart,
  FiUser,
  FiCalendar,
  FiActivity,
  FiShield,
  FiFileText,
  FiAlertCircle,
  FiCheckCircle,
  FiMapPin,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { formatCpf } from '@/lib/gestao-tripulantes/cpf';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  documento: any;
  colaboradorNome?: string;
  colaboradorCpf?: string;
}

type OcrNamedItem = { nome?: string; exame?: string; data?: string };
type OcrListItem = string | OcrNamedItem;

function isOcrNamedItem(value: OcrListItem): value is OcrNamedItem {
  return typeof value === 'object' && value != null;
}

const TIPO_EXAME_LABELS: Record<string, string> = {
  admissional: 'Admissional',
  periodico: 'Periódico',
  demissional: 'Demissional',
  retorno: 'Retorno ao Trabalho',
  mudanca_funcao: 'Mudança de Função / Risco',
};

const RESULTADO_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  apto: { label: 'APTO', bg: 'bg-emerald-100 border-emerald-300', text: 'text-emerald-800' },
  inapto: { label: 'INAPTO', bg: 'bg-rose-100 border-rose-300', text: 'text-rose-800' },
  apto_condicional: { label: 'APTO COM RESTRIÇÃO', bg: 'bg-amber-100 border-amber-300', text: 'text-amber-800' },
};

export default function AsoOcrDetailsModal({
  isOpen,
  onClose,
  documento,
  colaboradorNome,
  colaboradorCpf,
}: Props) {
  const [copiedJson, setCopiedJson] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  if (!isOpen || !documento) return null;

  const ocrData = documento.ocr_dados_extraidos || documento.ocr_data || {};
  const asoData = documento.aso_data || {};
  const esocialRef = asoData.esocial_evento_ref || {};

  const tipoExame = asoData.tipo_exame || ocrData.tipo_exame || 'periodico';
  const resultado = asoData.resultado || ocrData.resultado || 'apto';
  const resultadoConfig = RESULTADO_BADGES[String(resultado).toLowerCase()] || RESULTADO_BADGES.apto;

  const nomeOcr = ocrData.nome_completo || ocrData.nome || asoData.nome_colaborador || '';
  const cpfOcr = ocrData.cpf || asoData.cpf_documento || '';
  const rgOcr = ocrData.rg || '';
  const dataNascOcr = ocrData.data_nascimento || '';

  const dataRealizacao = asoData.data_realizacao || ocrData.data_realizacao || documento.data_emissao;
  const dataValidade = documento.data_validade || ocrData.data_validade;

  const medicoExaminador =
    ocrData.medico_examinador_nome || ocrData.medico_nome || asoData.medico_nome || ocrData.medico || '—';
  const crmExaminador =
    ocrData.medico_examinador_crm || ocrData.medico_crm || asoData.medico_crm || '';
  const ufExaminador =
    ocrData.medico_examinador_uf || ocrData.medico_uf || asoData.medico_uf || 'RJ';

  const medicoPcmso = ocrData.medico_pcmso_nome || ocrData.coordenador_pcmso || '';
  const crmPcmso = ocrData.medico_pcmso_crm || '';
  const ufPcmso = ocrData.medico_pcmso_uf || '';

  const clinica = ocrData.nome_clinica || asoData.nome_clinica || '—';
  const cnpjClinica = ocrData.cnpj_clinica || '';
  const enderecoClinica = [ocrData.endereco_logradouro, ocrData.endereco_cep].filter(Boolean).join(' - ');

  const examesRealizados: OcrListItem[] = Array.isArray(ocrData.exames_realizados)
    ? ocrData.exames_realizados
    : Array.isArray(ocrData.exames_complementares)
    ? ocrData.exames_complementares
    : [];

  const riscosOcupacionais: OcrListItem[] = Array.isArray(ocrData.riscos_ocupacionais)
    ? ocrData.riscos_ocupacionais
    : Array.isArray(ocrData.fatores_risco)
    ? ocrData.fatores_risco
    : [];

  const formatDate = (val: unknown) => {
    if (!val) return '—';
    try {
      if (typeof val === 'string' && val.includes('/')) return val;
      return new Date(String(val)).toLocaleDateString('pt-BR');
    } catch {
      return String(val);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(ocrData, null, 2));
    setCopiedJson(true);
    toast.success('JSON do OCR copiado para a área de transferência!');
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const recibo =
    asoData.esocial_numero_recibo ||
    esocialRef.numero_recibo ||
    ocrData.numero_recibo;
  const protocolo =
    asoData.esocial_protocolo ||
    esocialRef.protocolo_envio ||
    ocrData.protocolo_envio;
  const dataEnvio =
    asoData.esocial_data_envio ||
    esocialRef.data_envio ||
    esocialRef.data_processamento;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-400/30 flex items-center justify-center text-red-400">
              <FiHeart size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Informações Extraídas do ASO (OCR)
                </h2>
                <span
                  className={'px-2 py-0.5 rounded-full border text-[11px] font-bold uppercase ' + resultadoConfig.bg + ' ' + resultadoConfig.text}
                >
                  {resultadoConfig.label}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30 text-[11px] font-medium">
                  {TIPO_EXAME_LABELS[tipoExame.toLowerCase()] || tipoExame}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {documento.titulo || 'ASO — Atestado de Saúde Ocupacional'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {documento.arquivo_url && (
              <a
                href={documento.arquivo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
              >
                <FiDownload size={14} />
                Baixar PDF
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {/* Top Summary Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Data de Realização</span>
              <span className="font-bold text-slate-800 text-sm">
                {formatDate(dataRealizacao)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Data de Validade</span>
              <span className="font-bold text-slate-800 text-sm">
                {formatDate(dataValidade)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Status do OCR</span>
              <span
                className={'font-bold inline-flex items-center gap-1 text-sm ' + (documento.ocr_status === 'concluido' ? 'text-emerald-600' : 'text-amber-600')}
              >
                {documento.ocr_status === 'concluido' ? (
                  <FiCheckCircle size={14} />
                ) : (
                  <FiAlertCircle size={14} />
                )}
                {String(documento.ocr_status || 'Pendente').toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Status e-Social</span>
              <span className="font-bold text-blue-700 text-sm">
                {recibo
                  ? 'PROCESSADO (COM RECIBO)'
                  : (asoData.esocial_status || 'NÃO ENVIADO').replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
          </div>

          {/* 1. Identificação do Colaborador */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <FiUser className="text-blue-600" size={16} />
              <h3 className="font-bold text-slate-800 text-sm">
                Identificação & Reconhecimento Óptico (OCR)
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 block">Nome no Documento (OCR):</span>
                <p className="font-semibold text-slate-800 text-sm uppercase">
                  {nomeOcr || '—'}
                </p>
                {colaboradorNome && nomeOcr && (
                  <span className="text-[11px] text-slate-500">
                    Perfil cadastrado: <strong>{colaboradorNome}</strong>
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 block">CPF Extraído (OCR):</span>
                <p className="font-mono font-bold text-slate-800 text-sm">
                  {cpfOcr ? formatCpf(cpfOcr) : 'Não detectado'}
                </p>
                {colaboradorCpf && (
                  <span className="text-[11px] text-slate-500">
                    Perfil cadastrado: <strong>{formatCpf(colaboradorCpf)}</strong>
                  </span>
                )}
              </div>

              {rgOcr && (
                <div>
                  <span className="text-slate-400 block">RG Extraído:</span>
                  <span className="font-semibold text-slate-700">{rgOcr}</span>
                </div>
              )}

              {dataNascOcr && (
                <div>
                  <span className="text-slate-400 block">Data de Nascimento:</span>
                  <span className="font-semibold text-slate-700">{formatDate(dataNascOcr)}</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Corpo Clínico & PCMSO */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <FiActivity className="text-emerald-600" size={16} />
              <h3 className="font-bold text-slate-800 text-sm">
                Corpo Clínico, PCMSO & Clínica
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 block font-medium">Médico Examinador</span>
                <p className="font-bold text-slate-800 text-sm">{medicoExaminador}</p>
                {crmExaminador && (
                  <p className="text-slate-600 text-xs">
                    CRM: <strong className="font-mono">{crmExaminador}</strong> ({ufExaminador})
                  </p>
                )}
              </div>

              <div className="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 block font-medium">Médico Coordenador do PCMSO</span>
                <p className="font-bold text-slate-800 text-sm">{medicoPcmso || '—'}</p>
                {crmPcmso && (
                  <p className="text-slate-600 text-xs">
                    CRM: <strong className="font-mono">{crmPcmso}</strong> ({ufPcmso || 'RJ'})
                  </p>
                )}
              </div>

              <div className="col-span-1 md:col-span-2 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 block font-medium">Clínica / Local de Realização</span>
                <p className="font-bold text-slate-800 text-sm">{clinica}</p>
                {cnpjClinica && (
                  <p className="text-slate-600 text-xs">
                    CNPJ: <strong className="font-mono">{cnpjClinica}</strong>
                  </p>
                )}
                {enderecoClinica && (
                  <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                    <FiMapPin size={12} className="text-slate-400 shrink-0" />
                    {enderecoClinica}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 3. Exames Complementares Realizados */}
          {examesRealizados.length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <FiFileText className="text-indigo-600" size={16} />
                  <h3 className="font-bold text-slate-800 text-sm">
                    Exames Complementares Realizados ({examesRealizados.length})
                  </h3>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                      <th className="py-2 px-3 font-semibold">Exame</th>
                      <th className="py-2 px-3 font-semibold">Data de Realização</th>
                      <th className="py-2 px-3 font-semibold">Status / Parecer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {examesRealizados.map((ex: OcrListItem, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-medium text-slate-800 uppercase">
                          {typeof ex === 'string' ? ex : ex.nome || ex.exame || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {isOcrNamedItem(ex) && ex.data ? formatDate(ex.data) : formatDate(dataRealizacao)}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            REALIZADO
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. Riscos Ocupacionais */}
          {riscosOcupacionais.length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <FiShield className="text-amber-600" size={16} />
                <h3 className="font-bold text-slate-800 text-sm">
                  Riscos Ocupacionais Identificados ({riscosOcupacionais.length})
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {riscosOcupacionais.map((risco: OcrListItem, idx: number) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-medium uppercase"
                  >
                    {typeof risco === 'string' ? risco : risco.nome || JSON.stringify(risco)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 5. Informações do e-Social */}
          {(recibo || protocolo || dataEnvio) && (
            <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <FiCheckCircle className="text-blue-700" size={16} />
                  <h3 className="font-bold text-blue-950 text-sm">
                    Transmissão Governamental e-Social (Evento S-2220)
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-bold uppercase shadow-sm">
                  Homologado
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {recibo && (
                  <div>
                    <span className="text-blue-900/70 block font-medium">Número do Recibo:</span>
                    <span className="font-mono font-bold text-emerald-800 text-xs select-all break-all">
                      {recibo}
                    </span>
                  </div>
                )}
                {protocolo && (
                  <div>
                    <span className="text-blue-900/70 block font-medium">Protocolo de Envio:</span>
                    <span className="font-mono font-bold text-blue-900 text-xs select-all break-all">
                      {protocolo}
                    </span>
                  </div>
                )}
                {dataEnvio && (
                  <div>
                    <span className="text-blue-900/70 block font-medium">Data de Envio:</span>
                    <span className="font-medium text-slate-800 text-xs">
                      {new Date(dataEnvio).toLocaleString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 6. Raw OCR JSON Accordion */}
          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="w-full px-5 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-bold text-slate-700"
            >
              <span>Visualizar Estrutura Bruta do OCR (JSON)</span>
              {showRawJson ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
            </button>
            {showRawJson && (
              <div className="p-4 bg-slate-900 text-slate-100 text-xs font-mono relative">
                <button
                  onClick={handleCopyJson}
                  className="absolute top-3 right-3 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 flex items-center gap-1 text-[11px] transition-colors"
                >
                  {copiedJson ? <FiCheck className="text-emerald-400" /> : <FiCopy />}
                  {copiedJson ? 'Copiado' : 'Copiar JSON'}
                </button>
                <pre className="overflow-x-auto max-h-60 p-2 scrollbar-thin">
                  {JSON.stringify(ocrData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>ID do Documento: <strong className="font-mono">{documento.id}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
