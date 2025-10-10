'use client';

import React, { useState } from 'react';
import StarRating from './StarRating';
import { useI18n } from '@/contexts/I18nContext';

interface CriterioAvaliacaoProps {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  peso: number;
  notaMaxima: number;
  initialNota?: number;
  initialComentario?: string;
  onChange: (id: string, nota: number, comentario: string) => void;
  readOnly?: boolean;
}

const CriterioAvaliacao: React.FC<CriterioAvaliacaoProps> = ({
  id,
  nome,
  descricao,
  categoria,
  peso,
  notaMaxima = 5,
  initialNota = 0,
  initialComentario = '',
  onChange,
  readOnly = false,
}) => {
  const { t } = useI18n();
  const [nota, setNota] = useState<number>(initialNota);
  const [comentario, setComentario] = useState<string>(initialComentario);
  const [showComentario, setShowComentario] = useState<boolean>(!!initialComentario);

  const handleNotaChange = (newNota: number) => {
    console.log(t('components.criterioIdNomeNotaAlteradaParaNewnota'));
    setNota(newNota);
    onChange(id, newNota, comentario);
  };

  const handleComentarioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newComentario = e.target.value;
    setComentario(newComentario);
    onChange(id, nota, newComentario);
  };

  // Determinar a cor de fundo com base na categoria
  const getCategoryColor = () => {
    switch (categoria.toLowerCase()) {
      case 'desempenho':
        return 'bg-blue-50 border-blue-200';
      case 'comportamento':
        return 'bg-green-50 border-green-200';
      case 'competencia':
        return 'bg-purple-50 border-purple-200';
      case 'lideranca':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getCategoryColor()} mb-4`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
        <div>
          <h3 className="text-lg font-medium">{nome}</h3>
          <p className="text-sm text-gray-600">{descricao}</p>
          <div className="text-xs text-gray-500 mt-1">
            {t('avaliacao.criterio.categoria', 'Categoria')}: {categoria} |
            {t('avaliacao.criterio.peso', 'Peso')}: {peso}
          </div>
        </div>
        <div className="mt-2 md:mt-0">
          <StarRating
            maxRating={notaMaxima}
            initialRating={nota}
            onChange={handleNotaChange}
            readOnly={readOnly}
            size="md"
          />
        </div>
      </div>

      {!readOnly && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowComentario(!showComentario)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showComentario
              ? t('avaliacao.criterio.ocultarComentario', 'Ocultar comentário')
              : t('avaliacao.criterio.adicionarComentario', 'Adicionar comentário')}
          </button>
        </div>
      )}

      {(showComentario || readOnly && comentario) && (
        <div className="mt-2">
          <textarea
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder={t('avaliacao.criterio.comentarioPlaceholder', 'Adicione um comentário sobre este critério...')}
            rows={3}
            value={comentario}
            onChange={handleComentarioChange}
            disabled={readOnly}
          />
        </div>
      )}
    </div>
  );
};

export default CriterioAvaliacao;
