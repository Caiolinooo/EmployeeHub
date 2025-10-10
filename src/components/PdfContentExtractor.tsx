'use client';

import React, { useState, useEffect } from 'react';
import { FiLoader, FiAlertCircle } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface PdfContentExtractorProps {
  filePath: string;
}

const PdfContentExtractor: React.FC<PdfContentExtractorProps> = ({ filePath }) => {
  const { t } = useI18n();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const extractPdfContent = async () => {
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

          // Construir URL completa para verificação
          const fullPath = `${window.location.origin}${normalizedPath}`;

          console.log(t('components.verificandoArquivoPdfParaExtracao'), fullPath);

          // Verificar se o arquivo existe
          const fileCheckResponse = await fetch(fullPath, {
            method: 'HEAD',
            cache: 'no-cache'
          });

          if (!fileCheckResponse.ok) {
            throw new Error(`${t('viewer.fileNotFound', 'Arquivo não encontrado')}: ${fileCheckResponse.status} ${fileCheckResponse.statusText}`);
          }
        } else {
          // Para URLs externas, verificar diretamente
          const fileCheckResponse = await fetch(normalizedPath, {
            method: 'HEAD',
            cache: 'no-cache'
          });

          if (!fileCheckResponse.ok) {
            throw new Error(`${t('viewer.fileNotFound', 'Arquivo não encontrado')}: ${fileCheckResponse.status} ${fileCheckResponse.statusText}`);
          }
        }

        // Extrair conteúdo do PDF usando a API
        const response = await fetch(`/api/pdf-extract?url=${encodeURIComponent(normalizedPath)}`);

        if (!response.ok) {
          throw new Error(`${t('viewer.extractError', 'Erro ao extrair conteúdo')}: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setContent(data.content || t('viewer.noContent', 'Nenhum conteúdo extraído.'));
      } catch (err) {
        console.error(t('components.erroAoExtrairConteudoDoPdf'), err);
        setError(err instanceof Error ? err.message : t('viewer.extractError', 'Erro desconhecido ao extrair conteúdo do PDF'));
      } finally {
        setLoading(false);
      }
    };

    if (filePath) {
      extractPdfContent();
    }
  }, [filePath, t]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <FiLoader className="animate-spin h-8 w-8 text-abz-blue mb-4" />
        <p className="text-gray-600">{t('viewer.extracting', 'Extraindo conteúdo do documento...')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <FiAlertCircle className="h-8 w-8 text-red-500 mb-4" />
        <p className="text-red-600 font-medium mb-2">{t('viewer.extractError', 'Erro ao extrair conteúdo')}</p>
        <p className="text-gray-600 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="prose max-w-none">
        {content.split('\n').map((paragraph, index) => (
          paragraph.trim() ? (
            <p key={index} className="mb-4">{paragraph}</p>
          ) : (
            <br key={index} />
          )
        ))}
      </div>
    </div>
  );
};

export default PdfContentExtractor;
