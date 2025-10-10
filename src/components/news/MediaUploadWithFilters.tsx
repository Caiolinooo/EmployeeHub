'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FiX, FiArrowLeft, FiCheck, FiUpload } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { fetchWithToken } from '@/lib/tokenStorage';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';

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
  const [step, setStep] = useState<'upload' | 'filter' | 'caption'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('');
  const [caption, setCaption] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setStep('filter');
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setIsSubmitting(true);
    try {
      // Upload da mídia
      const formData = new FormData();
      formData.append('folder', 'posts');
      formData.append('file', selectedFile);

      const uploadResp = await fetch('/api/news/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadResp.ok) {
        throw new Error({t('components.erroAoFazerUploadDaMidia')});
      }

      const uploadData = await uploadResp.json();
      const mediaUrls = (uploadData.files || []).map((f: any) => f.url);

      // Criar post
      const newPost = {
        title: caption || {t('components.novaPublicacao')},
        content: caption,
        excerpt: caption.substring(0, 200),
        media_urls: mediaUrls,
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
        toast.success({t('components.publicacaoCriadaComSucesso')});
        onPostCreated(createdPost);
        onClose();
      } else {
        throw new Error({t('components.erroAoCriarPublicacao')});
      }
    } catch (error) {
      console.error('Erro ao criar post:', error);
      toast.error({t('components.erroAoCriarPublicacao')});
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-90"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
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
            {step === 'upload' && `Selecionar ${mediaType === 'photo' ? 'Foto' : {t('components.video')}}`}
            {step === 'filter' && 'Aplicar Filtro'}
            {step === 'caption' && {t('components.novaPublicacao')}}
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
          {/* Upload Step */}
          {step === 'upload' && (
            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center">
                <div className="mb-6">
                  <FiUpload className="w-20 h-20 mx-auto text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  Selecione {mediaType === 'photo' ? 'uma foto' : {t('components.umVideo')}}
                </h3>
                <p className="text-gray-600 mb-6">
                  Arraste e solte ou clique para selecionar
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={mediaType === 'photo' ? 'image/*' : 'video/*'}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  Selecionar do Computador
                </button>
              </div>
            </div>
          )}

          {/* Filter Step */}
          {step === 'filter' && previewUrl && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
              {/* Preview grande */}
              <div className="md:col-span-2">
                <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className={`w-full h-full object-contain ${selectedFilter}`}
                  />
                </div>
              </div>

              {/* Filtros */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                <h3 className="font-semibold text-gray-800 mb-3">Filtros</h3>
                {filters.map((filter) => (
                  <button
                    key={filter.name}
                    onClick={() => setSelectedFilter(filter.class)}
                    className={`w-full text-left p-2 rounded-lg transition-colors ${
                      selectedFilter === filter.class
                        ? 'bg-blue-100 border-2 border-blue-600'
                        : 'hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={previewUrl}
                          alt={filter.name}
                          className={`w-full h-full object-cover ${filter.class}`}
                        />
                      </div>
                      <span className="font-medium text-gray-800">{filter.name}</span>
                      {selectedFilter === filter.class && (
                        <FiCheck className="w-5 h-5 text-blue-600 ml-auto" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Caption Step */}
          {step === 'caption' && previewUrl && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {/* Preview */}
              <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className={`w-full h-full object-contain ${selectedFilter}`}
                />
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

