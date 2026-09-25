'use client';

import React, { useState, useRef } from 'react';
import { FiX, FiArrowLeft, FiImage, FiVideo, FiSmile, FiMapPin, FiTag, FiUsers, FiCheck } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { fetchWithToken } from '@/lib/tokenStorage';
import { toSafeMediaUrl } from '@/lib/security/safe-media-url';
import { compressVideo, needsCompression } from '@/lib/videoCompression';

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
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper para verificar se arquivo é vídeo
  const isVideoFile = (index: number): boolean => {
    const file = selectedFiles[index];
    return file?.type?.startsWith('video/') || false;
  };

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
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const filesArray = Array.from(event.target.files || []);
    if (filesArray.length === 0) return;

    try {
      const processedFiles: File[] = [];
      let needsCompression = false;

      // Verificar se algum arquivo precisa de compressão
      for (const file of filesArray) {
        if (file.type.startsWith('video/') && file.size > 50 * 1024 * 1024) {
          needsCompression = true;
          break;
        }
      }

      // Se precisa de compressão, mostrar indicador
      if (needsCompression) {
        setIsCompressing(true);
        setCompressionProgress('Preparando compressão...');
      }

      for (const file of filesArray) {
        // Comprimir vídeos grandes
        if (file.type.startsWith('video/') && file.size > 50 * 1024 * 1024) {
          const sizeMB = (file.size / 1024 / 1024).toFixed(2);
          setCompressionProgress(`Comprimindo ${file.name} (${sizeMB}MB)...`);

          try {
            const compressed = await compressVideo(
              file,
              45, // Target 45MB
              (msg) => setCompressionProgress(msg)
            );
            processedFiles.push(compressed);
          } catch (error) {
            console.error('Erro ao comprimir:', error);
            const useOriginal = confirm(
              `Não foi possível comprimir "${file.name}".\n\nTentar enviar o arquivo original? (Pode falhar se > 50MB)`
            );
            if (useOriginal) {
              processedFiles.push(file);
            } else {
              setIsCompressing(false);
              setCompressionProgress('');
              if (event.target) event.target.value = '';
              return;
            }
          }
        } else {
          processedFiles.push(file);
        }
      }

      // Validação final de tamanho
      const oversized = processedFiles.filter(f => f.size > 50 * 1024 * 1024);
      if (oversized.length > 0) {
        alert(
          `Arquivos ainda muito grandes:\n\n${oversized.map(f =>
            `${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB)`
          ).join('\n')}\n\nPor favor, comprima manualmente.`
        );
        if (event.target) event.target.value = '';
        setIsCompressing(false);
        setCompressionProgress('');
        return;
      }

      setSelectedFiles(processedFiles);
      const urls = processedFiles.map(file => URL.createObjectURL(file));
      setPreviewUrls(urls);
      setCurrentStep('edit');

    } catch (error) {
      console.error('Erro ao processar arquivos:', error);
      alert('Erro ao processar arquivos. Tente novamente.');
      if (event.target) event.target.value = '';
    } finally {
      setIsCompressing(false);
      setCompressionProgress('');
    }
  };

  // Próximo passo
  const handleNext = () => {
    if (currentStep === 'select') {
      fileInputRef.current?.click();
    } else if (currentStep === 'edit') {
      setCurrentStep('caption');
    } else if (currentStep === 'caption') {
      // Limpar erros anteriores e iniciar compartilhamento
      setUploadError(null);
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
    setUploadError(null);
    setCurrentStep('sharing'); // Mudar para tela de progresso

    try {
      console.log('🚀 [SHARE] Iniciando compartilhamento...');
      console.log('📎 [SHARE] Arquivos selecionados:', selectedFiles.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB, ${f.type})`));

      // Upload real de mídias via API
      let mediaUrls: string[] = [];
      if (selectedFiles.length > 0) {
        console.log('⬆️ [SHARE] Iniciando upload de', selectedFiles.length, 'arquivo(s)...');

        const form = new FormData();
        form.append('folder', 'posts');
        selectedFiles.forEach((file) => {
          form.append('file', file);
        });

        const uploadResp = await fetch('/api/news/upload', { method: 'POST', body: form });

        if (uploadResp.ok) {
          const uploadData = await uploadResp.json();
          mediaUrls = (uploadData.files || []).map((f: any) => f.url);
          console.log('✅ [SHARE] Upload bem-sucedido! URLs:', mediaUrls);

          // Mostrar logs de debug de sucesso
          if (uploadData.debugLogs) {
            console.log('📋 [UPLOAD DEBUG LOGS]');
            uploadData.debugLogs.forEach((log: string) => console.log(log));
          }
        } else {
          // Tentar obter detalhes do erro
          const errorData = await uploadResp.json().catch(() => null);

          console.error('❌ [UPLOAD FAILED]');
          console.error('Status:', uploadResp.status);
          console.error('Status Text:', uploadResp.statusText);

          let errorMessage = 'Erro ao fazer upload da mídia';

          if (errorData) {
            console.error('Erro:', errorData.error);
            console.error('Detalhes:', errorData.details);

            // Mostrar logs de debug
            if (errorData.debugLogs) {
              console.error('📋 [DEBUG LOGS DO SERVIDOR]');
              errorData.debugLogs.forEach((log: string) => console.error(log));
            }

            // Mensagem de erro mais amigável
            if (uploadResp.status === 413) {
              errorMessage = `Arquivo muito grande: ${errorData.details || 'O limite é 50MB por arquivo.'}`;
            } else {
              errorMessage = errorData.details || errorData.error || 'Erro desconhecido no upload';
            }
          }

          throw new Error(errorMessage);
        }
      }

      console.log('📝 [SHARE] Criando post no banco de dados...');

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
        console.log('✅ [SHARE] Post criado com sucesso! ID:', createdPost.id);
        onPostCreated(createdPost);

        // Pequeno delay para mostrar sucesso antes de fechar
        setTimeout(() => handleClose(), 1500);
      } else {
        const errorData = await response.json().catch(() => null);
        console.error('❌ [SHARE] Erro ao criar post:', errorData);
        throw new Error(errorData?.error || t('newsSystem.errorCreatingPost', 'Erro ao criar post'));
      }
    } catch (error) {
      console.error('💥 [SHARE] Erro ao compartilhar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao compartilhar post. Tente novamente.';
      setUploadError(errorMessage);
      // Voltar para o step de caption para permitir retry
      setCurrentStep('caption');
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
                {currentStep === 'edit' ? t('components.avancar') : 'Compartilhar'}
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
          {/* Compression Progress Overlay */}
          {isCompressing && (
            <div className="flex-1 flex items-center justify-center p-8 bg-white">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mb-6 mx-auto">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-gray-900">Comprimindo Vídeo</h3>
                <p className="text-gray-600 mb-4">
                  Estamos otimizando seu vídeo para upload. Isso pode levar alguns minutos...
                </p>
                {compressionProgress && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-800 font-medium">{compressionProgress}</p>
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  💡 Dica: Vídeos menores uploadam mais rápido e economizam dados!
                </p>
              </div>
            </div>
          )}

          {/* Step: Select */}
          {!isCompressing && currentStep === 'select' && (
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
          {!isCompressing && currentStep === 'edit' && (
            <div className="flex-1 flex">
              {/* Media Preview */}
              <div className="flex-1 bg-black flex items-center justify-center">
                {previewUrls.length > 0 && (
                  isVideoFile(currentImageIndex) ? (
                    <video
                      src={toSafeMediaUrl(previewUrls[currentImageIndex])}
                      controls
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <img
                      src={toSafeMediaUrl(previewUrls[currentImageIndex])}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  )
                )}
              </div>

              {/* Thumbnails */}
              {previewUrls.length > 1 && (
                <div className="w-20 bg-gray-50 p-2 space-y-2 overflow-y-auto">
                  {previewUrls.map((url, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${index === currentImageIndex ? 'border-blue-500' : 'border-transparent'
                        }`}
                    >
                      {isVideoFile(index) ? (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                          <FiVideo className="w-6 h-6 text-white" />
                        </div>
                      ) : (
                        <img
                          src={toSafeMediaUrl(url)}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Caption */}
          {!isCompressing && currentStep === 'caption' && (
            <div className="flex-1 flex">
              {/* Media Preview */}
              <div className="w-1/2 bg-black flex items-center justify-center">
                {previewUrls.length > 0 && (
                  isVideoFile(currentImageIndex) ? (
                    <video
                      src={toSafeMediaUrl(previewUrls[currentImageIndex])}
                      controls
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <img
                      src={toSafeMediaUrl(previewUrls[currentImageIndex])}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  )
                )}
              </div>

              {/* Caption Form */}
              <div className="w-1/2 p-6 space-y-4">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
                  <span className="font-medium">Sua publicação</span>
                </div>

                {/* Error Message */}
                {uploadError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-2">
                      <FiX className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800">Erro ao compartilhar</p>
                        <p className="text-sm text-red-600 mt-1">{uploadError}</p>
                      </div>
                    </div>
                  </div>
                )}

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
          {!isCompressing && currentStep === 'sharing' && (
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
                  {isUploading ? 'Compartilhando...' : t('components.publicacaoCompartilhada')}
                </h3>
                <p className="text-gray-500">
                  {isUploading ? t('components.aguardeEnquantoSuaPublicacaoEProcessada') : t('components.suaPublicacaoFoiCompartilhadaComSucesso')}
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
