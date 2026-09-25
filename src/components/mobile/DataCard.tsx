'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type DataCardProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
};

export default function DataCard({ title, subtitle, meta, onClick, className, children }: DataCardProps) {
  const Comp = onClick ? 'button' : 'article';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-2xl border border-gray-100 bg-white p-4 shadow-sm',
        onClick && 'touch-target min-h-[64px]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900 truncate">{title}</h3>
          {subtitle ? <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p> : null}
        </div>
        {meta ? <span className="text-xs font-medium text-[#005B96] shrink-0">{meta}</span> : null}
      </div>
      {children}
    </Comp>
  );
}
