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
  showLabel?: boolean;
  showTooltip?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({
  maxRating = 5,
  initialRating = 0,
  onChange,
  size = 'md',
  readOnly = false,
  name,
  id,
  showLabel = true,
  showTooltip = true
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

  // Get rating label based on value
  const getRatingLabel = (value: number): string => {
    if (value === 0) return '';
    const labels: Record<number, string> = {
      1: t('starRating.scale.level1'),
      2: t('starRating.scale.level2'),
      3: t('starRating.scale.level3'),
      4: t('starRating.scale.level4'),
      5: t('starRating.scale.level5')
    };
    return labels[value] || '';
  };

  // Determinar o tamanho das estrelas com base na prop size
  const starSize = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }[size];

  // Criar um array com o número de estrelas
  const stars = Array.from({ length: maxRating }, (_, index) => index + 1);

  const activeRating = hoverRating || rating;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex">
          {stars.map((star) => {
            const isActive = star <= activeRating;
            return (
              <div key={star} className="relative group">
                <button
                  type="button"
                  onClick={() => handleClick(star)}
                  onMouseEnter={() => handleMouseEnter(star)}
                  onMouseLeave={handleMouseLeave}
                  className={`focus:outline-none ${readOnly ? 'cursor-default' : 'cursor-pointer'} p-1`}
                  disabled={readOnly}
                  aria-label={`${star} ${t('starRating.ariaLabel')} ${maxRating}`}
                >
                  <FiStar
                    className={`${starSize} ${
                      isActive
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300'
                    } transition-all duration-150`}
                  />
                </button>
                
                {/* Tooltip */}
                {showTooltip && !readOnly && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-lg">
                      <div className="font-semibold">{star} - {getRatingLabel(star)}</div>
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="w-2 h-2 bg-gray-900 rotate-45"></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Show rating value */}
        {rating > 0 && (
          <span className="text-sm font-medium text-gray-700 ml-2">
            {rating}/{maxRating}
          </span>
        )}
      </div>

      {/* Show label description */}
      {showLabel && activeRating > 0 && (
        <div className={`text-sm ${readOnly ? 'text-gray-600' : 'text-blue-600 font-medium'} transition-all`}>
          {activeRating} - {getRatingLabel(activeRating)}
        </div>
      )}

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
