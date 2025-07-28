'use client';

import React, { useState, useEffect } from 'react';
import { FiLoader, FiAlertCircle, FiDownload, FiRefreshCw } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import TextContentViewer from './TextContentViewer';

interface PdfJsViewerProps {
  filePath: string;
}

const PdfJsViewer: React.FC<PdfJsViewerProps> = ({ filePath }) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Estado para controlar o tipo de visualizador
  const [viewerType, setViewerType] = useState<'direct' | 'object' | 'google' | 'pdfjs' | 'office' | 'text'>('direct');

  // Normalizar o caminho do arquivo
  const getNormalizedPath = () => {
    // Verificar se o caminho está vazio ou é inválido
    if (!filePath || typeof filePath !== 'string') {
      console.error('Caminho de arquivo inválido:', filePath);
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

    console.log('Caminho já é uma URL completa:', filePath);
    return filePath;
  };

  // Verificar se o arquivo existe e extrair o conteúdo
  useEffect(() => {
    const checkFileExists = async () => {
      setLoading(true);
      setError(null);

      try {
        // Normalizar o caminho do arquivo
        const normalizedPath = getNormalizedPath();

        console.log('Verificando arquivo PDF:', normalizedPath);

        // Verificar se o arquivo existe
        const response = await fetch(normalizedPath, {
          method: 'HEAD',
          cache: 'no-cache'
        });

        if (!response.ok) {
          // Tentar com extensão .txt (para arquivos convertidos)
          const txtPath = normalizedPath.replace(/\.pdf$/i, '.txt');
          console.log('Tentando arquivo de texto convertido:', txtPath);

          const txtResponse = await fetch(txtPath, {
            method: 'HEAD',
            cache: 'no-cache'
          });

          if (!txtResponse.ok) {
            throw new Error(`${t('viewer.fileNotFound', 'Arquivo não encontrado')}: ${response.status} ${response.statusText}`);
          }

          // Arquivo de texto existe, continuar carregamento
          console.log('Arquivo de texto encontrado, usando visualizador de texto');
          setViewerType('text');
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
  }, [filePath, t]);

  // Função para lidar com erros de carregamento do iframe
  const handleIframeError = () => {
    console.log('Iframe direto falhou, tentando object...');
    setViewerType('object');
  };

  // Função para lidar com erros de carregamento do object
  const handleObjectError = () => {
    console.log('Object falhou, tentando Google Docs Viewer...');
    setViewerType('google');
  };

  // Função para alternar entre os visualizadores
  const toggleViewer = () => {
    const viewers: ('direct' | 'object' | 'google' | 'pdfjs' | 'office' | 'text')[] = ['direct', 'object', 'google', 'pdfjs', 'office', 'text'];
    const currentIndex = viewers.indexOf(viewerType);
    const nextIndex = (currentIndex + 1) % viewers.length;
    setViewerType(viewers[nextIndex]);
  };

  // Usar fallback automático se o navegador não suportar visualização direta de PDF
  useEffect(() => {
    // Verificar se o navegador é o Safari (que tem problemas com PDFs)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Verificar se é um dispositivo móvel
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Verificar se o navegador é Chrome, Edge ou Firefox (que geralmente suportam PDF)
    const isChrome = /chrome/i.test(navigator.userAgent) && !/edge/i.test(navigator.userAgent);
    const isEdge = /edg/i.test(navigator.userAgent);
    const isFirefox = /firefox/i.test(navigator.userAgent);

    // Registrar informações para debug
    console.log('Informações do navegador:', {
      isSafari,
      isMobile,
      isChrome,
      isEdge,
      isFirefox,
      userAgent: navigator.userAgent
    });

    // Escolher o visualizador mais adequado com base no navegador
    if (isMobile || isSafari) {
      // Usar Google Docs Viewer para dispositivos móveis e Safari
      console.log('Usando Google Docs Viewer para dispositivo móvel ou Safari');
      setViewerType('google');
    } else if (isChrome || isEdge) {
      // Usar visualização direta para Chrome e Edge
      console.log('Usando visualização direta para Chrome ou Edge');
      setViewerType('direct');
    } else if (isFirefox) {
      // Usar object para Firefox
      console.log('Usando object para Firefox');
      setViewerType('object');
    } else {
      // Fallback para Google Docs Viewer
      console.log('Usando Google Docs Viewer como fallback');
      setViewerType('google');
    }
  }, []);

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
          href={getNormalizedPath()}
          download
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          {t('viewer.downloadView', 'Baixar e visualizar localmente')}
        </a>
      </div>
    );
  }

  // Usar o Google Docs Viewer como uma solução confiável para visualizar PDFs
  const googleDocsViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(getNormalizedPath())}&embedded=true`;

  // URL alternativa para o Microsoft Office Online Viewer como fallback
  const officeOnlineViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(getNormalizedPath())}`;

  // URL para o PDF.js viewer (mais compatível)
  // Como não temos o PDF.js instalado, vamos usar o viewer do Mozilla
  const pdfJsViewerUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(getNormalizedPath())}`;

  const normalizedPath = getNormalizedPath();

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 relative">
        {viewerType === 'direct' && (
          <div className="w-full h-full">
            <iframe
              src={normalizedPath}
              className="w-full h-full border-0"
              title="PDF Viewer Direct"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
              loading="lazy"
              onError={handleIframeError}
            />
          </div>
        )}

        {viewerType === 'object' && (
          <div className="w-full h-full">
            <object
              data={normalizedPath}
              type="application/pdf"
              className="w-full h-full border-0"
            >
              <p className="text-center p-4">
                {t('viewer.pdfNotSupported', 'Seu navegador não suporta a visualização de PDF.')}
                <br />
                <a
                  href={normalizedPath}
                  download
                  className="text-blue-600 hover:underline"
                >
                  {t('viewer.downloadView', 'Baixar e visualizar localmente')}
                </a>
              </p>
            </object>
          </div>
        )}

        {viewerType === 'google' && (
          <iframe
            src={googleDocsViewerUrl}
            className="w-full h-full border-0"
            title="PDF Viewer Google"
            loading="lazy"
          />
        )}

        {viewerType === 'pdfjs' && (
          <iframe
            src={pdfJsViewerUrl}
            className="w-full h-full border-0"
            title="PDF.js Viewer"
            loading="lazy"
          />
        )}

        {viewerType === 'office' && (
          <iframe
            src={officeOnlineViewerUrl}
            className="w-full h-full border-0"
            title="Office Online Viewer"
            loading="lazy"
          />
        )}

        {viewerType === 'text' && (
          <div className="w-full h-full bg-white p-6 overflow-auto">
            <TextContentViewer filePath={normalizedPath.replace(/\.pdf$/i, '.txt')} />
          </div>
        )}

        {/* Botão de alternância de visualizador */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={toggleViewer}
            className="flex items-center px-3 py-2 bg-gray-800 bg-opacity-70 text-white rounded-md hover:bg-opacity-90 transition-colors shadow-lg"
            title={t('viewer.changeViewer', 'Alternar visualizador')}
          >
            <FiRefreshCw className="mr-2" />
            {viewerType === 'direct'
              ? t('viewer.direct', 'Direto')
              : viewerType === 'object'
                ? t('viewer.object', 'Objeto')
                : viewerType === 'google'
                  ? t('viewer.google', 'Google')
                  : viewerType === 'pdfjs'
                    ? t('viewer.pdfjs', 'PDF.js')
                    : t('viewer.office', 'Office')}
          </button>
        </div>

        {/* Botão de download flutuante */}
        <div className="absolute bottom-4 right-4 z-20">
          <a
            href={normalizedPath}
            download
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-lg"
            title={t('viewer.download', 'Baixar documento')}
          >
            <FiDownload className="mr-2" />
            {t('viewer.download', 'Baixar')}
          </a>
        </div>
      </div>
    </div>
  );
};

export default PdfJsViewer;
