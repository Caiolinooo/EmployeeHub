'use client';

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { FiBook, FiSettings, FiSearch, FiFilter } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import LibraryManager from '@/components/library/LibraryManager';
import ModernLibraryCard from '@/components/library/ModernLibraryCard';

interface LibraryItem {
    id: string;
    title: string;
    slug: string;
    description: string;
    type: 'video' | 'image' | 'pdf' | 'document' | 'text' | 'link';
    metadata: any;
}

export default function LibraryPage() {
    const { user, profile } = useSupabaseAuth();
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [filteredItems, setFilteredItems] = useState<LibraryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const router = useRouter();

    // Debug logging
    useEffect(() => {
        console.log('LibraryPage Auth Debug:', {
            hasUser: !!user,
            hasProfile: !!profile,
            role: profile?.role
        });
    }, [user, profile]);

    const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'admin' || profile?.role === 'MANAGER' || profile?.role === 'manager';

    const fetchItems = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/library/items');
            if (res.ok) {
                const data = await res.json();
                setItems(data);
                setFilteredItems(data);
            }
        } catch (error) {
            console.error('Failed to fetch library items', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    // Search filter
    useEffect(() => {
        if (!searchQuery) {
            setFilteredItems(items);
        } else {
            const query = searchQuery.toLowerCase();
            setFilteredItems(items.filter(item =>
                item.title.toLowerCase().includes(query) ||
                item.description.toLowerCase().includes(query)
            ));
        }
    }, [searchQuery, items]);

    return (
        <MainLayout>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Biblioteca</h1>
                    <p className="text-slate-500 mt-1">Repositório central de conhecimento e documentos oficiais.</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar documentos..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {isAdmin && (
                        <button
                            onClick={() => setIsManagerOpen(true)}
                            className="flex items-center justify-center px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
                            aria-label="Gerenciar biblioteca"
                        >
                            <FiSettings className="mr-2" />
                            <span className="hidden sm:inline">Gerenciar</span>
                        </button>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredItems.map((item) => (
                        <ModernLibraryCard
                            key={item.id}
                            item={item}
                            onClick={() => router.push(`/biblioteca/${item.slug}`)}
                        />
                    ))}

                    {filteredItems.length === 0 && (
                        <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FiBook className="w-8 h-8 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">Nenhum item encontrado</h3>
                            <p className="text-gray-500 mt-1">
                                {searchQuery ? `Não encontramos nada para "${searchQuery}"` : "A biblioteca está vazia no momento."}
                            </p>
                        </div>
                    )}
                </div>
            )}

            <LibraryManager
                isOpen={isManagerOpen}
                onClose={() => setIsManagerOpen(false)}
                onUpdate={fetchItems}
            />
        </MainLayout>
    );
}

