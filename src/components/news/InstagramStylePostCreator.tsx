'use client';

import React, { useState, useRef } from 'react';
import { FiX, FiArrowLeft, FiImage, FiVideo, FiSmile, FiMapPin, FiTag, FiUsers, FiCheck } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';

interface InstagramStylePostCreatorProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (post: any) => void;
}

type Step = 'select' | 'edit' | 'caption' | 'sharing';

const InstagramStylePostCreator: React.FC<InstagramStylePostCreatorProps> = ({
  userId,
  isOpen,
  onClose,
  onPostCreated
}) => {
  const { t } = useI18n();
  const [currentStep, setCurrentStep] = useState<Step>('select');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [postData, setPostData] = useState({
    title: '',
    content: '',
    location: '',
    tags: [] as string[],
    category_id: '',
    visibility: 'public'
  });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resetar estado ao fechar
  const handleClose = () => {
    setCurrentStep('select');
    setSelectedFiles([]);
    setPreviewUrls([]);
    setCurrentImageIndex(0);
    setPostData({
      title: '',
      content: '',
      location: '',
      tags: [],
      category_id: '',
      visibility: 'public'
    });
    onClose();
  };

  // Selecionar arquivos
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setSelectedFiles(files);
    
    // Criar URLs de preview
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);
    setCurrentStep('edit');
  };

  // Próximo passo
  const handleNext = () => {
    if (currentStep === 'select') {
      fileInputRef.current?.click();
    } else if (currentStep === 'edit') {
      setCurrentStep('caption');
    } else if (currentStep === 'caption') {
      setCurrentStep('sharing');
      handleShare();
    }
  };

  // Voltar
  const handleBack = () => {
    if (currentStep === 'edit') {
      setCurrentStep('select');
      setSelectedFiles([]);
      setPreviewUrls([]);
    } else if (currentStep === 'caption') {
      setCurrentStep('edit');
    } else if (currentStep === 'sharing') {
      setCurrentStep('caption');
    }
  };

  // Compartilhar post
  const handleShare = async () => {
    setIsUploading(true);

    try {
      // Upload real de imagens via API local (/api/upload) que salva em public/uploads
      let mediaUrls: string[] = [];
      if (selectedFiles.length > 0) {
        const form = new FormData();
        form.append('folder', 'posts');
        selectedFiles.forEach((file) => {
          form.append('file', file);
        });
        const uploadResp = await fetch('/api/news/upload', { method: 'POST', body: form });
        if (uploadResp.ok) {
          const uploadData = await uploadResp.json();
          mediaUrls = (uploadData.files || []).map((f: any) => f.url);
        } else {
          console.warn('Falha no upload, usando previews');
          mediaUrls = previewUrls;
        }
      } else {
        mediaUrls = previewUrls;
      }

      const newPost = {
        title: postData.title || t('components.novaPublicacao'),
        content: postData.content,
        excerpt: postData.content.substring(0, 200),
        media_urls: mediaUrls,
        external_links: [],
        author_id: userId,
        category_id: postData.category_id || null,
        tags: postData.tags,
        visibility_settings: {
          public: postData.visibility === 'public',
          roles: [],
          users: []
        },
        status: 'published'
      };

      const response = await fetchWithToken('/api/news/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost)
      });

      if (response.ok) {
        const createdPost = await response.json();
        onPostCreated(createdPost);
        handleClose();
      } else {
        throw new Error(t('newsSystem.errorCreatingPost', 'Erro ao criar post'));
      }
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      alert(t('newsSystem.errorSharingPost', 'Erro ao compartilhar post. Tente novamente.'));
    } finally {
      setIsUploading(false);
    }
  };

  // Adicionar tag
  const addTag = (tag: string) => {
    if (tag && !postData.tags.includes(tag)) {
      setPostData({
        ...postData,
        tags: [...postData.tags, tag]
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            {currentStep !== 'select' && (
              <button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <FiArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-lg font-semibold">
              {currentStep === 'select' && t('newsSystem.createPost')}
              {currentStep === 'edit' && t('newsSystem.edit')}
              {currentStep === 'caption' && t('newsSystem.newPublication')}
              {currentStep === 'sharing' && t('newsSystem.sharing')}
            </h2>
          </div>
          
          <div className="flex items-center space-x-3">
            {currentStep !== 'select' && currentStep !== 'sharing' && (
              <button
                onClick={handleNext}
                disabled={currentStep === 'caption' && !postData.content.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentStep === 'edit' ? {t('components.avancar')} : 'Compartilhar'}
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex">
          {/* Step: Select */}
          {currentStep === 'select' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                  <FiImage className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-medium mb-2">{t('newsSystem.selectMedia')}</h3>
                <p className="text-gray-500 mb-6">{t('newsSystem.selectMediaDesc')}</p>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  {t('newsSystem.selectFromComputer')}
                </button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Step: Edit */}
          {currentStep === 'edit' && (
            <div className="flex-1 flex">
              {/* Image Preview */}
              <div className="flex-1 bg-black flex items-center justify-center">
                {previewUrls.length > 0 && (
                  <img
                    src={previewUrls[currentImageIndex]}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>
              
              {/* Thumbnails */}
              {previewUrls.length > 1 && (
                <div className="w-20 bg-gray-50 p-2 space-y-2 overflow-y-auto">
                  {previewUrls.map((url, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${
                        index === currentImageIndex ? 'border-blue-500' : 'border-transparent'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Caption */}
          {currentStep === 'caption' && (
            <div className="flex-1 flex">
              {/* Image Preview */}
              <div className="w-1/2 bg-black flex items-center justify-center">
                {previewUrls.length > 0 && (
                  <img
                    src={previewUrls[currentImageIndex]}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>
              
              {/* Caption Form */}
              <div className="w-1/2 p-6 space-y-4">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
                  <span className="font-medium">Sua publicação</span>
                </div>
                
                <div>
                  <textarea
                    value={postData.content}
                    onChange={(e) => setPostData({ ...postData, content: e.target.value })}
                    placeholder={t('newsSystem.writeCaption', 'Escreva uma legenda...')}
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="text-right text-sm text-gray-500 mt-1">
                    {postData.content.length}/2200
                  </div>
                </div>

                <div className="space-y-3">
                  <button className="flex items-center space-x-3 w-full p-3 hover:bg-gray-50 rounded-lg">
                    <FiMapPin className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">Adicionar localização</span>
                  </button>
                  
                  <button className="flex items-center space-x-3 w-full p-3 hover:bg-gray-50 rounded-lg">
                    <FiTag className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">Marcar pessoas</span>
                  </button>
                  
                  <button className="flex items-center space-x-3 w-full p-3 hover:bg-gray-50 rounded-lg">
                    <FiUsers className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">Configurações de audiência</span>
                  </button>
                </div>

                {postData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {postData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step: Sharing */}
          {currentStep === 'sharing' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                  {isUploading ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  ) : (
                    <FiCheck className="w-8 h-8 text-green-600" />
                  )}
                </div>
                <h3 className="text-lg font-medium mb-2">
                  {isUploading ? 'Compartilhando...' : {t('components.publicacaoCompartilhada')}}
                </h3>
                <p className="text-gray-500">
                  {isUploading ? {t('components.aguardeEnquantoSuaPublicacaoEProcessada')} : {t('components.suaPublicacaoFoiCompartilhadaComSucesso')}}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstagramStylePostCreator;
