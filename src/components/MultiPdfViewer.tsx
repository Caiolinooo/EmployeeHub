'use client';

import React, { useState, useEffect } from 'react';
import { FiDownload, FiX, FiExternalLink, FiRefreshCw } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import TextContentViewer from './TextContentViewer';
import PdfImageViewer from './PdfImageViewer';
import UniversalPdfViewer from './UniversalPdfViewer';

interface MultiPdfViewerProps {
  title: string;
  filePath: string;
  onClose: () => void;
}

type ViewerType = 'direct' | 'object' | 'iframe' | 'google' | 'office' | 'fallback' | 'text' | 'image' | 'universal';

const MultiPdfViewer: React.FC<MultiPdfViewerProps> = ({
  title,
  filePath,
  onClose
}) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerType, setViewerType] = useState<ViewerType>('direct');
  const [fileExists, setFileExists] = useState(false);

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

  // Verificar se o arquivo existe e escolher o melhor visualizador
  useEffect(() => {
    const checkFileExists = async () => {
      try {
        setLoading(true);
        setError(null);

        const path = getNormalizedPath();
        if (!path) {
          throw new Error({t('components.caminhoDoArquivoInvalido')});
        }

        // Verificar se o PDF original existe
        const response = await fetch(path, {
          method: 'HEAD',
          cache: 'no-cache'
        });

        if (!response.ok) {
          throw new Error({t('components.arquivoNaoEncontradoResponsestatus')});
        }

        // PDF existe, usar o visualizador universal por padrão (seguindo o modelo do módulo de reembolso)
        console.log('PDF encontrado, usando visualizador universal');
        // Definir como 'universal' para usar o novo visualizador
        setViewerType('universal');
        setFileExists(true);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao verificar arquivo:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        setFileExists(false);
        setLoading(false);
      }
    };

    checkFileExists();
  }, [filePath]);

  const normalizedPath = getNormalizedPath();
  const googleDocsViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(normalizedPath)}&embedded=true`;
  const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(normalizedPath)}`;

  // Detectar o navegador e definir o melhor visualizador
  useEffect(() => {
    if (!fileExists) return;

    // Verificar se é um dispositivo móvel
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Verificar se é Safari (que tem problemas com PDFs)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Verificar se é Chrome ou Edge (que geralmente suportam PDFs)
    const isChrome = /chrome/i.test(navigator.userAgent) && !/edge/i.test(navigator.userAgent);
    const isEdge = /edge/i.test(navigator.userAgent);

    console.log({t('components.informacoesDoNavegador')}, { isMobile, isSafari, isChrome, isEdge });

    // Verificar se o arquivo é um PDF ou texto convertido
    const isPdfPath = normalizedPath.toLowerCase().endsWith('.pdf');
    const txtPath = normalizedPath.replace(/\.pdf$/i, '.txt');

    // Verificar se existe uma versão em texto do arquivo
    fetch(txtPath, { method: 'HEAD', cache: 'no-cache' })
      .then(response => {
        if (response.ok) {
          console.log('Arquivo de texto encontrado, usando visualizador de texto');
          setViewerType('text');
          return;
        }

        // Se não houver versão em texto, usar o visualizador apropriado para o navegador
        if (isMobile || isSafari) {
          // Usar visualização direta para dispositivos móveis e Safari
          setViewerType('direct');
        } else if (isChrome || isEdge) {
          // Usar object para Chrome e Edge
          setViewerType('object');
        } else {
          // Usar iframe para outros navegadores
          setViewerType('iframe');
        }

        console.log('Tipo de visualizador selecionado:', viewerType);
      })
      .catch(() => {
        // Em caso de erro, usar o visualizador padrão
        if (isMobile || isSafari) {
          setViewerType('direct');
        } else {
          setViewerType('object');
        }
      });
  }, [fileExists, normalizedPath]);

  // Função para alternar entre os visualizadores
  const toggleViewer = () => {
    const viewers: ViewerType[] = ['universal', 'image', 'text', 'direct', 'object', 'iframe', 'google', 'office'];
    const currentIndex = viewers.indexOf(viewerType);
    const nextIndex = (currentIndex + 1) % viewers.length;
    setViewerType(viewers[nextIndex]);
  };

  // Função para lidar com erros de visualização
  const handleViewerError = () => {
    console.log({t('components.visualizadorViewertypeFalhouTentandoProximo')});

    // Tentar o próximo visualizador
    if (viewerType === 'direct') {
      setViewerType('object');
    } else if (viewerType === 'object') {
      setViewerType('iframe');
    } else if (viewerType === 'iframe') {
      setViewerType('google');
    } else if (viewerType === 'google') {
      setViewerType('office');
    } else if (viewerType === 'office') {
      // Tentar com arquivo de texto convertido
      const txtPath = normalizedPath.replace(/\.pdf$/i, '.txt');

      // Verificar se o arquivo de texto existe
      fetch(txtPath, { method: 'HEAD', cache: 'no-cache' })
        .then(response => {
          if (response.ok) {
            console.log('Arquivo de texto encontrado, usando visualizador de texto');
            setViewerType('text');
          } else {
            // Se não existir, mostrar fallback
            setViewerType('fallback');
          }
        })
        .catch(() => {
          // Em caso de erro, mostrar fallback
          setViewerType('fallback');
        });
    } else {
      // Se todos falharem, mostrar fallback
      setViewerType('fallback');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full h-[98vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-3 border-b bg-gray-50">
          <h2 className="text-xl font-semibold text-abz-blue truncate">{title}</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleViewer}
              className="text-gray-500 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              title={t('viewer.changeViewer', 'Alternar visualizador')}
            >
              <FiRefreshCw className="h-5 w-5" />
            </button>
            <a
              href={normalizedPath}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              title={t('viewer.openInNewTab', 'Abrir em nova aba')}
            >
              <FiExternalLink className="h-5 w-5" />
            </a>
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
            <>
              {viewerType === 'direct' && (
                <div className="w-full h-full">
                  <embed
                    src={normalizedPath}
                    type="application/pdf"
                    className="w-full h-full"
                    onError={handleViewerError}
                  />
                </div>
              )}

              {viewerType === 'object' && (
                <div className="w-full h-full">
                  <object
                    data={normalizedPath}
                    type="application/pdf"
                    className="w-full h-full"
                    onError={handleViewerError}
                  >
                    <p className="text-center p-4">
                      {t('viewer.pdfNotSupported', 'Seu navegador não suporta a visualização de PDF.')}
                      <br />
                      <button
                        onClick={() => setViewerType('google')}
                        className="text-blue-600 hover:underline"
                      >
                        {t('viewer.tryGoogleViewer', 'Tentar visualizador do Google')}
                      </button>
                    </p>
                  </object>
                </div>
              )}

              {viewerType === 'iframe' && (
                <div className="w-full h-full">
                  <iframe
                    src={normalizedPath}
                    className="w-full h-full border-0"
                    title={t('viewer.documentViewer', 'Visualizador de documento')}
                    loading="lazy"
                    onError={handleViewerError}
                  />
                </div>
              )}

              {viewerType === 'google' && (
                <iframe
                  src={googleDocsViewerUrl}
                  className="w-full h-full border-0"
                  title={t('viewer.documentViewer', 'Visualizador de documento')}
                  loading="lazy"
                  onError={handleViewerError}
                />
              )}

              {viewerType === 'office' && (
                <iframe
                  src={officeViewerUrl}
                  className="w-full h-full border-0"
                  title={t('viewer.documentViewer', 'Visualizador de documento')}
                  loading="lazy"
                  onError={handleViewerError}
                />
              )}

              {viewerType === 'fallback' && (
                <div className="flex flex-col items-center justify-center h-full p-4">
                  <div className="bg-white p-6 rounded-lg shadow-md max-w-lg w-full text-center">
                    <h3 className="text-lg font-semibold mb-4">{t('viewer.cannotPreview', 'Não foi possível pré-visualizar o documento')}</h3>
                    <p className="text-gray-600 mb-6">
                      {t('viewer.downloadToView', 'Por favor, baixe o documento para visualizá-lo em seu dispositivo.')}
                    </p>
                    <a
                      href={normalizedPath}
                      download
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <FiDownload className="mr-2" />
                      {t('viewer.download', 'Baixar documento')}
                    </a>
                  </div>
                </div>
              )}

              {viewerType === 'text' && (
                <div className="w-full h-full bg-white p-6 overflow-auto">
                  <TextContentViewer filePath={normalizedPath.replace(/\.pdf$/i, '.txt')} />
                </div>
              )}

              {viewerType === 'image' && (
                <div className="w-full h-full">
                  <PdfImageViewer filePath={normalizedPath} />
                </div>
              )}

              {/* Usar sempre o visualizador universal melhorado */}
              {(viewerType === 'universal' || true) && (
                <UniversalPdfViewer
                  title={title}
                  filePath={normalizedPath}
                  onClose={onClose}
                  allowDownload={true}
                />
              )}
            </>
          )}
        </div>

        {/* Rodapé com informações do visualizador */}
        <div className="bg-gray-50 p-2 text-xs text-gray-500 text-center border-t">
          {viewerType === 'universal' ?
            t('viewer.usingUniversalViewer', 'Usando visualizador universal') :
            viewerType === 'direct' ?
              t('viewer.usingDirectViewer', 'Usando visualizador direto (embed)') :
              viewerType === 'object' ?
                t('viewer.usingObjectViewer', 'Usando visualizador de objeto') :
                viewerType === 'iframe' ?
                  t('viewer.usingIframeViewer', 'Usando visualizador de iframe') :
                  viewerType === 'google' ?
                    t('viewer.usingGoogleViewer', 'Usando Google Docs Viewer') :
                    viewerType === 'office' ?
                      t('viewer.usingOfficeViewer', 'Usando Microsoft Office Viewer') :
                      viewerType === 'text' ?
                        t('viewer.usingTextViewer', 'Usando visualizador de texto') :
                        viewerType === 'image' ?
                          t('viewer.usingImageViewer', 'Usando visualizador de imagem') :
                          t('viewer.usingFallbackViewer', 'Usando visualizador de fallback')}
        </div>
      </div>
    </div>
  );
};

export default MultiPdfViewer;
