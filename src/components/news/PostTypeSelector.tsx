'use client';

import React from 'react';
import { FiX, FiImage, FiVideo, FiCalendar, FiStar, FiFileText } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useI18n } from '@/contexts/I18nContext';

interface PostTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: 'photo' | 'video' | 'event' | 'highlight' | 'text') => void;
}

const PostTypeSelector: React.FC<PostTypeSelectorProps> = ({
  isOpen,
  onClose,
  onSelectType
}) => {
  if (!isOpen) return null;

  const postTypes = [
    {
      id: 'photo' as const,
      icon: FiImage,
      title: 'Foto',
      description: 'Compartilhe fotos com filtros',
      color: 'from-blue-500 to-blue-600',
      hoverColor: 'hover:from-blue-600 hover:to-blue-700'
    },
    {
      id: 'video' as const,
      icon: FiVideo,
      title: {t('components.video')},
      description: {t('components.compartilheVideos')},
      color: 'from-purple-500 to-purple-600',
      hoverColor: 'hover:from-purple-600 hover:to-purple-700'
    },
    {
      id: 'event' as const,
      icon: FiCalendar,
      title: 'Evento',
      description: {t('components.crieUmEventoNoCalendario')},
      color: 'from-green-500 to-green-600',
      hoverColor: 'hover:from-green-600 hover:to-green-700'
    },
    {
      id: 'highlight' as const,
      icon: FiStar,
      title: 'Destaque',
      description: 'Crie um destaque fixo (como Instagram)',
      color: 'from-yellow-500 to-orange-500',
      hoverColor: 'hover:from-yellow-600 hover:to-orange-600'
    },
    {
      id: 'text' as const,
      icon: FiFileText,
      title: 'Texto',
      description: {t('components.publicacaoApenasComTexto')},
      color: 'from-gray-500 to-gray-600',
      hoverColor: 'hover:from-gray-600 hover:to-gray-700'
    }
  ];

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
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Criar Publicação</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Post Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {postTypes.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                onClick={() => {
                  onSelectType(type.id);
                  onClose();
                }}
                className={`group relative overflow-hidden rounded-xl p-6 text-left transition-all duration-300 transform hover:scale-105 hover:shadow-xl bg-gradient-to-br ${type.color} ${type.hoverColor}`}
              >
                <div className="relative z-10">
                  <div className="flex items-center mb-3">
                    <div className="bg-white bg-opacity-20 backdrop-blur-sm p-3 rounded-full">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{type.title}</h3>
                  <p className="text-white text-opacity-90 text-sm">{type.description}</p>
                </div>

                {/* Decorative gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Escolha o tipo de conteúdo que deseja compartilhar
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PostTypeSelector;

