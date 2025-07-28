'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Importar o componente AvaliacoesPageFixed dinamicamente para evitar problemas de carregamento
const AvaliacoesPageFixed = dynamic(() => import('./page-fixed-corrected'), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-abz-blue"></div>
    </div>
  )
});

export default function AvaliacoesPage() {
  return <AvaliacoesPageFixed />;
}
