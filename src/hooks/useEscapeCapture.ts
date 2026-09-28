'use client';

import { useEffect } from 'react';

/**
 * Esc em capture no document. useEscapeToClose fica no window (bubble);
 * input autoFocus + Playwright keyboard.press('Escape') às vezes não sobe.
 * Não altera o hash de useEscapeToClose.
 */
export function useEscapeCapture(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Esc') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);
}
