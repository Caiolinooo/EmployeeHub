'use client';

import React, { useState, useRef } from 'react';
import { FiX, FiUpload, FiStar, FiImage } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { fetchWithToken } from '@/lib/tokenStorage';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';

interface HighlightCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onHighlightCreated: (highlight: any) => void;
}

const HighlightCreator: React.FC<HighlightCreatorProps> = ({
  isOpen,
  onClose,
  userId,
  onHighlightCreated
}) => {
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isPermanent, setIsPermanent] = useState(false);
  const [expiresIn, setExpiresIn] = useState('24'); // horas
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = async () => {
    if (!title || !selectedFile) {
      toast.error(t('components.preenchaTodosOsCamposObrigatorios'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload da mídia
      const formData = new FormData();
      formData.append('folder', 'highlights');
      formData.append('file', selectedFile);

      const uploadResp = await fetch('/api/news/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadResp.ok) {
        throw new Error(t('components.erroAoFazerUploadDaMidia'));
      }

      const uploadData = await uploadResp.json();
      const mediaUrls = (uploadData.files || []).map((f: any) => f.url);

      // Calcular data de expiração
      let expiresAt = null;
      if (!isPermanent) {
        const now = new Date();
        now.setHours(now.getHours() + parseInt(expiresIn));
        expiresAt = now.toISOString();
      }

      // Criar highlight
      const highlightData = {
        title,
        content: `✨ Destaque: ${title}`,
        excerpt: title,
        media_urls: mediaUrls,
        external_links: [],
        author_id: userId,
        category_id: null,
        tags: ['destaque', 'highlight'],
        visibility_settings: {
          public: true,
          roles: [],
          users: []
        },
        metadata: {
          type: 'highlight',
          isPermanent,
          expiresAt,
          viewCount: 0
        },
        featured: true, // Marcar como destaque
        status: 'published'
      };

      const response = await fetchWithToken('/api/news/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(highlightData)
      });

      if (response.ok) {
        const createdHighlight = await response.json();
        toast.success('Destaque criado com sucesso!');
        onHighlightCreated(createdHighlight);
        onClose();
        
        // Reset
        setTitle('');
        setSelectedFile(null);
        setPreviewUrl('');
        setIsPermanent(false);
        setExpiresIn('24');
      } else {
        throw new Error('Erro ao criar destaque');
      }
    } catch (error) {
      console.error('Erro ao criar highlight:', error);
      toast.error('Erro ao criar destaque');
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-yellow-500 to-orange-500">
          <div className="flex items-center space-x-3">
            <div className="bg-white bg-opacity-20 backdrop-blur-sm p-3 rounded-full">
              <FiStar className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Criar Destaque</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-100 transition-colors p-2 rounded-full hover:bg-white hover:bg-opacity-20"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Preview */}
          {previewUrl ? (
            <div className="relative">
              <div className="aspect-[9/16] max-w-xs mx-auto bg-black rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                {/* Overlay estilo Instagram Stories */}
                <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black to-transparent">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full" />
                    <span className="text-white font-semibold text-sm">{title || 'Seu Destaque'}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl('');
                }}
                className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-yellow-500 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <FiImage className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">Clique para selecionar uma imagem</p>
              <p className="text-sm text-gray-500">Formato vertical (9:16) recomendado</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título do Destaque *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Novidades, Eventos, Conquistas..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>

          {/* Opções de Duração */}
          <div className="space-y-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPermanent}
                onChange={(e) => setIsPermanent(e.target.checked)}
                className="w-5 h-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
              />
              <span className="text-sm text-gray-700 font-medium">
                Destaque Permanente (não expira)
              </span>
            </label>

            {!isPermanent && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expira em (horas)
                </label>
                <select
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                >
                  <option value="1">1 hora</option>
                  <option value="6">6 horas</option>
                  <option value="12">12 horas</option>
                  <option value="24">24 horas (padrão)</option>
                  <option value="48">48 horas</option>
                  <option value="72">72 horas</option>
                  <option value="168">1 semana</option>
                </select>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <FiStar className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold mb-1">Como funcionam os Destaques?</p>
                <ul className="list-disc list-inside space-y-1 text-yellow-700">
                  <li>Aparecem no topo do feed em círculos coloridos</li>
                  <li>Podem ser permanentes ou temporários</li>
                  <li>Usuários podem ver quantas vezes foram visualizados</li>
                  <li>Formato vertical é recomendado (como Stories do Instagram)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title || !selectedFile}
            className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Criando...' : 'Criar Destaque'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default HighlightCreator;

