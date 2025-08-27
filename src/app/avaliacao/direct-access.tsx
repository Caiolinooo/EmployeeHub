'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Componente para acesso direto ao módulo de avaliação
 * Este componente ignora o fluxo normal de autenticação e permite acesso direto
 */
export function DirectAccess({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const setupDirectAccess = async () => {
      try {
        console.log('DirectAccess - Iniciando acesso direto ao módulo de avaliação');
        
        // Obter o ID do usuário do localStorage ou URL
        const userId = localStorage.getItem('userId') || 
                      new URLSearchParams(window.location.search).get('userId') || 
                      'c9b1e9a2-3c80-4b3d-9f75-fc7a00d7cdbb'; // ID do admin como fallback
        
        if (!userId) {
          setError('ID do usuário não encontrado');
          setIsLoading(false);
          return;
        }
        
        console.log('DirectAccess - ID do usuário:', userId);
        
        // Buscar o usuário no banco de dados
        const { data: userData, error: userError } = await supabase
          .from('users_unified')
          .select('*')
          .eq('id', userId)
          .single();
          
        if (userError) {
          console.error('DirectAccess - Erro ao buscar usuário:', userError);
          setError('Erro ao buscar usuário');
          setIsLoading(false);
          return;
        }
        
        console.log('DirectAccess - Usuário encontrado:', userData);
        
        // Verificar se o usuário é admin ou gerente
        const isAdmin = userData.role === 'ADMIN';
        const isManager = userData.role === 'MANAGER';
        
        if (!isAdmin && !isManager) {
          setError('Usuário não tem permissão para acessar o módulo de avaliação');
          setIsLoading(false);
          return;
        }
        
        // Criar um token simples
        const token = btoa(JSON.stringify({
          userId: userData.id,
          email: userData.email,
          role: userData.role,
          exp: Math.floor(Date.now() / 1000) + 86400 // 24 horas
        }));
        
        // Salvar o token no localStorage e cookies
        localStorage.setItem('token', token);
        localStorage.setItem('abzToken', token);
        document.cookie = `token=${token}; path=/; max-age=86400; samesite=lax`;
        document.cookie = `abzToken=${token}; path=/; max-age=86400; samesite=lax`;
        
        // Salvar o perfil do usuário no localStorage
        localStorage.setItem('userProfile', JSON.stringify({
          ...userData,
          accessPermissions: {
            modules: {
              dashboard: true,
              manual: true,
              procedimentos: true,
              politicas: true,
              calendario: true,
              noticias: true,
              reembolso: true,
              contracheque: true,
              ponto: true,
              avaliacao: true,
              ...(isAdmin ? { admin: true } : {})
            },
            features: {}
          }
        }));
        
        // Definir variáveis globais para o contexto de autenticação
        (window as any).userProfile = {
          ...userData,
          accessPermissions: {
            modules: {
              dashboard: true,
              manual: true,
              procedimentos: true,
              politicas: true,
              calendario: true,
              noticias: true,
              reembolso: true,
              contracheque: true,
              ponto: true,
              avaliacao: true,
              ...(isAdmin ? { admin: true } : {})
            },
            features: {}
          }
        };
        
        (window as any).isAdmin = isAdmin;
        (window as any).isManager = isManager || isAdmin;
        
        console.log('DirectAccess - Acesso configurado com sucesso');
        setIsAuthorized(true);
        setIsLoading(false);
      } catch (error) {
        console.error('DirectAccess - Erro ao configurar acesso direto:', error);
        setError('Erro ao configurar acesso direto');
        setIsLoading(false);
      }
    };
    
    setupDirectAccess();
  }, []);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Configurando acesso direto...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <p className="text-red-600 font-semibold mb-2">Erro de acesso</p>
          <p className="text-gray-600">{error}</p>
          <button 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => window.location.href = '/dashboard'}
          >
            Voltar para o Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-yellow-500 text-xl mb-4">⚠️</div>
          <p className="text-yellow-600 font-semibold mb-2">Acesso não autorizado</p>
          <p className="text-gray-600">Você não tem permissão para acessar esta página.</p>
          <button 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => window.location.href = '/dashboard'}
          >
            Voltar para o Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}
