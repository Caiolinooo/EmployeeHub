'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FiX, FiArrowLeft, FiCheck, FiUpload } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { fetchWithToken } from '@/lib/tokenStorage';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';
import { toSafeMediaUrl } from '@/lib/security/safe-media-url';
import { compressVideo, needsCompression } from '@/lib/videoCompression';

interface MediaUploadWithFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onPostCreated: (post: any) => void;
  mediaType: 'photo' | 'video';
}

// Filtros CSS estilo Instagram
const filters = [
  { name: 'Normal', class: '' },
  { name: 'Clarendon', class: 'brightness-110 contrast-110 saturate-125' },
  { name: 'Gingham', class: 'brightness-105 hue-rotate-15' },
  { name: 'Moon', class: 'grayscale brightness-110 contrast-110' },
  { name: 'Lark', class: 'contrast-90 saturate-110 brightness-110' },
  { name: 'Reyes', class: 'sepia-22 brightness-110 contrast-85 saturate-75' },
  { name: 'Juno', class: 'contrast-120 saturate-140 brightness-110' },
  { name: 'Slumber', class: 'saturate-66 brightness-105' },
  { name: 'Crema', class: 'sepia-50 contrast-125' },
  { name: 'Ludwig', class: 'brightness-105 saturate-140' },
  { name: 'Aden', class: 'hue-rotate-20 contrast-90 saturate-85 brightness-120' },
  { name: 'Perpetua', class: 'contrast-110 brightness-110' }
];

