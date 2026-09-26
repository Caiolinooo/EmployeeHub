'use client';

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { useParams, useRouter } from 'next/navigation';
import { FiArrowLeft, FiDownload, FiExternalLink } from 'react-icons/fi';
import dynamic from 'next/dynamic';

// Legacy Content Imports
import ManualContent from '@/components/library/legacy/ManualContent';
import PoliticasContent from '@/components/library/legacy/PoliticasContent';
import ProcedimentosContent from '@/components/library/legacy/ProcedimentosContent';
import GuiaOffshoreContent from '@/components/library/legacy/GuiaOffshoreContent';

// Dynamic import for PDF viewer to avoid heavy load on initial bundle
const LazyDocumentViewer = dynamic(() => import('@/components/LazyLoad/LazyDocumentViewer'), {
    loading: () => <p className="p-4 text-center">Carregando visualizador...</p>,
    ssr: false
});

interface LibraryItem {
    id: string;
    title: string;
    description: string;
    type: 'video' | 'image' | 'pdf' | 'document' | 'text' | 'link' | 'collection';
    content_url: string;
    content_text: string;
    metadata: any;
    slug?: string;
}

export default function LibraryItemPage() {
    const params = useParams();
    const router = useRouter();
    const [item, setItem] = useState<LibraryItem | null>(null);
    const [loading, setLoading] = useState(true);

    // Safely get slug from params
    const slug = params?.slug as string;

    useEffect(() => {
        const fetchItem = async () => {
            try {
                if (!slug) return;

                const res = await fetch(`/api/library/slug/${slug}`);
                if (res.ok) {
                    const data = await res.json();
                    setItem(data);
                } else {
                    // Handle 404
                    console.error('Item not found');
                }
            } catch (error) {
                console.error('Error fetching item:', error);
            } finally {
                setLoading(false);
            }
        };

        if (slug) {
            fetchItem();
        } else {
            setLoading(false);
        }
    }, [slug]);

    if (loading) {
        return (
            <MainLayout>
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-abz-blue"></div>
                </div>
            </MainLayout>
        );
    }

    if (!item) {
        return (
            <MainLayout>
                <div className="text-center py-20">
                    <h2 className="text-xl font-semibold">Item não encontrado</h2>
                    <button onClick={() => router.back()} className="mt-4 text-abz-blue hover:underline">
                        Voltar para Biblioteca
                    </button>
                </div>
            </MainLayout>
        );
    }

    // Apply styles from metadata
    const contentStyle = {
        color: item.metadata?.textColor || 'inherit',
        // font family could be applied here too
    };

    const containerStyle = {
        backgroundColor: item.metadata?.backgroundColor || '#ffffff',
    };

    // Helper to determine if we should render legacy content
    const renderLegacyContent = () => {
        switch (slug) {
            case 'manual-colaborador':
                return <ManualContent />;
            case 'politicas-internas':
                return <PoliticasContent />;
            case 'procedimentos':
                return <ProcedimentosContent />;
            case 'guia-offshore':
                return <GuiaOffshoreContent />;
            default:
                return null;
        }
    };

    const legacyContent = renderLegacyContent();

    return (
        <MainLayout>
            <div className="mb-6 flex items-center justify-between">
                <button
                    onClick={() => router.push('/biblioteca')}
                    className="flex items-center py-2 -my-2 text-gray-600 hover:text-abz-blue transition-colors"
                >
                    <FiArrowLeft className="mr-2" />
                    Voltar para Biblioteca
                </button>
            </div>

            <div className={`rounded-lg shadow-sm border border-gray-100 overflow-hidden min-h-[60vh]`} style={containerStyle}>
                <div className="p-4 sm:p-8 border-b border-gray-100 bg-white/50 backdrop-blur-sm">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-3 break-words" style={{ color: contentStyle.color }}>{item.title}</h1>
                    <p className="text-lg opacity-80" style={{ color: contentStyle.color }}>{item.description}</p>
                </div>

                <div className="p-4 sm:p-8">
                    {/* Render Consolidated Legacy Content if matched */}
                    {legacyContent ? (
                        <div className="legacy-content-wrapper">
                            {legacyContent}
                        </div>
                    ) : (
                        <>
                            {item.type === 'pdf' && item.content_url && (
                                <div className="h-[70vh] md:h-[800px] border border-gray-200 rounded-lg overflow-hidden">
                                    <iframe
                                        src={`${item.content_url}#toolbar=0`}
                                        className="w-full h-full"
                                        title={item.title}
                                    />
                                    {/* Fallback to simple download link if iframe has issues or for better UX */}
                                    <div className="mt-4 text-center">
                                        <a href={item.content_url} target="_blank" rel="noreferrer" className="inline-flex items-center text-abz-blue hover:underline">
                                            <FiDownload className="mr-1" /> Abrir/Baixar PDF original
                                        </a>
                                    </div>
                                </div>
                            )}

                            {item.type === 'video' && item.content_url && (
                                <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                                    <video
                                        controls
                                        className="w-full h-full"
                                        src={item.content_url}
                                    >
                                        Seu navegador não suporta a tag de vídeo.
                                    </video>
                                </div>
                            )}

                            {item.type === 'image' && item.content_url && (
                                <div className="flex justify-center bg-gray-50 rounded-lg p-4">
                                    <img
                                        src={item.content_url}
                                        alt={item.title}
                                        className="max-h-[80vh] object-contain shadow-lg rounded"
                                    />
                                </div>
                            )}

                            {item.type === 'text' && (
                                <div className="prose max-w-none whitespace-pre-wrap" style={contentStyle}>
                                    {item.content_text || ''}
                                </div>
                            )}

                            {item.type === 'document' && (
                                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                    <p className="mb-4">Este é um arquivo para download.</p>
                                    <a
                                        href={item.content_url}
                                        className="inline-flex items-center px-6 py-3 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark transition-colors font-medium"
                                        download
                                    >
                                        <FiDownload className="mr-2" />
                                        Baixar Arquivo
                                    </a>
                                </div>
                            )}

                            {item.type === 'link' && (
                                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                    <p className="mb-4 text-lg">Este item aponta para um recurso externo/interno.</p>
                                    <a
                                        href={item.content_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-6 py-3 bg-abz-blue text-white rounded-md hover:bg-abz-blue-dark transition-colors font-medium"
                                    >
                                        <FiExternalLink className="mr-2" />
                                        Acessar Recurso
                                    </a>
                                </div>
                            )}

                            {/* Collection Renderer */}
                            {item.type === 'collection' && item.metadata?.resources && (
                                <div className="mt-6">
                                    <h3 className="text-xl font-bold mb-4 text-gray-800">Conteúdos Disponíveis</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {item.metadata.resources.map((res: any, idx: number) => (
                                            <a
                                                key={idx}
                                                href={res.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-abz-blue transition-all group"
                                            >
                                                <div className="flex items-center">
                                                    <div className="p-3 bg-gray-50 rounded-lg text-abz-blue group-hover:bg-blue-50 transition-colors">
                                                        {res.type === 'link' ? <FiExternalLink className="w-5 h-5" /> : <FiDownload className="w-5 h-5" />}
                                                    </div>
                                                    <div className="ml-4">
                                                        <h4 className="font-bold text-gray-800 group-hover:text-abz-blue transition-colors">{res.title}</h4>
                                                        <p className="text-xs text-gray-500 mt-1">{res.type === 'link' ? 'Link Externo' : 'Arquivo para Download'}</p>
                                                    </div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
