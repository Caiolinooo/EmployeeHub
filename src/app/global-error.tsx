'use client';

import React from 'react';
import { FiAlertTriangle, FiRefreshCw, FiHome } from 'react-icons/fi';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Simple translation function since we can't use I18n context here
  const t = (key: string, fallback: string) => fallback;

  // Log the error to help with debugging
  React.useEffect(() => {
    console.error('Global application error:', error);

    // Log additional information about the error
    if (error.stack) {
      console.error('Error stack:', error.stack);
    }

    // Check if this is a webpack-related error
    if (error.message && error.message.includes('webpack') ||
        error.message && error.message.includes('call')) {
      console.error('This appears to be a webpack or module loading error. Check your imports and dynamic components.');
    }
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="bg-red-100 p-3 rounded-full mb-4">
              <FiAlertTriangle className="h-8 w-8 text-red-500" />
            </div>

            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              {t('errors.errorOccurred', 'Erro na Aplicação')}
            </h1>

            <p className="text-gray-600 mb-6">
              {t('errors.somethingWentWrong', 'Desculpe, ocorreu um erro inesperado na aplicação. Nossa equipe foi notificada.')}
            </p>

            {error.message && (
              <div className="w-full bg-gray-100 p-4 rounded mb-6 text-left overflow-auto max-h-32">
                <p className="text-sm font-mono text-gray-700">
                  {error.message}
                </p>
                {error.digest && (
                  <p className="mt-1 text-xs text-gray-400">
                    Código de erro: {error.digest}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 w-full">
              <button
                onClick={() => reset()}
                className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <FiRefreshCw className="mr-2" />
                Tentar novamente
              </button>

              <a
                href="/"
                className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                <FiHome className="mr-2" />
                Página inicial
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
