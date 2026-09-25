'use client';

import React, { useState } from 'react';
import { FiHeart, FiMessageCircle, FiShare2, FiBookmark, FiMoreHorizontal, FiEye, FiCalendar, FiUser } from 'react-icons/fi';
import { useI18n } from '@/contexts/I18nContext';
import { formatViewsWithText } from '@/lib/formatters';
import { useToast } from '@/hooks/useToast';
import { useACLPermissions } from '@/hooks/useACLPermissions';
import { NewsPost } from '@/types/news';
import NewsCommentSection from './NewsCommentSection';
import { fetchWithToken } from '@/lib/tokenStorage';
import { toSafeMediaUrl } from '@/lib/security/safe-media-url';

interface NewsPostCardProps {
    post: NewsPost;
    userId?: string;
    onPostUpdated?: (post: NewsPost) => void;
    onDelete?: (postId: string) => void;
    onEdit?: (post: NewsPost) => void;
}

const NewsPostCard: React.FC<NewsPostCardProps> = ({
    post: initialPost,
    userId,
    onPostUpdated,
    onDelete,
    onEdit
}) => {
    const { t } = useI18n();
    const { toast } = useToast();
    const { hasPermission } = useACLPermissions(userId);

    const [post, setPost] = useState<NewsPost>(initialPost);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [isLiking, setIsLiking] = useState(false);

    // Formatar data
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

        if (diffInHours < 1) return t('newsSystem.post.justNow');
        if (diffInHours < 24) return `${diffInHours}h`;
        if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d`;
        return date.toLocaleDateString('pt-BR');
    };

    // Curtir post
    const handleLike = async () => {
        if (!userId || isLiking) return;

        // Otimista
        const newLikedState = !post.user_liked;
        const newLikesCount = post.likes_count + (newLikedState ? 1 : -1);

        let newLatestLikes = post.latest_likes || [];
        if (newLikedState) {
            if (!newLatestLikes.find((l: any) => l.userId === userId)) {
                newLatestLikes = [{ userId: userId, firstName: 'Você', lastName: '', avatar: '' }, ...newLatestLikes];
            }
        } else {
            newLatestLikes = newLatestLikes.filter((l: any) => l.userId !== userId);
        }

        const updatedPost = {
            ...post,
            user_liked: newLikedState,
            likes_count: newLikesCount,
            latest_likes: newLatestLikes
        };
        setPost(updatedPost);
        if (onPostUpdated) onPostUpdated(updatedPost);

        try {
            setIsLiking(true);
            const response = await fetch(`/api/news/posts/${post.id}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });

            if (!response.ok) {
                throw new Error('Falha ao curtir');
            }
        } catch (error) {
            // Reverter
            setPost(post);
            if (onPostUpdated) onPostUpdated(post);
            console.error('Erro ao curtir:', error);
        } finally {
            setIsLiking(false);
        }
    };

    // Compartilhar
    const handleShare = async () => {
        const url = `${window.location.origin}/news/post/${post.id}`;
        const shareData: ShareData = {
            title: post.title,
            text: post.excerpt || post.title,
            url: url
        };

        try {
            if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(url);
                toast.success(t('newsSystem.post.linkCopied'));
            }
        } catch (e) {
            console.error('Falha ao compartilhar:', e);
            prompt(t('newsSystem.post.copyLinkFallback'), url);
        }
        setIsMenuOpen(false);
    };

    // Excluir
    const handleDelete = async () => {
        if (!confirm(t('newsSystem.post.confirmDelete'))) return;
        if (onDelete) onDelete(post.id);
        setIsMenuOpen(false);
    };

    // Duplo clique na imagem
    const handleDoubleClick = () => {
        if (!post.user_liked) {
            handleLike();

            // Animação simples via DOM (opcional, pode ser melhorada com React state/ref)
            const heartElement = document.getElementById(`heart-animation-${post.id}`);
            if (heartElement) {
                heartElement.classList.remove('hidden');
                heartElement.classList.add('animate-ping');
                setTimeout(() => {
                    heartElement.classList.add('hidden');
                    heartElement.classList.remove('animate-ping');
                }, 1000);
            }
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
            {/* Header */}
            <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <FiUser className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center space-x-2">
                            <h3 className="font-semibold text-gray-900">
                                {post.author.first_name} {post.author.last_name}
                            </h3>
                            {post.category && (
                                <span
                                    className="px-2 py-1 text-xs rounded-full text-white"
                                    style={{ backgroundColor: post.category.color }}
                                >
                                    {post.category.name}
                                </span>
                            )}
                            {post.featured && (
                                <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                                    Destaque
                                </span>
                            )}
                        </div>
                        <div className="flex items-center text-sm text-gray-500 space-x-2">
                            <FiCalendar className="w-4 h-4" />
                            <span>{formatDate(post.published_at)}</span>
                            <span>•</span>
                            <FiEye className="w-4 h-4" />
                            <span>{post.views_count === 0 ? t('newsSystem.post.views_0') : post.views_count === 1 ? t('newsSystem.post.views_1') : t('newsSystem.post.views_other', { count: post.views_count })}</span>
                        </div>
                    </div>
                </div>

                <div className="relative">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-2 hover:bg-gray-100 rounded-full"
                    >
                        <FiMoreHorizontal className="w-5 h-5 text-gray-500" />
                    </button>

                    {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow z-10">
                            <button
                                onClick={handleShare}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                            >
                                {t('newsSystem.post.copyLink')}
                            </button>

                            {(hasPermission('news.edit') || hasPermission('news.publish')) && onEdit && (
                                <button
                                    onClick={() => { onEdit(post); setIsMenuOpen(false); }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                >
                                    {t('newsSystem.post.edit')}
                                </button>
                            )}

                            {(hasPermission('news.delete') || hasPermission('news.publish')) && onDelete && (
                                <button
                                    onClick={handleDelete}
                                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                    {t('newsSystem.post.delete')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Conteúdo */}
            <div className="px-4 pb-3">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{post.title}</h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{post.content || post.excerpt}</p>

                {/* Tags */}
                {Array.isArray(post.tags) && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        {post.tags.map((tag, index) => (
                            <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Links Externos */}
                {Array.isArray(post.external_links) && post.external_links.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {post.external_links.map((link, index) => (
                            <a
                                key={index}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <div className="text-sm font-medium text-blue-600">{link.title}</div>
                                <div className="text-xs text-gray-500">{link.url}</div>
                            </a>
                        ))}
                    </div>
                )}
            </div>

            {/* Mídia */}
            {post.media_urls && post.media_urls.length > 0 && (
                <div className="relative">
                    <div className="grid grid-cols-1 gap-2">
                        {post.media_urls.map((url, index) => (
                            <div
                                key={index}
                                className="relative"
                                onDoubleClick={handleDoubleClick}
                            >
                                <img
                                    src={toSafeMediaUrl(url)}
                                    alt={`Mídia ${index + 1}`}
                                    className="w-full h-auto cursor-pointer select-none"
                                />
                                <div
                                    id={`heart-animation-${post.id}`}
                                    className="absolute inset-0 flex items-center justify-center hidden pointer-events-none"
                                >
                                    <FiHeart className="w-20 h-20 text-red-500 fill-current" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Ações */}
            <div className="px-4 py-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                        <button
                            onClick={handleLike}
                            className={`flex items-center space-x-2 group ${post.user_liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'} transition-all duration-200`}
                            disabled={!userId}
                        >
                            <div className="relative">
                                <FiHeart className={`w-5 h-5 transition-all duration-200 ${post.user_liked ? 'fill-current scale-110' : 'group-hover:scale-110'}`} />
                                {post.user_liked && (
                                    <div className="absolute inset-0 animate-ping">
                                        <FiHeart className="w-5 h-5 text-red-300 fill-current" />
                                    </div>
                                )}
                            </div>
                            <span className="text-sm font-medium">{post.likes_count}</span>
                        </button>

                        <button
                            onClick={() => setShowComments(!showComments)}
                            className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors"
                        >
                            <FiMessageCircle className="w-5 h-5" />
                            <span className="text-sm font-medium">{post.comments_count}</span>
                        </button>

                        <button
                            onClick={handleShare}
                            className="flex items-center space-x-2 text-gray-500 hover:text-green-500 transition-colors"
                        >
                            <FiShare2 className="w-5 h-5" />
                            <span className="text-sm font-medium">{t('newsSystem.post.share')}</span>
                        </button>
                    </div>

                    <button className="text-gray-500 hover:text-yellow-500 transition-colors">
                        <FiBookmark className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Comentários */}
            {showComments && (
                <div className="border-t border-gray-100">
                    <NewsCommentSection postId={post.id} userId={userId || ''} />
                </div>
            )}
        </div>
    );
};

export default NewsPostCard;
