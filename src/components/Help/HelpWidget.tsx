'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
    FiHelpCircle, FiX, FiHome, FiMessageCircle, FiSearch,
    FiChevronRight, FiChevronLeft, FiLogIn, FiDollarSign,
    FiTrendingUp, FiFileText, FiBook, FiCalendar, FiMonitor,
    FiSend, FiAlertCircle, FiStar, FiMessageSquare, FiZoomIn,
    FiPaperclip, FiTrash2, FiCheckSquare, FiSquare, FiInfo
} from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { getHelpCategories, searchHelpArticles, HelpCategory, HelpArticle } from '@/data/helpContent';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import { useEscapeCapture } from '@/hooks/useEscapeCapture';
import { useRestoreFocus } from '@/hooks/useRestoreFocus';
import { useSiteConfig } from '@/contexts/SiteConfigContext';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    FiLogIn,
    FiDollarSign,
    FiTrendingUp,
    FiFileText,
    FiBook,
    FiCalendar,
    FiMonitor,
    FiMessageSquare,
};

type Tab = 'home' | 'help' | 'messages';
type MessageType = 'question' | 'bug' | 'suggestion';

// Image Lightbox Component
function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
    return (
        <div
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            >
                <FiX className="w-8 h-8" />
            </button>
            <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <img
                    src={src}
                    alt={alt}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg"
                />
            </div>
        </div>
    );
}

// Clickable Help Image Component
function HelpImage({ src, alt }: { src: string; alt: string }) {
    const [showLightbox, setShowLightbox] = useState(false);
    const { t } = useI18n();

    return (
        <>
            <div
                className="relative my-4 cursor-pointer group rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                onClick={() => setShowLightbox(true)}
            >
                <img
                    src={src}
                    alt={alt}
                    className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2 shadow-lg">
                        <FiZoomIn className="w-5 h-5 text-gray-700" />
                    </div>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {t('helpWidget.clickToEnlarge', 'Clique para ampliar')}
                </div>
            </div>
            {showLightbox && (
                <ImageLightbox src={src} alt={alt} onClose={() => setShowLightbox(false)} />
            )}
        </>
    );
}