const MediaUploadWithFilters: React.FC<MediaUploadWithFiltersProps> = ({
  isOpen,
  onClose,
  userId,
  onPostCreated,
  mediaType
}) => {
  const { t } = useI18n();
  const [step, setStep] = useState<'upload' | 'filter' | 'caption'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('');
  const [caption, setCaption] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset ao fechar
      setStep('upload');
      setSelectedFile(null);
      setPreviewUrl('');
      setSelectedFilter('');
      setCaption('');
      setLocation('');
    }
  }, [isOpen]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let processedFile = file;

      // Comprimir vídeos grandes
      if (file.type.startsWith('video/') && file.size > 50 * 1024 * 1024) {
        setIsCompressing(true);
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        setCompressionProgress(`Vídeo grande detectado (${sizeMB}MB). Comprimindo...`);

        try {
          processedFile = await compressVideo(
            file,
            45,
            (msg) => setCompressionProgress(msg)
          );
          toast.success(`Vídeo comprimido de ${sizeMB}MB para ${(processedFile.size / 1024 / 1024).toFixed(2)}MB`);
        } catch (error) {
          console.error('Erro ao comprimir:', error);
          const useOriginal = confirm(
            `Não foi possível comprimir o vídeo.\n\nTentar enviar o arquivo original? (Pode falhar se > 50MB)`
          );
          if (!useOriginal) {
            setIsCompressing(false);
            setCompressionProgress('');
            if (e.target) e.target.value = '';
            return;
          }
        } finally {
          setIsCompressing(false);
          setCompressionProgress('');
        }
      }

      // Validação final
      if (processedFile.size > 50 * 1024 * 1024) {
        toast.error(`Arquivo muito grande: ${(processedFile.size / 1024 / 1024).toFixed(2)}MB. Limite: 50MB`);
        if (e.target) e.target.value = '';
        return;
      }

      setSelectedFile(processedFile);
      const url = URL.createObjectURL(processedFile);
      setPreviewUrl(url);
      setStep('filter');
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro ao processar arquivo');
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setIsSubmitting(true);
    try {
      // 1. Obter URL assinada para upload
      const folder = 'posts';
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      const signedUrlResp = await fetchWithToken('/api/news/signed-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filePath,
          fileType: selectedFile.type
        })
      });

      if (!signedUrlResp.ok) {
        throw new Error('Falha ao obter permissão de upload');
      }

      const { signedUrl, path, token } = await signedUrlResp.json();

      // 2. Upload direto para o Supabase Storage usando URL assinada
      const { data, error: uploadError } = await (await import('@/lib/supabase')).supabase.storage
        .from('news')
        .uploadToSignedUrl(path, token, selectedFile);

      if (uploadError) {
        console.error('Erro detalhado do upload:', uploadError);
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      // 3. Obter URL pública
      const { data: publicUrlData } = (await import('@/lib/supabase')).supabase.storage
        .from('news')
        .getPublicUrl(path);

      const mediaUrl = publicUrlData.publicUrl;

      // 4. Criar post (mantém chamada à API de posts)
      const newPost = {
        title: caption || t('components.novaPublicacao'),
        content: caption,
        excerpt: caption.substring(0, 200),
        media_urls: [mediaUrl],
        external_links: [],
        author_id: userId,
        category_id: null,
        tags: [],
        visibility_settings: {
          public: true,
          roles: [],
          users: []
        },
        metadata: {
          filter: selectedFilter,
          location: location,
          mediaType: mediaType
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
        toast.success(t('components.publicacaoCriadaComSucesso'));
        onPostCreated(createdPost);
        onClose();
      } else {
        throw new Error(t('components.erroAoCriarPublicacao'));
      }
    } catch (error: any) {
      console.error('Erro ao criar post:', error);
      toast.error(error.message || t('components.erroAoCriarPublicacao'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col relative z-[10000]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          {step !== 'upload' && (
            <button
              onClick={() => setStep(step === 'caption' ? 'filter' : 'upload')}
              className="text-gray-600 hover:text-gray-800"
            >
              <FiArrowLeft className="w-6 h-6" />
            </button>
          )}
          <h2 className="text-xl font-bold text-gray-800 flex-1 text-center">
            {step === 'upload' && `Selecionar ${mediaType === 'photo' ? 'Foto' : t('components.video')}`}
            {step === 'filter' && 'Aplicar Filtro'}
            {step === 'caption' && t('components.novaPublicacao')}
          </h2>
          {step === 'caption' ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="text-blue-600 hover:text-blue-700 font-semibold disabled:opacity-50"
            >
              {isSubmitting ? 'Publicando...' : 'Compartilhar'}
            </button>
          ) : step === 'filter' ? (
            <button
              onClick={() => setStep('caption')}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              Avançar
            </button>
          ) : (
            <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
              <FiX className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {/* Compression Progress Overlay */}
          {isCompressing && (
            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mb-6 mx-auto">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
                </div>
                <h3 className="text-xl font-semibold mb-3">Comprimindo Vídeo</h3>
                <p className="text-gray-600 mb-4">
                  Estamos otimizando seu vídeo para upload. Isso pode levar alguns minutos...
                </p>
                {compressionProgress && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 font-medium">{compressionProgress}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Step */}
          {!isCompressing && step === 'upload' && (
            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center">
                <div className="mb-6">
                  <FiUpload className="w-20 h-20 mx-auto text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  {t('newsSystem.selectMedia')}
                </h3>
                <p className="text-gray-600 mb-6">
                  {t('newsSystem.dragAndDrop', 'Arraste e solte ou clique para selecionar')}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  {t('newsSystem.selectFromComputer')}
                </button>
              </div>
            </div>
          )}

          {/* Filter Step */}
          {!isCompressing && step === 'filter' && previewUrl && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
              {/* Preview grande */}
              <div className="md:col-span-2">
                <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                  {selectedFile?.type.startsWith('video/') ? (
                    <video
                      src={toSafeMediaUrl(previewUrl)}
                      className={`w-full h-full object-contain ${selectedFilter}`}
                      controls
                      playsInline
                    />
                  ) : (
                    <img
                      src={toSafeMediaUrl(previewUrl)}
                      alt="Preview"
                      className={`w-full h-full object-contain ${selectedFilter}`}
                    />
                  )}
                </div>
              </div>

              {/* Filtros */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                <h3 className="font-semibold text-gray-800 mb-3 sticky top-0 bg-white py-2 z-10">Filtros</h3>
                {filters.map((filter) => (
                  <button
                    key={filter.name}
                    onClick={() => setSelectedFilter(filter.class)}
                    className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${selectedFilter === filter.class
                      ? 'bg-blue-100 border-2 border-blue-600 shadow-md'
                      : 'hover:bg-gray-100 border-2 border-transparent hover:shadow-sm'
                      }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 border-gray-200 shadow-sm">
                        {selectedFile?.type.startsWith('video/') ? (
                          <video
                            src={toSafeMediaUrl(previewUrl)}
                            className={`w-full h-full object-cover ${filter.class}`}
                            muted
                            playsInline
                          />
                        ) : (
                          <img
                            src={toSafeMediaUrl(previewUrl)}
                            alt={filter.name}
                            className={`w-full h-full object-cover ${filter.class}`}
                            loading="lazy"
                          />
                        )}
                      </div>
                      <span className="font-medium text-gray-800 flex-1">{filter.name}</span>
                      {selectedFilter === filter.class && (
                        <FiCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Caption Step */}
          {!isCompressing && step === 'caption' && previewUrl && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {/* Preview */}
              <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                {selectedFile?.type.startsWith('video/') ? (
                  <video
                    src={toSafeMediaUrl(previewUrl)}
                    className={`w-full h-full object-contain ${selectedFilter}`}
                    controls
                    playsInline
                  />
                ) : (
                  <img
                    src={toSafeMediaUrl(previewUrl)}
                    alt="Preview"
                    className={`w-full h-full object-contain ${selectedFilter}`}
                  />
                )}
              </div>

              {/* Caption form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Legenda
                  </label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Escreva uma legenda..."
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Localização (opcional)
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t('components.adicionarLocalizacao')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MediaUploadWithFilters;

