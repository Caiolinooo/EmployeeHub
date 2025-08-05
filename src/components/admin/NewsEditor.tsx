'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { FiSave, FiImage, FiFile, FiX, FiPlus, FiTag } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import PermissionsSelector from './PermissionsSelector';

interface NewsFormData {
  title: string;
  description: string;
  content: string;
  category: string;
  author: string;
  date: string;
  featured: boolean;
  enabled: boolean;
  adminOnly: boolean;
  managerOnly: boolean;
}

interface NewsEditorProps {
  newsId?: string;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}

export default function NewsEditor({ newsId, onSave, onCancel }: NewsEditorProps) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<NewsFormData>({
    defaultValues: {
      title: '',
      description: '',
      content: '',
      category: 'general',
      author: '',
      date: new Date().toISOString().split('T')[0],
      featured: false,
      enabled: true,
      adminOnly: false,
      managerOnly: false,
    }
  });

  const adminOnly = watch('adminOnly');
  const managerOnly = watch('managerOnly');

  // Carregar dados da notícia se estiver editando
  useEffect(() => {
    if (newsId) {
      const fetchNews = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(`/api/admin/news/${newsId}`);
          if (response.ok) {
            const data = await response.json();
            
            // Preencher o formulário com os dados
            reset({
              title: data.title,
              description: data.description,
              content: data.content || '',
              category: data.category,
              author: data.author,
              date: new Date(data.date).toISOString().split('T')[0],
              featured: data.featured,
              enabled: data.enabled,
              adminOnly: data.adminOnly || false,
              managerOnly: data.managerOnly || false,
            });
            
            // Definir previews de imagens
            if (data.thumbnail) {
              setThumbnailPreview(data.thumbnail);
            }
            
            if (data.coverImage) {
              setCoverImagePreview(data.coverImage);
            }
            
            // Definir tags
            if (data.tags) {
              setTags(Array.isArray(data.tags) ? data.tags : []);
            }
            
            // Definir permissões
            if (data.allowedRoles) {
              setAllowedRoles(Array.isArray(data.allowedRoles) ? data.allowedRoles : []);
            }
            
            if (data.allowedUserIds) {
              setAllowedUserIds(Array.isArray(data.allowedUserIds) ? data.allowedUserIds : []);
            }
          } else {
            throw new Error(t('admin.errorLoadingNews'));
          }
        } catch (error) {
          console.error('Erro ao carregar notícia:', error);
          setError(t('admin.errorLoadingNews'));
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchNews();
    }
  }, [newsId, reset]);

  // Função para lidar com upload de imagem de miniatura
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setThumbnailFile(file);
      
      // Criar preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Função para lidar com upload de imagem de capa
  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setCoverImageFile(file);
      
      // Criar preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Função para lidar com upload de arquivo anexo
  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAttachmentFile(e.target.files[0]);
    }
  };

  // Função para adicionar tag
  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  // Função para remover tag
  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  // Função para fazer upload de arquivo
  const uploadFile = async (file: File, type: string): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.files[0].url;
      } else {
        console.error(`Erro ao fazer upload do ${type}`);
        return null;
      }
    } catch (error) {
      console.error(`Erro ao fazer upload do ${type}:`, error);
      return null;
    }
  };

  // Função para salvar notícia
  const onSubmit = async (formData: NewsFormData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let thumbnailUrl = thumbnailPreview;
      let coverImageUrl = coverImagePreview;
      let attachmentUrl = null;
      
      // Fazer upload da miniatura, se houver
      if (thumbnailFile) {
        thumbnailUrl = await uploadFile(thumbnailFile, 'images');
      }
      
      // Fazer upload da imagem de capa, se houver
      if (coverImageFile) {
        coverImageUrl = await uploadFile(coverImageFile, 'images');
      }
      
      // Fazer upload do anexo, se houver
      if (attachmentFile) {
        attachmentUrl = await uploadFile(attachmentFile, 'documents');
      }
      
      // Preparar dados para salvar
      const newsData = {
        ...formData,
        date: new Date(formData.date),
        thumbnail: thumbnailUrl,
        coverImage: coverImageUrl,
        file: attachmentUrl,
        tags,
        allowedRoles,
        allowedUserIds,
      };
      
      // Chamar função de salvamento
      await onSave(newsData);
    } catch (error) {
      console.error('Erro ao salvar notícia:', error);
      setError(t('admin.errorSavingNews'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg font-medium leading-6 text-gray-900">
          {newsId ? t('admin.editNews') : t('admin.addNews')}
        </h3>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md m-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        {/* Informações básicas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.newsTitle')} *
            </label>
            <input
              type="text"
              id="title"
              {...register('title', { required: true })}
              className={`w-full px-3 py-2 border ${errors.title ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue`}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{t('admin.fieldRequired')}</p>
            )}
          </div>
          
          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.newsDescription')} *
            </label>
            <textarea
              id="description"
              {...register('description', { required: true })}
              rows={2}
              className={`w-full px-3 py-2 border ${errors.description ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue`}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{t('admin.fieldRequired')}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.category')} *
            </label>
            <select
              id="category"
              {...register('category', { required: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
            >
              <option value="general">{t('admin.categoryGeneral')}</option>
              <option value="announcement">{t('admin.categoryAnnouncement')}</option>
              <option value="event">{t('admin.categoryEvent')}</option>
              <option value="update">{t('admin.categoryUpdate')}</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.author')} *
            </label>
            <input
              type="text"
              id="author"
              {...register('author', { required: true })}
              className={`w-full px-3 py-2 border ${errors.author ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue`}
            />
            {errors.author && (
              <p className="mt-1 text-sm text-red-600">{t('admin.fieldRequired')}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.date')} *
            </label>
            <input
              type="date"
              id="date"
              {...register('date', { required: true })}
              className={`w-full px-3 py-2 border ${errors.date ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue`}
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{t('admin.fieldRequired')}</p>
            )}
          </div>
          
          <div className="flex space-x-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="featured"
                {...register('featured')}
                className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
              />
              <label htmlFor="featured" className="ml-2 block text-sm text-gray-700">
                {t('admin.featured')}
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="enabled"
                {...register('enabled')}
                className="h-4 w-4 text-abz-blue focus:ring-abz-blue border-gray-300 rounded"
              />
              <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700">
                {t('admin.enabled')}
              </label>
            </div>
          </div>
        </div>
        
        {/* Conteúdo */}
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
            {t('admin.newsContent')} *
          </label>
          <textarea
            id="content"
            {...register('content', { required: true })}
            rows={10}
            className={`w-full px-3 py-2 border ${errors.content ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue`}
          />
          {errors.content && (
            <p className="mt-1 text-sm text-red-600">{t('admin.fieldRequired')}</p>
          )}
        </div>
        
        {/* Imagens e arquivos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.thumbnail')}
            </label>
            <div className="mt-1 flex items-center">
              <div className="flex-shrink-0">
                {thumbnailPreview ? (
                  <div className="relative h-24 w-24 rounded-md overflow-hidden bg-gray-100">
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setThumbnailPreview(null);
                        setThumbnailFile(null);
                      }}
                      className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-bl-md"
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="h-24 w-24 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                    <FiImage className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="ml-4 flex-1">
                <div className="relative rounded-md shadow-sm">
                  <input
                    type="file"
                    id="thumbnail"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    className="sr-only"
                  />
                  <label
                    htmlFor="thumbnail"
                    className="cursor-pointer py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
                  >
                    {t('admin.chooseImage')}
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {t('admin.thumbnailDescription')}
                </p>
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.coverImage')}
            </label>
            <div className="mt-1 flex items-center">
              <div className="flex-shrink-0">
                {coverImagePreview ? (
                  <div className="relative h-24 w-40 rounded-md overflow-hidden bg-gray-100">
                    <img
                      src={coverImagePreview}
                      alt="Cover image preview"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCoverImagePreview(null);
                        setCoverImageFile(null);
                      }}
                      className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-bl-md"
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="h-24 w-40 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                    <FiImage className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="ml-4 flex-1">
                <div className="relative rounded-md shadow-sm">
                  <input
                    type="file"
                    id="coverImage"
                    accept="image/*"
                    onChange={handleCoverImageChange}
                    className="sr-only"
                  />
                  <label
                    htmlFor="coverImage"
                    className="cursor-pointer py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
                  >
                    {t('admin.chooseImage')}
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {t('admin.coverImageDescription')}
                </p>
              </div>
            </div>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.attachment')}
            </label>
            <div className="mt-1 flex items-center">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                  <FiFile className="h-6 w-6 text-gray-400" />
                </div>
              </div>
              <div className="ml-4 flex-1">
                <div className="relative rounded-md shadow-sm">
                  <input
                    type="file"
                    id="attachment"
                    onChange={handleAttachmentChange}
                    className="sr-only"
                  />
                  <label
                    htmlFor="attachment"
                    className="cursor-pointer py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
                  >
                    {t('admin.chooseFile')}
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {attachmentFile ? attachmentFile.name : t('admin.attachmentDescription')}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('admin.tags')}
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map(tag => (
              <div 
                key={tag} 
                className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs flex items-center"
              >
                <FiTag className="mr-1" />
                <span>{tag}</span>
                <button 
                  type="button" 
                  onClick={() => removeTag(tag)}
                  className="ml-1 text-blue-500 hover:text-blue-700"
                >
                  <FiX />
                </button>
              </div>
            ))}
          </div>
          <div className="flex">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder={t('admin.addTag')}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-abz-blue focus:border-abz-blue"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-700 hover:bg-gray-100"
            >
              <FiPlus />
            </button>
          </div>
        </div>
        
        {/* Permissões */}
        <PermissionsSelector
          adminOnly={adminOnly}
          managerOnly={managerOnly}
          allowedRoles={allowedRoles}
          allowedUserIds={allowedUserIds}
          onAdminOnlyChange={(value) => setValue('adminOnly', value)}
          onManagerOnlyChange={(value) => setValue('managerOnly', value)}
          onAllowedRolesChange={setAllowedRoles}
          onAllowedUserIdsChange={setAllowedUserIds}
        />
        
        {/* Botões */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-abz-blue hover:bg-abz-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-abz-blue disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                {t('common.saving')}
              </>
            ) : (
              <>
                <FiSave className="inline-block mr-2" />
                {t('common.save')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
