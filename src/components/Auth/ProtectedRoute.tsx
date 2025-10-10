'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { FiLoader, FiAlertCircle, FiTool } from 'react-icons/fi';
import Link from 'next/link';
import { useI18n } from '@/contexts/I18nContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  managerOnly?: boolean;
  moduleName?: string;
}

export default function ProtectedRoute({
  const { t } = useI18n();

  children,
  adminOnly = false,
  managerOnly = false,
  moduleName
}: ProtectedRouteProps) {
  const { user, profile, isLoading, isAdmin: contextIsAdmin, isManager: contextIsManager, hasAccess: contextHasAccess } = useSupabaseAuth();
  const isAuthenticated = !!user;

  // Usar as verificações de papel do contexto de autenticação
  const [isAvaliacaoRoute, setIsAvaliacaoRoute] = useState(false);

  // Atualizar isAvaliacaoRoute quando o componente montar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAvaliacao = window.location.pathname.includes('/avaliacao');
      setIsAvaliacaoRoute(isAvaliacao);
      console.log({t('components.protectedrouteRotaDeAvaliacaoDetectada')}, isAvaliacao);
    }
  }, []);

  // Verificar se o usuário tem acesso ao módulo de avaliação
  const hasEvaluationAccess = contextHasAccess('avaliacao');

  // Permitir acesso à rota de avaliação apenas em desenvolvimento ou se o usuário tiver permissão
  const isAdmin = contextIsAdmin;
  const isManager = contextIsManager;

  // Verificar se o usuário tem acesso à rota de avaliação
  const hasAccessToAvaliacaoRoute = isAdmin || isManager || hasEvaluationAccess || (isAvaliacaoRoute && process.env.NODE_ENV === 'development');

  // Usar a função hasAccess do contexto de autenticação
  const hasAccess = contextHasAccess;

  const router = useRouter();
  const [showAdminFix, setShowAdminFix] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  // Verificar se estamos em ambiente de desenvolvimento - definido apenas uma vez
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Verificar se o usuário deveria ser administrador
  const adminEmail = process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com';
  const adminPhone = process.env.ADMIN_PHONE_NUMBER || '+5522997847289';
  const shouldBeAdmin = user?.email === adminEmail || (user as any)?.phone_number === adminPhone;

  // Forçar acesso de administrador para o usuário principal (mesmo em produção)
  // Isso garante que o usuário principal sempre tenha acesso ao painel de administração
  const forceAdmin = shouldBeAdmin && !isAdmin;

  // isAvaliacaoRoute já foi definido como state acima

  useEffect(() => {
    console.log('ProtectedRoute - Estado inicial:', {
      isLoading,
      isAuthenticated,
      isAdmin,
      isManager,
      adminOnly,
      managerOnly,
      moduleName,
      userEmail: user?.email,
      userPhone: (user as any)?.phone_number,
      shouldBeAdmin,
      forceAdmin,
      userRole: user?.role,
      profileRole: profile?.role,
      contextIsAdmin,
      contextIsManager,
      isAvaliacaoRoute,
      pathname: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      isDevelopment,
      adminEmail: process.env.ADMIN_EMAIL || 'caio.correia@groupabz.com',
      adminPhone: process.env.ADMIN_PHONE_NUMBER || '+5522997847289'
    });

    // Log detalhado para depuração de permissões
    console.log({t('components.protectedrouteDetalhesDoUsuario')}, {
      id: user?.id,
      email: user?.email,
      phone: (user as any)?.phone_number,
      role: user?.role,
      profileId: profile?.id,
      profileEmail: profile?.email,
      profilePhone: profile?.phone_number,
      profileRole: profile?.role,
      profilePermissions: profile?.access_permissions
    });

    // Verificar se o usuário deveria ser administrador mas não está marcado como tal
    if (isAuthenticated && shouldBeAdmin && !isAdmin && !checkingAdmin) {
      console.log({t('components.usuarioDeveriaSerAdministradorMasNaoEstaMarcadoCom')});
      setShowAdminFix(true);
    }

    // Em ambiente de desenvolvimento, ser mais permissivo com redirecionamentos
    if (isDevelopment) {
      console.log({t('components.ambienteDeDesenvolvimentoRedirecionamentosSeraoMai')});

      // Mesmo em desenvolvimento, se for uma rota de admin e o usuário não for admin,
      // mostrar a opção de corrigir as permissões
      if (adminOnly && isAuthenticated && shouldBeAdmin && !isAdmin) {
        setShowAdminFix(true);
        return;
      }

      // Em desenvolvimento, permitir acesso a rotas protegidas se estiver autenticado
      if (isAuthenticated) {
        console.log('Ambiente de desenvolvimento: permitindo acesso a rota protegida');
        return;
      }
    }

    // Adicionar um atraso maior para evitar redirecionamentos rápidos que podem causar loops
    const redirectTimer = setTimeout(() => {
      if (!isLoading) {
        console.log({t('components.protectedrouteVerificandoPermissoesAposAtraso')}, {
          isAuthenticated,
          isAdmin,
          isManager,
          adminOnly,
          managerOnly,
          moduleName,
          isAvaliacaoRoute
        });

        // Verificar acesso à rota de avaliação
        if (isAvaliacaoRoute) {
          console.log({t('components.verificandoAcessoARotaDeAvaliacao')}, {
            isAdmin,
            isManager,
            hasEvaluationAccess,
            hasAccessToAvaliacaoRoute
          });

          if (hasAccessToAvaliacaoRoute) {
            console.log({t('components.acessoPermitidoARotaDeAvaliacao')});
            return;
          } else {
            console.log({t('components.acessoNegadoARotaDeAvaliacao')});
            router.replace('/dashboard');
            return;
          }
        }

        // BYPASS TEMPORÁRIO: Permitir acesso à rota de administração para depuração
        if (typeof window !== 'undefined' && window.location.pathname.includes('/admin')) {
          console.log({t('components.bypassPermitindoAcessoARotaDeAdministracaoParaDepu')});
          return;
        }

        if (!isAuthenticated) {
          // Redirecionar para login se não estiver autenticado
          console.log({t('components.redirecionandoParaLoginUsuarioNaoAutenticado')});
          router.replace('/login');
        } else if (adminOnly && !isAdmin) {
          // Se o usuário deveria ser admin mas não está marcado como tal, mostrar opção de correção
          if (shouldBeAdmin) {
            console.log({t('components.usuarioDeveriaSerAdministradorMasNaoEstaMarcadoCom')});
            // Em produção, permitir acesso mesmo sem a marcação de admin para o usuário principal
            if (!isDevelopment && forceAdmin) {
              console.log({t('components.bypassProducaoPermitindoAcessoARotaDeAdministracao')});
              return; // Permitir acesso
            }
            setShowAdminFix(true);
          } else {
            // Redirecionar para dashboard se a rota for apenas para administradores
            console.log('Redirecionando para dashboard: rota apenas para administradores');
            router.replace('/dashboard');
          }
        } else if (managerOnly && !isAdmin && !isManager) {
          // Verificar se o usuário é o administrador principal
          if (shouldBeAdmin) {
            console.log({t('components.usuarioEOAdministradorPrincipalMasNaoEstaMarcadoCo')});
            // Em produção, permitir acesso mesmo sem a marcação de admin para o usuário principal
            if (!isDevelopment && forceAdmin) {
              console.log({t('components.bypassProducaoPermitindoAcessoARotaDeGerenteParaOU')});
              return; // Permitir acesso
            }
            setShowAdminFix(true);
            return;
          }

          // Redirecionar para dashboard se a rota for apenas para gerentes ou administradores
          console.log('Redirecionando para dashboard: rota apenas para gerentes ou administradores');
          console.log({t('components.detalhesDoUsuario')}, {
            isAdmin,
            isManager,
            role: user?.role,
            email: user?.email,
            phone: (user as any)?.phone_number
          });

          router.replace('/dashboard');
        } else if (moduleName && !hasAccess(moduleName) && !isAdmin) {
          // Verificação especial para o módulo de avaliação
          if (moduleName === 'avaliacao') {
            if (!hasAccessToAvaliacaoRoute) {
              console.log({t('components.redirecionandoParaDashboardSemAcessoAoModuloDeAval')});
              router.replace('/dashboard');
            } else {
              console.log({t('components.acessoPermitidoAoModuloDeAvaliacao')});
            }
          } else {
            // Redirecionar para dashboard se o usuário não tiver acesso ao módulo
            console.log({t('components.redirecionandoParaDashboardSemAcessoAoModuloModule')});
            router.replace('/dashboard');
          }
        } else {
          // Adicionar log para depuração
          console.log('Acesso permitido:', { isAdmin, isManager, moduleName, hasAccess: moduleName ? hasAccess(moduleName) : 'N/A' });
        }
      }
    }, 2000); // Aumentar o atraso para 2 segundos para dar tempo de carregar o estado de autenticação

    // Limpar o timer quando o componente for desmontado
    return () => clearTimeout(redirectTimer);
  }, [isAuthenticated, isAdmin, isManager, isLoading, router, adminOnly, managerOnly, moduleName, hasAccess, isDevelopment, user, shouldBeAdmin, checkingAdmin, isAvaliacaoRoute, hasAccessToAvaliacaoRoute, hasEvaluationAccess, profile]);

  // Função para corrigir as permissões de administrador
  const fixAdminPermissions = async () => {
    setCheckingAdmin(true);

    try {
      console.log({t('components.tentandoCorrigirPermissoesDeAdministrador')});

      // Chamar a API para corrigir as permissões
      const response = await fetch('/api/auth/fix-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          email: user?.email,
          phoneNumber: (user as any)?.phone_number
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log({t('components.permissoesDeAdministradorCorrigidasComSucesso')});
        // Recarregar a página para aplicar as alterações
        window.location.reload();
      } else {
        console.error({t('components.erroAoCorrigirPermissoesDeAdministrador')}, data.error);
        // Redirecionar para a página de correção de administrador
        router.push('/admin-fix');
      }
    } catch (error) {
      console.error({t('components.erroAoCorrigirPermissoesDeAdministrador')}, error);
      // Redirecionar para a página de correção de administrador
      router.push('/admin-fix');
    } finally {
      setCheckingAdmin(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-abz-background">
        <FiLoader className="animate-spin h-12 w-12 text-abz-blue" />
      </div>
    );
  }

  // Mostrar opção de correção de permissões de administrador
  if (showAdminFix) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-abz-background">
        <FiTool className="h-16 w-16 text-yellow-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Correção de Permissões Necessária</h1>
        <p className="text-gray-600 mb-2">Você deveria ter permissões de administrador, mas elas não estão configuradas corretamente.</p>
        <p className="text-gray-600 mb-4">Clique no botão abaixo para corrigir este problema.</p>
        <div className="flex space-x-4">
          <button
            onClick={fixAdminPermissions}
            className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
            disabled={checkingAdmin}
          >
            {checkingAdmin ? (
              <span className="flex items-center">
                <FiLoader className="animate-spin mr-2" />
                Corrigindo...
              </span>
            ) : (
              {t('components.corrigirPermissoes')}
            )}
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            Voltar para o Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Verificar acesso em ambiente de produção
  if (!isDevelopment && (
    !isAuthenticated ||
    (adminOnly && !isAdmin && !forceAdmin && !isAvaliacaoRoute && !window.location.pathname.includes('/admin')) ||
    (managerOnly && !isAdmin && !isManager && !forceAdmin && !isAvaliacaoRoute) ||
    (moduleName && moduleName !== 'avaliacao' && !hasAccess(moduleName) && !isAdmin && !forceAdmin && !isAvaliacaoRoute) ||
    (moduleName === 'avaliacao' && !hasAccess(moduleName))
  )) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-abz-background">
        <FiAlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Acesso Negado</h1>
        <p className="text-gray-600 mb-4">Você não tem permissão para acessar esta página.</p>
        <button
          onClick={() => router.replace('/dashboard')}
          className="px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Voltar para o Dashboard
        </button>
      </div>
    );
  }

  // Em desenvolvimento, permitir acesso se estiver autenticado
  return <>{children}</>;
}
