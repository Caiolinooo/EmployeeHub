'use client';

import React, { useState } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import SocialFeed from '@/components/Social/SocialFeed';
import { 
  UserGroupIcon,
  HashtagIcon,
  ArrowTrendingUpIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

const SocialPage: React.FC = () => {
  const { user } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState<'feed' | 'trending' | 'hashtags'>('feed');

  const tabs = [
    {
      id: 'feed' as const,
      name: 'Feed',
      icon: UserGroupIcon,
      description: 'Posts da sua rede'
    },
    {
      id: 'trending' as const,
      name: 'Em Alta',
      icon: ArrowTrendingUpIcon,
      description: 'Posts populares'
    },
    {
      id: 'hashtags' as const,
      name: 'Hashtags',
      icon: HashtagIcon,
      description: 'Tópicos em destaque'
    }
  ];

  const trendingHashtags = [
    { tag: 'ABZTeam', count: 24 },
    { tag: 'NovoSistema', count: 18 },
    { tag: 'Equipe', count: 15 },
    { tag: 'Projetos', count: 12 },
    { tag: 'Comunicacao', count: 10 },
    { tag: 'Inovacao', count: 8 },
    { tag: 'Colaboracao', count: 6 },
    { tag: 'Sucesso', count: 5 }
  ];

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <UserGroupIcon className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">ABZ Social</h1>
                <p className="text-gray-600 mt-1">
                  Conecte-se com sua equipe e compartilhe momentos especiais
                </p>
              </div>
            </div>
            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Cog6ToothIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === 'feed' && (
              <div>
                <SocialFeed />
              </div>
            )}

            {activeTab === 'trending' && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Posts em Alta
                </h2>
                <p className="text-gray-500">
                  Em breve: posts mais curtidos e comentados da semana
                </p>
              </div>
            )}

            {activeTab === 'hashtags' && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Hashtags Populares
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {trendingHashtags.map((hashtag) => (
                    <div
                      key={hashtag.tag}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                          <HashtagIcon className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-medium text-gray-900">
                          #{hashtag.tag}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {hashtag.count} posts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* User Stats */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Sua Atividade
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Posts criados</span>
                  <span className="font-semibold text-gray-900">0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Curtidas recebidas</span>
                  <span className="font-semibold text-gray-900">0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Comentários feitos</span>
                  <span className="font-semibold text-gray-900">0</span>
                </div>
              </div>
            </div>

            {/* Trending Hashtags */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Hashtags em Alta
              </h3>
              <div className="space-y-3">
                {trendingHashtags.slice(0, 5).map((hashtag) => (
                  <div
                    key={hashtag.tag}
                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
                  >
                    <span className="text-blue-600 font-medium">
                      #{hashtag.tag}
                    </span>
                    <span className="text-sm text-gray-500">
                      {hashtag.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Ações Rápidas
              </h3>
              <div className="space-y-3">
                <button className="w-full text-left p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">
                  📝 Criar Post
                </button>
                <button className="w-full text-left p-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
                  📸 Compartilhar Foto
                </button>
                <button className="w-full text-left p-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors">
                  🎉 Celebrar Conquista
                </button>
              </div>
            </div>

            {/* Community Guidelines */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Diretrizes da Comunidade
              </h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p>• Seja respeitoso com todos os colegas</p>
                <p>• Compartilhe conteúdo relevante e profissional</p>
                <p>• Use hashtags para organizar o conteúdo</p>
                <p>• Evite spam e conteúdo inadequado</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default SocialPage;
