'use client';

import React, { useState } from 'react';
import { FiX, FiFileText } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { fetchWithToken } from '@/lib/tokenStorage';
import toast from 'react-hot-toast';
import { useI18n } from '@/contexts/I18nContext';

interface TextPostCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onPostCreated: (post: any) => void;
}

const TextPostCreator: React.FC<TextPostCreatorProps> = ({
  isOpen,
  onClose,
  userId,
  onPostCreated
}) => {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error(t('newsSystem.contentRequired', 'O conteúdo é obrigatório'));
      return;
    }

    setIsSubmitting(true);
    try {
      const newPost = {
        title: title || t('newsSystem.newPost', 'Nova publicação'),
        content: content,
        excerpt: content.substring(0, 200),
        media_urls: [],
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
          type: 'text'
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
        toast.success(t('newsSystem.postCreated', 'Publicação criada com sucesso!'));
        onPostCreated(createdPost);
        onClose();
        
        // Reset
        setTitle('');
        setContent('');
      } else {
        throw new Error(t('newsSystem.errorCreatingPost', 'Erro ao criar publicação'));
      }
    } catch (error) {
      console.error('Erro ao criar post:', error);
      toast.error(t('newsSystem.errorCreatingPost', 'Erro ao criar publicação'));
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
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="bg-gray-100 p-3 rounded-full">
              <FiFileText className="w-6 h-6 text-gray-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">
              {t('newsSystem.createTextPost', 'Criar Publicação')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Título (opcional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('newsSystem.title', 'Título')} ({t('common.optional', 'opcional')})
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('newsSystem.titlePlaceholder', 'Digite um título...')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Conteúdo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('newsSystem.content', 'Conteúdo')} *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('newsSystem.whatAreYouThinking', 'O que você está pensando?')}
              rows={8}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <div className="mt-2 text-sm text-gray-500 text-right">
              {content.length} {t('common.characters', 'caracteres')}
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              💡 {t('newsSystem.textPostTip', 'Dica: Use quebras de linha para organizar melhor seu texto.')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t('common.cancel', 'Cancelar')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t('common.publishing', 'Publicando...') : t('common.publish', 'Publicar')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TextPostCreator;

