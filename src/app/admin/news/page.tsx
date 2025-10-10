'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiStar, FiUpload, FiDownload, FiX } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';

interface NewsItem {
  id: string;
  title: string;
  description: string;
  date: string;
  file: string;
  enabled: boolean;
  featured: boolean;
  category: string;
  author: string;
  thumbnail?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Componente para edição de notícia
interface NewsEditorProps {
  news: NewsItem;
  onSave: (news: NewsItem) => void;
  onCancel: () => void;
  isNew?: boolean;
}

const NewsEditor = ({ news, onSave, onCancel, isNew = false }: NewsEditorProps) => {
  const { t } = useI18n();
  const [editedNews, setEditedNews] = useState<NewsItem>({ ...news });
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditedNews(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setEditedNews(prev => ({ ...prev, [name]: checked }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setThumbnail(e.target.files[0]);
    }
  };

  const handleUpload = async (fileToUpload: File, type: string) => {
    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('type', type);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (type === 'news') {
          setEditedNews(prev => ({
            ...prev,
            file: data.files[0].url,
          }));
        } else if (type === 'thumbnails') {
          setEditedNews(prev => ({
            ...prev,
            thumbnail: data.files[0].url,
          }));
        }
        setUploadProgress(100);
        return data.files[0].url;
      } else {
        console.error('Erro ao fazer upload do arquivo');
        return null;
      }
    } catch (error) {
      console.error(`Erro ao fazer upload do ${type}:`, error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Se houver arquivos para upload, fazer o upload primeiro
    if (file) {
      await handleUpload(file, 'news');
    }

    if (thumbnail) {
      await handleUpload(thumbnail, 'thumbnails');
    }

    onSave(editedNews);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {isNew ? t('userEditor.addNews', 'Adicionar Nova Notícia') : t('userEditor.editNews', 'Editar Notícia')}
        </h3>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          <FiX className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Título
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={editedNews.title}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              required
            />
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              Data
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={editedNews.date.substring(0, 10)}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              required
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Categoria
            </label>
            <input
              type="text"
              id="category"
              name="category"
              value={editedNews.category}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              required
            />
          </div>

          <div>
            <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-1">
              Autor
            </label>
            <input
              type="text"
              id="author"
              name="author"
              value={editedNews.author}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              required
            />
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Descrição
          </label>
          <textarea
            id="description"
            name="description"
            value={editedNews.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-1">
            Arquivo
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="file"
              id="file"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex-1">
              <input
                type="text"
                name="file"
                value={editedNews.file}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                placeholder="Caminho do arquivo ou URL"
                required
              />
            </div>
            <label
              htmlFor="file"
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue cursor-pointer"
            >
              <FiUpload className="inline-block mr-1" />
              Selecionar
            </label>
            {file && (
              <button
                type="button"
                onClick={() => handleUpload(file, 'news')}
                disabled={isUploading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
              >
                {isUploading ? `${uploadProgress}%` : 'Upload'}
              </button>
            )}
          </div>
          {file && (
            <p className="mt-1 text-sm text-gray-500">
              Arquivo selecionado: {file.name} ({(typeof file.size === 'number' ? (file.size / 1024).toFixed(2) : '0.00')} KB)
            </p>
          )}
        </div>

        <div className="mb-4">
          <label htmlFor="thumbnail" className="block text-sm font-medium text-gray-700 mb-1">
            Miniatura (opcional)
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="file"
              id="thumbnail"
              onChange={handleThumbnailChange}
              className="hidden"
              accept="image/*"
            />
            <div className="flex-1">
              <input
                type="text"
                name="thumbnail"
                value={editedNews.thumbnail || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                placeholder="Caminho da imagem ou URL"
              />
            </div>
            <label
              htmlFor="thumbnail"
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue cursor-pointer"
            >
              <FiUpload className="inline-block mr-1" />
              Selecionar
            </label>
            {thumbnail && (
              <button
                type="button"
                onClick={() => handleUpload(thumbnail, 'thumbnails')}
                disabled={isUploading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
              >
                {isUploading ? `${uploadProgress}%` : 'Upload'}
              </button>
            )}
          </div>
          {thumbnail && (
            <p className="mt-1 text-sm text-gray-500">
              Imagem selecionada: {thumbnail.name} ({(typeof thumbnail.size === 'number' ? (thumbnail.size / 1024).toFixed(2) : '0.00')} KB)
            </p>
          )}
          {editedNews.thumbnail && (
            <div className="mt-2">
              <img
                src={editedNews.thumbnail}
                alt="Miniatura"
                className="h-20 w-auto object-cover rounded-md"
              />
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4 mb-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              name="enabled"
              checked={editedNews.enabled}
              onChange={handleCheckboxChange}
              className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
            />
            <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700">
              Ativo
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="featured"
              name="featured"
              checked={editedNews.featured}
              onChange={handleCheckboxChange}
              className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
            />
            <label htmlFor="featured" className="ml-2 block text-sm text-gray-700">
              Destaque
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
          >
            {t('common.cancel', 'Cancelar')}
          </button>
          <button
            type="submit"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
          >
            {isNew ? t('common.add', 'Adicionar') : t('common.save', 'Salvar')}
          </button>
        </div>
      </form>
    </div>
  );
};

// Componente para visualização de notícia
interface NewsItemProps {
  news: NewsItem;
  onEdit: (news: NewsItem) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (id: string, enabled: boolean) => void;
  onToggleFeatured: (id: string, featured: boolean) => void;
}

const NewsItemComponent = ({ news, onEdit, onDelete, onToggleVisibility, onToggleFeatured }: NewsItemProps) => {
  // Formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${news.enabled ? 'border-green-500' : 'border-gray-300'}`}>
      <div className="flex justify-between items-start">
        <div className="flex items-start space-x-3">
          {news.thumbnail ? (
            <img
              src={news.thumbnail}
              alt={news.title}
              className="w-16 h-16 object-cover rounded-md"
            />
          ) : (
            <div className="w-16 h-16 bg-gray-200 rounded-md flex items-center justify-center">
              <span className="text-gray-400 text-xs">Sem imagem</span>
            </div>
          )}
          <div>
            <div className="flex items-center">
              <h3 className="font-medium text-gray-900">{news.title}</h3>
              {news.featured && (
                <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full flex items-center">
                  <FiStar className="mr-1 h-3 w-3" />
                  Destaque
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">{news.description}</p>
            <div className="flex flex-wrap items-center mt-2 text-xs text-gray-500">
              <span className="mr-3">Data: {formatDate(news.date)}</span>
              <span className="mr-3">Categoria: {news.category}</span>
              <span className="mr-3">Autor: {news.author}</span>
              <a
                href={news.file}
                target="_blank"
                rel="noopener noreferrer"
                className="text-abz-blue hover:text-abz-blue-dark flex items-center"
              >
                <FiDownload className="mr-1" />
                Baixar
              </a>
            </div>
          </div>
        </div>
        <div className="flex space-x-1">
          <button
            onClick={() => onToggleFeatured(news.id, !news.featured)}
            className={`p-1 ${news.featured ? 'text-yellow-500 hover:text-yellow-700' : 'text-gray-400 hover:text-gray-600'}`}
            title={news.featured ? 'Remover destaque' : 'Destacar'}
          >
            <FiStar className="h-4 w-4" />
          </button>
          <button
            onClick={() => onToggleVisibility(news.id, !news.enabled)}
            className={`p-1 ${news.enabled ? 'text-green-500 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'}`}
            title={news.enabled ? 'Desativar' : 'Ativar'}
          >
            {news.enabled ? <FiEye className="h-4 w-4" /> : <FiEyeOff className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onEdit(news)}
            className="p-1 text-blue-500 hover:text-blue-700"
            title="Editar"
          >
            <FiEdit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(news.id)}
            className="p-1 text-red-500 hover:text-red-700"
            title="Excluir"
          >
            <FiTrash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default function NewsPage() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);

  // Carregar notícias
  const fetchNews = async () => {
    setIsLoading(true);
    setError(null); // Limpar erros anteriores

    try {
      console.log(t('admin.iniciandoBuscaDeNoticias'));

      // Tentar primeiro a API real
      let url = '/api/news';
      const params = new URLSearchParams();

      if (selectedCategory) {
        params.append('category', selectedCategory);
      }

      if (showFeaturedOnly) {
        params.append('featured', 'true');
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      console.log('URL de busca (API real):', url);

      let response;
      let useMockData = false;

      try {
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        console.log('Status da resposta (API real):', response.status);

        if (!response.ok) {
          console.log('API real falhou, usando dados de exemplo...');
          useMockData = true;
        }
      } catch (fetchError) {
        console.error('Erro ao buscar da API real:', fetchError);
        console.log('Usando dados de exemplo devido a erro na API real...');
        useMockData = true;
      }

      // Se a API real falhar, usar a API de exemplo
      if (useMockData) {
        let mockUrl = '/api/news/mock';
        if (params.toString()) {
          mockUrl += `?${params.toString()}`;
        }

        console.log('URL de busca (API mock):', mockUrl);

        response = await fetch(mockUrl, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        console.log('Status da resposta (API mock):', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Resposta de erro (API mock):', errorText);
          throw new Error(t('admin.erroAoCarregarNoticiasResponsestatusResponsestatus'));
        }
      }

      if (!response) {
        throw new Error('Nenhuma resposta recebida');
      }

      const data = await response.json();
      console.log('Dados recebidos:', data);

      // Verificar se data é um array
      if (!Array.isArray(data)) {
        console.error(t('admin.respostaNaoEUmArray'), data);
        setNewsItems([]);
        setError(t('admin.formatoDeRespostaInvalidoPorFavorTenteNovamente'));
      } else {
        setNewsItems(data);

        // Extrair categorias únicas
        const uniqueCategories = Array.from(new Set(data.map((item: NewsItem) => item.category)));
        setCategories(uniqueCategories as string[]);
        console.log('Categorias encontradas:', uniqueCategories);
      }
    } catch (error) {
      console.error(t('admin.erroAoCarregarNoticias'), error);
      setError(t('admin.erroAoCarregarNoticiasPorFavorTenteNovamente'));
      setNewsItems([]); // Definir como array vazio para evitar erros de renderização
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [selectedCategory, showFeaturedOnly]);

  // Funções para gerenciar as notícias
  const handleEdit = (news: NewsItem) => {
    setEditingNews(news);
    setIsAdding(false);
  };

  const handleAdd = () => {
    // Criar uma nova notícia com valores padrão
    const newNews: NewsItem = {
      id: '',
      title: '',
      description: '',
      date: new Date().toISOString().substring(0, 10),
      file: '',
      enabled: true,
      featured: false,
      category: selectedCategory || t('admin.noticias'),
      author: 'Equipe ABZ',
      thumbnail: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEditingNews(newNews);
    setIsAdding(true);
  };

  const handleSave = async (news: NewsItem) => {
    try {
      let response;

      if (isAdding) {
        // Adicionar nova notícia
        response = await fetch('/api/news', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(news),
        });
      } else {
        // Atualizar notícia existente
        response = await fetch(`/api/news/${news.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(news),
        });
      }

      if (!response.ok) {
        throw new Error(t('admin.erroAoSalvarNoticia'));
      }

      // Recarregar notícias
      fetchNews();

      // Limpar estado de edição
      setEditingNews(null);
      setIsAdding(false);
    } catch (error) {
      console.error(t('admin.erroAoSalvarNoticia'), error);
      setError(t('admin.erroAoSalvarNoticiaPorFavorTenteNovamente'));
    }
  };

  const handleCancel = () => {
    setEditingNews(null);
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('admin.temCertezaQueDesejaExcluirEstaNoticia'))) {
      try {
        const response = await fetch(`/api/news/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error(t('admin.erroAoExcluirNoticia'));
        }

        // Recarregar notícias
        fetchNews();
      } catch (error) {
        console.error(t('admin.erroAoExcluirNoticia'), error);
        setError(t('admin.erroAoExcluirNoticiaPorFavorTenteNovamente'));
      }
    }
  };

  const handleToggleVisibility = async (id: string, enabled: boolean) => {
    try {
      const news = newsItems.find(item => item.id === id);

      if (!news) {
        throw new Error(t('admin.noticiaNaoEncontrada'));
      }

      const response = await fetch(`/api/news/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...news, enabled }),
      });

      if (!response.ok) {
        throw new Error(t('admin.erroAoAtualizarNoticia'));
      }

      // Recarregar notícias
      fetchNews();
    } catch (error) {
      console.error(t('admin.erroAoAtualizarNoticia'), error);
      setError(t('admin.erroAoAtualizarNoticiaPorFavorTenteNovamente'));
    }
  };

  const handleToggleFeatured = async (id: string, featured: boolean) => {
    try {
      const news = newsItems.find(item => item.id === id);

      if (!news) {
        throw new Error(t('admin.noticiaNaoEncontrada'));
      }

      const response = await fetch(`/api/news/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...news, featured }),
      });

      if (!response.ok) {
        throw new Error(t('admin.erroAoAtualizarNoticia'));
      }

      // Recarregar notícias
      fetchNews();
    } catch (error) {
      console.error(t('admin.erroAoAtualizarNoticia'), error);
      setError(t('admin.erroAoAtualizarNoticiaPorFavorTenteNovamente'));
    }
  };

  // Ordenar notícias por data (mais recentes primeiro)
  const sortedNewsItems = [...newsItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Notícias</h1>
          <p className="mt-1 text-sm text-gray-500">
            Adicione, edite ou remova notícias e comunicados.
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <button
            onClick={handleAdd}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
          >
            <FiPlus className="mr-2 h-4 w-4" />
            Adicionar Notícia
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Filtros</h3>
        <div className="space-y-4">
          {/* Filtro por categoria */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Categoria</h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  selectedCategory === ''
                    ? 'bg-abz-blue text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todas
              </button>
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    selectedCategory === category
                      ? 'bg-abz-blue text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro por destaque */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showFeaturedOnly}
                onChange={() => setShowFeaturedOnly(!showFeaturedOnly)}
                className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Mostrar apenas notícias em destaque</span>
            </label>
          </div>
        </div>
      </div>

      {/* Editor de notícia */}
      {editingNews && (
        <NewsEditor
          news={editingNews}
          onSave={handleSave}
          onCancel={handleCancel}
          isNew={isAdding}
        />
      )}

      {/* Mensagem de erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Lista de notícias */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Notícias ({sortedNewsItems.length})
          </h3>
        </div>
        <div className="divide-y divide-gray-200">
          {isLoading ? (
            <div className="p-6 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-abz-blue"></div>
              <p className="mt-2 text-sm text-gray-500">Carregando notícias...</p>
            </div>
          ) : sortedNewsItems.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Nenhuma notícia encontrada. Clique em {t('admin.adicionarNoticia')} para criar uma nova.
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {sortedNewsItems.map(news => (
                <NewsItemComponent
                  key={news.id}
                  news={news}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleVisibility={handleToggleVisibility}
                  onToggleFeatured={handleToggleFeatured}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
