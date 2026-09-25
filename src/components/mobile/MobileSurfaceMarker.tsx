'use client';

import { useLayoutEffect } from 'react';
import { useMobileSurface } from '@/lib/mobile-ui/mobile-surface-context';

/** Marca o documento como front mobile. Sem isto o FAB desktop não some. */
export default function MobileSurfaceMarker() {
  const { setMobileSurface } = useMobileSurface();

  useLayoutEffect(() => {
    setMobileSurface(true);
    document.documentElement.setAttribute('data-abz-ui', 'mobile');
    return () => {
      setMobileSurface(false);
      document.documentElement.removeAttribute('data-abz-ui');
    };
  }, [setMobileSurface]);

  return null;
}
