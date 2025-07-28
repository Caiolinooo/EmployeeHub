'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { FiLoader, FiAlertCircle } from 'react-icons/fi';
import Link from 'next/link';
import ClientOnly from '../ClientOnly';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Componente que protege rotas para que apenas administradores possam acessá-las.
 * Redireciona usuários não autorizados para a página especificada ou para o dashboard.
 */
const AdminProtectedRoute: React.FC<AdminProtectedRouteProps> = ({
  children,
  redirectTo = '/dashboard',
}) => {
  const { user, profile, isLoading, isAdmin } = useSupabaseAuth();
  const router = useRouter();

  // Verificar se estamos em ambiente de desenvolvimento
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Verificar se o usuário deveria ser administrador
  const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
  const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
  const shouldBeAdmin = user?.email === adminEmail || (user as any)?.phone_number === adminPhone;

  // Forçar acesso de administrador para o usuário principal (mesmo em produção)
  const forceAdmin = shouldBeAdmin && !isAdmin;

  // Componente de carregamento
  const LoadingIndicator = () => (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <FiLoader className="animate-spin h-12 w-12 text-blue-600" />
    </div>
  );

  // Componente de acesso negado
  const AccessDenied = () => (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <FiAlertCircle className="h-16 w-16 text-red-500 mb-4" />
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Acesso Negado</h1>
      <p className="text-gray-600 mb-4">Você não tem permissão para acessar esta página.</p>
      <Link 
        href={redirectTo}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Voltar para o Dashboard
      </Link>
    </div>
  );

  // Em ambiente de desenvolvimento, permitir acesso para facilitar o desenvolvimento
  if (isDevelopment && user) {
    console.log('AdminProtectedRoute - Ambiente de desenvolvimento: permitindo acesso');
    return <>{children}</>;
  }

  // Se estiver carregando, mostrar indicador de carregamento
  if (isLoading) {
    return <LoadingIndicator />;
  }

  // Se não estiver autenticado, redirecionar para login
  if (!user) {
    console.log('AdminProtectedRoute - Usuário não autenticado, redirecionando para login');
    router.push('/login');
    return <LoadingIndicator />;
  }

  // Se não for administrador e não for o usuário principal, negar acesso
  if (!isAdmin && !forceAdmin) {
    console.log('AdminProtectedRoute - Acesso negado: usuário não é administrador');
    return <AccessDenied />;
  }

  // Se chegou até aqui, o usuário tem permissão para acessar a rota
  return (
    <ClientOnly fallback={<LoadingIndicator />}>
      {children}
    </ClientOnly>
  );
};

export default AdminProtectedRoute;
