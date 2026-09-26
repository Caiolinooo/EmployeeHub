'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FiPlus, FiX, FiSearch, FiLoader } from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import Link from 'next/link';
import AddShortcutModal from './AddShortcutModal';

interface Shortcut {
    id: string;
    module_id: string;
    module_name: string;
    module_href: string;
    icon?: string;
    position: number;
}

interface SearchResult {
    id: string;
    type: string;
    title: string;
    content: string;
    url: string;
}

export default function UserShortcutsBar() {
    const { user, profile, getToken } = useSupabaseAuth();
    const { t } = useI18n();
    const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Fetch user shortcuts on mount
    useEffect(() => {
        fetchShortcuts();
    }, [user]); // Changed from session to user as dependency

    // Close search results on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSearchResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search with debounce
    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }

        const timeoutId = setTimeout(async () => {
            setSearchLoading(true);
            setShowSearchResults(true);
            try {
                // Get current locale from browser or html tag if possible, but simpler to rely on API 
                // accepting a locale param. We can get it from the t function context if available?
                // The useI18n hook might expose 'locale'.
                // Let's check useI18n definition first, but assuming it's standard context.
                // If not available, we can rely on document.documentElement.lang
                const currentLocale = document.documentElement.lang || 'pt-BR';
                const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=8&locale=${currentLocale}`);
                const data = await response.json();
                if (response.ok) {
                    setSearchResults(data.results || []);
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setSearchLoading(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const fetchShortcuts = async () => {
        const token = getToken();
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/user-shortcuts', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setShortcuts(data);
            }
        } catch (error) {
            console.error('Error fetching shortcuts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddShortcut = async (module: { id: string; name: string; href: string; icon?: string }) => {
        const token = getToken();
        if (!token) return;

        try {
            const response = await fetch('/api/user-shortcuts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    module_id: module.id,
                    module_name: module.name,
                    module_href: module.href,
                    icon: module.icon
                })
            });

            if (response.ok) {
                const newShortcut = await response.json();
                setShortcuts(prev => [...prev, newShortcut]);
            }
        } catch (error) {
            console.error('Error adding shortcut:', error);
        }
    };

    const handleRemoveShortcut = async (moduleId: string) => {
        const token = getToken();
        if (!token) return;

        try {
            const response = await fetch(`/api/user-shortcuts?module_id=${moduleId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                setShortcuts(prev => prev.filter(s => s.module_id !== moduleId));
            }
        } catch (error) {
            console.error('Error removing shortcut:', error);
        }
    };

    const handleSearchResultClick = (result: SearchResult) => {
        window.location.href = result.url;
        setShowSearchResults(false);
        setSearchQuery('');
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'document': return '📄';
            case 'news': return '📰';
            case 'user': return '👤';
            case 'card': return '📊';
            case 'reimbursement': return '💰';
            case 'paystub': return '💵';
            case 'evaluation': return '📋';
            case 'academy': return '🎓';
            case 'calendar': return '📅';
            default: return '📄';
        }
    };

    return (
        <div className="w-full">
            {/* Search and Shortcuts Row */}
            <div className="flex items-center gap-3 flex-wrap">
                {/* Search Input */}
                <div ref={searchRef} className="relative flex-1 min-w-0 sm:min-w-[280px] max-w-xl">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <FiSearch className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('dashboard.searchPlaceholder')}
                        className="block w-full pl-14 pr-6 py-4 bg-white border-0 rounded-full text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-[0_2px_20px_rgba(0,0,0,0.04)] text-lg transition-all"
                    />

                    {/* Search Results Dropdown */}
                    {showSearchResults && (
                        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-200 max-h-80 overflow-y-auto">
                            {searchLoading ? (
                                <div className="p-4 text-center">
                                    <FiLoader className="animate-spin h-5 w-5 mx-auto text-blue-500" />
                                    <p className="text-sm text-gray-500 mt-2">{t('common.loading')}</p>
                                </div>
                            ) : searchResults.length === 0 ? (
                                <div className="p-4 text-center text-gray-500">
                                    <p className="text-sm">{t('components.nenhumResultadoEncontradoPara')} "{searchQuery}"</p>
                                </div>
                            ) : (
                                <div className="py-2">
                                    {searchResults.map((result) => (
                                        <button
                                            key={`${result.type}-${result.id}`}
                                            onClick={() => handleSearchResultClick(result)}
                                            className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">{getTypeIcon(result.type)}</span>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-medium text-gray-900 truncate">
                                                        {result.title}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 truncate">
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

                {/* Shortcuts */}
                <div className="flex items-center gap-2 flex-wrap">
                    {loading ? (
                        <div className="px-4 py-2">
                            <FiLoader className="animate-spin h-4 w-4 text-gray-400" />
                        </div>
                    ) : (
                        <>
                            {shortcuts.map((shortcut) => (
                                <div
                                    key={shortcut.id}
                                    className="group relative flex items-center gap-1 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-100 hover:shadow-md transition-all"
                                >
                                    <Link
                                        href={shortcut.module_href}
                                        className="text-sm font-medium text-gray-700 hover:text-blue-600"
                                    >
                                        {t(`cards.${shortcut.module_name}`, shortcut.module_name)}
                                    </Link>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleRemoveShortcut(shortcut.module_id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 ml-1 p-0.5 text-gray-500 hover:text-red-500 transition-all"
                                        title={t('common.remove')}
                                        aria-label={t('common.remove') as string}
                                    >
                                        <FiX className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </>
                    )}

                    {/* Add Shortcut Button */}
                    <button
                        onClick={() => setShowModal(true)}
                        className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-500 hover:text-blue-600 hover:shadow-md transition-all border border-gray-100 shadow-sm"
                        title={t('dashboard.addShortcut')}
                        aria-label={t('dashboard.addShortcut') as string}
                    >
                        <FiPlus className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Add Shortcut Modal */}
            {showModal && (
                <AddShortcutModal
                    onClose={() => setShowModal(false)}
                    onAdd={handleAddShortcut}
                    existingShortcuts={shortcuts.map(s => s.module_id)}
                />
            )}
        </div>
    );
}
