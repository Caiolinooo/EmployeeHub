'use client';

import { useCallback, useEffect, useRef } from 'react';

/** Restaura foco no gatilho depois de fechar overlay (Esc, X, backdrop). */
export function useRestoreFocus(open?: boolean) {
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

  useEffect(() => {
    if (open === undefined) return undefined;
    if (!open) return undefined;
    const el = document.activeElement;
    if (el instanceof HTMLElement && el !== document.body && el !== document.documentElement) {
      triggerRef.current = el;
    }
    return () => {
      restoreFocus();
    };
  }, [open, restoreFocus]);

  return { markTrigger, restoreFocus, triggerRef };
}
