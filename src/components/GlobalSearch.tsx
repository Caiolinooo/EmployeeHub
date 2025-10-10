'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { DocumentTextIcon, NewspaperIcon, UserIcon, RectangleStackIcon, CurrencyDollarIcon } from '@heroicons/react/24/solid';
import { useI18n } from '@/contexts/I18nContext';

interface SearchResult {
  id: string;
  type: 'document' | 'news' | 'user' | 'card' | 'reimbursement';
  title: string;
  content: string;
  url: string;
  relevance?: number;
  metadata?: any;
}

interface SearchResponse {
  query: string;
  type: string;
  results: SearchResult[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

const GlobalSearch: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fechar busca ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Atalho de teclado Ctrl+K
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Buscar com debounce
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          limit: '10'
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

  const getIcon = (type: string) => {
    switch (type) {
      case 'document':
        return <DocumentTextIcon className="w-5 h-5 text-blue-500" />;
      case 'news':
        return <NewspaperIcon className="w-5 h-5 text-green-500" />;
      case 'user':
        return <UserIcon className="w-5 h-5 text-purple-500" />;
      case 'card':
        return <RectangleStackIcon className="w-5 h-5 text-orange-500" />;
      case 'reimbursement':
        return <CurrencyDollarIcon className="w-5 h-5 text-emerald-500" />;
      default:
        return <MagnifyingGlassIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'document':
        return 'Documento';
      case 'news':
        return {t('components.noticia')};
      case 'user':
        return {t('components.usuario')};
      case 'card':
        return 'Card';
      case 'reimbursement':
        return 'Reembolso';
      case 'paystub':
        return 'Contracheque';
      case 'evaluation':
        return {t('components.avaliacao')};
      case 'policy':
        return {t('components.politica')};
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
    setIsOpen(false);
  };

  return (
    <>
      {/* Botão de busca */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <MagnifyingGlassIcon className="w-4 h-4" />
        <span>Buscar...</span>
        <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-gray-500 bg-white border border-gray-300 rounded">
          Ctrl K
        </kbd>
      </button>

      {/* Modal de busca */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-start justify-center min-h-screen pt-16 px-4">
            <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setIsOpen(false)} />
            
            <div ref={searchRef} className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl">
              {/* Header */}
              <div className="flex items-center px-4 py-3 border-b">
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 mr-3" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Digite para buscar..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 text-lg outline-none"
                  autoFocus
                />
                <button
                  onClick={() => setIsOpen(false)}
                  className="ml-3 p-1 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Filtros */}
              <div className="px-4 py-2 border-b bg-gray-50">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-sm text-gray-600">Filtrar por:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'all', label: 'Todos' },
                    { value: 'document', label: 'Documentos' },
                    { value: 'news', label: {t('components.noticias')} },
                    { value: 'user', label: {t('components.usuarios')} },
                    { value: 'card', label: 'Cards' },
                    { value: 'reimbursement', label: 'Reembolsos' },
                    { value: 'paystub', label: 'Contracheques' },
                    { value: 'evaluation', label: {t('components.avaliacoes')} },
                    { value: 'policy', label: {t('components.politicas')} },
                    { value: 'procedure', label: 'Procedimentos' },
                    { value: 'academy', label: 'Cursos' }
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setSelectedType(type.value)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        selectedType === type.value
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resultados */}
              <div className="max-h-96 overflow-y-auto">
                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <span className="ml-2 text-gray-600">Buscando...</span>
                  </div>
                )}

                {!loading && query.length >= 2 && results.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <MagnifyingGlassIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Nenhum resultado encontrado para "{query}"</p>
                  </div>
                )}

                {!loading && results.length > 0 && (
                  <div className="py-2">
                    {results.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleResultClick(result)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-start space-x-3">
                          {getIcon(result.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-medium text-gray-900 truncate">
                                {result.title}
                              </h3>
                              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
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

                {query.length < 2 && (
                  <div className="text-center py-8 text-gray-500">
                    <MagnifyingGlassIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Digite pelo menos 2 caracteres para buscar</p>
                    <p className="text-xs mt-1">Use Ctrl+K para abrir a busca rapidamente</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalSearch;
