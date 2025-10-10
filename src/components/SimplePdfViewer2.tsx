'use client';

import React, { useState, useEffect } from 'react';
import { FiDownload, FiX } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface SimplePdfViewer2Props {
  title: string;
  filePath: string;
  onClose: () => void;
}

const SimplePdfViewer2: React.FC<SimplePdfViewer2Props> = ({
  title,
  filePath,
  onClose
}) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Normalizar o caminho do arquivo
  const getNormalizedPath = () => {
    // Verificar se o caminho está vazio ou é inválido
    if (!filePath || typeof filePath !== 'string') {
      console.error({t('components.caminhoDeArquivoInvalido')}, filePath);
      return '';
    }

    // Registrar o caminho original para debug
    console.log('Caminho original do arquivo:', filePath);

    // Se o caminho não começar com http ou https, considerar como caminho relativo
    if (!filePath.startsWith('http://') && !filePath.startsWith('https://')) {
      // Garantir que o caminho comece com /
      let normalizedPath = filePath;
      if (!filePath.startsWith('/')) {
        normalizedPath = `/${filePath}`;
      }

      // Construir URL completa para garantir compatibilidade em todos os navegadores
      if (typeof window !== 'undefined') {
        const fullPath = `${window.location.origin}${normalizedPath}`;
        console.log('Caminho normalizado do arquivo:', fullPath);
        return fullPath;
      }

      console.log('Caminho normalizado do arquivo (sem origem):', normalizedPath);
      return normalizedPath;
    }
    
    console.log({t('components.caminhoJaEUmaUrlCompleta')}, filePath);
    return filePath;
  };

  // Verificar se o arquivo existe
  useEffect(() => {
    const checkFileExists = async () => {
      try {
        setLoading(true);
        setError(null);

        const path = getNormalizedPath();
        if (!path) {
          throw new Error({t('components.caminhoDoArquivoInvalido')});
        }

        // Verificar se o arquivo existe
        const response = await fetch(path, { 
          method: 'HEAD',
          cache: 'no-cache'
        });
        
        if (!response.ok) {
          throw new Error({t('components.arquivoNaoEncontradoResponsestatus')});
        }

        setLoading(false);
      } catch (err) {
        console.error('Erro ao verificar arquivo:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        setLoading(false);
      }
    };

    checkFileExists();
  }, [filePath]);

  const normalizedPath = getNormalizedPath();
  const googleDocsViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(normalizedPath)}&embedded=true`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full h-[98vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-3 border-b bg-gray-50">
          <h2 className="text-xl font-semibold text-abz-blue truncate">{title}</h2>
          <div className="flex items-center space-x-2">
            <a
              href={normalizedPath}
              download
              className="text-gray-500 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              title={t('viewer.download', 'Baixar documento')}
            >
              <FiDownload className="h-5 w-5" />
            </a>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-red-600 p-1.5 rounded-full hover:bg-red-100 transition-colors"
              title={t('viewer.close', 'Fechar visualizador')}
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Document viewer */}
        <div className="flex-1 overflow-hidden bg-gray-100">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-600">{t('viewer.loading', 'Carregando documento...')}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-red-500 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-red-600">{t('viewer.errorLoading', 'Erro ao carregar o documento')}</p>
              <p className="text-gray-600 mt-2">{error}</p>
              <div className="mt-4">
                <a
                  href={normalizedPath}
                  download
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  {t('viewer.downloadInstead', 'Baixar o documento')}
                </a>
              </div>
            </div>
          ) : (
            <iframe
              src={googleDocsViewerUrl}
              className="w-full h-full border-0"
              title={t('viewer.documentViewer', 'Visualizador de documento')}
              loading="lazy"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SimplePdfViewer2;
