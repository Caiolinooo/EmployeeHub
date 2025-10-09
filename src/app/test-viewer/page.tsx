'use client';

import React, { useState } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { FiFileText, FiDownload, FiEye } from 'react-icons/fi';
import MultiPdfViewer from '@/components/MultiPdfViewer';
import { useI18n } from '@/contexts/I18nContext';

export default function TestViewerPage() {
  const { t } = useI18n();
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

  // Lista de documentos para testar
  const documents = [
    {
      id: 'politica-hse',
      title: 'Política de HSE',
      file: '/documentos/politicas/PL-HSE-R0 - Política de HSE_ABZ Group-PORT.pdf'
    },
    {
      id: 'politica-qualidade',
      title: 'Política da Qualidade',
      file: '/documentos/politicas/PL-QUA-R8 - Politica da Qualidade_ABZ Group-PORT.pdf'
    },
    {
      id: 'quality-policy',
      title: 'Quality Policy',
      file: '/documentos/politicas/PL-QUA-a-R8 - Quality Policy_ABZ Group-ENG.pdf'
    },
    {
      id: 'manual-logistica',
      title: 'Manual de Logística',
      file: '/documentos/manuais/Manual de logística.pdf'
    },
    {
      id: 'manual-ponto',
      title: 'Manual de Uso Ponto Ahgora',
      file: '/documentos/manuais/Manual de Uso Ponto Ahgora.pdf'
    },
    {
      id: 'procedimento-logistica',
      title: 'Revisão de procedimento de logistica',
      file: '/documentos/procedimentos/Revisão de procedimento de logistica.pdf'
    },
    {
      id: 'noticia-exemplo-1',
      title: 'Exemplo de Notícia 1',
      file: '/documentos/noticias/exemplo-noticia-1.pdf'
    },
    {
      id: 'noticia-exemplo-2',
      title: 'Exemplo de Notícia 2',
      file: '/documentos/noticias/exemplo-noticia-2.pdf'
    }
  ];

  // Função para abrir o visualizador
  const openViewer = (documentId: string) => {
    setSelectedDocument(documentId);
  };

  // Função para fechar o visualizador
  const closeViewer = () => {
    setSelectedDocument(null);
  };

  // Encontrar o documento selecionado
  const selectedDocumentDetails = documents.find(doc => doc.id === selectedDocument);

  return (
    <MainLayout>
      <h1 className="text-3xl font-bold text-abz-text-black mb-6">Teste de Visualizador de PDF</h1>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">Instruções</h2>
        <p className="mb-4">
          Esta página permite testar o visualizador de PDF com diferentes documentos.
          Clique em "Visualizar" para abrir o documento no visualizador.
        </p>
        <p className="mb-4">
          O visualizador tentará usar diferentes métodos para exibir o PDF:
        </p>
        <ol className="list-decimal pl-6 mb-4 space-y-2">
          <li>Visualização direta (embed)</li>
          <li>Visualização com object tag</li>
          <li>Visualização com iframe</li>
          <li>Visualização com Google Docs Viewer</li>
          <li>Visualização com Microsoft Office Viewer</li>
        </ol>
        <p>
          Se um método falhar, o visualizador tentará o próximo automaticamente.
          Você também pode alternar entre os métodos clicando no botão de atualização no canto superior direito do visualizador.
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Documentos para Teste</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((document) => (
            <div
              key={document.id}
              className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start mb-3">
                <div className="bg-abz-light-blue p-3 rounded-full mr-3">
                  <FiFileText className="text-abz-blue w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-abz-text-black">{document.title}</h3>
                  <p className="text-sm text-gray-500">{document.id}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => openViewer(document.id)}
                  className="flex items-center px-3 py-2 bg-abz-blue text-white rounded-md hover:bg-opacity-90 transition-colors"
                >
                  <FiEye className="mr-1" />
                  Visualizar
                </button>
                <a
                  href={document.file}
                  download
                  className="flex items-center px-3 py-2 bg-gray-100 text-abz-text-dark rounded-md hover:bg-gray-200 transition-colors"
                >
                  <FiDownload className="mr-1" />
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visualizador de documento */}
      {selectedDocument && selectedDocumentDetails && (
        <MultiPdfViewer
          title={selectedDocumentDetails.title}
          filePath={selectedDocumentDetails.file}
          onClose={closeViewer}
        />
      )}
    </MainLayout>
  );
}

