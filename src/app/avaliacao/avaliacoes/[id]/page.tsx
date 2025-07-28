'use client';

import React, { useEffect } from 'react';

/**
 * Componente de redirecionamento para manter a compatibilidade com links existentes
 * Usando window.location.href para garantir um redirecionamento completo
 */
interface PageProps {
  params: { id: string };
}

export default function AvaliacaoDetailRedirectPage({ params }: PageProps) {
  const id = params.id;

  useEffect(() => {
    // Adicionar timestamp para evitar cache
    const timestamp = Date.now();

    // Usar window.location para garantir um redirecionamento completo
    window.location.href = `/avaliacao/${id}?t=${timestamp}`;
  }, [id]);

  return (
    <div className="flex justify-center items-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-abz-blue mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecionando para a página de detalhes da avaliação...</p>
      </div>
    </div>
  );
}
