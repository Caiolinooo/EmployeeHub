'use client';

import React, { useState, useEffect } from 'react';
import { FiX, FiDownload, FiMaximize, FiMinimize, FiAlertCircle, FiLoader } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useI18n } from '@/contexts/I18nContext';
import PdfJsViewer from './PdfJsViewer';
import UniversalPdfViewer from './UniversalPdfViewer';

interface EnhancedPdfViewerProps {
  title: string;
  filePath: string;
  onClose: () => void;
  allowDownload?: boolean;
  accentColor?: string;
}

const EnhancedPdfViewer: React.FC<EnhancedPdfViewerProps> = ({
  title,
  filePath,
  onClose,
  allowDownload = true,
  accentColor = 'text-abz-blue'
}) => {
  const { t } = useI18n();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'fitH' | 'fitV' | 'fitB'>('fitH');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPdfSupport, setHasPdfSupport] = useState(true);

  // Verificar se o navegador suporta PDF nativamente
  useEffect(() => {
    // Verificação básica de suporte a PDF
    const checkPdfSupport = () => {
      try {
        // Verificar se o navegador é o IE (que não suporta PDF)
        const isIE = typeof document !== 'undefined' && !!(document as any).documentMode;

        // Verificar se é um navegador móvel (que pode não suportar PDF)
        const isMobile = typeof navigator !== 'undefined' &&
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Verificar se o navegador tem o plugin de PDF
        const hasPdfPlugin = typeof navigator !== 'undefined' &&
          navigator.mimeTypes &&
          (navigator.mimeTypes as any)['application/pdf'];

        // Se for IE ou mobile sem plugin, considerar que não tem suporte
        setHasPdfSupport(!isIE && (!isMobile || hasPdfPlugin));
      } catch (error) {
        console.error('Erro ao verificar suporte a PDF:', error);
        // Por padrão, assumir que tem suporte
        setHasPdfSupport(true);
      }
    };

    checkPdfSupport();
  }, []);

  // Verificar se o documento está acessível
  useEffect(() => {
    const checkDocument = async () => {
      setLoading(true);
      setError(null);

      try {
        // Verificar se estamos no navegador
        if (typeof window === 'undefined') {
          return;
        }

        // Verificar se o caminho do arquivo é válido
        if (!filePath) {
          setError('Caminho do documento não especificado');
          return;
        }

        // Tentar acessar o documento
        const response = await fetch(filePath, { method: 'HEAD' });

        if (!response.ok) {
          setError(`Erro ao acessar o documento: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error('Erro ao verificar documento:', error);
        setError(`Erro ao acessar o documento: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setLoading(false);
      }
    };

    // Executar a verificação apenas no lado do cliente
    if (typeof window !== 'undefined') {
      checkDocument();
    } else {
      setLoading(false); // Não está carregando no servidor
    }
  }, [filePath]);

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    try {
      if (typeof document === 'undefined') return;

      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    } catch (error) {
      console.error('Erro ao alternar modo tela cheia:', error);
    }
  };

  // Handle fullscreen change event
  useEffect(() => {
    // Verificar se estamos no navegador
    if (typeof document === 'undefined') return;

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    try {
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
      };
    } catch (error) {
      console.error('Erro ao adicionar evento de fullscreen:', error);
      return () => {};
    }
  }, []);

  // Change view mode
  const changeViewMode = (mode: 'fitH' | 'fitV' | 'fitB') => {
    setViewMode(mode);
  };

  // Renderizar o visualizador de PDF
  const renderPdfViewer = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <FiLoader className="animate-spin h-10 w-10 text-abz-blue mb-4" />
          <p className="text-gray-700">{t('viewer.loading', 'Carregando documento...')}</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <FiAlertCircle className="h-10 w-10 text-red-500 mb-4" />
          <p className="text-red-700 mb-2">{t('viewer.error', 'Erro ao carregar o documento')}</p>
          <p className="text-sm text-gray-600">{error}</p>
          <a
            href={filePath}
            download
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {t('viewer.downloadView', 'Baixar e visualizar localmente')}
          </a>
        </div>
      );
    }

    // Usar o visualizador universal para todos os casos
    return (
      <div className="w-full h-full">
        <iframe
          src={`https://docs.google.com/viewer?url=${encodeURIComponent(filePath)}&embedded=true`}
          className="w-full h-full border-0"
          title={t('viewer.documentViewer', 'Visualizador de documento')}
          loading="lazy"
        />
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-2 sm:p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-lg shadow-xl w-full h-[98vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-3 border-b bg-gray-50">
          <h2 className={`text-xl font-semibold ${accentColor} truncate`}>{title}</h2>
          <div className="flex items-center space-x-2">


            {/* View mode buttons - only show if PDF is supported */}
            {hasPdfSupport && !error && !loading && (
              <div className="hidden sm:flex items-center space-x-1 mr-2">
                <button
                  onClick={() => changeViewMode('fitH')}
                  className={`px-2 py-1 text-xs rounded ${viewMode === 'fitH' ? 'bg-gray-200 font-medium' : 'hover:bg-gray-100'}`}
                  title={t('viewer.fitWidth', 'Ajustar à largura')}
                >
                  {t('viewer.width', 'Largura')}
                </button>
                <button
                  onClick={() => changeViewMode('fitV')}
                  className={`px-2 py-1 text-xs rounded ${viewMode === 'fitV' ? 'bg-gray-200 font-medium' : 'hover:bg-gray-100'}`}
                  title={t('viewer.fitHeight', 'Ajustar à altura')}
                >
                  {t('viewer.height', 'Altura')}
                </button>
                <button
                  onClick={() => changeViewMode('fitB')}
                  className={`px-2 py-1 text-xs rounded ${viewMode === 'fitB' ? 'bg-gray-200 font-medium' : 'hover:bg-gray-100'}`}
                  title={t('viewer.fitPage', 'Ajustar à página')}
                >
                  {t('viewer.page', 'Página')}
                </button>
              </div>
            )}

            {/* Action buttons */}
            {allowDownload && (
              <a
                href={filePath}
                download
                className="text-gray-500 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                title={t('viewer.download', 'Baixar documento')}
              >
                <FiDownload className="h-5 w-5" />
              </a>
            )}
            <button
              onClick={toggleFullscreen}
              className="text-gray-500 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              title={isFullscreen ? t('viewer.exitFullscreen', 'Sair da tela cheia') : t('viewer.fullscreen', 'Tela cheia')}
            >
              {isFullscreen ? <FiMinimize className="h-5 w-5" /> : <FiMaximize className="h-5 w-5" />}
            </button>
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
          {renderPdfViewer()}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EnhancedPdfViewer;
