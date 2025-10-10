'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { SetPasswordModal } from './SetPasswordModal';
import { fetchWrapper } from '@/lib/fetch-wrapper';

interface PasswordRequiredGuardProps {
  children: React.ReactNode;
}

export function PasswordRequiredGuard({ children }: PasswordRequiredGuardProps) {
  const { user, isAuthenticated, isLoading, passwordExpired } = useSupabaseAuth();
  const { t } = useI18n();
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);
  const [isCheckingPassword, setIsCheckingPassword] = useState(true);
  const [hasPassword, setHasPassword] = useState(true);
  const router = useRouter();

  // Verificar se o usuário tem senha definida
  useEffect(() => {
    const checkUserPassword = async () => {
      if (!isAuthenticated || !user) {
        setIsCheckingPassword(false);
        return;
      }

      try {
        // Obter o token do localStorage
        const token = localStorage.getItem('token');

        if (!token) {
          console.error({t('components.tokenNaoEncontradoNoLocalstorage')});
          setIsCheckingPassword(false);
          return;
        }

        // Verificar se o usuário tem senha definida usando fetch diretamente
        const response = await fetch('/api/auth/check-has-password', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log({t('components.respostaDaVerificacaoDeSenha')}, data);

          if (data.hasPassword || data.isAdmin) {
            // Se o usuário tem senha ou é admin, permitir acesso
            setHasPassword(true);
          } else {
            setHasPassword(false);
            setShowSetPasswordModal(true);
          }
        } else {
          console.error({t('components.erroAoVerificarSenhaDoUsuario')}, response.status);
          // Se houver erro, assumir que o usuário não tem senha definida
          setHasPassword(false);
          setShowSetPasswordModal(true);
        }
      } catch (error) {
        console.error({t('components.erroAoVerificarSenhaDoUsuario')}, error);
      } finally {
        setIsCheckingPassword(false);
      }
    };

    checkUserPassword();
  }, [isAuthenticated, user]);

  // Função para lidar com o sucesso da definição de senha
  const handlePasswordSetSuccess = () => {
    setPasswordSet(true);
  };

  // Função para fechar o modal de definição de senha
  const handleCloseSetPasswordModal = () => {
    if (passwordSet) {
      setShowSetPasswordModal(false);
      setHasPassword(true);
    }
  };

  // Se estiver carregando ou verificando a senha, mostrar indicador de carregamento
  if (isLoading || isCheckingPassword) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-abz-background">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-abz-blue"></div>
          <p className="mt-4 text-abz-blue font-medium">Verificando credenciais...</p>
        </div>
      </div>
    );
  }

  // Se não estiver autenticado, redirecionar para o login
  if (!isAuthenticated) {
    router.replace('/login');
    return null;
  }

  // Se o usuário não tiver senha definida, mostrar apenas o modal
  if (!hasPassword) {
    return (
      <>
        {/* Modal de definição de senha */}
        <SetPasswordModal
          isOpen={showSetPasswordModal}
          onClose={handleCloseSetPasswordModal}
          onSuccess={handlePasswordSetSuccess}
          isNewUser={false}
        />

        {/* Fundo escurecido e desfocado para bloquear o acesso ao conteúdo */}
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-md z-40 flex items-center justify-center">
          <div className="text-white text-center max-w-md p-6">
            <div className="mb-4">
              <svg className="h-16 w-16 mx-auto text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2">{t('auth.securityRequired', 'Segurança Necessária')}</h2>
            <p className="mb-4">{t('auth.passwordRequiredMessage', 'Por motivos de segurança, você precisa definir uma senha antes de acessar o sistema.')}</p>
          </div>
        </div>
      </>
    );
  }

  // Se o usuário tiver senha definida, renderizar os filhos normalmente
  return <>{children}</>;
}
