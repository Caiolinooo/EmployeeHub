'use client';

import React, { useState, useEffect } from 'react';
import { FiLoader, FiAlertCircle } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import '@/styles/pdf-viewer.css';

interface TextContentViewerProps {
  filePath: string;
}

const TextContentViewer: React.FC<TextContentViewerProps> = ({ filePath }) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('Buscando conteúdo do arquivo:', filePath);

        const response = await fetch(filePath, {
          cache: 'no-cache'
        });

        if (!response.ok) {
          throw new Error(`${t('viewer.fileNotFound', 'Arquivo não encontrado')}: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        setContent(text);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao buscar conteúdo do arquivo:', err);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    };

    fetchContent();
  }, [filePath, t]);

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
      </div>
    );
  }

  // Função para processar o texto e identificar estruturas como parágrafos, títulos, etc.
  const processText = (text: string) => {
    // Pré-processamento para remover caracteres de controle e normalizar espaços
    const cleanText = text.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '')
                          .replace(/\r\n/g, '\n')
                          .replace(/\r/g, '\n')
                          .replace(/\n{3,}/g, '\n\n'); // Limitar quebras de linha consecutivas

    // Dividir o texto em linhas
    const lines = cleanText.split('\n');

    // Analisar o texto para identificar estruturas
    const processedLines = [];
    let currentParagraph = [];
    let inTable = false;
    let tableRows: any[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Verificar se é um possível título (linha curta, com texto, seguida ou precedida por linha em branco)
      const isTitle = trimmedLine.length > 0 &&
                     trimmedLine.length < 100 &&
                     trimmedLine.match(/[A-Z]/) && // Contém pelo menos uma letra maiúscula
                     (i === 0 || lines[i-1].trim() === '') &&
                     (i === lines.length - 1 || lines[i+1].trim() === '');

      // Verificar se é um possível subtítulo
      const isSubtitle = trimmedLine.length > 0 &&
                        trimmedLine.length < 80 &&
                        !isTitle &&
                        trimmedLine.match(/^[0-9.]*\s*[A-Z]/) && // Começa com número ou letra maiúscula
                        (i === 0 || lines[i-1].trim() !== '') &&
                        (i === lines.length - 1 || lines[i+1].trim() !== '');

      // Verificar se é uma lista (começa com - ou • ou número seguido de ponto)
      const isList = trimmedLine.match(/^(\s*[-•*]\s+|\s*\d+[.)]\s+)/);

      // Desativamos a detecção automática de tabelas para evitar formatação indesejada
      // Apenas detectaremos tabelas se tiverem um formato muito específico
      const isTableRow = false; // Desativado para evitar tabelas indesejadas

      // Processar a linha com base no tipo identificado
      if (isTitle) {
        // Finalizar parágrafo atual se existir
        if (currentParagraph.length > 0) {
          processedLines.push({ type: 'paragraph', content: currentParagraph.join(' ') });
          currentParagraph = [];
        }

        processedLines.push({ type: 'title', content: trimmedLine });
      }
      else if (isSubtitle) {
        // Finalizar parágrafo atual se existir
        if (currentParagraph.length > 0) {
          processedLines.push({ type: 'paragraph', content: currentParagraph.join(' ') });
          currentParagraph = [];
        }

        processedLines.push({ type: 'subtitle', content: trimmedLine });
      }
      else if (isList) {
        // Finalizar parágrafo atual se existir
        if (currentParagraph.length > 0) {
          processedLines.push({ type: 'paragraph', content: currentParagraph.join(' ') });
          currentParagraph = [];
        }

        processedLines.push({ type: 'list-item', content: trimmedLine });
      }
      else if (isTableRow) {
        // Finalizar parágrafo atual se existir
        if (currentParagraph.length > 0) {
          processedLines.push({ type: 'paragraph', content: currentParagraph.join(' ') });
          currentParagraph = [];
        }

        // Iniciar nova tabela ou adicionar à tabela atual
        if (!inTable) {
          inTable = true;
          tableRows = [trimmedLine];
        } else {
          tableRows.push(trimmedLine);
        }

        // Se a próxima linha não for uma linha de tabela, finalizar a tabela
        if (i === lines.length - 1 || !lines[i+1].trim().match(/\S+(\s{2,}|\t)\S+/)) {
          processedLines.push({ type: 'table', content: tableRows });
          inTable = false;
          tableRows = [];
        }
      }
      else if (trimmedLine === '') {
        // Finalizar parágrafo atual se existir
        if (currentParagraph.length > 0) {
          processedLines.push({ type: 'paragraph', content: currentParagraph.join(' ') });
          currentParagraph = [];
        }

        // Adicionar espaço em branco apenas se não for seguido por outro espaço em branco
        if (i < lines.length - 1 && lines[i+1].trim() !== '') {
          processedLines.push({ type: 'space' });
        }
      }
      else {
        // Linha normal, adicionar ao parágrafo atual
        if (trimmedLine.length > 0) {
          currentParagraph.push(trimmedLine);
        }

        // Se a próxima linha estiver em branco ou for um título/lista, finalizar o parágrafo
        if (i === lines.length - 1 ||
            lines[i+1].trim() === '' ||
            lines[i+1].trim().match(/^(\s*[-•*]\s+|\s*\d+[.)]\s+)/) ||
            (lines[i+1].trim().length > 0 && lines[i+1].trim().length < 100 &&
             (i+1 === lines.length - 1 || lines[i+2].trim() === ''))) {

          if (currentParagraph.length > 0) {
            processedLines.push({ type: 'paragraph', content: currentParagraph.join(' ') });
            currentParagraph = [];
          }
        }
      }
    }

    // Finalizar qualquer parágrafo pendente
    if (currentParagraph.length > 0) {
      processedLines.push({ type: 'paragraph', content: currentParagraph.join(' ') });
    }

    return processedLines;
  };

  // Função para renderizar o conteúdo processado
  const renderProcessedContent = (processedLines: any[]) => {
    return processedLines.map((item, index) => {
      switch (item.type) {
        case 'title':
          return <h1 key={index} className="text-2xl font-bold my-4 text-gray-800">{item.content}</h1>;

        case 'subtitle':
          return <h2 key={index} className="text-xl font-semibold my-3 text-gray-700">{item.content}</h2>;

        case 'paragraph':
          return <p key={index} className="my-2 leading-relaxed">{item.content}</p>;

        case 'list-item':
          return <div key={index} className="ml-6 my-1">{item.content}</div>;

        case 'space':
          return <div key={index} className="h-4"></div>;

        case 'table':
          // Renderizar tabela simples
          return (
            <div key={index} className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-gray-300">
                <tbody>
                  {item.content.map((row: string, rowIndex: number) => {
                    const cells = row.split(/\s{2,}|\t/).filter(cell => cell.trim().length > 0);
                    return (
                      <tr key={rowIndex} className={rowIndex === 0 ? "bg-gray-100" : ""}>
                        {cells.map((cell: string, cellIndex: number) => {
                          const CellTag = rowIndex === 0 ? 'th' : 'td';
                          return (
                            <CellTag key={cellIndex} className="border border-gray-300 px-4 py-2 text-sm">
                              {cell.trim()}
                            </CellTag>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );

        default:
          return null;
      }
    });
  };

  // Processar e renderizar o conteúdo
  const processedContent = processText(content);

  return (
    <div className="pdf-container">
      <div className="pdf-page">
        <div className="pdf-content">
          {renderProcessedContent(processedContent)}
        </div>
      </div>
    </div>
  );
};

export default TextContentViewer;
