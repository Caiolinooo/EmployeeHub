'use client';

import { useCallback, useRef } from 'react';

/** Restaura foco no gatilho depois de fechar overlay (Esc, X, backdrop). */
export function useRestoreFocus() {
  const triggerRef = useRef<HTMLElement | null>(null);

  const markTrigger = useCallback((el: EventTarget | null) => {
    if (el instanceof HTMLElement) {
      triggerRef.current = el;
    }
  }, []);

  const restoreFocus = useCallback(() => {
    const node = triggerRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (document.contains(node)) node.focus();
      });
    });
  }, []);

  return { markTrigger, restoreFocus, triggerRef };
}
