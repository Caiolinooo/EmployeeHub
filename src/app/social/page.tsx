'use client';

import React from 'react';
import MainLayout from '@/components/Layout/MainLayout';

// ABZ Social module intentionally disabled per client request. Keeping a simple redirect UX.
const SocialPage: React.FC = () => {
  if (typeof window !== 'undefined') {
    window.location.replace('/noticias');
  }
  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto py-16 text-center">
        <h1 className="text-2xl font-semibold mb-2">ABZ Social foi desativado</h1>
        <p className="text-gray-600 mb-6">Redirecionando você para o ABZ News...</p>
        <a href="/noticias" className="text-blue-600 underline">Ir para ABZ News</a>
      </div>
    </MainLayout>
  );
};

export default SocialPage;

