'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useI18n } from '@/contexts/I18nContext';

interface SearchResult {
  id: string;
  type: 'document' | 'news' | 'user' | 'card' | 'reimbursement' | 'paystub' | 'evaluation' | 'policy' | 'procedure' | 'academy' | 'calendar';
  title: string;
  content: string;
  url: string;
  relevance?: number;
  metadata?: any;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

const DashboardSearch: React.FC = () => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fechar busca ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Buscar com debounce
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setShowResults(true);
      try {
        const params = new URLSearchParams({
          q: query,
          limit: '8'
        });
        
        if (selectedType !== 'all') {
          params.append('type', selectedType);
        }

        const response = await fetch(`/api/search?${params}`);
        const data: SearchResponse = await response.json();
        
        if (response.ok) {
          setResults(data.results);
        } else {
          console.error('Erro na busca:', data.error);
          setResults([]);
        }
      } catch (error) {
        console.error('Erro ao buscar:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, selectedType]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document':
        return '📄';
      case 'news':
        return '📰';
      case 'user':
        return '👤';
      case 'card':
        return '📊';
      case 'reimbursement':
        return '💰';
      case 'paystub':
        return '💵';
      case 'evaluation':
        return '📋';
      case 'policy':
        return '📜';
      case 'procedure':
        return '📝';
      case 'academy':
        return '🎓';
      case 'calendar':
        return '📅';
      default:
        return '📄';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'document':
        return 'Documento';
      case 'news':
        return t('components.noticia');
      case 'user':
        return t('components.usuario');
      case 'card':
        return 'Card';
      case 'reimbursement':
        return 'Reembolso';
      case 'paystub':
        return 'Contracheque';
      case 'evaluation':
        return t('components.avaliacao');
      case 'policy':
        return t('components.politica');
      case 'procedure':
        return 'Procedimento';
      case 'academy':
        return 'Curso';
      case 'calendar':
        return 'Evento';
      default:
        return 'Item';
    }
  };

  const handleResultClick = (result: SearchResult) => {
    window.location.href = result.url;
    setShowResults(false);
    setQuery('');
  };

  const handleFocus = () => {
    if (query.length >= 2) {
      setShowResults(true);
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl mx-auto">
      {/* Campo de busca principal */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder={t('components.buscarEmTodoOSistemaDocumentosNoticiasReembolsosEt')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-sm"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setShowResults(false);
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Filtros rápidos */}
      {query.length >= 2 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { value: 'all', label: 'Todos' },
            { value: 'news', label: t('components.noticias') },
            { value: 'reimbursement', label: 'Reembolsos' },
            { value: 'document', label: 'Documentos' },
            { value: 'academy', label: 'Cursos' },
            { value: 'policy', label: t('components.politicas') }
          ].map((type) => (
            <button
              key={type.value}
              onClick={() => setSelectedType(type.value)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedType === type.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      )}

      {/* Resultados */}
      {showResults && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto">
          {loading && (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Buscando...</p>
            </div>
          )}

          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="p-4 text-center text-gray-500">
              <p className="text-sm">Nenhum resultado encontrado para "{query}"</p>
              <p className="text-xs mt-1">Tente usar termos diferentes ou remover filtros</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="py-2">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b">
                {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
              </div>
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 focus:outline-none focus:bg-gray-50"
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {getTypeIcon(result.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {result.title}
                        </h4>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {getTypeLabel(result.type)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {result.content}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardSearch;
