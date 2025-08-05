'use client';

import React, { useState } from 'react';
import { FiStar } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface StarRatingProps {
  maxRating: number;
  initialRating?: number;
  onChange: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readOnly?: boolean;
  name?: string;
  id?: string;
}

const StarRating: React.FC<StarRatingProps> = ({
  maxRating = 5,
  initialRating = 0,
  onChange,
  size = 'md',
  readOnly = false,
  name,
  id,
}) => {
  const { t } = useI18n();
  const [rating, setRating] = useState<number>(initialRating);
  const [hoverRating, setHoverRating] = useState<number>(0);

  const handleClick = (selectedRating: number) => {
    if (readOnly) return;

    // Se clicar na mesma estrela novamente, zerar a avaliação
    const newRating = selectedRating === rating ? 0 : selectedRating;

    console.log(`StarRating: Alterando de ${rating} para ${newRating}`);
    setRating(newRating);
    onChange(newRating);
  };

  const handleMouseEnter = (hoveredRating: number) => {
    if (readOnly) return;
    setHoverRating(hoveredRating);
  };

  const handleMouseLeave = () => {
    if (readOnly) return;
    setHoverRating(0);
  };

  // Determinar o tamanho das estrelas com base na prop size
  const starSize = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }[size];

  // Criar um array com o número de estrelas
  const stars = Array.from({ length: maxRating }, (_, index) => index + 1);

  return (
    <div className="flex items-center">
      <div className="flex">
        {stars.map((star) => {
          const isActive = star <= (hoverRating || rating);
          return (
            <button
              key={star}
              type="button"
              onClick={() => handleClick(star)}
              onMouseEnter={() => handleMouseEnter(star)}
              onMouseLeave={handleMouseLeave}
              className={`focus:outline-none ${readOnly ? 'cursor-default' : 'cursor-pointer'} p-1`}
              disabled={readOnly}
              aria-label={t('starRating.ariaLabel', `${star} of ${maxRating} stars`)}
            >
              <FiStar
                className={`${starSize} ${
                  isActive
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300'
                } transition-colors duration-150`}
              />
            </button>
          );
        })}
      </div>
      {name && (
        <input
          type="hidden"
          name={name}
          id={id}
          value={rating}
        />
      )}
    </div>
  );
};

export default StarRating;
