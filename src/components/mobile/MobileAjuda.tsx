'use client';

import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { FiChevronDown, FiChevronRight, FiSearch } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { getHelpCategories, searchHelpArticles, HelpArticle } from '@/data/helpContent';
import DataCard from './DataCard';
import MobileShell from './MobileShell';

export default function MobileAjuda() {
  const { t, locale } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedArticles, setExpandedArticles] = useState<Record<string, boolean>>({});

  const toggleArticle = (articleId: string) => {
    setExpandedArticles((prev) => ({ ...prev, [articleId]: !prev[articleId] }));
  };

  const categories = useMemo(() => getHelpCategories(locale), [locale]);
  const searching = searchQuery.trim().length > 2;
  const searchResults = useMemo(
    () => (searching ? searchHelpArticles(searchQuery, locale) : []),
    [searching, searchQuery, locale],
  );

  const renderArticle = (article: HelpArticle) => {
    const expanded = !!expandedArticles[article.id];
    return (
      <div key={article.id} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
        <button
          type="button"
          onClick={() => toggleArticle(article.id)}
          className="touch-target flex w-full items-start text-left text-sm text-gray-700"
          aria-expanded={expanded}
        >
          <span className="mr-2 mt-0.5 text-gray-400">
            {expanded ? <FiChevronDown aria-hidden /> : <FiChevronRight aria-hidden />}
          </span>
          <span className={`font-medium ${expanded ? 'text-[#005B96]' : ''}`}>{article.title}</span>
        </button>
        {expanded ? (
          <div className="mt-2 rounded-lg bg-gray-50 p-3 pl-6 text-xs leading-relaxed text-gray-600 prose prose-sm max-w-none">
            {article.content ? (
              <ReactMarkdown>{article.content}</ReactMarkdown>
            ) : (
              t('ajuda.inDevelopment', 'Conteúdo em desenvolvimento. Entre em contato com o suporte para mais detalhes.')
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <MobileShell title="Ajuda">
      <div className="flex flex-col gap-3" data-abz-mobile-ajuda="">
        <div className="relative">
          <FiSearch
            aria-hidden
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder={t('ajuda.searchPlaceholder', 'Buscar por artigos, termos ou dúvidas...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-12 pr-4 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-[#005B96] focus:outline-none"
          />
        </div>

        {searching ? (
          searchResults.length > 0 ? (
            <DataCard
              title={t('ajuda.knowledgeBaseTitle', 'Base de Conhecimento')}
              subtitle={`${searchResults.length} resultado(s) para "${searchQuery}"`}
            >
              <div className="mt-3 flex flex-col gap-3">
                {searchResults.map(renderArticle)}
              </div>
            </DataCard>
          ) : (
            <p className="py-8 text-center text-sm text-gray-500">
              {t('ajuda.noResults', 'Nenhum resultado encontrado para "{query}"').replace('{query}', searchQuery)}
            </p>
          )
        ) : (
          categories.map((category) => (
            <DataCard
              key={category.id}
              title={category.name}
              subtitle={category.description}
            >
              <div className="mt-3 flex flex-col gap-3">
                {category.articles.slice(0, 5).map(renderArticle)}
              </div>
            </DataCard>
          ))
        )}
      </div>
    </MobileShell>
  );
}
