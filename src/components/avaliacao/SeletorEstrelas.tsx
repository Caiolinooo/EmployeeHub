'use client';

import React, { useState } from 'react';
import { FaStar } from 'react-icons/fa';
import { ESCALA_AVALIACAO, type NotaAvaliacao } from '@/data/escala-avaliacao';

interface SeletorEstrelasProps {
  valor: number;
  onChange: (valor: number) => void;
  disabled?: boolean;
  tamanho?: 'sm' | 'md' | 'lg';
  mostrarLegenda?: boolean;
}

export default function SeletorEstrelas({
  valor,
  onChange,
  disabled = false,
  tamanho = 'md',
  mostrarLegenda = true
}: SeletorEstrelasProps) {
  const [hover, setHover] = useState(0);

  const tamanhos = {
    sm: 20,
    md: 24,
    lg: 32
  };

  const iconSize = tamanhos[tamanho];

  const notaSelecionada = ESCALA_AVALIACAO.find(n => n.valor === (hover || valor));

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        {[1, 2, 3, 4, 5].map((estrela) => {
          const nota = ESCALA_AVALIACAO[estrela - 1];
          const isAtivo = estrela <= (hover || valor);

          return (
            <button
              key={estrela}
              type="button"
              onClick={() => !disabled && onChange(estrela)}
              onMouseEnter={() => !disabled && setHover(estrela)}
              onMouseLeave={() => !disabled && setHover(0)}
              disabled={disabled}
              className={`
                transition-all duration-200 transform
                ${!disabled ? 'hover:scale-110 cursor-pointer' : 'cursor-not-allowed opacity-50'}
                ${isAtivo ? 'text-opacity-100' : 'text-opacity-30'}
              `}
              style={{
                color: isAtivo ? nota.cor : '#D1D5DB'
              }}
              aria-label={`${estrela} estrela${estrela > 1 ? 's' : ''}`}
            >
              <FaStar size={iconSize} />
            </button>
          );
        })}
      </div>

      {mostrarLegenda && notaSelecionada && (
        <div className="mt-2 p-3 rounded-md bg-gray-50 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">
                  {notaSelecionada.valor} {notaSelecionada.valor === 1 ? 'estrela' : 'estrelas'}
                </span>
                <span
                  className="px-2 py-0.5 text-xs font-medium rounded-full text-white"
                  style={{ backgroundColor: notaSelecionada.cor }}
                >
                  {notaSelecionada.label}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {notaSelecionada.descricao}
              </p>
            </div>
          </div>
        </div>
      )}

      {!valor && !hover && mostrarLegenda && (
        <div className="mt-2 p-3 rounded-md bg-yellow-50 border border-yellow-200">
          <p className="text-sm text-yellow-800">
            Clique nas estrelas para selecionar sua avaliação
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Componente para exibir apenas as estrelas (sem interação)
 */
interface ExibicaoEstrelasProps {
  valor: number;
  tamanho?: 'sm' | 'md' | 'lg';
  mostrarValor?: boolean;
  mostrarLabel?: boolean;
}

export function ExibicaoEstrelas({
  valor,
  tamanho = 'md',
  mostrarValor = false,
  mostrarLabel = false
}: ExibicaoEstrelasProps) {
  const tamanhos = {
    sm: 16,
    md: 20,
    lg: 24
  };

  const iconSize = tamanhos[tamanho];
  const nota = ESCALA_AVALIACAO.find(n => n.valor === valor);

  if (!nota) {
    return (
      <div className="flex items-center space-x-2 text-gray-400">
        <span className="text-sm">Não avaliado</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((estrela) => (
          <FaStar
            key={estrela}
            size={iconSize}
            style={{
              color: estrela <= valor ? nota.cor : '#D1D5DB',
              opacity: estrela <= valor ? 1 : 0.3
            }}
          />
        ))}
      </div>
      {mostrarValor && (
        <span className="text-sm font-medium text-gray-700">
          {valor}/5
        </span>
      )}
      {mostrarLabel && (
        <span
          className="px-2 py-0.5 text-xs font-medium rounded-full text-white"
          style={{ backgroundColor: nota.cor }}
        >
          {nota.label}
        </span>
      )}
    </div>
  );
}

/**
 * Legenda completa da escala de avaliação
 */
export function LegendaEscalaAvaliacao() {
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">
        Escala de Avaliação
      </h4>
      <div className="space-y-2">
        {ESCALA_AVALIACAO.map((nota) => (
          <div key={nota.valor} className="flex items-center space-x-3">
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((estrela) => (
                <FaStar
                  key={estrela}
                  size={14}
                  style={{
                    color: estrela <= nota.valor ? nota.cor : '#D1D5DB',
                    opacity: estrela <= nota.valor ? 1 : 0.3
                  }}
                />
              ))}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{nota.label}</p>
              <p className="text-xs text-gray-600">{nota.descricao}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
