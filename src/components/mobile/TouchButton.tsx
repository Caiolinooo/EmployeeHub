'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

type TouchButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: 'primary' | 'ghost' | 'link';
};

export default function TouchButton({
  asChild,
  variant = 'primary',
  className,
  type,
  ...props
}: TouchButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      type={asChild ? undefined : type ?? 'button'}
      className={cn(
        'touch-target inline-flex items-center justify-center rounded-xl px-4 text-base font-semibold transition-colors disabled:opacity-50',
        variant === 'primary' && 'bg-[#005B96] text-white shadow-sm',
        variant === 'ghost' && 'bg-white text-[#005B96] border border-gray-200',
        variant === 'link' && 'bg-transparent text-[#005B96] underline-offset-2 underline px-2',
        className,
      )}
      {...props}
    />
  );
}
