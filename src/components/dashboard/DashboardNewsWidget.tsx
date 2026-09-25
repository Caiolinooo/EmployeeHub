'use client';

import React, { useEffect, useState } from 'react';
import { fetchWithToken } from '@/lib/tokenStorage';
import { FiLoader, FiVideo, FiFileText } from 'react-icons/fi';
import { toSafeMediaUrl } from '@/lib/security/safe-media-url';

interface NewsPost {
    id: string;
    title: string;
    excerpt: string;
    media_urls: string[];
    category: {
        id: string;
        name: string;
        color: string;
    } | null;
    published_at: string;
}

export default function DashboardNewsWidget() {
    const [latestPost, setLatestPost] = useState<NewsPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    useEffect(() => {
        const loadLatestNews = async () => {
            try {
                // Fetch published posts, limit 1, ordered by published_at DESC (default)
                const res = await fetchWithToken('/api/news/posts?limit=1&status=published');
                const data = await res.json();

                if (data.posts && data.posts.length > 0) {
                    const post = data.posts[0];
                    setLatestPost(post);

                    // Check for video in media_urls
                    const video = post.media_urls.find((url: string) =>
                        url.match(/\.(mp4|webm|ogg|mov)$/i)
                    );
                    setVideoUrl(video || null);
                }
            } catch (err) {
                console.error('Failed to load dashboard news', err);
            } finally {
                setLoading(false);
            }
        };

        loadLatestNews();
    }, []);

    if (loading) {
        return (
            <div className="bg-gray-100 rounded-[2rem] p-8 h-full min-h-[320px] flex items-center justify-center animate-pulse">
                <FiLoader className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
        );
    }

    if (!latestPost) {
        return (
            <div className="bg-[#0055FF] text-white rounded-[2rem] p-8 md:p-10 h-full min-h-[320px] flex flex-col justify-end relative overflow-hidden shadow-lg">
                <div className="relative z-10">
                    <h3 className="text-3xl font-bold mb-2">Bem-vindo ao Portal</h3>
                    <p className="text-blue-100">Fique atento às novidades por aqui.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#0055FF] text-white rounded-[2rem] h-full min-h-[320px] flex flex-col justify-end relative overflow-hidden shadow-[0_20px_25px_-5px_rgba(0,0,0,0.15),0_10px_10px_-5px_rgba(0,0,0,0.1)] group cursor-pointer transition-transform hover:scale-[1.01]"
            onClick={() => window.location.href = `/noticias?id=${latestPost.id}`}>

            {/* Background Media */}
            {(() => {
                const safeVideo = toSafeMediaUrl(videoUrl);
                const safeImage = toSafeMediaUrl(latestPost.media_urls[0]);
                if (safeVideo) {
                    return (
                        <div className="absolute inset-0 w-full h-full z-0">
                            <video
                                src={safeVideo}
                                className="w-full h-full object-cover opacity-60 group-hover:opacity-70 transition-opacity"
                                autoPlay
                                muted
                                loop
                                playsInline
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/90 via-blue-900/40 to-transparent"></div>
                        </div>
                    );
                }
                if (safeImage) {
                    return (
                        <div className="absolute inset-0 w-full h-full z-0">
                            <img
                                src={safeImage}
                                className="w-full h-full object-cover opacity-60 group-hover:opacity-70 transition-opacity"
                                alt="News background"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/90 via-blue-900/40 to-transparent"></div>
                        </div>
                    );
                }
                return (
                    <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-blue-400/20 to-transparent pointer-events-none z-0"></div>
                );
            })()}

            {/* Content */}
            <div className="relative z-10 p-8 md:p-10 mt-auto">
                <h3 className="text-3xl font-bold mb-4 leading-tight line-clamp-2 drop-shadow-md">
                    {latestPost.title}
                </h3>

                <div className="flex items-center gap-3">
                    {latestPost.category && (
                        <span
                            className="inline-block px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider text-black shadow-sm"
                            style={{ backgroundColor: latestPost.category.color || '#FFB800' }}
                        >
                            {latestPost.category.name}
                        </span>
                    )}

                    {videoUrl && (
                        <span className="flex items-center gap-1 text-xs font-medium bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full border border-white/20">
                            <FiVideo className="w-3 h-3" /> Vídeo
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
