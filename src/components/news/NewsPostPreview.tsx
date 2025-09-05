'use client';

import React from 'react';
import { FiUser, FiCalendar, FiEye, FiHeart, FiTag } from 'react-icons/fi';
import MarkdownPreview from '../MarkdownPreview';

type Author = {
  first_name?: string;
  last_name?: string;
  role?: string;
};

export interface NewsPostDraft {
  title: string;
  excerpt: string;
  content: string;
  media_urls: string[];
  tags: string[];
  featured?: boolean;
  pinned?: boolean;
}

interface NewsPostPreviewProps {
  draft: NewsPostDraft;
  author?: Author;
}

const NewsPostPreview: React.FC<NewsPostPreviewProps> = ({ draft, author }) => {
  const safeMedia = Array.isArray(draft.media_urls) ? draft.media_urls : [];
  const safeTags = Array.isArray(draft.tags) ? draft.tags : [];

  return (
    <div className="h-full flex flex-col">
      {/* Header Preview */}
      <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Preview</h3>
          <span className="text-xs text-gray-500">Como aparecerá no feed</span>
        </div>
      </div>

      {/* Card Preview */}
      <div className="p-4 overflow-y-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Header do Post */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <FiUser className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-gray-900">
                    {author?.first_name || 'Autor'} {author?.last_name || ''}
                  </h3>
                </div>
                <div className="flex items-center text-sm text-gray-500 space-x-2">
                  <FiCalendar className="w-4 h-4" />
                  <span>agora</span>
                  <span>•</span>
                  <FiEye className="w-4 h-4" />
                  <span>pré-visualização</span>
                </div>
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="px-4 pb-3">
            {draft.title && (
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{draft.title}</h2>
            )}
            {draft.excerpt && (
              <p className="text-gray-700 leading-relaxed mb-3">{draft.excerpt}</p>
            )}

            {/* Renderização segura do conteúdo (Markdown básico) */}
            {draft.content && (
              <MarkdownPreview content={draft.content} className="prose prose-sm max-w-none" />
            )}

            {safeTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {safeTags.map((tag, idx) => (
                  <span key={idx} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                    <FiTag className="inline-block w-3 h-3 mr-1" />#{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Mídia */}
          {safeMedia.length > 0 && (
            <div className="relative">
              <div className="grid grid-cols-1 gap-2">
                {safeMedia.map((url, index) => (
                  <div key={index} className="relative">
                    {url ? (
                      <img src={url} alt={`Mídia ${index + 1}`} className="w-full h-auto" />
                    ) : (
                      <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                        URL de mídia vazia
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ações (read-only) */}
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex items-center justify-between text-gray-500">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <FiHeart className="w-5 h-5" />
                  <span className="text-sm">0</span>
                </div>
              </div>
              <div className="text-xs">Destaques: {draft.featured ? 'Sim' : 'Não'} • Fixado: {draft.pinned ? 'Sim' : 'Não'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsPostPreview;

