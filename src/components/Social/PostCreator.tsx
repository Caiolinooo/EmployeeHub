'use client';

import React, { useState } from 'react';
import { 
  XMarkIcon,
  PhotoIcon,
  FaceSmileIcon,
  HashtagIcon,
  AtSymbolIcon
} from '@heroicons/react/24/outline';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_photo_url?: string;
}

interface Post {
  id: string;
  content: string;
  image_url?: string;
  image_urls?: string[];
  hashtags?: string[];
  mentions?: string[];
  created_at: string;
  updated_at: string;
  user: User;
  likes_count: number;
  comments_count: number;
  user_liked: boolean;
}

interface PostCreatorProps {
  onClose: () => void;
  onPostCreated: (post: Post) => void;
}

const PostCreator: React.FC<PostCreatorProps> = ({ onClose, onPostCreated }) => {
  const { user, getToken } = useSupabaseAuth();
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('Por favor, escreva algo para postar');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        setError({t('components.erroDeAutenticacao')});
        return;
      }

      const postData = {
        content: content.trim(),
        image_url: imageUrl.trim() || null,
        visibility: 'public'
      };

      const response = await fetch('/api/social/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(postData)
      });

      if (response.ok) {
        const data = await response.json();
        onPostCreated(data.post);
        setContent('');
        setImageUrl('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Erro ao criar post');
      }
    } catch (err) {
      console.error('Erro ao criar post:', err);
      setError('Erro ao criar post');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Criar Post</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4">
          {/* User info */}
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              {user?.profile_photo_url ? (
                <img
                  src={user.profile_photo_url}
                  alt={`${user.first_name} ${user.last_name}`}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <span className="text-white font-medium">
                  {user?.first_name?.charAt(0) || 'U'}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-medium text-gray-900">
                {user?.first_name} {user?.last_name}
              </h3>
              <p className="text-sm text-gray-500">Público</p>
            </div>
          </div>

          {/* Content textarea */}
          <div className="mb-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={{t('components.noQueVoceEstaPensandoUserfirstname')}}
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              maxLength={2000}
            />
            <div className="flex justify-between items-center mt-2">
              <div className="text-sm text-gray-500">
                Use # para hashtags e @ para mencionar pessoas
              </div>
              <div className="text-sm text-gray-500">
                {content.length}/2000
              </div>
            </div>
          </div>

          {/* Image URL input */}
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <PhotoIcon className="w-5 h-5 text-gray-400" />
              <label className="text-sm font-medium text-gray-700">
                URL da Imagem (opcional)
              </label>
            </div>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://exemplo.com/imagem.jpg"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Image preview */}
          {imageUrl && (
            <div className="mb-4">
              <img
                src={imageUrl}
                alt="Preview"
                className="w-full rounded-lg object-cover max-h-48"
                onError={() => setImageUrl('')}
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                className="flex items-center space-x-2 text-gray-500 hover:text-blue-600 transition-colors"
                title="Adicionar emoji"
              >
                <FaceSmileIcon className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="flex items-center space-x-2 text-gray-500 hover:text-blue-600 transition-colors"
                title="Adicionar hashtag"
              >
                <HashtagIcon className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="flex items-center space-x-2 text-gray-500 hover:text-blue-600 transition-colors"
                title="Mencionar pessoa"
              >
                <AtSymbolIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !content.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Postando...' : 'Postar'}
              </button>
            </div>
          </div>

          {/* Keyboard shortcut hint */}
          <div className="mt-3 text-xs text-gray-500 text-center">
            Pressione Ctrl+Enter para postar rapidamente
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostCreator;
