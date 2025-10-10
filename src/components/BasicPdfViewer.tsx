'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiDownload } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { getAvailableLocalizedDocumentPath } from '@/lib/documentUtils';

interface BasicPdfViewerProps {
  title: string;
  filePath: string;
  onClose: () => void;
  allowDownload?: boolean;
}

const BasicPdfViewer: React.FC<BasicPdfViewerProps> = ({
  title,
  filePath,
  onClose,
  allowDownload = true
}) => {
  const { t, locale } = useI18n();
  const [localizedFilePath, setLocalizedFilePath] = useState<string>(filePath);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Função para normalizar o caminho do arquivo
  const getNormalizedPath = (path: string) => {
    // Se já for uma URL completa, retornar como está
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // Caso contrário, construir URL completa
    const baseUrl = window.location.origin;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
  };

  // Obter o caminho do documento traduzido
  useEffect(() => {
    const getLocalizedPath = async () => {
      setIsLoading(true);
      try {
        // Obter o caminho do documento traduzido
        const localizedPath = await getAvailableLocalizedDocumentPath(filePath, locale);
        setLocalizedFilePath(localizedPath);
        console.log('📄 Documento localizado:', localizedPath);
      } catch (error) {
        console.error('Erro ao obter caminho do documento traduzido:', error);
        // Em caso de erro, usar o caminho original
        setLocalizedFilePath(filePath);
      } finally {
        setIsLoading(false);
      }
    };

    getLocalizedPath();
  }, [filePath, locale]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-lg shadow-xl max-w-6xl w-full h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          <div className="flex items-center space-x-2">
            {allowDownload && !isLoading && (
              <a
                href={getNormalizedPath(localizedFilePath)}
                download
                className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                title={t('viewer.download', 'Baixar documento')}
              >
                <FiDownload className="w-4 h-4 mr-1.5" />
                {t('viewer.download', 'Baixar')}
              </a>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
              title={t('viewer.close', 'Fechar')}
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-600">
                {t('viewer.loading', 'Carregando documento...')}
              </p>
            </div>
          ) : (
            <iframe
              src={getNormalizedPath(localizedFilePath)}
              className="w-full h-full border-0"
              title={title}
            />
          )}
        </div>

        {/* Footer com informações de tradução */}
        {!isLoading && (
          <div className="p-3 border-t bg-gray-50 text-center text-sm">
            {localizedFilePath !== filePath ? (
              <p className="text-green-600">
                ✓ {t('viewer.translatedDocument', 'Documento traduzido disponível para o seu idioma')}
              </p>
            ) : locale !== 'pt-BR' ? (
              <p className="text-amber-600">
                ⚠ {t('viewer.noTranslation', 'Este documento está disponível apenas em português')}
              </p>
            ) : (
              <p className="text-gray-500">
                {t('viewer.originalDocument', 'Documento original em português')}
              </p>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default BasicPdfViewer;
