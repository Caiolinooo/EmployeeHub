'use client';

import React, { useState, useEffect } from 'react';
import { FiFolder, FiFile, FiFolderPlus, FiUpload, FiArrowLeft, FiRefreshCw, FiHome } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface FileExplorerProps {
  basePath: string;
  onFileSelect?: (filePath: string) => void;
  onFolderSelect?: (folderPath: string) => void;
  allowUpload?: boolean;
  allowCreateFolder?: boolean;
  fileFilter?: string[];
  initialPath?: string;
  showFullPath?: boolean;
}

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  lastModified?: string;
}

export default function FileExplorer({
  basePath,
  onFileSelect,
  onFolderSelect,
  allowUpload = false,
  allowCreateFolder = false,
  fileFilter = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'],
  initialPath = '',
  showFullPath = false
}: FileExplorerProps) {
  const { t } = useI18n();
  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [showNewFolderInput, setShowNewFolderInput] = useState<boolean>(false);
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);

  // Função para obter o caminho completo
  const getFullPath = (path: string = '') => {
    return `${basePath}${path ? '/' + path : ''}`;
  };

  // Função para obter o caminho de exibição
  const getDisplayPath = (path: string = '') => {
    return showFullPath ? getFullPath(path) : path;
  };

  // Função para carregar arquivos e pastas
  const loadFiles = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = (typeof window !== 'undefined' && (localStorage.getItem('token') || localStorage.getItem('abzToken'))) || '';
      const response = await fetch(`/api/files?path=${encodeURIComponent(getFullPath(currentPath))}` , {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao carregar arquivos: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro desconhecido ao carregar arquivos');
      }
      
      // Ordenar: primeiro diretórios, depois arquivos, ambos em ordem alfabética
      const sortedFiles = data.files.sort((a: FileItem, b: FileItem) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      
      setFiles(sortedFiles);
    } catch (err) {
      console.error('Erro ao carregar arquivos:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  // Carregar arquivos quando o componente montar ou o caminho mudar
  useEffect(() => {
    loadFiles();
  }, [currentPath]);

  // Função para navegar para uma pasta
  const navigateToFolder = (folderPath: string) => {
    setCurrentPath(folderPath);
    if (onFolderSelect) {
      onFolderSelect(getFullPath(folderPath));
    }
  };

  // Função para navegar para a pasta pai
  const navigateUp = () => {
    if (!currentPath) return;
    
    const pathParts = currentPath.split('/');
    pathParts.pop();
    const parentPath = pathParts.join('/');
    
    navigateToFolder(parentPath);
  };

  // Função para navegar para a pasta raiz
  const navigateToRoot = () => {
    navigateToFolder('');
  };

  // Função para selecionar um arquivo
  const handleFileSelect = (file: FileItem) => {
    if (onFileSelect) {
      onFileSelect(file.path);
    }
  };

  // Função para criar uma nova pasta
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      return;
    }

    try {
      const token = (typeof window !== 'undefined' && (localStorage.getItem('token') || localStorage.getItem('abzToken'))) || '';
      const response = await fetch('/api/files/create-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          path: getFullPath(currentPath),
          folderName: newFolderName.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro ao criar pasta');
      }

      // Limpar o nome da pasta e recarregar os arquivos
      setNewFolderName('');
      setShowNewFolderInput(false);
      loadFiles();
    } catch (err) {
      console.error('Erro ao criar pasta:', err);
      alert(err instanceof Error ? err.message : 'Erro desconhecido ao criar pasta');
    }
  };

  // Função para fazer upload de arquivo
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);

    try {
      const formData = new FormData();
      formData.append('path', getFullPath(currentPath));
      
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const token = (typeof window !== 'undefined' && (localStorage.getItem('token') || localStorage.getItem('abzToken'))) || '';
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro ao fazer upload de arquivo');
      }

      // Recarregar os arquivos
      loadFiles();
    } catch (err) {
      console.error('Erro ao fazer upload de arquivo:', err);
      alert(err instanceof Error ? err.message : 'Erro desconhecido ao fazer upload de arquivo');
    } finally {
      setUploadingFile(false);
      // Limpar o input de arquivo
      e.target.value = '';
    }
  };

  // Função para formatar o tamanho do arquivo
  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined) return 'N/A';
    
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Função para verificar se um arquivo deve ser exibido com base no filtro
  const shouldShowFile = (file: FileItem) => {
    if (file.isDirectory) return true;
    if (!fileFilter || fileFilter.length === 0) return true;
    
    return fileFilter.some(ext => file.name.toLowerCase().endsWith(ext.toLowerCase()));
  };

  // Filtrar arquivos com base no filtro
  const filteredFiles = files.filter(shouldShowFile);

  // Renderizar o caminho de navegação (breadcrumbs)
  const renderBreadcrumbs = () => {
    if (!currentPath) {
      return (
        <div className="flex items-center text-sm text-gray-600">
          <FiHome className="mr-1" />
          <span>{basePath}</span>
        </div>
      );
    }

    const pathParts = currentPath.split('/');
    
    return (
      <div className="flex items-center text-sm text-gray-600 overflow-x-auto whitespace-nowrap">
        <button 
          onClick={navigateToRoot}
          className="flex items-center hover:text-abz-blue"
        >
          <FiHome className="mr-1" />
          <span>{basePath}</span>
        </button>
        
        {pathParts.map((part, index) => {
          if (!part) return null;
          
          const pathToHere = pathParts.slice(0, index + 1).join('/');
          
          return (
            <React.Fragment key={index}>
              <span className="mx-1">/</span>
              <button 
                onClick={() => navigateToFolder(pathToHere)}
                className="hover:text-abz-blue"
              >
                {part}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Cabeçalho */}
      <div className="bg-gray-50 p-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            {t('fileExplorer.title', 'Explorador de Arquivos')}
          </h3>
          
          <div className="flex space-x-2">
            {allowCreateFolder && (
              <button
                onClick={() => setShowNewFolderInput(true)}
                className="p-1.5 text-gray-600 hover:text-abz-blue rounded-md hover:bg-gray-100"
                title={t('fileExplorer.createFolder', 'Criar Pasta')}
              >
                <FiFolderPlus className="h-5 w-5" />
              </button>
            )}
            
            {allowUpload && (
              <label className="p-1.5 text-gray-600 hover:text-abz-blue rounded-md hover:bg-gray-100 cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  multiple
                />
                <FiUpload className="h-5 w-5" title={t('fileExplorer.upload', 'Fazer Upload')} />
              </label>
            )}
            
            <button
              onClick={loadFiles}
              className="p-1.5 text-gray-600 hover:text-abz-blue rounded-md hover:bg-gray-100"
              title={t('fileExplorer.refresh', 'Atualizar')}
            >
              <FiRefreshCw className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Navegação (breadcrumbs) */}
        <div className="mt-2">
          {renderBreadcrumbs()}
        </div>
        
        {/* Input para criar nova pasta */}
        {showNewFolderInput && (
          <div className="mt-2 flex items-center">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t('fileExplorer.newFolderName', 'Nome da nova pasta')}
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-abz-blue focus:border-abz-blue text-sm"
              autoFocus
            />
            <button
              onClick={handleCreateFolder}
              className="ml-2 px-3 py-1.5 bg-abz-blue text-white rounded-md text-sm hover:bg-abz-blue-dark"
            >
              {t('fileExplorer.create', 'Criar')}
            </button>
            <button
              onClick={() => {
                setShowNewFolderInput(false);
                setNewFolderName('');
              }}
              className="ml-2 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
            >
              {t('common.cancel', 'Cancelar')}
            </button>
          </div>
        )}
      </div>
      
      {/* Conteúdo */}
      <div className="p-0">
        {/* Botão para voltar */}
        {currentPath && (
          <button
            onClick={navigateUp}
            className="flex items-center p-3 w-full text-left hover:bg-gray-50 border-b border-gray-200"
          >
            <FiArrowLeft className="mr-2 text-gray-500" />
            <span className="text-gray-700">{t('fileExplorer.upOneLevel', 'Voltar um nível')}</span>
          </button>
        )}
        
        {/* Estado de carregamento */}
        {loading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-abz-blue"></div>
            <span className="ml-2 text-gray-600">{t('common.loading', 'Carregando...')}</span>
          </div>
        )}
        
        {/* Mensagem de erro */}
        {error && (
          <div className="p-4 text-red-700 bg-red-50 border-b border-red-200">
            <p className="font-medium">{t('common.error', 'Erro')}</p>
            <p className="text-sm">{error}</p>
            <button
              onClick={loadFiles}
              className="mt-2 text-sm text-abz-blue hover:underline flex items-center"
            >
              <FiRefreshCw className="mr-1" />
              {t('common.tryAgain', 'Tentar novamente')}
            </button>
          </div>
        )}
        
        {/* Lista de arquivos e pastas */}
        {!loading && !error && (
          <div className="max-h-96 overflow-y-auto">
            {filteredFiles.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {t('fileExplorer.noFiles', 'Nenhum arquivo ou pasta encontrado')}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('fileExplorer.name', 'Nome')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('fileExplorer.size', 'Tamanho')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('fileExplorer.lastModified', 'Última Modificação')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredFiles.map((file, index) => (
                    <tr 
                      key={index}
                      className={`hover:bg-gray-50 cursor-pointer ${file.isDirectory ? 'font-medium' : ''}`}
                      onClick={() => {
                        if (file.isDirectory) {
                          navigateToFolder(currentPath ? `${currentPath}/${file.name}` : file.name);
                        } else {
                          handleFileSelect(file);
                        }
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {file.isDirectory ? (
                            <FiFolder className="mr-2 text-abz-blue" />
                          ) : (
                            <FiFile className="mr-2 text-gray-500" />
                          )}
                          <span className="text-gray-900">{file.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {file.isDirectory ? '-' : formatFileSize(file.size)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {file.lastModified ? new Date(file.lastModified).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        
        {/* Estado de upload */}
        {uploadingFile && (
          <div className="p-3 bg-blue-50 border-t border-blue-200 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-abz-blue mr-2"></div>
            <span className="text-sm text-blue-700">{t('fileExplorer.uploading', 'Fazendo upload...')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
