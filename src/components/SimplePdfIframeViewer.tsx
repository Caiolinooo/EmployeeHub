'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiDownload, FiExternalLink } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface SimplePdfIframeViewerProps {
  title: string;
  filePath: string;
  onClose: () => void;
  allowDownload?: boolean;
}

const SimplePdfIframeViewer: React.FC<SimplePdfIframeViewerProps> = ({
  title,
  filePath,
  onClose,
  allowDownload = true
}) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Função para normalizar o caminho do arquivo
  const getNormalizedPath = () => {
    // Se já for uma URL completa, retornar como está
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    
    // Caso contrário, construir URL completa
    const baseUrl = window.location.origin;
    const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
    return `${baseUrl}${normalizedPath}`;
  };

  // Verificar se o arquivo existe
  React.useEffect(() => {
    const checkFileExists = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const path = getNormalizedPath();
        if (!path) {
          throw new Error({t('components.caminhoDoArquivoInvalido')});
        }
        
        const response = await fetch(path, { 
          method: 'HEAD',
          cache: 'no-cache'
        });
        
        if (!response.ok) {
          throw new Error({t('components.arquivoNaoEncontradoResponsestatus')});
        }
        
        // Arquivo existe, continuar carregamento
        setLoading(false);
      } catch (err) {
        console.error('Erro ao verificar arquivo PDF:', err);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    };
    
    checkFileExists();
  }, [filePath]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          <div className="flex items-center space-x-2">
            {allowDownload && (
              <a
                href={getNormalizedPath()}
                download
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
                title={t('viewer.download', 'Baixar documento')}
              >
                <FiDownload className="w-5 h-5" />
              </a>
            )}
            <a
              href={getNormalizedPath()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
              title={t('viewer.openInNewTab', 'Abrir em nova aba')}
            >
              <FiExternalLink className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
              title={t('viewer.close', 'Fechar')}
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full p-6">
              <div className="text-red-500 mb-4">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-red-600">{t('viewer.errorLoading', 'Erro ao carregar o documento')}</p>
              <p className="text-gray-600 mt-2">{error}</p>
              <div className="mt-4">
                <a
                  href={getNormalizedPath()}
                  download
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  {t('viewer.downloadInstead', 'Baixar o documento')}
                </a>
              </div>
            </div>
          ) : (
            <iframe
              src={getNormalizedPath()}
              className="w-full h-full border-0"
              title={t('viewer.documentViewer', 'Visualizador de documento')}
              loading="lazy"
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SimplePdfIframeViewer;
