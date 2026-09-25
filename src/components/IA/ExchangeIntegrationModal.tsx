'use client';

import React, { useState } from 'react';
import ModalCloseButton from '@/components/ui/ModalCloseButton';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export default function ExchangeIntegrationModal({ isOpen, onClose, token }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEscapeToClose(isOpen, onClose);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/exchange', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url; // Redireciona para o Microsoft Login
      } else {
        throw new Error(data.error || 'Erro ao gerar URL de autorização');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div data-modal-panel="" className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="absolute right-2 top-2">
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h2 className="text-xl font-bold text-gray-800 mb-2">Conectar E-mail (Microsoft 365)</h2>
          <p className="text-gray-500 text-sm mb-6">
            Para que o ABZ Assistant possa ler seus e-mails e ajudar com o seu fluxo de trabalho, você precisa autorizar o acesso à sua conta corporativa.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm text-left">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={handleConnect}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#0078D4] hover:bg-[#0063B1] text-white rounded-xl font-medium transition-colors disabled:opacity-70"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/>
                  </svg>
                  Conectar com a Microsoft
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-medium transition-colors"
            >
              Agora não
            </button>
          </div>
        </div>
        <div className="bg-gray-50 p-4 border-t border-gray-100 text-xs text-center text-gray-400">
          Seus dados são criptografados e acessados apenas pelo assistente de IA da ABZ Group.
        </div>
      </div>
    </div>
  );
}