export default function HelpWidget() {
    const { user, profile } = useSupabaseAuth();
    const { t } = useI18n();
    const { config } = useSiteConfig();
    const [isOpen, setIsOpen] = useState(false);
    const { markTrigger, restoreFocus } = useRestoreFocus();
    const closeHelp = () => {
        setIsOpen(false);
        restoreFocus();
    };
    useEscapeToClose(isOpen, closeHelp);
    useEscapeCapture(isOpen, closeHelp);
    const [activeTab, setActiveTab] = useState<Tab>('home');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<HelpArticle[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<HelpCategory | null>(null);
    const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
    const [messageType, setMessageType] = useState<MessageType | null>(null);

    const { locale } = useI18n();
    const categories = getHelpCategories(locale);
    const [messageText, setMessageText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [messageSent, setMessageSent] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [screenshotName, setScreenshotName] = useState<string | null>(null);
    const [includeSystemInfo, setIncludeSystemInfo] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const widgetRef = useRef<HTMLDivElement>(null);
    const consoleLogsRef = useRef<Array<{ type: string; message: string; timestamp: string }>>([]);

    // Get user's first name for greeting
    const firstName = profile?.first_name || user?.email?.split('@')[0] || t('helpWidget.defaultUser', 'Usuário');

    // Capture console logs and network errors
    useEffect(() => {
        if (!includeSystemInfo) return;

        const originalConsoleError = console.error;
        const originalConsoleWarn = console.warn;
        const originalConsoleLog = console.log;

        const addLog = (type: string, args: any[]) => {
            try {
                const message = args.map(arg =>
                    typeof arg === 'object' ? JSON.stringify(arg, Object.getOwnPropertyNames(arg)) : String(arg)
                ).join(' ');

                consoleLogsRef.current.push({
                    type,
                    message,
                    timestamp: new Date().toISOString()
                });

                // Keep only last 50 logs
                if (consoleLogsRef.current.length > 50) {
                    consoleLogsRef.current.shift();
                }
            } catch (e) {
                // Ignore errors in logging
            }
        };

        console.error = (...args) => {
            addLog('error', args);
            originalConsoleError.apply(console, args);
        };

        console.warn = (...args) => {
            addLog('warn', args);
            originalConsoleWarn.apply(console, args);
        };

        console.log = (...args) => {
            addLog('log', args);
            originalConsoleLog.apply(console, args);
        };

        // Capture unhandled promise rejections (network errors often land here)
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            addLog('error', ['Unhandled Promise Rejection:', event.reason]);
        };

        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            console.error = originalConsoleError;
            console.warn = originalConsoleWarn;
            console.log = originalConsoleLog;
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, [includeSystemInfo]);

    // Handle file selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                alert(t('helpWidget.maxImageSize', 'A imagem deve ter no máximo 5MB'));
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setScreenshot(reader.result as string);
                setScreenshotName(file.name);
            };
            reader.readAsDataURL(file);
        }
    };

    // Search effect
    useEffect(() => {
        if (searchQuery.length >= 3) {
            const results = searchHelpArticles(searchQuery, locale);
            setSearchResults(results);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery, locale]);

    // Close widget when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
                const target = event.target as HTMLElement;
                if (target.closest('[data-help-trigger]')) return;
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Send message to feedback system
    const handleSendMessage = async () => {
        if (!messageText.trim() || !messageType) return;

        setIsSending(true);
        try {
            const typeMap = {
                question: 'doubt',
                bug: 'bug',
                suggestion: 'suggestion'
            };

            // Prepare browser info if enabled
            const browserInfo = includeSystemInfo ? {
                language: navigator.language,
                languages: navigator.languages?.join(', '),
                platform: navigator.platform,
                cookiesEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine,
                deviceMemory: (navigator as any).deviceMemory,
                hardwareConcurrency: navigator.hardwareConcurrency,
                screenHeight: window.screen.height,
                screenWidth: window.screen.width,
                pixelRatio: window.devicePixelRatio,
                timestamp: new Date().toISOString()
            } : undefined;

            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: typeMap[messageType],
                    message: messageText,
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    screenResolution: `${window.screen.width}x${window.screen.height}`,
                    browserInfo,
                    screenshot,
                    consoleLogs: includeSystemInfo ? consoleLogsRef.current : []
                })
            });

            if (response.ok) {
                setMessageSent(true);
                setMessageText('');
                setMessageType(null);
                setScreenshot(null);
                setScreenshotName(null);
                setTimeout(() => setMessageSent(false), 3000);
            }
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsSending(false);
        }
    };

    // Reset state when changing tabs
    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        setSelectedCategory(null);
        setSelectedArticle(null);
        setSearchQuery('');
        setSearchResults([]);
        setMessageType(null);
        setMessageText('');
    };

    // Render icon component
    const renderIcon = (iconName: string, className?: string) => {
        const IconComponent = iconMap[iconName];
        return IconComponent ? <IconComponent className={className} /> : null;
    };

    // Parse and render article content with images
    const renderArticleContent = (content: string) => {
        // Split content into lines for processing
        const lines = content.split('\n');
        let html = '';
        let inOrderedList = false;
        let inUnorderedList = false;
        let inSubList = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check for heading h2
            if (line.match(/^## (.+)$/)) {
                if (inSubList) { html += '</ul>'; inSubList = false; }
                if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
                if (inUnorderedList) { html += '</ul>'; inUnorderedList = false; }
                html += line.replace(/^## (.+)$/, '<h2 class="text-base font-semibold text-gray-800 mt-6 mb-3">$1</h2>');
            }
            // Check for heading h3
            else if (line.match(/^### (.+)$/)) {
                if (inSubList) { html += '</ul>'; inSubList = false; }
                if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
                if (inUnorderedList) { html += '</ul>'; inUnorderedList = false; }
                html += line.replace(/^### (.+)$/, '<h3 class="text-sm font-semibold text-gray-700 mt-5 mb-2">$1</h3>');
            }
            // Check for ordered list item (not indented)
            else if (line.match(/^\d+\. (.+)$/)) {
                if (inSubList) { html += '</ul>'; inSubList = false; }
                if (inUnorderedList) { html += '</ul>'; inUnorderedList = false; }
                if (!inOrderedList) { html += '<ol class="list-decimal pl-5 space-y-2 my-3">'; inOrderedList = true; }
                const itemContent = line.replace(/^\d+\. (.+)$/, '$1')
                    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>')
                    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm text-blue-600 font-mono">$1</code>');
                html += `<li class="text-gray-600 leading-relaxed">${itemContent}`;
                // Check if next line is a sub-item - if not, close the li
                const nextLine = lines[i + 1]?.trim();
                if (!nextLine?.startsWith('-')) {
                    html += '</li>';
                }
            }
            // Check for unordered list item (not indented)
            else if (line.match(/^- (.+)$/)) {
                if (inSubList) { html += '</ul>'; inSubList = false; }
                if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
                if (!inUnorderedList) { html += '<ul class="list-disc pl-5 space-y-1 my-3">'; inUnorderedList = true; }
                const itemContent = line.replace(/^- (.+)$/, '$1')
                    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>')
                    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm text-blue-600 font-mono">$1</code>');
                html += `<li class="text-gray-600 leading-relaxed">${itemContent}</li>`;
            }
            // Check for sub-list items (indented with spaces - inside ordered list)
            else if (line.match(/^   - (.+)$/)) {
                if (!inSubList) {
                    html += '<ul class="list-disc pl-5 mt-1 space-y-1">';
                    inSubList = true;
                }
                const itemContent = line.replace(/^   - (.+)$/, '$1')
                    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>')
                    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm text-blue-600 font-mono">$1</code>');
                html += `<li class="text-gray-600 leading-relaxed text-sm">${itemContent}</li>`;
                // Check if next line is NOT a sub-item - if so, close the sublist and the parent li
                const nextLine = lines[i + 1]?.trim();
                if (!nextLine?.startsWith('-') && !lines[i + 1]?.startsWith('   -')) {
                    html += '</ul></li>';
                    inSubList = false;
                }
            }
            // Check for blockquote
            else if (line.match(/^> (.+)$/)) {
                if (inSubList) { html += '</ul></li>'; inSubList = false; }
                if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
                if (inUnorderedList) { html += '</ul>'; inUnorderedList = false; }
                html += line.replace(/^> (.+)$/, '<blockquote class="border-l-4 border-blue-500 pl-4 py-2 my-3 bg-blue-50 text-sm italic text-gray-600">$1</blockquote>');
            }
            // Empty line - check if list should continue
            else if (line.trim() === '') {
                if (inSubList) { html += '</ul></li>'; inSubList = false; }

                // Look ahead to see if the next non-empty line continues the list
                let nextNonEmptyLine = '';
                for (let j = i + 1; j < lines.length; j++) {
                    if (lines[j].trim() !== '') {
                        nextNonEmptyLine = lines[j];
                        break;
                    }
                }

                // Only close ordered list if next content is NOT a numbered item or sub-item
                if (inOrderedList && !nextNonEmptyLine.match(/^\d+\. /) && !nextNonEmptyLine.match(/^   - /)) {
                    html += '</ol>';
                    inOrderedList = false;
                }

                // Only close unordered list if next content is NOT a bullet item
                if (inUnorderedList && !nextNonEmptyLine.match(/^- /)) {
                    html += '</ul>';
                    inUnorderedList = false;
                }
            }
            // Regular text
            else if (line.trim()) {
                if (inSubList) { html += '</ul></li>'; inSubList = false; }
                if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
                if (inUnorderedList) { html += '</ul>'; inUnorderedList = false; }
                const textContent = line
                    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>')
                    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm text-blue-600 font-mono">$1</code>');
                html += `<p class="text-gray-600 leading-relaxed mb-3">${textContent}</p>`;
            }
        }

        // Close any open lists
        if (inSubList) html += '</ul></li>';
        if (inOrderedList) html += '</ol>';
        if (inUnorderedList) html += '</ul>';

        return html;
    };

    return (
        <>
            {/* Image Lightbox */}
            {lightboxImage && (
                <ImageLightbox
                    src={lightboxImage.src}
                    alt={lightboxImage.alt}
                    onClose={() => setLightboxImage(null)}
                />
            )}

            {/* Floating trigger button */}
            <button
                data-help-trigger
                data-fab-help=""
                onClick={(event) => {
                    if (!isOpen) markTrigger(event.currentTarget);
                    if (isOpen) closeHelp();
                    else setIsOpen(true);
                }}
                className={`fixed bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${isOpen
                    ? 'hidden md:flex bg-gray-600 hover:bg-gray-700'
                    : 'flex bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                    }`}
                style={{ boxShadow: '0 4px 20px rgba(0, 91, 150, 0.4)' }}
            >
                {isOpen ? (
                    <FiX className="w-6 h-6 text-white" />
                ) : (
                    <FiHelpCircle className="w-7 h-7 text-white" />
                )}
            </button>

            {/* Widget panel */}
            {isOpen && (
                <>
                    {/* Mobile backdrop */}
                    <div
                        className="fixed inset-0 bg-black/40 z-[50] md:hidden transition-opacity"
                        onClick={closeHelp}
                    />
                    <div
                        ref={widgetRef}
                        data-modal-panel=""
                        className="fixed bottom-0 left-0 right-0 md:bottom-24 md:left-auto md:right-6 z-[60] md:w-[400px] h-[85vh] md:h-[600px] max-h-[800px] bg-white rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 font-plus-jakarta"
                        style={{ boxShadow: '0 -4px 25px rgba(0, 0, 0, 0.15)' }}
                    >
                        {/* Content area */}
                        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                            {/* Home Tab */}
                            {activeTab === 'home' && (
                                <div className="flex-1 flex flex-col">
                                    {/* Header with gradient */}
                                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-5 md:p-6 text-white relative overflow-hidden flex flex-col">
                                        <div className="absolute top-0 right-0 p-4 z-20 md:hidden">
                                            <button onClick={closeHelp} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
                                                <FiX className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {config?.widget_logo && (
                                            <div className="absolute top-4 right-4 opacity-20">
                                                <img
                                                    src={config.widget_logo}
                                                    alt="Logo"
                                                    className="w-16 h-16 object-contain filter brightness-0 invert"
                                                />
                                            </div>
                                        )}
                                        <h2 className="text-xl font-semibold mb-1 relative z-10">{t('helpWidget.greeting', 'Olá, {name}! 👋').replace('{name}', firstName)}</h2>
                                        <p className="text-blue-100 text-sm relative z-10">{t('helpWidget.subtitle', 'Como podemos ajudar você hoje?')}</p>
                                    </div>

                                    {/* Quick actions */}
                                    <div className="p-5 flex-1">
                                        <button
                                            onClick={() => handleTabChange('messages')}
                                            className="w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl p-4 flex items-center gap-4 transition-colors mb-4"
                                        >
                                            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                                                <FiSend className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="text-left flex-1">
                                                <p className="font-semibold text-gray-800">{t('helpWidget.contactSupport', 'Fale com o Suporte')}</p>
                                                <p className="text-sm text-gray-500 mt-0.5">{t('helpWidget.contactSupportDesc', 'Envie sua dúvida ou reporte um problema')}</p>
                                            </div>
                                            <FiChevronRight className="w-5 h-5 text-gray-400" />
                                        </button>

                                        <button
                                            onClick={() => handleTabChange('help')}
                                            className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl p-4 flex items-center gap-4 transition-colors"
                                        >
                                            <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
                                                <FiSearch className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="text-left flex-1">
                                                <p className="font-semibold text-gray-800">{t('helpWidget.searchHelp', 'Buscar na Ajuda')}</p>
                                                <p className="text-sm text-gray-500 mt-0.5">{t('helpWidget.searchHelpDesc', 'Encontre respostas rápidas')}</p>
                                            </div>
                                            <FiChevronRight className="w-5 h-5 text-gray-400" />
                                        </button>

                                        {/* Info card */}
                                        <div className="mt-6 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <FiStar className="w-4 h-4 text-white" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-amber-800 text-sm">{t('helpWidget.quickTip', 'Dica rápida')}</p>
                                                    <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                                                        {t('helpWidget.quickTipDesc', 'Acesse a aba "Ajuda" para encontrar tutoriais com imagens sobre todos os módulos do portal.')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Help Tab */}
                            {activeTab === 'help' && (
                                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                    {/* Header */}
                                    <div className="bg-white border-b p-4 flex-shrink-0">
                                        {selectedArticle ? (
                                            <button
                                                onClick={() => setSelectedArticle(null)}
                                                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                                            >
                                                <FiChevronLeft className="w-5 h-5" />
                                                <span>{t('helpWidget.back', 'Voltar')}</span>
                                            </button>
                                        ) : selectedCategory ? (
                                            <button
                                                onClick={() => setSelectedCategory(null)}
                                                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                                            >
                                                <FiChevronLeft className="w-5 h-5" />
                                                <span>{t('helpWidget.categories', 'Categorias')}</span>
                                            </button>
                                        ) : (
                                            <h3 className="text-lg font-semibold text-gray-800">{t('helpWidget.helpCenter', 'Central de Ajuda')}</h3>
                                        )}
                                    </div>

                                    {/* Search bar */}
                                    {!selectedArticle && (
                                        <div className="p-4 border-b bg-gray-50 flex-shrink-0">
                                            <div className="relative">
                                                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder={t('helpWidget.searchPlaceholder', 'Qual é a sua dúvida?')}
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div className="flex-1 overflow-y-auto p-4 min-h-0">
                                        {/* Search results */}
                                        {searchQuery && searchResults.length > 0 && (
                                            <div className="space-y-2">
                                                {searchResults.map((article) => (
                                                    <button
                                                        key={article.id}
                                                        onClick={() => {
                                                            setSelectedArticle(article);
                                                            setSearchQuery('');
                                                        }}
                                                        className="w-full text-left p-4 bg-white border rounded-xl hover:bg-gray-50 transition-colors"
                                                    >
                                                        <p className="font-medium text-gray-800">{article.title}</p>
                                                        <p className="text-xs text-gray-500 mt-1">{article.category}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* No results */}
                                        {searchQuery && searchResults.length === 0 && (
                                            <div className="text-center py-8">
                                                <p className="text-gray-500">{t('helpWidget.noResults', 'Nenhum resultado encontrado')}</p>
                                                <button
                                                    onClick={() => handleTabChange('messages')}
                                                    className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
                                                >
                                                    {t('helpWidget.contactSupportAction', 'Fale com o suporte')}
                                                </button>
                                            </div>
                                        )}

                                        {/* Article view */}
                                        {selectedArticle && (
                                            <div className="pb-4">
                                                <h4 className="text-lg font-semibold text-gray-800 mb-4 leading-tight">{selectedArticle.title}</h4>

                                                {/* Article content with improved typography */}
                                                <div
                                                    className="text-sm text-gray-600 leading-relaxed space-y-3"
                                                    dangerouslySetInnerHTML={{
                                                        __html: renderArticleContent(selectedArticle.content)
                                                    }}
                                                />

                                                {/* Article images */}
                                                {selectedArticle.images && selectedArticle.images.length > 0 && (
                                                    <div className="mt-6 space-y-4">
                                                        <h5 className="text-sm font-semibold text-gray-700">{t('helpWidget.illustratedSteps', 'Passo a passo ilustrado:')}</h5>
                                                        {selectedArticle.images.map((img, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="relative cursor-pointer group rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                                                                onClick={() => setLightboxImage({ src: img, alt: `Imagem ${idx + 1}` })}
                                                            >
                                                                <img
                                                                    src={img}
                                                                    alt={`Passo ${idx + 1}`}
                                                                    className="w-full h-auto"
                                                                />
                                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3 shadow-lg">
                                                                        <FiZoomIn className="w-5 h-5 text-gray-700" />
                                                                    </div>
                                                                </div>
                                                                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {t('helpWidget.clickToEnlarge', 'Clique para ampliar')}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Category articles */}
                                        {selectedCategory && !selectedArticle && !searchQuery && (
                                            <div className="space-y-3">
                                                <h4 className="font-semibold text-gray-800 mb-4">{selectedCategory.name}</h4>
                                                {selectedCategory.articles.map((article) => (
                                                    <button
                                                        key={article.id}
                                                        onClick={() => setSelectedArticle(article)}
                                                        className="w-full text-left p-4 bg-white border rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-between"
                                                    >
                                                        <div>
                                                            <p className="font-medium text-gray-700">{article.title}</p>
                                                            {article.images && article.images.length > 0 && (
                                                                <p className="text-xs text-blue-600 mt-1">{t('helpWidget.withImages', '📷 Com imagens')}</p>
                                                            )}
                                                        </div>
                                                        <FiChevronRight className="w-4 h-4 text-gray-400" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Categories list */}
                                        {!selectedCategory && !selectedArticle && !searchQuery && (
                                            <div className="space-y-3">
                                                {categories.map((category) => (
                                                    <button
                                                        key={category.id}
                                                        onClick={() => setSelectedCategory(category)}
                                                        className="w-full text-left p-4 bg-white border rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-4"
                                                    >
                                                        <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center">
                                                            {renderIcon(category.icon, 'w-5 h-5 text-blue-600')}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-semibold text-gray-800">{category.name}</p>
                                                            <p className="text-xs text-gray-500 mt-0.5">{category.description}</p>
                                                        </div>
                                                        <div className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                                                            {category.articles.length}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Messages Tab */}
                            {activeTab === 'messages' && (
                                <div className="flex-1 flex flex-col">
                                    {/* Header */}
                                    <div className="bg-white border-b p-4 flex-shrink-0">
                                        <h3 className="text-lg font-semibold text-gray-800">{t('helpWidget.messages', 'Mensagens')}</h3>
                                        <p className="text-xs text-gray-500 mt-1">{t('helpWidget.supportHours', 'Atendimento: 08h às 17h (seg a sexta)')}</p>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 overflow-y-auto p-4">
                                        {messageSent ? (
                                            <div className="flex flex-col items-center justify-center h-full text-center">
                                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                                <h4 className="font-semibold text-gray-800">{t('helpWidget.messageSent', 'Mensagem enviada!')}</h4>
                                                <p className="text-sm text-gray-500 mt-2">
                                                    {t('helpWidget.messageSentDesc', 'Nossa equipe responderá em breve.')}
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Message type selection */}
                                                {!messageType ? (
                                                    <div className="space-y-3">
                                                        <p className="text-sm text-gray-600 mb-4">{t('helpWidget.howCanWeHelp', 'Como podemos ajudar?')}</p>

                                                        <button
                                                            onClick={() => setMessageType('question')}
                                                            className="w-full p-4 bg-blue-50 border border-blue-200 rounded-xl text-left hover:bg-blue-100 transition-colors"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <FiHelpCircle className="w-5 h-5 text-blue-600" />
                                                                <span className="font-medium text-gray-800">{t('helpWidget.haveQuestion', 'Tenho uma dúvida')}</span>
                                                            </div>
                                                        </button>

                                                        <button
                                                            onClick={() => setMessageType('bug')}
                                                            className="w-full p-4 bg-red-50 border border-red-200 rounded-xl text-left hover:bg-red-100 transition-colors"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <FiAlertCircle className="w-5 h-5 text-red-600" />
                                                                <span className="font-medium text-gray-800">{t('helpWidget.reportBug', 'Reportar um erro/bug')}</span>
                                                            </div>
                                                        </button>

                                                        <button
                                                            onClick={() => setMessageType('suggestion')}
                                                            className="w-full p-4 bg-green-50 border border-green-200 rounded-xl text-left hover:bg-green-100 transition-colors"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <FiStar className="w-5 h-5 text-green-600" />
                                                                <span className="font-medium text-gray-800">{t('helpWidget.suggestImprovement', 'Sugerir uma melhoria')}</span>
                                                            </div>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col h-full">
                                                        <button
                                                            onClick={() => setMessageType(null)}
                                                            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 font-medium"
                                                        >
                                                            <FiChevronLeft className="w-5 h-5" />
                                                            <span>{t('helpWidget.back', 'Voltar')}</span>
                                                        </button>

                                                        <div className="flex-1">
                                                            <p className="text-sm text-gray-600 mb-3">
                                                                {messageType === 'question' && t('helpWidget.describeQuestion', 'Descreva sua dúvida:')}
                                                                {messageType === 'bug' && t('helpWidget.describeBug', 'Descreva o erro encontrado:')}
                                                                {messageType === 'suggestion' && t('helpWidget.describeSuggestion', 'Compartilhe sua sugestão:')}
                                                            </p>
                                                            <textarea
                                                                value={messageText}
                                                                onChange={(e) => setMessageText(e.target.value)}
                                                                placeholder={t('helpWidget.typeHere', 'Digite aqui...')}
                                                                className="w-full h-32 p-4 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                                            />

                                                            {/* Attachments & Options */}
                                                            <div className="mt-3 space-y-3">
                                                                {/* Screenshot Upload */}
                                                                <div>
                                                                    <input
                                                                        type="file"
                                                                        ref={fileInputRef}
                                                                        onChange={handleFileChange}
                                                                        accept="image/*"
                                                                        className="hidden"
                                                                    />

                                                                    {screenshot ? (
                                                                        <div className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg">
                                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                                <div className="w-8 h-8 relative flex-shrink-0">
                                                                                    <img src={screenshot} alt="Screenshot" className="w-full h-full object-cover rounded" />
                                                                                </div>
                                                                                <span className="text-xs text-gray-600 truncate">{screenshotName}</span>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => {
                                                                                    setScreenshot(null);
                                                                                    setScreenshotName(null);
                                                                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                                                                }}
                                                                                className="p-1 hover:bg-gray-200 rounded text-gray-500"
                                                                            >
                                                                                <FiTrash2 className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => fileInputRef.current?.click()}
                                                                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium px-2 py-1 -ml-2 rounded-lg hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            <FiPaperclip className="w-4 h-4" />
                                                                            <span>{t('helpWidget.attachScreenshot', 'Anexar print da tela')}</span>
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                {/* System Info Toggle */}
                                                                <button
                                                                    onClick={() => setIncludeSystemInfo(!includeSystemInfo)}
                                                                    className="flex items-start gap-2 text-left group"
                                                                >
                                                                    <div className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-colors ${includeSystemInfo ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white group-hover:border-blue-500'}`}>
                                                                        {includeSystemInfo && <FiCheckSquare className="w-3 h-3 text-white" />}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">
                                                                        <span className="text-gray-700 font-medium">{t('helpWidget.includeSystemInfo', 'Incluir dados do sistema')}</span>
                                                                        <p className="mt-0.5 leading-tight">{t('helpWidget.includeSystemInfoDesc', 'Navegador, SO e resolução para melhor diagnóstico.')}</p>
                                                                    </div>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={handleSendMessage}
                                                            disabled={!messageText.trim() || isSending}
                                                            className="mt-4 w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            {isSending ? (
                                                                <span>{t('helpWidget.sending', 'Enviando...')}</span>
                                                            ) : (
                                                                <>
                                                                    <FiSend className="w-4 h-4" />
                                                                    <span>{t('helpWidget.sendMessage', 'Enviar mensagem')}</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Bottom navigation */}
                        <div className="border-t bg-white px-4 py-3.5 flex justify-around flex-shrink-0">
                            <button
                                onClick={() => handleTabChange('home')}
                                className={`flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-colors ${activeTab === 'home' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <FiHome className="w-5 h-5" />
                                <span className="text-xs font-medium">{t('helpWidget.home', 'Início')}</span>
                            </button>
                            <button
                                onClick={() => handleTabChange('help')}
                                className={`flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-colors ${activeTab === 'help' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <FiHelpCircle className="w-5 h-5" />
                                <span className="text-xs font-medium">{t('helpWidget.help', 'Ajuda')}</span>
                            </button>
                            <button
                                onClick={() => handleTabChange('messages')}
                                className={`flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-colors ${activeTab === 'messages' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <FiMessageCircle className="w-5 h-5" />
                                <span className="text-xs font-medium">{t('helpWidget.messages', 'Mensagens')}</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
