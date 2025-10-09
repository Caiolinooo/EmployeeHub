'use client';

import React, { useState } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { FiFileText, FiDownload, FiEye, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import EnhancedPdfViewer from '@/components/EnhancedPdfViewer';

export default function TestPdfPage() {
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Lista de documentos para testar
  const documents = [
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
    }
  ];

  // Função para testar se um documento está acessível
  const testDocument = async (doc: { id: string, file: string }) => {
    setLoading(prev => ({ ...prev, [doc.id]: true }));
    setErrors(prev => ({ ...prev, [doc.id]: '' }));

    try {
      const response = await fetch(doc.file, { method: 'HEAD' });
      setTestResults(prev => ({ ...prev, [doc.id]: response.ok }));

      if (!response.ok) {
        setErrors(prev => ({
          ...prev,
          [doc.id]: `Erro ${response.status}: ${response.statusText}`
        }));
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, [doc.id]: false }));
      setErrors(prev => ({
        ...prev,
        [doc.id]: `Erro ao acessar: ${error instanceof Error ? error.message : String(error)}`
      }));
    } finally {
      setLoading(prev => ({ ...prev, [doc.id]: false }));
    }
  };

  // Testar todos os documentos
  const testAllDocuments = () => {
    documents.forEach(doc => testDocument(doc));
  };

  // Abrir o visualizador de documentos
  const openViewer = (docId: string) => {
    setSelectedDocument(docId);
  };

  // Fechar o visualizador de documentos
  const closeViewer = () => {
    setSelectedDocument(null);
  };

  // Encontrar o documento selecionado
  const selectedDoc = documents.find(doc => doc.id === selectedDocument);

  return (
    <MainLayout>
      <h1 className="text-3xl font-bold text-abz-text-black mb-4">Teste de Visualização de PDFs</h1>
      <p className="text-gray-600 mb-6">Esta página permite testar a visualização de documentos PDF.</p>

      <div className="mb-6 flex justify-between items-center">
        <button
          onClick={testAllDocuments}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Testar Todos os Documentos
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Documentos Disponíveis</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map(doc => (
            <div
              key={doc.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start mb-3">
                <div className="bg-blue-100 p-3 rounded-full mr-3">
                  <FiFileText className="text-blue-600 w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{doc.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{doc.file.split('/').pop()}</p>
                </div>
              </div>

              {/* Status do teste */}
              {doc.id in testResults && (
                <div className={`text-sm p-2 rounded mb-3 flex items-center ${
                  testResults[doc.id] ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {testResults[doc.id] ? (
                    <>
                      <FiCheckCircle className="mr-1" />
                      <span>Documento acessível</span>
                    </>
                  ) : (
                    <>
                      <FiAlertCircle className="mr-1" />
                      <span>{errors[doc.id] || 'Documento não acessível'}</span>
                    </>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => openViewer(doc.id)}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  disabled={loading[doc.id]}
                >
                  <FiEye className="mr-1" />
                  Visualizar
                </button>
                <a
                  href={doc.file}
                  download
                  className="flex items-center px-3 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors"
                >
                  <FiDownload className="mr-1" />
                  Download
                </a>
                <button
                  onClick={() => testDocument(doc)}
                  className="flex items-center px-3 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors"
                  disabled={loading[doc.id]}
                >
                  {loading[doc.id] ? 'Testando...' : 'Testar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Informações de Depuração</h2>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Navegador:</h3>
            <p className="text-sm" id="browser-info">Carregando...</p>
          </div>

          <div>
            <h3 className="font-semibold">Suporte a PDF:</h3>
            <p className="text-sm" id="pdf-support">Verificando...</p>
          </div>

          <div>
            <h3 className="font-semibold">Teste de iframe:</h3>
            <div className="border border-gray-200 rounded-md p-2 h-40 mt-2">
              <iframe
                src="/documentos/politicas/PL-HSE-R0 - Política de HSE_ABZ Group-PORT.pdf"
                className="w-full h-full border-0"
                title="Teste de iframe"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Visualizador de documento */}
      {selectedDoc && (
        <EnhancedPdfViewer
          title={selectedDoc.title}
          filePath={selectedDoc.file}
          onClose={closeViewer}
        />
      )}

      {/* Script para detectar informações do navegador */}
      <script dangerouslySetInnerHTML={{
        __html: `
          document.addEventListener('DOMContentLoaded', function() {
            // Detectar navegador
            const browserInfo = document.getElementById('browser-info');
            const userAgent = navigator.userAgent;
            browserInfo.textContent = userAgent;

            // Verificar suporte a PDF
            const pdfSupport = document.getElementById('pdf-support');

            // Tenta criar um objeto de plugin PDF
            const isPdfSupported =
              navigator.mimeTypes &&
              navigator.mimeTypes['application/pdf'] ?
              'Suportado nativamente' : 'Não suportado nativamente';

            pdfSupport.textContent = isPdfSupported;
          });
        `
      }} />
    </MainLayout>
  );
}

