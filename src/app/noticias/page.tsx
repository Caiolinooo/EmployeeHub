'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import NewsFeed from '@/components/news/NewsFeed';
import { FiSearch, FiX } from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

// Página unificada do ABZ News exibindo o feed estilo Instagram com filtros
export default function NoticiasPage() {
  const { user, profile } = useSupabaseAuth();
  const userId = user?.id || profile?.id || '';
  const searchParams = useSearchParams();
  const selectedPostId = searchParams?.get('post_id') || undefined;

  const [searchQuery, setSearchQuery] = useState('');

  /* 
     NOTE: Without real Category IDs, filtering by category ID won't work unless back-end supports slugs.
     The API checks `category_id`.
     So I will stick to Search and "Destaques" toggle for now, effectively.
  */

  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto py-6 px-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-900">ABZ News</h1>

          {/* Search Bar & Filters Wrapper */}
          <div className="relative w-full md:max-w-xl mx-auto flex items-center bg-gray-100 rounded-full px-4 py-2 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-100 focus-within:bg-white">
            <FiSearch className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />

            <input
              type="text"
              placeholder="Search for news..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-700 placeholder-gray-500 min-w-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="ml-2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                <FiX className="h-4 w-4" />
              </button>
            )}

            {/* In-Bar Filters (Desktop) */}
            <div className="hidden md:flex items-center space-x-2 ml-4 pl-4 border-l border-gray-200">
              <button
                onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${showFeaturedOnly
                    ? 'bg-gray-600 text-white shadow-sm'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
              >
                Destaques
              </button>
              {/* Example Categories as Chips */}
              {/* 
              <button className="px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600 hover:bg-gray-300">
                Comunicado
              </button>
              <button className="px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600 hover:bg-gray-300">
                Insights
              </button> 
              */}
            </div>
          </div>
        </div>

        {/* Mobile Filter Chips (Scrollable) */}
        <div className="md:hidden flex items-center space-x-2 mb-6 overflow-x-auto pb-2 scrollbar-hide px-1">
          <button
            onClick={() => setShowFeaturedOnly(false)}
            className={`max-md:min-h-11 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${!showFeaturedOnly ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Todos
          </button>
          <button
            onClick={() => setShowFeaturedOnly(true)}
            className={`max-md:min-h-11 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${showFeaturedOnly ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Destaques
          </button>
        </div>

        <NewsFeed
          userId={userId}
          limit={10}
          searchQuery={searchQuery}
          featured={showFeaturedOnly}
          selectedPostId={selectedPostId}
        />
      </div>
    </MainLayout>
  );
}
