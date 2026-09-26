'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { FiX, FiSearch, FiPlus, FiCheck } from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import * as FaIcons from 'react-icons/fa';
import * as FiIcons from 'react-icons/fi';
import * as HiIcons from 'react-icons/hi';
import * as BiIcons from 'react-icons/bi';
import * as AiIcons from 'react-icons/ai';
import * as BsIcons from 'react-icons/bs';
import * as MdIcons from 'react-icons/md';
import * as RiIcons from 'react-icons/ri';
import * as IoIcons from 'react-icons/io5';

interface Module {
    id: string;
    title: string;
    description: string;
    href: string;
    icon: string;
    iconName?: string;
    category?: string;
    moduleKey?: string;
    color?: string;
}

interface Suggestion {
    module_id: string;
    module_name: string;
    module_href: string;
    access_count: number;
}

interface AddShortcutModalProps {
    onClose: () => void;
    onAdd: (module: { id: string; name: string; href: string; icon?: string }) => void;
    existingShortcuts: string[];
}

export default function AddShortcutModal({ onClose, onAdd, existingShortcuts }: AddShortcutModalProps) {
    const { getToken } = useSupabaseAuth();
    const { t } = useI18n();
    const [modules, setModules] = useState<Module[]>([]);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadData = async () => {
            const token = getToken();
            if (!token) return;

            setLoading(true);
            try {
                // Fetch all available modules/cards
                const cardsResponse = await fetch('/api/cards/supabase', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (cardsResponse.ok) {
                    const cardsData = await cardsResponse.json();
                    setModules(cardsData);
                }

                // Fetch suggestions
                const suggestionsResponse = await fetch('/api/user-shortcuts/suggestions', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (suggestionsResponse.ok) {
                    const suggestionsData = await suggestionsResponse.json();
                    setSuggestions(suggestionsData.suggestions || []);
                }

            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [getToken]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Dynamic Icon Rendering Helper
    const renderIcon = (iconName: string, className: string = "w-6 h-6") => {
        if (!iconName) return <FiIcons.FiBox className={className} />;

        // Try to find icon in various libraries
        // Format might be "FiUser", "FaHome", etc.
        let IconComponent = null;

        if (iconName.startsWith('Fi')) IconComponent = (FiIcons as any)[iconName];
        else if (iconName.startsWith('Fa')) IconComponent = (FaIcons as any)[iconName];
        else if (iconName.startsWith('Hi')) IconComponent = (HiIcons as any)[iconName];
        else if (iconName.startsWith('Bi')) IconComponent = (BiIcons as any)[iconName];
        else if (iconName.startsWith('Ai')) IconComponent = (AiIcons as any)[iconName];
        else if (iconName.startsWith('Bs')) IconComponent = (BsIcons as any)[iconName];
        else if (iconName.startsWith('Md')) IconComponent = (MdIcons as any)[iconName];
        else if (iconName.startsWith('Ri')) IconComponent = (RiIcons as any)[iconName];
        else if (iconName.startsWith('Io')) IconComponent = (IoIcons as any)[iconName];

        // Fallback for icons without prefix or just common names check
        if (!IconComponent && (FiIcons as any)[`Fi${iconName}`]) IconComponent = (FiIcons as any)[`Fi${iconName}`];

        return IconComponent ? <IconComponent className={className} /> : <FiIcons.FiBox className={className} />;
    };

    const filteredModules = modules.filter(m => {
        const matchesSearch = (m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.description?.toLowerCase().includes(searchQuery.toLowerCase()));

        const isAlreadyShortcut = existingShortcuts.includes(m.id);
        const isSuggested = !searchQuery && suggestions.some(s => s.module_id === m.id);

        return matchesSearch && !isAlreadyShortcut && !isSuggested;
    });

    const handleAddClick = (module: Module) => {
        onAdd({
            id: module.id,
            name: module.moduleKey || module.title,
            href: module.href,
            icon: module.iconName || module.icon
        });
    };

    const handleSuggestionClick = (suggestion: Suggestion) => {
        // Find full module details to get icon and key
        const moduleDetails = modules.find(m => m.id === suggestion.module_id);
        onAdd({
            id: suggestion.module_id,
            name: moduleDetails?.moduleKey || suggestion.module_name,
            href: suggestion.module_href,
            icon: moduleDetails?.iconName || moduleDetails?.icon
        });
    };

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div ref={modalRef} className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl ring-1 ring-black/5 animate-in zoom-in-95 duration-200 relative">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{t('dashboard.addShortcut', 'Adicionar Atalho')}</h2>
                        <p className="text-sm text-gray-500 mt-1">{t('dashboard.selectModule', 'Selecione um módulo para adicionar aos seus atalhos')}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <FiX className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="relative">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder={t('dashboard.searchModules', 'Buscar módulos...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
                            <p>{t('common.loading')}</p>
                        </div>
                    ) : (
                        <>
                            {/* Suggestions Section */}
                            {suggestions.length > 0 && !searchQuery && (
                                <div>
                                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
                                        {t('dashboard.suggestedForYou', 'Sugeridos para você')}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {suggestions.map(suggestion => {
                                            const moduleDef = modules.find(m => m.id === suggestion.module_id);
                                            // Skip if already in shortcuts (should be filtered by API but safely checking)
                                            if (existingShortcuts.includes(suggestion.module_id)) return null;

                                            return (
                                                <button
                                                    key={suggestion.module_id}
                                                    onClick={() => handleSuggestionClick(suggestion)}
                                                    className="flex items-center p-3 rounded-xl border border-gray-100 hover:border-blue-100 hover:bg-blue-50/50 hover:shadow-sm transition-all group text-left"
                                                >
                                                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mr-3 group-hover:bg-blue-200 transition-colors">
                                                        {renderIcon(moduleDef?.iconName || moduleDef?.icon || '', "w-5 h-5")}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium text-gray-900 group-hover:text-blue-700 truncate">
                                                            {moduleDef?.moduleKey ? t(`cards.${moduleDef.moduleKey}`, moduleDef.title) : t(`cards.${suggestion.module_name}`)}
                                                        </h4>
                                                        <p className="text-xs text-gray-500">
                                                            {t('dashboard.oftenAccessed', 'Acessado frequentemente')}
                                                        </p>
                                                    </div>
                                                    <FiPlus className="w-5 h-5 text-gray-500 group-hover:text-blue-500" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* All Modules Section */}
                            <div>
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
                                    {searchQuery ? t('common.results', 'Resultados') : t('dashboard.allModules', 'Todos os módulos')}
                                </h3>

                                {filteredModules.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                        <p>{t('components.nenhumResultadoEncontradoPara')} "{searchQuery}"</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {filteredModules.map(module => (
                                            <button
                                                key={module.id}
                                                onClick={() => handleAddClick(module)}
                                                className="flex items-center p-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm transition-all group text-left"
                                            >
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 transition-colors ${module.color || 'bg-gray-100 text-gray-500'}`}>
                                                    {renderIcon(module.iconName || module.icon, "w-5 h-5")}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-gray-900 truncate">
                                                        {module.moduleKey ? t(`cards.${module.moduleKey}`, module.title) : module.title}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {module.moduleKey ? t(`cards.${module.moduleKey}Desc`, module.description) : module.description}
                                                    </p>
                                                </div>
                                                <FiPlus className="w-5 h-5 text-gray-500 group-hover:text-blue-500" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        {t('common.close', 'Fechar')}
                    </button>
                </div>
            </div>
        </div>
    );

    // Use createPortal to render the modal at the document body level
    // This ensures it stays on top of all other elements (Sidebar, Header, etc.)
    return typeof document !== 'undefined'
        ? ReactDOM.createPortal(modalContent, document.body)
        : null;
}
