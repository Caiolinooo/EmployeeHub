'use client';

import React, { useState } from 'react';
import {
  FiAward,
  FiClock,
  FiAlertCircle,
  FiAlertTriangle,
  FiPlus,
  FiChevronDown,
  FiChevronUp,
  FiCheck
} from 'react-icons/fi';

export interface MatrizConformidadeData {
  colaborador_id: string;
  cargo_nome: string;
  regime: string;
  total_requisitos: number;
  total_conforme: number;
  total_vencendo: number;
  total_vencido: number;
  total_faltante: number;
  percentual_conformidade: number;
  requisitos: {
    requisito_id: string;
    treinamento_nome: string;
    sigla?: string | null;
    obrigatorio: boolean;
    cargo_nome: string;
    regime: string;
    matriz_nome: string;
    status: 'conforme' | 'vencendo' | 'vencido' | 'nao_realizado';
    dias_restantes?: number | null;
    documento_id?: string | null;
    data_emissao?: string | null;
    data_validade?: string | null;
    arquivo_url?: string | null;
    numero_documento?: string | null;
  }[];
}

interface Props {
  conformidade: MatrizConformidadeData | null;
  isLoading?: boolean;
  onLancarCurso?: (nomeCurso: string, sigla?: string | null) => void;
}

export default function MatrizConformidadeColaboradorCard({
  conformidade,
  isLoading,
  onLancarCurso,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="p-4 bg-slate-50 border-b border-gray-200 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
        <div className="h-2.5 bg-gray-200 rounded w-full" />
      </div>
    );
  }

  if (!conformidade || conformidade.total_requisitos === 0) {
    return null;
  }

  const {
    cargo_nome,
    regime,
    total_requisitos,
    total_conforme,
    total_vencendo,
    total_vencido,
    total_faltante,
    percentual_conformidade,
    requisitos,
  } = conformidade;

  const is100Percent = percentual_conformidade === 100;
  const hasVencidos = total_vencido > 0;
  const hasFaltantes = total_faltante > 0;

  return (
    <div className="bg-gradient-to-r from-slate-50 to-blue-50/40 border-b border-gray-200 p-4 shrink-0">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl text-white ${
            is100Percent
              ? 'bg-emerald-600'
              : hasVencidos
                ? 'bg-red-600'
                : 'bg-blue-600'
          }`}>
            <FiAward className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-gray-900 text-sm">
                Matriz de Conformidade do Cargo: <span className="text-blue-700">{cargo_nome}</span>
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-gray-700 border border-gray-200">
                Regime: {regime}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {total_conforme} de {total_requisitos} cursos em conformidade ({percentual_conformidade}%)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          {/* Status summary pills */}
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {total_conforme} conforme(s)
            </span>
            {total_vencendo > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                {total_vencendo} a vencer
              </span>
            )}
            {total_vencido > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                {total_vencido} vencido(s)
              </span>
            )}
            {total_faltante > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                {total_faltante} não realizado(s)
              </span>
            )}
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-white rounded-lg border border-gray-200 transition"
            title={expanded ? 'Recolher detalhes da matriz' : 'Expandir detalhes da matriz'}
          >
            {expanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 transition-all duration-500 rounded-full ${
            is100Percent
              ? 'bg-emerald-500'
              : percentual_conformidade >= 70
                ? 'bg-blue-600'
                : 'bg-amber-500'
          }`}
          style={{ width: `${percentual_conformidade}%` }}
        />
      </div>

      {/* Expandable Requisitos Grid */}
      {expanded && (
        <div className="mt-4 pt-3 border-t border-gray-200/80 grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {requisitos.map((req, idx) => {
            const isConforme = req.status === 'conforme';
            const isVencendo = req.status === 'vencendo';
            const isVencido = req.status === 'vencido';
            const isPendente = req.status === 'nao_realizado';

            return (
              <div
                key={req.requisito_id || idx}
                className={`p-2.5 px-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                  isConforme
                    ? 'bg-white border-emerald-200 shadow-xs'
                    : isVencendo
                      ? 'bg-orange-50/70 border-orange-200'
                      : isVencido
                        ? 'bg-red-50/70 border-red-200'
                        : 'bg-amber-50/50 border-amber-200'
                }`}
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-gray-900 truncate">
                      {req.treinamento_nome}
                    </span>
                    {req.sigla && (
                      <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                        {req.sigla}
                      </span>
                    )}
                    {req.obrigatorio && (
                      <span className="text-[10px] text-gray-400 font-medium">
                        (Obrigatório)
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-500 flex items-center gap-2">
                    {isConforme && (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <FiCheck className="w-3 h-3 text-emerald-600" />
                        {req.data_validade
                          ? `Válido até ${req.data_validade.split('T')[0]}`
                          : 'Permanente'}
                      </span>
                    )}
                    {isVencendo && (
                      <span className="text-orange-700 font-bold flex items-center gap-1">
                        <FiClock className="w-3 h-3" />
                        Vence em {req.dias_restantes} dias
                      </span>
                    )}
                    {isVencido && (
                      <span className="text-red-700 font-bold flex items-center gap-1">
                        <FiAlertCircle className="w-3 h-3" />
                        Vencido
                      </span>
                    )}
                    {isPendente && (
                      <span className="text-amber-700 font-medium flex items-center gap-1">
                        <FiAlertTriangle className="w-3 h-3 text-amber-600" />
                        Não realizado
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {isPendente ? (
                    <button
                      onClick={() => onLancarCurso?.(req.treinamento_nome, req.sigla)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition shadow-xs"
                      title="Lançar ou anexar este treinamento exigido"
                    >
                      <FiPlus className="w-3 h-3" /> Lançar
                    </button>
                  ) : (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isConforme
                        ? 'bg-emerald-100 text-emerald-800'
                        : isVencendo
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {isConforme ? 'Válido' : isVencendo ? 'A Vencer' : 'Vencido'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
