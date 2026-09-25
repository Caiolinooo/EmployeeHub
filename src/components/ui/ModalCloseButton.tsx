'use client';

import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { cn } from '@/lib/utils';

interface ModalCloseButtonProps {
  onClick: () => void;
  className?: string;
  label?: string;
  /** Só no celular — desktop 0 px quando o modal já tem outro fechar. */
  mobileOnly?: boolean;
  /** Não monta o nó no desktop (sem display:none). Portal sem X fica igual. */
  mountOnlyWhenMobile?: boolean;
}

function useNarrow767() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return narrow;
}

export default function ModalCloseButton({
  onClick,
  className,
  label = 'Fechar',
  mobileOnly = false,
  mountOnlyWhenMobile = false,
}: ModalCloseButtonProps) {
  const narrow = useNarrow767();
  if (mountOnlyWhenMobile && !narrow) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-modal-close=""
      className={cn(
        'inline-flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-800 hover:bg-black/5',
        'max-md:h-11 max-md:w-11 max-md:min-h-11 max-md:min-w-11',
        mobileOnly ? 'md:hidden' : '',
        className,
      )}
    >
      <FiX className="h-5 w-5" aria-hidden />
    </button>
  );
}
