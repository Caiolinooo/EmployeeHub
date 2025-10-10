'use client';

import React, { useState, useEffect } from 'react';
import { FiLoader, FiAlertCircle, FiDownload, FiZoomIn, FiZoomOut } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface PdfImageViewerProps {
  filePath: string;
}

const PdfImageViewer: React.FC<PdfImageViewerProps> = ({ filePath }) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  
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
  
  // Função para gerar URLs de imagens a partir do PDF
  useEffect(() => {
    const generateImageUrls = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Verificar se o arquivo existe
        const pdfPath = getNormalizedPath();
        const response = await fetch(pdfPath, { method: 'HEAD' });
        
        if (!response.ok) {
          throw new Error({t('components.arquivoNaoEncontradoResponsestatus')});
        }
        
        // Para este exemplo, vamos simular a conversão de PDF para imagens
        // Em um ambiente de produção, você precisaria de um serviço de backend para converter PDF em imagens
        
        // Verificar se existem imagens pré-renderizadas do PDF
        const basePath = pdfPath.replace('.pdf', '');
        const urls: string[] = [];
        
        // Tentar carregar imagens pré-renderizadas (page-1.png, page-2.png, etc.)
        // Se não existirem, usar um fallback para o PDF original
        try {
          // Simular 3 páginas para este exemplo
          for (let i = 1; i <= 3; i++) {
            const imgPath = `${basePath}-page-${i}.png`;
            const imgResponse = await fetch(imgPath, { method: 'HEAD' });
            
            if (imgResponse.ok) {
              urls.push(imgPath);
            }
          }
        } catch (err) {
          console.log(t('components.erroAoVerificarImagensPrerenderizadas'), err);
        }
        
        // Se não encontrou imagens pré-renderizadas, usar o PDF original
        if (urls.length === 0) {
          // Usar o PDF original como fallback
          urls.push(pdfPath);
        }
        
        setImageUrls(urls);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao gerar URLs de imagens:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        setLoading(false);
      }
    };
    
    generateImageUrls();
  }, [filePath]);
  
  // Funções para navegação e zoom
  const nextPage = () => {
    if (currentPage < imageUrls.length) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const zoomIn = () => {
    setZoom(Math.min(zoom + 25, 200));
  };
  
  const zoomOut = () => {
    setZoom(Math.max(zoom - 25, 50));
  };
  
  // Renderizar o componente
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
  
  return (
    <div className="h-full w-full flex flex-col">
      {/* Barra de ferramentas */}
      <div className="bg-gray-100 p-2 flex items-center justify-between border-b">
        <div className="flex items-center space-x-2">
          <button
            onClick={prevPage}
            disabled={currentPage === 1}
            className={`px-3 py-1 rounded ${
              currentPage === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            &lt; {t('viewer.prev', 'Anterior')}
          </button>
          
          <span className="text-sm">
            {t('viewer.page', 'Página')} {currentPage} {t('viewer.of', 'de')} {imageUrls.length}
          </span>
          
          <button
            onClick={nextPage}
            disabled={currentPage === imageUrls.length}
            className={`px-3 py-1 rounded ${
              currentPage === imageUrls.length ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t('viewer.next', 'Próxima')} &gt;
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={zoomOut}
            className="p-1 rounded bg-white text-gray-700 hover:bg-gray-50"
            title={t('viewer.zoomOut', 'Diminuir zoom')}
          >
            <FiZoomOut />
          </button>
          
          <span className="text-sm">{zoom}%</span>
          
          <button
            onClick={zoomIn}
            className="p-1 rounded bg-white text-gray-700 hover:bg-gray-50"
            title={t('viewer.zoomIn', 'Aumentar zoom')}
          >
            <FiZoomIn />
          </button>
          
          <a
            href={getNormalizedPath()}
            download
            className="ml-2 px-3 py-1 rounded bg-white text-gray-700 hover:bg-gray-50 flex items-center"
            title={t('viewer.download', 'Baixar documento')}
          >
            <FiDownload className="mr-1" />
            {t('viewer.download', 'Baixar')}
          </a>
        </div>
      </div>
      
      {/* Área de visualização */}
      <div className="flex-1 overflow-auto bg-gray-200 flex items-center justify-center p-4">
        <div 
          className="bg-white shadow-lg p-2 transition-transform duration-200"
          style={{ 
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'center center'
          }}
        >
          {imageUrls.length > 0 && (
            imageUrls[0].endsWith('.pdf') ? (
              // Se for um PDF, usar um iframe como fallback
              <iframe
                src={imageUrls[0]}
                className="w-full h-full border-0"
                style={{ minWidth: '800px', minHeight: '1000px' }}
                title="PDF Viewer"
              />
            ) : (
              // Se for uma imagem, mostrar a imagem
              <img
                src={imageUrls[currentPage - 1]}
                alt={{t('components.paginaCurrentpage')}}
                className="max-w-full"
                style={{ maxHeight: '80vh' }}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfImageViewer;
