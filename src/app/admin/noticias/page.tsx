'use client';

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { FiPlus, FiEdit, FiTrash2, FiFile, FiCalendar, FiTag } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import FileExplorer from '@/components/FileExplorer';
import MultiPdfViewer from '@/components/MultiPdfViewer';

interface News {
  id: string;
  title: string;
  description: string;
  date: string;
  file: string;
  enabled: boolean;
  featured: boolean;
  category: string;
  author: string;
  thumbnail?: string;
}

export default function NewsAdminPage() {
  const { t } = useI18n();
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showFileExplorer, setShowFileExplorer] = useState<boolean>(false);
  // const [selectedFile, setSelectedFile] = useState<string | null>(null); // Removido - não utilizado
  const [viewerOpen, setViewerOpen] = useState<boolean>(false);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    file: '',
    enabled: true,
    featured: false,
    category: '',
    author: '',
    thumbnail: ''
  });

  // Carregar notícias
  const loadNews = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/news');
      
      if (!response.ok) {
        throw new Error(`Erro ao carregar notícias: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setNews(data);
    } catch (err) {
      console.error('Erro ao carregar notícias:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Carregar notícias quando o componente montar
  useEffect(() => {
    loadNews();
  }, []);

  // Função para formatar a data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Função para abrir o explorador de arquivos
  const openFileExplorer = () => {
    setShowFileExplorer(true);
  };

  // Função para fechar o explorador de arquivos
  const closeFileExplorer = () => {
    setShowFileExplorer(false);
  };

  // Função para lidar com a seleção de arquivo
  const handleFileSelect = (filePath: string) => {
    setFormData({ ...formData, file: filePath });
    closeFileExplorer();
  };

  // Função para abrir o visualizador
  const openViewer = (filePath: string) => {
    setViewingFile(filePath);
    setViewerOpen(true);
  };

  // Função para fechar o visualizador
  const closeViewer = () => {
    setViewerOpen(false);
    setViewingFile(null);
  };

  // Função para obter o nome do arquivo a partir do caminho
  const getFileName = (filePath: string) => {
    if (!filePath) return '';
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  };

  // Função para criar uma nova notícia
  const createNews = async () => {
    try {
      const response = await fetch('/api/news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`Erro ao criar notícia: ${response.status} ${response.statusText}`);
      }

      // Recarregar notícias
      loadNews();
      
      // Limpar formulário
      setFormData({
        title: '',
        description: '',
        date: '',
        file: '',
        enabled: true,
        featured: false,
        category: '',
        author: '',
        thumbnail: ''
      });
      
      setEditingNews(null);
    } catch (err) {
      console.error('Erro ao criar notícia:', err);
      alert(err instanceof Error ? err.message : 'Erro desconhecido ao criar notícia');
    }
  };

  // Função para editar uma notícia
  const editNews = (news: News) => {
    setEditingNews(news);
    setFormData({
      title: news.title,
      description: news.description,
      date: new Date(news.date).toISOString().split('T')[0],
      file: news.file,
      enabled: news.enabled,
      featured: news.featured,
      category: news.category,
      author: news.author,
      thumbnail: news.thumbnail || ''
    });
  };

  // Função para atualizar uma notícia
  const updateNews = async () => {
    if (!editingNews) return;

    try {
      const response = await fetch(`/api/news/${editingNews.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`Erro ao atualizar notícia: ${response.status} ${response.statusText}`);
      }

      // Recarregar notícias
      loadNews();
      
      // Limpar formulário
      setFormData({
        title: '',
        description: '',
        date: '',
        file: '',
        enabled: true,
        featured: false,
        category: '',
        author: '',
        thumbnail: ''
      });
      
      setEditingNews(null);
    } catch (err) {
      console.error('Erro ao atualizar notícia:', err);
      alert(err instanceof Error ? err.message : 'Erro desconhecido ao atualizar notícia');
    }
  };

  // Função para excluir uma notícia
  const deleteNews = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta notícia?')) return;

    try {
      const response = await fetch(`/api/news/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Erro ao excluir notícia: ${response.status} ${response.statusText}`);
      }

      // Recarregar notícias
      loadNews();
    } catch (err) {
      console.error('Erro ao excluir notícia:', err);
      alert(err instanceof Error ? err.message : 'Erro desconhecido ao excluir notícia');
    }
  };

  // Função para lidar com a mudança nos campos do formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Função para lidar com o envio do formulário
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingNews) {
      updateNews();
    } else {
      createNews();
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-abz-text-black mb-6">
          {t('admin.news.title', 'Gerenciamento de Notícias')}
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingNews ? t('admin.news.editNews', 'Editar Notícia') : t('admin.news.createNews', 'Criar Nova Notícia')}
          </h2>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.news.title', 'Título')}
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-abz-blue focus:border-abz-blue"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.news.category', 'Categoria')}
                </label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-abz-blue focus:border-abz-blue"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.news.date', 'Data')}
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-abz-blue focus:border-abz-blue"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.news.author', 'Autor')}
                </label>
                <input
                  type="text"
                  name="author"
                  value={formData.author}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-abz-blue focus:border-abz-blue"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.news.description', 'Descrição')}
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-abz-blue focus:border-abz-blue"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.news.file', 'Arquivo')}
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    name="file"
                    value={formData.file}
                    onChange={handleInputChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-1 focus:ring-abz-blue focus:border-abz-blue"
                    placeholder="/documentos/noticias/exemplo.pdf"
                  />
                  <button
                    type="button"
                    onClick={openFileExplorer}
                    className="px-3 py-2 bg-gray-100 border border-gray-300 border-l-0 rounded-r-md text-gray-700 hover:bg-gray-200"
                  >
                    {t('common.browse', 'Procurar')}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t('admin.news.fileHelp', 'Selecione um arquivo PDF para a notícia')}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.news.thumbnail', 'Miniatura (URL)')}
                </label>
                <input
                  type="text"
                  name="thumbnail"
                  value={formData.thumbnail}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-abz-blue focus:border-abz-blue"
                  placeholder="https://exemplo.com/imagem.jpg"
                />
              </div>
              
              <div className="flex items-center space-x-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enabled"
                    name="enabled"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
                  />
                  <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700">
                    {t('admin.news.enabled', 'Habilitada')}
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="featured"
                    name="featured"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
                  />
                  <label htmlFor="featured" className="ml-2 block text-sm text-gray-700">
                    {t('admin.news.featured', 'Destaque')}
                  </label>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              {editingNews && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingNews(null);
                    setFormData({
                      title: '',
                      description: '',
                      date: '',
                      file: '',
                      enabled: true,
                      featured: false,
                      category: '',
                      author: '',
                      thumbnail: ''
                    });
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  {t('common.cancel', 'Cancelar')}
                </button>
              )}
              
              <button
                type="submit"
                className="px-4 py-2 bg-abz-blue text-white rounded-md hover:bg-opacity-90"
              >
                {editingNews ? t('common.update', 'Atualizar') : t('common.create', 'Criar')}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">
            {t('admin.news.newsList', 'Lista de Notícias')}
          </h2>
          
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-abz-blue"></div>
              <span className="ml-2 text-gray-600">{t('common.loading', 'Carregando...')}</span>
            </div>
          ) : error ? (
            <div className="p-4 text-red-700 bg-red-50 rounded-md">
              <p className="font-medium">{t('common.error', 'Erro')}</p>
              <p className="text-sm">{error}</p>
              <button
                onClick={loadNews}
                className="mt-2 text-sm text-abz-blue hover:underline flex items-center"
              >
                <FiPlus className="mr-1" />
                {t('common.tryAgain', 'Tentar novamente')}
              </button>
            </div>
          ) : news.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>{t('admin.news.noNews', 'Nenhuma notícia encontrada')}</p>
              <p className="text-sm mt-2">{t('admin.news.createFirstNews', 'Crie sua primeira notícia usando o formulário acima')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.news.title', 'Título')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.news.category', 'Categoria')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.news.date', 'Data')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.news.status', 'Status')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.news.file', 'Arquivo')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.actions', 'Ações')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {news.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FiTag className="text-gray-400 mr-1" />
                          <span className="text-sm text-gray-500">{item.category}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FiCalendar className="text-gray-400 mr-1" />
                          <span className="text-sm text-gray-500">{formatDate(item.date)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          item.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {item.enabled ? t('common.enabled', 'Ativo') : t('common.disabled', 'Inativo')}
                        </span>
                        {item.featured && (
                          <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            {t('admin.news.featured', 'Destaque')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.file ? (
                          <button
                            onClick={() => openViewer(item.file)}
                            className="flex items-center text-sm text-abz-blue hover:underline"
                          >
                            <FiFile className="mr-1" />
                            {getFileName(item.file)}
                          </button>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => editNews(item)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          <FiEdit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => deleteNews(item.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <FiTrash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Explorador de arquivos */}
      {showFileExplorer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                {t('admin.news.selectFile', 'Selecionar Arquivo')}
              </h3>
              <button
                onClick={closeFileExplorer}
                className="text-gray-400 hover:text-gray-500"
              >
                &times;
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              <FileExplorer
                basePath="public/documentos"
                onFileSelect={handleFileSelect}
                allowUpload={true}
                allowCreateFolder={true}
                fileFilter={['.pdf']}
                initialPath="noticias"
                showFullPath={false}
              />
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeFileExplorer}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                {t('common.cancel', 'Cancelar')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Visualizador de documento */}
      {viewerOpen && viewingFile && (
        <MultiPdfViewer
          title={getFileName(viewingFile)}
          filePath={viewingFile}
          onClose={closeViewer}
        />
      )}
    </MainLayout>
  );
}
