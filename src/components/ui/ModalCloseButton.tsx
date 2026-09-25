'use client';

import { FiX } from 'react-icons/fi';
import { cn } from '@/lib/utils';

interface ModalCloseButtonProps {
  onClick: () => void;
  className?: string;
  label?: string;
  /** Só no celular — desktop 0 px quando o modal já tem outro fechar. */
  mobileOnly?: boolean;
}

export default function ModalCloseButton({
  onClick,
  className,
  label = 'Fechar',
  mobileOnly = false,
}: ModalCloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-modal-close=""
      className={cn(
        'inline-flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-800 hover:bg-black/5',
        mobileOnly ? 'md:hidden' : '',
        className,
      )}
    >
      <FiX className="h-5 w-5" aria-hidden />
    </button>
  );
}
