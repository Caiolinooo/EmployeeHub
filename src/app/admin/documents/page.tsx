'use client';

import React, { useState, useEffect } from 'react';
import DocumentPicker from '@/components/DocumentPicker';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiArrowUp, FiArrowDown, FiX, FiUpload, FiDownload } from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useI18n } from '@/contexts/I18nContext';

interface Document {
  id: string;
  title: string;
  description: string;
  category: string;
  language: string;
  file: string;
  enabled: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// Componente para edição de documento
interface DocumentEditorProps {
  document: Document;
  onSave: (document: Document) => void;
  onCancel: () => void;
  isNew?: boolean;
}

const DocumentEditor = ({ document, onSave, onCancel, isNew = false }: DocumentEditorProps) => {
  const { t } = useI18n();
  const [editedDocument, setEditedDocument] = useState<Document>({ ...document });
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showPicker, setShowPicker] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditedDocument(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setEditedDocument(prev => ({ ...prev, [name]: checked }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'documents');

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setEditedDocument(prev => ({
          ...prev,
          file: data.files[0].url,
        }));
        setUploadProgress(100);
      } else {
        console.error('Erro ao fazer upload do arquivo');
      }
    } catch (error) {
      console.error('Erro ao fazer upload do arquivo:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Se houver um arquivo para upload, fazer o upload primeiro
    if (file) {
      await handleUpload();
    }

    onSave(editedDocument);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {isNew ? 'Adicionar Novo Documento' : 'Editar Documento'}
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
              {t('admin.documents.docTitle')}
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={editedDocument.title}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              required
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.documents.category')}
            </label>
            <input
              type="text"
              id="category"
              name="category"
              value={editedDocument.category}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              required
            />
          </div>

          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.documents.language')}
            </label>
            <select
              id="language"
              name="language"
              value={editedDocument.language}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              required
            >
              <option value="">{t('admin.documents.selectLanguage')}</option>
              <option value="Português">{t('admin.documents.portuguese')}</option>
              <option value="English">{t('admin.documents.english')}</option>
              <option value="Español">{t('admin.documents.spanish')}</option>
            </select>
          </div>

          <div>
            <label htmlFor="order" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.documents.order')}
            </label>
            <input
              type="number"
              id="order"
              name="order"
              value={editedDocument.order}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
              min="1"
              required
            />
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            {t('admin.documents.description')}
          </label>
          <textarea
            id="description"
            name="description"
            value={editedDocument.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-1">
            {t('admin.documents.file')}
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
                value={editedDocument.file}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
                placeholder={t('admin.documents.filePlaceholder')}
                required
              />
            </div>
            <label
              htmlFor="file"
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue cursor-pointer"
            >
              <FiUpload className="inline-block mr-1" />
              {t('admin.documents.select')}
            </label>
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              {t('admin.documents.pickFromExplorer','Escolher do Explorador')}
            </button>
            {file && (
              <button
                type="button"
                onClick={handleUpload}
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

        <div className="flex items-center space-x-4 mb-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              name="enabled"
              checked={editedDocument.enabled}
              onChange={handleCheckboxChange}
              className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
            />
            <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700">
              {t('admin.documents.active')}
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
          >
            {isNew ? t('admin.documents.add') : t('common.save')}
          </button>
        </div>
      </form>
      <DocumentPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={(p) => setEditedDocument(prev => ({ ...prev, file: `/${p}` }))}
        basePath="public/documentos"
        fileFilter={['.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.txt']}
      />

    </div>
  );
};

// Componente para visualização de documento
interface DocumentItemProps {
  document: Document;
  onEdit: (document: Document) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (id: string, enabled: boolean) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}

const DocumentItem = ({ document, onEdit, onDelete, onToggleVisibility, onMoveUp, onMoveDown }: DocumentItemProps) => {
  const { t } = useI18n();
  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${document.enabled ? 'border-green-500' : 'border-gray-300'}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{document.title}</h3>
          <p className="text-sm text-gray-500 mt-1">{document.description}</p>
          <div className="flex flex-wrap items-center mt-2 text-xs text-gray-500">
            <span className="mr-3">{t('admin.documents.category')}: {document.category}</span>
            <span className="mr-3">{t('admin.documents.language')}: {document.language}</span>
            <span className="mr-3">{t('admin.documents.order')}: {document.order}</span>
            <a
              href={document.file}
              target="_blank"
              rel="noopener noreferrer"
              className="text-abz-blue hover:text-abz-blue-dark flex items-center"
            >
              <FiDownload className="mr-1" />
              {t('admin.documents.download')}
            </a>
          </div>
        </div>
        <div className="flex space-x-1">
          <button
            onClick={() => onMoveUp(document.id)}
            className="p-1 text-gray-500 hover:text-gray-700"
            title={t('admin.documents.moveUp')}
          >
            <FiArrowUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMoveDown(document.id)}
            className="p-1 text-gray-500 hover:text-gray-700"
            title={t('admin.documents.moveDown')}
          >
            <FiArrowDown className="h-4 w-4" />
          </button>
          <button
            onClick={() => onToggleVisibility(document.id, !document.enabled)}
            className={`p-1 ${document.enabled ? 'text-green-500 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'}`}
            title={document.enabled ? t('admin.documents.disable') : t('admin.documents.enable')}
          >
            {document.enabled ? <FiEye className="h-4 w-4" /> : <FiEyeOff className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onEdit(document)}
            className="p-1 text-blue-500 hover:text-blue-700"
            title={t('admin.documents.edit')}
          >
            <FiEdit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(document.id)}
            className="p-1 text-red-500 hover:text-red-700"
            title={t('admin.documents.delete')}
          >
            <FiTrash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default function DocumentsPage() {
  const { t } = useI18n();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Carregar documentos
  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const url = selectedCategory
        ? `/api/documents?category=${encodeURIComponent(selectedCategory)}`
        : '/api/documents';

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(t('admin.documents.errorLoading'));
      }

      const data = await response.json();
      setDocuments(data);

      // Extrair categorias únicas
      const uniqueCategories = Array.from(new Set(data.map((doc: Document) => doc.category)));
      setCategories(uniqueCategories as string[]);
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
      setError(t('admin.documents.errorLoadingMessage'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedCategory]);

  // Funções para gerenciar os documentos
  const handleEdit = (document: Document) => {
    setEditingDocument(document);
    setIsAdding(false);
  };

  const handleAdd = () => {
    // Criar um novo documento com valores padrão
    const newDocument: Document = {
      id: '',
      title: '',
      description: '',
      category: selectedCategory || '',
      language: 'Português',
      file: '',
      enabled: true,
      order: documents.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEditingDocument(newDocument);
    setIsAdding(true);
  };

  const handleSave = async (document: Document) => {
    try {
      let response;

      if (isAdding) {
        // Adicionar novo documento
        response = await fetchWithToken('/api/documents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(document),
        });
      } else {
        // Atualizar documento existente
        response = await fetchWithToken(`/api/documents/${document.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(document),
        });
      }

      if (!response.ok) {
        throw new Error('Erro ao salvar documento');
      }

      // Recarregar documentos
      fetchDocuments();

      // Limpar estado de edição
      setEditingDocument(null);
      setIsAdding(false);
    } catch (error) {
      console.error('Erro ao salvar documento:', error);
      setError('Erro ao salvar documento. Por favor, tente novamente.');
    }
  };

  const handleCancel = () => {
    setEditingDocument(null);
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('admin.documents.deleteConfirm'))) {
      try {
        const response = await fetchWithToken(`/api/documents/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Erro ao excluir documento');
        }

        // Recarregar documentos
        fetchDocuments();
      } catch (error) {
        console.error('Erro ao excluir documento:', error);
        setError('Erro ao excluir documento. Por favor, tente novamente.');
      }
    }
  };

  const handleToggleVisibility = async (id: string, enabled: boolean) => {
    try {
      const document = documents.find(doc => doc.id === id);

      if (!document) {
        throw new Error('Documento não encontrado');
      }

      const response = await fetchWithToken(`/api/documents/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...document, enabled }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar documento');
      }

      // Recarregar documentos
      fetchDocuments();
    } catch (error) {
      console.error('Erro ao atualizar documento:', error);
      setError('Erro ao atualizar documento. Por favor, tente novamente.');
    }
  };

  const handleMoveUp = async (id: string) => {
    try {
      const index = documents.findIndex(doc => doc.id === id);
      if (index <= 0) return;

      const document = documents[index];
      const prevDocument = documents[index - 1];

      // Trocar a ordem
      const updatedDocument = { ...document, order: prevDocument.order };
      const updatedPrevDocument = { ...prevDocument, order: document.order };

      // Atualizar os documentos
      await Promise.all([
        fetchWithToken(`/api/documents/${updatedDocument.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedDocument),
        }),
        fetchWithToken(`/api/documents/${updatedPrevDocument.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedPrevDocument),
        }),
      ]);

      // Recarregar documentos
      fetchDocuments();
    } catch (error) {
      console.error('Erro ao mover documento:', error);
      setError('Erro ao mover documento. Por favor, tente novamente.');
    }
  };

  const handleMoveDown = async (id: string) => {
    try {
      const index = documents.findIndex(doc => doc.id === id);
      if (index >= documents.length - 1) return;

      const document = documents[index];
      const nextDocument = documents[index + 1];

      // Trocar a ordem
      const updatedDocument = { ...document, order: nextDocument.order };
      const updatedNextDocument = { ...nextDocument, order: document.order };

      // Atualizar os documentos
      await Promise.all([
        fetchWithToken(`/api/documents/${updatedDocument.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedDocument),
        }),
        fetchWithToken(`/api/documents/${updatedNextDocument.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedNextDocument),
        }),
      ]);

      // Recarregar documentos
      fetchDocuments();
    } catch (error) {
      console.error('Erro ao mover documento:', error);
      setError('Erro ao mover documento. Por favor, tente novamente.');
    }
  };

  // Ordenar documentos por ordem
  const sortedDocuments = [...documents].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.documents.section')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('admin.documents.description')}
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <button
            onClick={handleAdd}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
          >
            <FiPlus className="mr-2 h-4 w-4" />
            {t('admin.documents.addDocument')}
          </button>
        </div>
      </div>

      {/* Filtro por categoria */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-3">{t('admin.documents.filterByCategory')}</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              selectedCategory === ''
                ? 'bg-abz-blue text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('admin.documents.all')}
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

      {/* Editor de documento */}
      {editingDocument && (
        <DocumentEditor
          document={editingDocument}
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

      {/* Lista de documentos */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            {t('admin.documents.section')} ({sortedDocuments.length})
          </h3>
        </div>
        <div className="divide-y divide-gray-200">
          {isLoading ? (
            <div className="p-6 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-abz-blue"></div>
              <p className="mt-2 text-sm text-gray-500">{t('admin.documents.loading')}</p>
            </div>
          ) : sortedDocuments.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              {t('admin.documents.noItems')}
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {sortedDocuments.map(document => (
                <DocumentItem
                  key={document.id}
                  document={document}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleVisibility={handleToggleVisibility}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
