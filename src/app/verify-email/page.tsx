'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/contexts/I18nContext';
import { toast, Toaster } from 'react-hot-toast';
import { FiCheck, FiX, FiLoader, FiMail, FiClock, FiAlertCircle } from 'react-icons/fi';
import Image from 'next/image';
import Link from 'next/link';
import LanguageSelector from '@/components/LanguageSelector';

export default function VerifyEmailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
    user?: any;
  } | null>(null);

  useEffect(() => {
    if (!searchParams) {
      setVerificationResult({
        success: false,
        message: 'Parâmetros de busca não disponíveis'
      });
      setIsVerifying(false);
      return;
    }

    const token = searchParams.get('token');

    if (!token) {
      setVerificationResult({
        success: false,
        message: 'Token de verificação não encontrado na URL'
      });
      setIsVerifying(false);
      return;
    }

    // Verificar o token
    verifyEmailToken(token);
  }, [searchParams]);

  const verifyEmailToken = async (token: string) => {
    try {
      setIsVerifying(true);
      
      const response = await fetch('/api/auth/verify-email-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      setVerificationResult(data);

      if (data.success) {
        toast.success('Email verificado com sucesso!');
        // Redirecionar imediatamente para definição de senha com o mesmo token
        router.replace(`/set-password?token=${encodeURIComponent(token)}`);
      } else {
        toast.error(data.message || 'Erro ao verificar email');
      }

    } catch (error) {
      console.error('Erro ao verificar email:', error);
      setVerificationResult({
        success: false,
        message: 'Erro ao verificar email. Tente novamente.'
      });
      toast.error('Erro ao verificar email');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md relative">
        {/* Language Selector */}
        <div className="absolute top-4 right-4">
          <LanguageSelector variant="dropdown" />
        </div>

        <div className="text-center mb-6">
          <Image
            src="/images/logo.png"
            alt="ABZ Group"
            width={150}
            height={50}
            className="mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-blue-600">
            Verificação de Email
          </h1>
        </div>

        {isVerifying ? (
          <div className="text-center">
            <div className="bg-blue-50 p-6 rounded-lg mb-6">
              <FiLoader className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
              <h2 className="text-lg font-medium text-blue-900 mb-2">
                Verificando seu email...
              </h2>
              <p className="text-blue-700">
                Por favor, aguarde enquanto verificamos seu endereço de email.
              </p>
            </div>
          </div>
        ) : verificationResult?.success ? (
          <div className="text-center">
            <div className="bg-green-50 p-6 rounded-lg mb-6">
              <FiCheck className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-lg font-medium text-green-900 mb-2">
                Email verificado com sucesso!
              </h2>
              <p className="text-green-700 mb-4">
                Seu endereço de email foi confirmado e sua conta está ativa.
              </p>
              {verificationResult.user && (
                <div className="bg-white p-4 rounded border border-green-200 mb-4">
                  <p className="text-sm text-gray-600">
                    <strong>Nome:</strong> {verificationResult.user.first_name} {verificationResult.user.last_name}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Email:</strong> {verificationResult.user.email}
                  </p>
                </div>
              )}
              <p className="text-green-600 text-sm">
                Redirecionando para a criação de senha...
              </p>
            </div>

            <div className="text-center">
              {/* Fallback: caso não redirecione automaticamente */}
              {(() => {
                const token = searchParams?.get('token');
                const href = token ? `/set-password?token=${encodeURIComponent(token)}` : '/set-password';
                return (
                  <Link
                    href={href}
                    className="inline-block bg-green-600 text-white px-6 py-2 rounded-md font-medium hover:bg-green-700 transition-colors"
                  >
                    Criar senha agora
                  </Link>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="bg-red-50 p-6 rounded-lg mb-6">
              <FiX className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-lg font-medium text-red-900 mb-2">
                Erro na verificação
              </h2>
              <p className="text-red-700 mb-4">
                {verificationResult?.message || 'Não foi possível verificar seu email.'}
              </p>
              
              <div className="bg-white p-4 rounded border border-red-200 mb-4">
                <div className="flex items-start space-x-2 mb-3">
                  <FiAlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      Possíveis causas do erro:
                    </p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li className="flex items-center">
                        <FiClock className="h-3 w-3 mr-2 text-orange-500" />
                        Link expirado (válido por 24 horas)
                      </li>
                      <li className="flex items-center">
                        <FiCheck className="h-3 w-3 mr-2 text-green-500" />
                        Link já foi usado anteriormente
                      </li>
                      <li className="flex items-center">
                        <FiX className="h-3 w-3 mr-2 text-red-500" />
                        Link inválido ou corrompido
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="bg-blue-50 p-3 rounded border border-blue-200 mt-3">
                  <p className="text-xs text-blue-700">
                    <strong>💡 Dica:</strong> Se você recebeu múltiplos emails, use sempre o link mais recente.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Link
                href="/register"
                className="block w-full bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Registrar Novamente
              </Link>
              
              <Link
                href="/login"
                className="block w-full bg-gray-600 text-white px-6 py-2 rounded-md font-medium hover:bg-gray-700 transition-colors"
              >
                Ir para Login
              </Link>
            </div>
          </div>
        )}

        {/* Informações adicionais */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-center text-gray-500 mb-2">
            <FiMail className="h-4 w-4 mr-2" />
            <span className="text-sm">Precisa de ajuda?</span>
          </div>
          <p className="text-xs text-gray-500 text-center">
            Se você continuar tendo problemas, entre em contato com o suporte em{' '}
            <a href="mailto:suporte@abzgroup.com.br" className="text-blue-600 hover:text-blue-800">
              suporte@abzgroup.com.br
            </a>
          </p>
        </div>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
