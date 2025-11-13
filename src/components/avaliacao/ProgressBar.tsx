'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  percentage: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'purple' | 'orange';
  className?: string;
}

export default function ProgressBar({
  percentage,
  label,
  showPercentage = true,
  size = 'md',
  color = 'blue',
  className
}: ProgressBarProps) {
  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  };

  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    purple: 'bg-purple-600',
    orange: 'bg-orange-600'
  };

  const validPercentage = Math.min(Math.max(percentage, 0), 100);

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className='flex justify-between items-center mb-1.5'>
          <span className='text-sm font-medium text-gray-700'>{label}</span>
          {showPercentage && (
            <span className='text-sm font-semibold text-gray-900'>
              {validPercentage.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div className={cn('w-full bg-gray-200 rounded-full overflow-hidden', sizeClasses[size])}>
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out rounded-full',
            colorClasses[color]
          )}
          style={{ width: ${validPercentage}% }}
        />
      </div>
    </div>
  );
}
