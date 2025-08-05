'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from "next/image";
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useSupabaseAuth();

  useEffect(() => {
    // Verificar se o carregamento da autenticação já foi concluído
    if (!isLoading) {
      if (isAuthenticated) {
        // Se autenticado, redirecionar para o dashboard
        router.replace('/dashboard');
      } else {
        // Se não autenticado, redirecionar para o login
        router.replace('/login');
      }
    }
  }, [router, isAuthenticated, isLoading]);

  // Enquanto carrega, mostra um indicador de carregamento
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-abz-background">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-abz-blue"></div>
          <p className="mt-4 text-abz-blue font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  // Este componente não renderiza nada, pois o redirecionamento ocorre no efeito
  return null;
}
