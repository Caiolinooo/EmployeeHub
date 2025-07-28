'use client';

import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion } from 'framer-motion';
import { FiX, FiDownload, FiChevronLeft, FiChevronRight, FiZoomIn, FiZoomOut, FiRotateCw } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

// Configurar worker do PDF.js
// Usar o worker local para evitar problemas de CORS

// Definir o worker src para o worker local
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString();

interface ReactPdfViewerProps {
  title: string;
  filePath: string;
  onClose: () => void;
  allowDownload?: boolean;
}

const ReactPdfViewer: React.FC<ReactPdfViewerProps> = ({
  title,
  filePath,
  onClose,
  allowDownload = true
}) => {
  const { t } = useI18n();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Funções para navegação
  const previousPage = () => {
    setPageNumber(prevPageNumber => Math.max(prevPageNumber - 1, 1));
  };

  const nextPage = () => {
    setPageNumber(prevPageNumber => Math.min(prevPageNumber + 1, numPages || 1));
  };

  // Funções para zoom
  const zoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.2, 3.0));
  };

  const zoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.2, 0.5));
  };

  // Função para rotação
  const rotate = () => {
    setRotation(prevRotation => (prevRotation + 90) % 360);
  };

  // Função para lidar com o carregamento do documento
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  // Função para lidar com erros
  const onDocumentLoadError = (error: Error) => {
    console.error('Erro ao carregar PDF:', error);
    setError(error);
    setLoading(false);
  };

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
        <div className="flex-1 overflow-auto p-4 bg-gray-100">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full p-6">
              <div className="text-red-500 mb-4">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-red-600">{t('viewer.errorLoading', 'Erro ao carregar o documento')}</p>
              <p className="text-gray-600 mt-2">{error.message}</p>
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
          )}

          {!loading && !error && (
            <div className="flex flex-col items-center">
              <Document
                file={getNormalizedPath()}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center h-[600px]">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                }
                options={{
                  cMapUrl: 'https://unpkg.com/pdfjs-dist@3.4.120/cmaps/',
                  cMapPacked: true,
                  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.4.120/standard_fonts/'
                }}
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  rotate={rotation}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="shadow-lg"
                />
              </Document>
            </div>
          )}
        </div>

        {/* Controls */}
        {!loading && !error && numPages && (
          <div className="flex items-center justify-between p-4 border-t">
            <div className="flex items-center space-x-4">
              <button
                onClick={previousPage}
                disabled={pageNumber <= 1}
                className={`p-2 rounded-full ${pageNumber <= 1 ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}
                title={t('viewer.previousPage', 'Página anterior')}
              >
                <FiChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600">
                {t('viewer.pageInfo', `Página ${pageNumber} de ${numPages}`)}
              </span>
              <button
                onClick={nextPage}
                disabled={pageNumber >= numPages}
                className={`p-2 rounded-full ${pageNumber >= numPages ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}
                title={t('viewer.nextPage', 'Próxima página')}
              >
                <FiChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={zoomOut}
                className="p-2 rounded-full text-gray-600 hover:bg-gray-100"
                title={t('viewer.zoomOut', 'Diminuir zoom')}
              >
                <FiZoomOut className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600">{Math.round(scale * 100)}%</span>
              <button
                onClick={zoomIn}
                className="p-2 rounded-full text-gray-600 hover:bg-gray-100"
                title={t('viewer.zoomIn', 'Aumentar zoom')}
              >
                <FiZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={rotate}
                className="p-2 rounded-full text-gray-600 hover:bg-gray-100"
                title={t('viewer.rotate', 'Rotacionar')}
              >
                <FiRotateCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default ReactPdfViewer;
