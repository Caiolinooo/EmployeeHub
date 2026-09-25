'use client';

import { useLayoutEffect } from 'react';

/** Marca o documento como front mobile. Sem isto o atributo não existe no desktop. */
export default function MobileSurfaceMarker() {
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-abz-ui', 'mobile');
    return () => {
      document.documentElement.removeAttribute('data-abz-ui');
    };
  }, []);

  return null;
}
