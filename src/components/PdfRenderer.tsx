'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FiLoader, FiAlertCircle, FiZoomIn, FiZoomOut, FiRotateCw } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface PdfRendererProps {
  filePath: string;
  viewMode?: 'fitH' | 'fitV' | 'fitB';
}

const PdfRenderer: React.FC<PdfRendererProps> = ({ filePath, viewMode = 'fitH' }) => {
  const { t } = useI18n();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  // Verificar se o arquivo existe e carregar o PDF
  useEffect(() => {
    const checkFileAndLoad = async () => {
      setLoading(true);
      setError(null);

      try {
        // Normalizar o caminho do arquivo
        let normalizedPath = filePath;

        // Se o caminho não começar com http ou https, considerar como caminho relativo
        if (!filePath.startsWith('http://') && !filePath.startsWith('https://')) {
          // Garantir que o caminho comece com /
          if (!filePath.startsWith('/')) {
            normalizedPath = `/${filePath}`;
          }

          // Construir URL completa
          normalizedPath = `${window.location.origin}${normalizedPath}`;
        }

        console.log('Verificando arquivo PDF:', normalizedPath);

        // Verificar se o arquivo existe
        const response = await fetch(normalizedPath, {
          method: 'HEAD',
          // Adicionar cache: 'no-cache' para evitar problemas de cache
          cache: 'no-cache'
        });

        if (!response.ok) {
          throw new Error(`${t('viewer.fileNotFound', 'Arquivo não encontrado')}: ${response.status} ${response.statusText}`);
        }

        // Arquivo existe, continuar carregamento
        setLoading(false);
      } catch (err) {
        console.error('Erro ao verificar arquivo PDF:', err);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    };

    checkFileAndLoad();
  }, [filePath, t]);

  // Aplicar zoom ao container do PDF
  useEffect(() => {
    if (iframeRef.current && !loading && !error) {
      const applyZoom = () => {
        try {
          const iframe = iframeRef.current;
          const scale = zoom / 100;
          const transformOrigin = 'top center';
          const transform = `scale(${scale}) rotate(${rotation}deg)`;

          // Tentar aplicar transformação ao iframe
          if (iframe) {
            // Encontrar o elemento pai que contém todos os elementos de visualização
            const container = iframe.parentElement;
            if (container) {
              container.style.transformOrigin = transformOrigin;
              container.style.transform = transform;
            }

            // Tentar aplicar ao documento dentro do iframe
            try {
              if (iframe.contentDocument && iframe.contentDocument.body) {
                iframe.contentDocument.body.style.transformOrigin = transformOrigin;
                iframe.contentDocument.body.style.transform = transform;
              }
            } catch (innerErr) {
              console.log({t('components.naoFoiPossivelAplicarZoomAoConteudoDoIframe')}, innerErr);
            }
          }
        } catch (err) {
          console.error('Erro ao aplicar zoom:', err);
        }
      };

      // Tentar aplicar zoom após o carregamento
      const iframe = iframeRef.current;
      if (iframe) {
        iframe.onload = applyZoom;

        // Também tentar aplicar após um curto atraso
        setTimeout(applyZoom, 500);
        // E tentar novamente após um atraso maior para garantir que o PDF foi carregado
        setTimeout(applyZoom, 1500);
      }
    }
  }, [zoom, rotation, loading, error]);

  // Funções de controle
  const zoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const zoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const rotate = () => setRotation(prev => (prev + 90) % 360);

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

  // Normalizar o caminho do arquivo para o iframe
  const getNormalizedPath = () => {
    // Se o caminho não começar com http ou https, considerar como caminho relativo
    if (!filePath.startsWith('http://') && !filePath.startsWith('https://')) {
      // Garantir que o caminho comece com /
      let normalizedPath = filePath;
      if (!filePath.startsWith('/')) {
        normalizedPath = `/${filePath}`;
      }

      // Construir URL completa para garantir compatibilidade em todos os navegadores
      if (typeof window !== 'undefined') {
        return `${window.location.origin}${normalizedPath}`;
      }

      return normalizedPath;
    }
    return filePath;
  };

  return (
    <div className="relative h-full w-full flex flex-col">
      {/* Controles de zoom e rotação */}
      <div className="absolute top-2 right-2 z-10 flex items-center space-x-1 bg-white bg-opacity-80 rounded-md p-1 shadow-sm">
        <button
          onClick={zoomIn}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-700"
          title={t('viewer.zoomIn', 'Aumentar zoom')}
        >
          <FiZoomIn className="h-5 w-5" />
        </button>
        <div className="text-xs font-medium text-gray-700 px-1">{zoom}%</div>
        <button
          onClick={zoomOut}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-700"
          title={t('viewer.zoomOut', 'Diminuir zoom')}
        >
          <FiZoomOut className="h-5 w-5" />
        </button>
        <button
          onClick={rotate}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-700"
          title={t('viewer.rotate', 'Girar')}
        >
          <FiRotateCw className="h-5 w-5" />
        </button>
      </div>

      {/* Abordagem híbrida para renderizar o PDF de forma mais confiável */}
      <div className="w-full h-full relative">
        {/* Iframe como método principal */}
        <iframe
          ref={iframeRef}
          src={`${getNormalizedPath()}#view=${viewMode}&toolbar=1&navpanes=1`}
          className="w-full h-full border-0 absolute inset-0 z-10"
          style={{ display: 'block' }}
          title="PDF Viewer"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
          loading="lazy"
        />

        {/* Objeto como fallback */}
        <object
          data={`${getNormalizedPath()}#view=${viewMode}&toolbar=1&navpanes=1`}
          type="application/pdf"
          className="w-full h-full absolute inset-0 z-0"
        >
          <div className="flex flex-col items-center justify-center h-full">
            <FiAlertCircle className="h-10 w-10 text-yellow-500 mb-4" />
            <p className="text-gray-800 mb-2">{t('viewer.browserNotSupported', 'Seu navegador não suporta visualização de PDF')}</p>
            <p className="text-sm text-gray-600 mb-4">{t('viewer.downloadPrompt', 'Por favor, baixe o documento para visualizá-lo')}</p>
            <a
              href={getNormalizedPath()}
              download
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {t('viewer.downloadPdf', 'Baixar PDF')}
            </a>
          </div>
        </object>

        {/* Embed como terceira opção */}
        <embed
          src={`${getNormalizedPath()}#view=${viewMode}&toolbar=1&navpanes=1`}
          type="application/pdf"
          className="w-full h-full absolute inset-0 z-5"
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

export default PdfRenderer;
