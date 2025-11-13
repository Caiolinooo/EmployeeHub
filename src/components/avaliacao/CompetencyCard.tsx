'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FiStar } from 'react-icons/fi';

interface CompetencyCardProps {
  title: string;
  description?: string;
  score: number;
  maxScore?: number;
  comment?: string;
  category?: string;
  className?: string;
  interactive?: boolean;
  onScoreChange?: (score: number) => void;
}

export default function CompetencyCard({
  title,
  description,
  score,
  maxScore = 5,
  comment,
  category,
  className,
  interactive = false,
  onScoreChange
}: CompetencyCardProps) {
  const percentage = (score / maxScore) * 100;
  
  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-blue-600';
    if (percentage >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 5) return 'Superou consistentemente';
    if (score >= 4) return 'Excedeu expectativas';
    if (score >= 3) return 'Alcançou expectativa';
    if (score >= 2) return 'Não alcançou expectativa';
    return 'Frequentemente não alcançou';
  };

  return (
    <Card className={cn('transition-all duration-200 hover:shadow-md', className)}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1">
            <CardTitle className="text-base font-semibold text-gray-900">
              {title}
            </CardTitle>
            {category && (
              <span className="text-xs text-gray-500 mt-1">{category}</span>
            )}
          </div>
          {score > 0 && (
            <div className={cn('text-2xl font-bold', getScoreColor(percentage))}>
              {score.toFixed(1)}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {description && (
          <p className="text-sm text-gray-600">{description}</p>
        )}

        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => interactive && onScoreChange?.(star)}
              disabled={!interactive}
              className={cn(
                'transition-all duration-200',
                interactive && 'cursor-pointer hover:scale-110',
                !interactive && 'cursor-default'
              )}
            >
              <FiStar
                className={cn(
                  'w-5 h-5',
                  star <= score
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300'
                )}
              />
            </button>
          ))}
          {score > 0 && (
            <span className="text-xs text-gray-500 ml-2">
              {getScoreLabel(score)}
            </span>
          )}
        </div>

        {comment && (
          <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
            <p className="text-sm text-gray-700 italic">{comment}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
