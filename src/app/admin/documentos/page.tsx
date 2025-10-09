'use client';

import React, { useState } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import FileExplorer from '@/components/FileExplorer';
import { FiFile, FiDownload, FiEye, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import MultiPdfViewer from '@/components/MultiPdfViewer';
import { toast } from 'react-hot-toast';

export default function DocumentsAdminPage() {
  const { t } = useI18n();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  // const [currentFolder, setCurrentFolder] = useState<string>(''); // Removido - não utilizado
  const [viewerOpen, setViewerOpen] = useState<boolean>(false);
  const [isConverting, setIsConverting] = useState<boolean>(false);

  // Função para lidar com a seleção de arquivo
  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
  };

  // Função para lidar com a seleção de pasta
  const handleFolderSelect = (folderPath: string) => {
    // setCurrentFolder(folderPath); // Removido - variável não existe
    console.log('Pasta selecionada:', folderPath);
  };

  // Função para abrir o visualizador
  const openViewer = () => {
    if (selectedFile) {
      setViewerOpen(true);
    }
  };

  // Função para fechar o visualizador
  const closeViewer = () => {
    setViewerOpen(false);
  };

  // Função para obter o nome do arquivo a partir do caminho
  const getFileName = (filePath: string) => {
    if (!filePath) return '';
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  };

  // Função para converter PDFs para texto
  const convertPDFs = async () => {
    setIsConverting(true);
    toast.loading(t('admin.documents.converting', 'Convertendo PDFs para texto...'));

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('abzToken');

      if (!token) {
        throw new Error('Não autorizado');
      }

      const response = await fetch('/api/documents/convert', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao converter PDFs');
      }

      const data = await response.json();
      toast.dismiss();
      toast.success(t('admin.documents.convertSuccess', 'PDFs convertidos com sucesso!'));
      console.log('Resultado da conversão:', data);
    } catch (error) {
      console.error('Erro ao converter PDFs:', error);
      toast.dismiss();
      toast.error(t('admin.documents.convertError', 'Erro ao converter PDFs. Tente novamente.'));
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-abz-text-black mb-6">
          {t('admin.documents.title', 'Gerenciamento de Documentos')}
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <p className="text-gray-700 mb-4">
            {t('admin.documents.description', 'Gerencie os documentos do sistema. Você pode navegar pelas pastas, visualizar, fazer upload e organizar os documentos.')}
          </p>

          <div className="flex justify-end mb-4">
            <button
              onClick={convertPDFs}
              disabled={isConverting}
              className={`flex items-center px-4 py-2 rounded-md text-white ${isConverting ? 'bg-gray-400 cursor-not-allowed' : 'bg-abz-blue hover:bg-opacity-90'}`}
            >
              <FiRefreshCw className={`mr-2 ${isConverting ? 'animate-spin' : ''}`} />
              {t('admin.documents.convertPDFs', 'Converter PDFs para texto')}
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Explorador de arquivos */}
            <div className="w-full md:w-2/3">
              <FileExplorer
                basePath="public/documentos"
                onFileSelect={handleFileSelect}
                onFolderSelect={handleFolderSelect}
                allowUpload={true}
                allowCreateFolder={true}
                fileFilter={['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt']}
                showFullPath={false}
              />
            </div>

            {/* Painel de detalhes */}
            <div className="w-full md:w-1/3">
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="bg-gray-50 p-3 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    {t('admin.documents.details', 'Detalhes')}
                  </h3>
                </div>

                <div className="p-4">
                  {selectedFile ? (
                    <div>
                      <div className="flex items-center mb-4">
                        <div className="bg-abz-light-blue p-3 rounded-full mr-3">
                          <FiFile className="text-abz-blue w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-abz-text-black">{getFileName(selectedFile)}</h4>
                          <p className="text-sm text-gray-500">{selectedFile}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-4">
                        <button
                          onClick={openViewer}
                          className="flex items-center px-3 py-2 bg-abz-blue text-white rounded-md hover:bg-opacity-90 transition-colors"
                        >
                          <FiEye className="mr-1" />
                          {t('common.view', 'Visualizar')}
                        </button>

                        <a
                          href={`/${selectedFile}`}
                          download
                          className="flex items-center px-3 py-2 bg-gray-100 text-abz-text-dark rounded-md hover:bg-gray-200 transition-colors"
                        >
                          <FiDownload className="mr-1" />
                          {t('common.download', 'Download')}
                        </a>
                        <button
                          onClick={() => { navigator.clipboard.writeText(`/${selectedFile}`); toast.success(t('admin.documents.copied','Caminho copiado!') as string); }}
                          className="flex items-center px-3 py-2 bg-gray-100 text-abz-text-dark rounded-md hover:bg-gray-200 transition-colors"
                        >
                          {t('common.copy', 'Copiar caminho')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>{t('admin.documents.noFileSelected', 'Nenhum arquivo selecionado')}</p>
                      <p className="text-sm mt-2">{t('admin.documents.selectFileInstruction', 'Selecione um arquivo no explorador para ver os detalhes')}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md overflow-hidden mt-4">
                <div className="bg-gray-50 p-3 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    {t('admin.documents.help', 'Ajuda')}
                  </h3>
                </div>

                <div className="p-4">
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start">
                      <FiPlus className="mt-0.5 mr-2 text-green-600" />
                      <span>{t('admin.documents.helpCreateFolder', 'Clique no ícone de pasta com "+" para criar uma nova pasta')}</span>
                    </li>
                    <li className="flex items-start">
                      <FiEye className="mt-0.5 mr-2 text-blue-600" />
                      <span>{t('admin.documents.helpView', 'Clique em "Visualizar" para abrir o documento no visualizador')}</span>
                    </li>
                    <li className="flex items-start">
                      <FiDownload className="mt-0.5 mr-2 text-gray-600" />
                      <span>{t('admin.documents.helpDownload', 'Clique em "Download" para baixar o documento')}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visualizador de documento */}
      {viewerOpen && selectedFile && (
        <MultiPdfViewer
          title={getFileName(selectedFile)}
          filePath={`/${selectedFile}`}
          onClose={closeViewer}
        />
      )}
    </MainLayout>
  );
}

