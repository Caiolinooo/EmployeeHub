'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiX, FiEye, FiTrash2 } from 'react-icons/fi';
import { fetchWithToken } from '@/lib/tokenStorage';
import { useACLPermissions } from '@/hooks/useACLPermissions';
import HighlightCreator from './HighlightCreator';
import { toSafeMediaUrl } from '@/lib/security/safe-media-url';

interface Highlight {
    id: string;
    title: string;
    media_urls: string[];
    author: {
        id: string;
        first_name: string;
        last_name: string;
        avatar?: string;
        drive_photo_url?: string;
    };
    metadata: {
        type: string;
        isPermanent: boolean;
        expiresAt: string | null;
        viewCount: number;
    };
    created_at: string;
}

interface NewsHighlightsProps {
    userId: string;
    canCreate: boolean;
}

const NewsHighlights: React.FC<NewsHighlightsProps> = ({ userId, canCreate }) => {
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const [isCreatorOpen, setIsCreatorOpen] = useState(false);
    const [selectedHighlight, setSelectedHighlight] = useState<Highlight | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { hasPermission } = useACLPermissions(userId);

    const loadHighlights = async () => {
        try {
            // Fetch featured posts
            const response = await fetchWithToken('/api/news/posts?featured=true&limit=20');
            if (response.ok) {
                const data = await response.json();
                const posts = data.posts || [];

                // Filter for highlights and check expiration
                const validHighlights = posts.filter((post: any) => {
                    const isExplicitHighlight = post.metadata?.type === 'highlight';

                    if (isExplicitHighlight) {
                        const expiresAt = post.metadata?.expiresAt;
                        if (expiresAt && new Date(expiresAt) < new Date()) {
                            return false;
                        }
                        return true;
                    }

                    // Se não for 'highlight' explícito, mas estiver marcado como destaque (featured), inclui
                    return post.featured === true;
                });

                setHighlights(validHighlights);
            }
        } catch (error) {
            console.error('Erro ao carregar destaques:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadHighlights();
    }, []);

    const handleHighlightClick = async (highlight: Highlight) => {
        setSelectedHighlight(highlight);

        // Registrar visualização
        const sessionKey = `viewed-highlight-${highlight.id}`;
        if (!sessionStorage.getItem(sessionKey)) {
            try {
                // Optimistic UI update
                setHighlights(prev => prev.map(h => {
                    if (h.id === highlight.id) {
                        return {
                            ...h,
                            metadata: {
                                ...h.metadata,
                                viewCount: (h.metadata?.viewCount || 0) + 1
                            }
                        };
                    }
                    return h;
                }));
                // Update selected highlight immediately to show the new count
                setSelectedHighlight(prev => prev ? {
                    ...prev,
                    metadata: {
                        ...prev.metadata,
                        viewCount: (prev.metadata?.viewCount || 0) + 1
                    }
                } : prev);

                await fetchWithToken(`/api/news/${highlight.id}/view`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });

                sessionStorage.setItem(sessionKey, 'true');
            } catch (error) {
                console.error('Erro ao registrar view do destaque:', error);
                // We don't necessarily need to revert optimistic update for views since it's just a metric
            }
        }
    };

    const handleDeleteHighlight = async (highlightId: string) => {
        if (!confirm('Tem certeza que deseja excluir este destaque?')) return;
        try {
            const res = await fetchWithToken(`/api/news/posts/${highlightId}`, { method: 'DELETE' });
            if (res.ok) {
                setHighlights(prev => prev.filter(h => h.id !== highlightId));
                setSelectedHighlight(null);
            }
        } catch (e) {
            console.error('Erro ao excluir destaque:', e);
        }
    };

    const isVideo = (url: string) => {
        return url.match(/\.(mp4|webm|ogg|mov)$/i) !== null;
    };

    return (
        <div className="mb-8">
            <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide">
                {/* Create Button */}
                {canCreate && (
                    <button
                        onClick={() => setIsCreatorOpen(true)}
                        className="flex-shrink-0 flex flex-col items-center space-y-2 group"
                    >
                        <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center group-hover:border-yellow-500 transition-colors bg-white">
                            <FiPlus className="w-6 h-6 text-gray-400 group-hover:text-yellow-500" />
                        </div>
                        <span className="text-xs font-medium text-gray-600">Novo</span>
                    </button>
                )}

                {/* Highlights List */}
                {highlights.map((highlight) => (
                    <button
                        key={highlight.id}
                        onClick={() => handleHighlightClick(highlight)}
                        className="flex-shrink-0 flex flex-col items-center space-y-2 group"
                    >
                        <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-orange-500 group-hover:from-yellow-500 group-hover:to-orange-600 transition-all">
                            <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-gray-100 relative">
                                {(() => {
                                    const safeThumb = toSafeMediaUrl(highlight.media_urls?.[0]);
                                    if (!safeThumb) {
                                        return (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                                <span className="text-xs text-gray-500">Sem img</span>
                                            </div>
                                        );
                                    }
                                    return isVideo(highlight.media_urls[0]) ? (
                                        <video
                                            src={safeThumb}
                                            className="w-full h-full object-contain bg-gray-900"
                                            muted
                                            playsInline
                                        />
                                    ) : (
                                        <img
                                            src={safeThumb}
                                            alt={highlight.title}
                                            className="w-full h-full object-cover"
                                        />
                                    );
                                })()}
                            </div>
                        </div>
                        <span className="text-xs font-medium text-gray-600 truncate w-20 text-center">
                            {highlight.title}
                        </span>
                    </button>
                ))}
            </div>

            {/* Creator Modal */}
            <AnimatePresence>
                {isCreatorOpen && (
                    <HighlightCreator
                        isOpen={isCreatorOpen}
                        onClose={() => setIsCreatorOpen(false)}
                        userId={userId}
                        onHighlightCreated={() => {
                            loadHighlights();
                            setIsCreatorOpen(false);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Viewer Modal */}
            <AnimatePresence>
                {selectedHighlight && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
                        onClick={() => setSelectedHighlight(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="relative max-w-sm w-full aspect-[9/16] bg-black rounded-lg overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {(() => {
                                const safeViewer = toSafeMediaUrl(selectedHighlight.media_urls?.[0]);
                                if (!safeViewer) {
                                    return (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                            <span className="text-sm text-gray-400">Sem img</span>
                                        </div>
                                    );
                                }
                                return isVideo(selectedHighlight.media_urls[0]) ? (
                                    <video
                                        src={safeViewer}
                                        className="w-full h-full object-contain"
                                        controls
                                        autoPlay
                                        loop
                                        playsInline
                                    />
                                ) : (
                                    <img
                                        src={safeViewer}
                                        alt={selectedHighlight.title}
                                        className="w-full h-full object-contain"
                                    />
                                );
                            })()}

                            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent flex justify-between items-start">
                                <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 rounded-full bg-gray-500 overflow-hidden flex items-center justify-center text-white text-xs">
                                        {selectedHighlight.author.avatar || selectedHighlight.author.drive_photo_url ? (
                                            <img
                                                src={selectedHighlight.author.avatar || selectedHighlight.author.drive_photo_url}
                                                alt={selectedHighlight.author.first_name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            selectedHighlight.author.first_name[0]
                                        )}
                                    </div>
                                    <div className="text-white">
                                        <p className="text-sm font-semibold">{selectedHighlight.title}</p>
                                        <p className="text-xs opacity-75">
                                            {new Date(selectedHighlight.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {(hasPermission('news.edit') || hasPermission('news.delete')) && (
                                        <button
                                            onClick={() => handleDeleteHighlight(selectedHighlight.id)}
                                            className="text-white hover:text-red-400 transition-colors p-2 bg-black/30 rounded-full"
                                            title="Excluir destaque"
                                        >
                                            <FiTrash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSelectedHighlight(null)}
                                        className="text-white hover:text-gray-300"
                                    >
                                        <FiX className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent">
                                <div className="flex items-center justify-center space-x-2 text-white/80 text-sm">
                                    <FiEye className="w-4 h-4" />
                                    <span>{selectedHighlight.metadata?.viewCount || 0} visualizações</span>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default NewsHighlights;
