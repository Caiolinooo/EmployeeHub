'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { FaEnvelope, FaSpinner, FaCheckCircle } from 'react-icons/fa';
import { useI18n } from '@/contexts/I18nContext';

interface EmailVerificationPromptProps {
  email: string;
  onVerificationSent?: () => void;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export default function EmailVerificationPrompt({
  email,
  onVerificationSent,
  onClose,
  showCloseButton = true
}: EmailVerificationPromptProps) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleResendVerification = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/resend-email-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setVerificationSent(true);
        toast.success(t('components.emailDeVerificacaoEnviadoComSucesso'));
        onVerificationSent?.();
      } else {
        toast.error(data.error || t('components.erroAoEnviarEmailDeVerificacao'));
      }
    } catch (error) {
      console.error(t('components.erroAoReenviarVerificacao'), error);
      toast.error(t('components.erroAoEnviarEmailDeVerificacao'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
      <div className="flex items-center mb-4">
        <FaEnvelope className="text-yellow-600 text-2xl mr-3" />
        <h3 className="text-lg font-semibold text-yellow-800">
          Verificação de E-mail Necessária
        </h3>
      </div>
      
      <div className="mb-4">
        <p className="text-yellow-700 mb-2">
          Seu e-mail <strong>{email}</strong> ainda não foi verificado.
        </p>
        <p className="text-yellow-600 text-sm">
          Para acessar sua conta, você precisa verificar seu e-mail primeiro.
        </p>
      </div>

      {verificationSent ? (
        <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
          <div className="flex items-center">
            <FaCheckCircle className="text-green-600 mr-2" />
            <p className="text-green-700 text-sm">
              E-mail de verificação enviado! Verifique sua caixa de entrada.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={handleResendVerification}
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              t('components.reenviarEmailDeVerificacao')
            )}
          </button>
          
          <p className="text-xs text-gray-500 text-center">
            Não recebeu o e-mail? Verifique sua pasta de spam ou lixo eletrônico.
          </p>
        </div>
      )}

      {showCloseButton && onClose && (
        <button
          onClick={onClose}
          className="mt-4 w-full text-gray-600 hover:text-gray-800 text-sm"
        >
          Fechar
        </button>
      )}
    </div>
  );
}
