'use client';

import React, { useState, useEffect } from 'react';
import { FiX, FiUpload, FiSave, FiLayout, FiImage, FiList, FiTrash2, FiRefreshCw, FiPlus, FiLink, FiFile, FiFolder, FiVideo, FiMap, FiCalendar, FiUsers, FiBriefcase, FiClipboard, FiSearch, FiSettings, FiMessageCircle, FiBell, FiStar, FiHeart, FiShare, FiDownload, FiCheck, FiAlertCircle, FiHelpCircle, FiHome, FiGrid, FiMonitor, FiSmartphone, FiTag, FiFlag, FiAward, FiGift, FiShoppingCart, FiCreditCard, FiDollarSign, FiActivity, FiTrendingUp, FiPieChart, FiBarChart, FiShield, FiLock, FiUnlock, FiKey, FiBook } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';
import { getToken } from '@/lib/tokenStorage';

interface LibraryManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

interface LibraryItem {
    id: string;
    title: string;
    type: string;
    created_at?: string;
    metadata?: any;
}

interface ResourceItem {
    title: string;
    url: string;
    type: 'file' | 'link';
}

const ensureProtocol = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://${url}`;
};

const renderIcon = (iconName: string, className?: string) => {
    // Map of common icons - can be expanded
    const icons: any = {
        'book': FiBook, 'file': FiFile, 'link': FiLink, 'folder': FiFolder, 'image': FiImage,
        'video': FiVideo, 'map': FiMap, 'calendar': FiCalendar, 'users': FiUsers,
        'briefcase': FiBriefcase, 'clipboard': FiClipboard, 'search': FiSearch,
        'settings': FiSettings, 'message-circle': FiMessageCircle, 'bell': FiBell,
        'star': FiStar, 'heart': FiHeart, 'share': FiShare, 'download': FiDownload,
        'upload': FiUpload, 'trash': FiTrash2, 'check': FiCheck, 'x': FiX, 'plus': FiPlus,
        'alert-circle': FiAlertCircle, 'help-circle': FiHelpCircle, 'home': FiHome,
        'grid': FiGrid, 'list': FiList, 'layout': FiLayout, 'monitor': FiMonitor,
        'smartphone': FiSmartphone, 'tag': FiTag, 'flag': FiFlag, 'award': FiAward,
        'gift': FiGift, 'shopping-cart': FiShoppingCart, 'credit-card': FiCreditCard,
        'dollar-sign': FiDollarSign, 'activity': FiActivity, 'trending-up': FiTrendingUp,
        'pie-chart': FiPieChart, 'bar-chart': FiBarChart, 'shield': FiShield,
        'lock': FiLock, 'unlock': FiUnlock, 'key': FiKey
    };
    const Icon = icons[iconName] || FiBook;
    return <Icon className={className} />;
};

export default function LibraryManager({ isOpen, onClose, onUpdate }: LibraryManagerProps) {
    const [mode, setMode] = useState<'create' | 'manage'>('create');
    const [createTab, setCreateTab] = useState<'content' | 'appearance'>('content');

    const [items, setItems] = useState<LibraryItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        slug: '',
        description: '',
        type: 'pdf', // 'pdf', 'video', 'image', 'link', 'text', 'collection'
        content_url: '',
        metadata: {
            backgroundColor: '#ffffff',
            textColor: '#000000',
            icon: 'book',
            resources: [] as ResourceItem[] // For collections
        }
    });

    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    // Collection Builder State
    const [resourceForm, setResourceForm] = useState({ title: '', url: '', type: 'link' as 'link' | 'file' });
    const [resourceFile, setResourceFile] = useState<File | null>(null);

    // Fetch items when entering manage mode
    useEffect(() => {
        if (isOpen && mode === 'manage') {
            fetchItems();
        }
    }, [isOpen, mode]);

    const fetchItems = async () => {
        setLoadingItems(true);
        try {
            const token = getToken();
            const res = await fetch('/api/library/items', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setItems(data);
            }
        } catch (error) {
            console.error('Error fetching items:', error);
        } finally {
            setLoadingItems(false);
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Tem certeza que deseja excluir "${title}"? esta ação não pode ser desfeita.`)) return;
        try {
            const token = getToken();
            const res = await fetch(`/api/library/items/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                setItems(items.filter(item => item.id !== id));
                onUpdate();
            } else {
                alert('Erro ao excluir item.');
            }
        } catch (error) {
            alert('Erro ao excluir item.');
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isResource = false) => {
        if (!e.target.files || e.target.files.length === 0) return;
        if (isResource) {
            setResourceFile(e.target.files[0]);
        } else {
            setFile(e.target.files[0]);
        }
    };

    const uploadFileToStorage = async (fileToUpload: File, subfolder = 'general'): Promise<string | null> => {
        const fileExt = fileToUpload.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;

        try {
            // 1. Obter URL assinada do backend
            const token = getToken();
            const authRes = await fetch('/api/library/upload-auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ fileName, folder: subfolder === 'collection_resources' ? 'collection_resources' : '' })
            });

            if (!authRes.ok) {
                const err = await authRes.json();
                throw new Error(err.error || 'Falha na autorização do upload');
            }

            const { path, token: uploadToken } = await authRes.json();

            // 2. Fazer upload usando a URL assinada
            const { error: uploadError } = await supabase.storage
                .from('library-assets')
                .uploadToSignedUrl(path, uploadToken, fileToUpload);

            if (uploadError) throw uploadError;

            // 3. Obter URL pública
            const { data } = supabase.storage.from('library-assets').getPublicUrl(path);
            return data.publicUrl;
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Erro ao fazer upload: ' + (error as Error).message);
            return null;
        }
    };

    const addResourceToCollection = async () => {
        if (!resourceForm.title) return alert('Título do recurso é obrigatório');

        let url = resourceForm.url;
        if (resourceForm.type === 'file') {
            if (!resourceFile) return alert('Selecione um arquivo');
            setUploading(true);
            const uploaded = await uploadFileToStorage(resourceFile, 'collection_resources');
            setUploading(false);
            if (!uploaded) return alert('Falha no upload');
            url = uploaded;
        } else {
            if (!url) return alert('URL é obrigatória');
            url = ensureProtocol(url);
        }

        setFormData({
            ...formData,
            metadata: {
                ...formData.metadata,
                resources: [...formData.metadata.resources, { title: resourceForm.title, url, type: resourceForm.type }]
            }
        });

        // Reset resource form
        setResourceForm({ title: '', url: '', type: 'link' });
        setResourceFile(null);
    };

    const removeResource = (index: number) => {
        const newResources = [...formData.metadata.resources];
        newResources.splice(index, 1);
        setFormData({
            ...formData,
            metadata: {
                ...formData.metadata,
                resources: newResources
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setUploading(true);

        try {
            let mainContentUrl = formData.content_url;

            // Upload main file if exists and not collection
            if (formData.type !== 'collection' && file) {
                const uploaded = await uploadFileToStorage(file, formData.type);
                if (uploaded) mainContentUrl = uploaded;
                else throw new Error('Falha no upload principal');
            }

            const token = getToken();
            const res = await fetch('/api/library/items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    content_url: formData.type === 'link' ? ensureProtocol(mainContentUrl) : mainContentUrl,
                    slug: formData.slug || (formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).substring(2, 7))
                })
            });

            if (res.ok) {
                onUpdate();
                alert('Item criado com sucesso!');
                setFormData({
                    title: '',
                    slug: '',
                    description: '',
                    type: 'pdf',
                    content_url: '',
                    metadata: { backgroundColor: '#ffffff', textColor: '#000000', icon: 'book', resources: [] }
                });
                setFile(null);
                setMode('manage');
            } else {
                const err = await res.json();
                alert('Erro ao salvar: ' + err.error);
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar item.');
        } finally {
            setUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-800">Gerenciar Biblioteca</h2>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-200" aria-label="Fechar">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Mode Switcher */}
                <div className="grid grid-cols-2 p-4 gap-2 bg-gray-50 border-b border-gray-100">
                    <button
                        onClick={() => setMode('create')}
                        className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${mode === 'create' ? 'bg-white shadow text-abz-blue font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Criar Novo
                    </button>
                    <button
                        onClick={() => setMode('manage')}
                        className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${mode === 'manage' ? 'bg-white shadow text-abz-blue font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Gerenciar ({items.length})
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto">
                    {mode === 'create' ? (
                        <div className="p-6">
                            {/* Create Tabs */}
                            <div className="flex border-b border-gray-200 mb-6">
                                <button
                                    onClick={() => setCreateTab('content')}
                                    className={`pb-2 mr-6 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors ${createTab === 'content' ? 'border-abz-blue text-abz-blue' : 'border-transparent text-gray-500'}`}
                                >
                                    Conteúdo
                                </button>
                                <button
                                    onClick={() => setCreateTab('appearance')}
                                    className={`pb-2 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors ${createTab === 'appearance' ? 'border-abz-blue text-abz-blue' : 'border-transparent text-gray-500'}`}
                                >
                                    Aparência
                                </button>
                            </div>

                            <form id="library-form" onSubmit={handleSubmit} className="space-y-6">
                                {createTab === 'content' ? (
                                    <>
                                        {/* Basic Info */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título</label>
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-abz-blue outline-none"
                                                    value={formData.title}
                                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
                                                <textarea
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg h-20 resize-none focus:ring-2 focus:ring-blue-100 focus:border-abz-blue outline-none"
                                                    value={formData.description}
                                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Item</label>
                                                    <select
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:border-abz-blue outline-none"
                                                        value={formData.type}
                                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                                    >
                                                        <option value="pdf">PDF Único</option>
                                                        <option value="collection">Múltiplos Arquivos/Links</option>
                                                        <option value="link">Link Único</option>
                                                        <option value="video">Vídeo</option>
                                                        <option value="image">Imagem</option>
                                                        <option value="text">Texto</option>
                                                        <option value="document">Documento (Word/Excel)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Slug (Link)</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-xs font-mono"
                                                        placeholder="auto-gerado"
                                                        value={formData.slug}
                                                        onChange={e => setFormData({ ...formData, slug: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <hr className="border-gray-100" />

                                        {/* Logic based on Type */}
                                        {formData.type === 'collection' ? (
                                            <div className="space-y-4">
                                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                                    <h4 className="text-sm font-bold text-abz-blue mb-3">Adicionar Conteúdo à Página</h4>

                                                    <div className="space-y-3">
                                                        <input
                                                            type="text"
                                                            placeholder="Título do Link/Arquivo (Ex: Formulário 1)"
                                                            className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm"
                                                            value={resourceForm.title}
                                                            onChange={e => setResourceForm({ ...resourceForm, title: e.target.value })}
                                                        />

                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setResourceForm({ ...resourceForm, type: 'file' })}
                                                                className={`flex-1 py-1 text-xs rounded border ${resourceForm.type === 'file' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                                            >
                                                                Arquivo
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setResourceForm({ ...resourceForm, type: 'link' })}
                                                                className={`flex-1 py-1 text-xs rounded border ${resourceForm.type === 'link' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                                            >
                                                                Link Externo
                                                            </button>
                                                        </div>

                                                        {resourceForm.type === 'link' ? (
                                                            <input
                                                                type="text"
                                                                placeholder="https://..."
                                                                className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm"
                                                                value={resourceForm.url}
                                                                onChange={e => setResourceForm({ ...resourceForm, url: e.target.value })}
                                                            />
                                                        ) : (
                                                            <input
                                                                type="file"
                                                                className="w-full text-sm text-gray-600"
                                                                onChange={(e) => handleFileUpload(e, true)}
                                                            />
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={addResourceToCollection}
                                                            disabled={uploading}
                                                            className="w-full py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                                        >
                                                            {uploading ? 'Enviando...' : <span className="flex items-center justify-center"><FiPlus className="mr-1" /> Adicionar à Lista</span>}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* List of Added Resources */}
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Itens Inclusos ({formData.metadata.resources.length})</label>
                                                    {formData.metadata.resources.length === 0 ? (
                                                        <p className="text-sm text-center text-gray-500 italic py-4 bg-gray-50 rounded-lg">Nenhum item adicionado ainda.</p>
                                                    ) : (
                                                        <ul className="space-y-2">
                                                            {formData.metadata.resources.map((res: ResourceItem, idx: number) => (
                                                                <li key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                                                                    <div className="flex items-center">
                                                                        {res.type === 'link' ? <FiLink className="text-gray-400 mr-3" /> : <FiFile className="text-gray-400 mr-3" />}
                                                                        <div>
                                                                            <p className="text-sm font-medium text-gray-800">{res.title}</p>
                                                                            <p className="text-xs text-gray-500 truncate max-w-[150px]">{res.url}</p>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeResource(idx)}
                                                                        className="text-red-500 hover:text-red-700 p-1"
                                                                        aria-label={`Remover ${res.title}`}
                                                                    >
                                                                        <FiTrash2 className="w-4 h-4" />
                                                                    </button>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            /* Standard Upload/Link UI - SEPARATED INPUTS */
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Arquivo Principal</label>
                                                    <div className="border border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors text-center">
                                                        <input
                                                            type="file"
                                                            id="main-file-upload"
                                                            className="hidden"
                                                            onChange={(e) => handleFileUpload(e, false)}
                                                        />
                                                        <label htmlFor="main-file-upload" className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                                                            <FiUpload className="w-8 h-8 text-gray-400 mb-2" />
                                                            <span className="text-sm text-gray-600 font-medium">
                                                                {file ? file.name : 'Clique para escolher arquivo'}
                                                            </span>
                                                        </label>
                                                    </div>
                                                </div>

                                                <div className="relative">
                                                    <div className="absolute inset-0 flex items-center">
                                                        <div className="w-full border-t border-gray-200"></div>
                                                    </div>
                                                    <div className="relative flex justify-center text-xs uppercase">
                                                        <span className="bg-white px-2 text-gray-500">OU Link Externo</span>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">URL do Conteúdo</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Cole a URL aqui se não houver arquivo"
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-abz-blue outline-none"
                                                        value={formData.content_url}
                                                        onChange={e => setFormData({ ...formData, content_url: e.target.value })}
                                                        disabled={!!file} // Disable if file selected to avoid confusion
                                                    />
                                                    {file && <p className="text-xs text-orange-500 mt-1">URL desabilitada pois um arquivo foi selecionado.</p>}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    /* Appearance Tab */
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <label className="block text-xs font-bold text-gray-500 uppercase">Ícone</label>
                                            <div className="grid grid-cols-6 gap-2 bg-gray-50 p-4 rounded-xl border border-gray-200 h-64 overflow-y-auto">
                                                {['book', 'file', 'link', 'folder', 'image', 'video', 'map', 'calendar', 'users', 'briefcase', 'clipboard', 'search', 'settings', 'message-circle', 'bell', 'star', 'heart', 'share', 'download', 'upload', 'trash', 'edit', 'check', 'x', 'plus', 'minus', 'info', 'alert-circle', 'help-circle', 'home', 'grid', 'list', 'layout', 'monitor', 'smartphone', 'tag', 'flag', 'award', 'gift', 'shopping-cart', 'credit-card', 'dollar-sign', 'activity', 'trending-up', 'pie-chart', 'bar-chart', 'shield', 'lock', 'unlock', 'key'].map((iconName) => (
                                                    <button
                                                        key={iconName}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, metadata: { ...formData.metadata, icon: iconName } })}
                                                        className={`flex items-center justify-center p-3 rounded-lg transition-all ${formData.metadata.icon === iconName ? 'bg-abz-blue text-white ring-2 ring-blue-200 ring-offset-1' : 'bg-white text-gray-600 hover:bg-gray-200'}`}
                                                        title={iconName}
                                                    >
                                                        {renderIcon(iconName, 'w-5 h-5')}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="block text-xs font-bold text-gray-500 uppercase">Cor do Card</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {[
                                                    { name: 'Padrão (Azul)', bg: '#eff6ff', text: '#1e3a8a', ring: 'ring-blue-200' },
                                                    { name: 'Verde (Políticas)', bg: '#f0fdf4', text: '#14532d', ring: 'ring-green-200' },
                                                    { name: 'Laranja (Procedimentos)', bg: '#fff7ed', text: '#7c2d12', ring: 'ring-orange-200' },
                                                    { name: 'Vermelho (Atenção)', bg: '#fef2f2', text: '#7f1d1d', ring: 'ring-red-200' },
                                                    { name: 'Roxo (Coleção)', bg: '#faf5ff', text: '#581c87', ring: 'ring-purple-200' },
                                                    { name: 'Cinza (Arquivo)', bg: '#f3f4f6', text: '#1f2937', ring: 'ring-gray-200' },
                                                ].map((theme) => (
                                                    <div
                                                        key={theme.name}
                                                        className={`flex items-center gap-3 p-3 border rounded-xl hover:bg-opacity-50 cursor-pointer transition-all ${formData.metadata.backgroundColor === theme.bg ? `ring-2 ${theme.ring} border-transparent` : 'border-gray-100'}`}
                                                        style={{ backgroundColor: theme.bg }}
                                                        onClick={() => setFormData({ ...formData, metadata: { ...formData.metadata, backgroundColor: theme.bg, textColor: theme.text } })}
                                                    >
                                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] bg-white/50 backdrop-blur-sm" style={{ color: theme.text }}>Aa</div>
                                                        <span className="text-xs font-bold" style={{ color: theme.text }}>{theme.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>
                    ) : (
                        /* Manage Tab */
                        <div className="p-6">
                            {loadingItems ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-lg animate-pulse"></div>)}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {items.length === 0 && <p className="text-center text-gray-500 py-4">Nenhum item encontrado.</p>}
                                    {items.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:shadow-sm">
                                            <div className="overflow-hidden mr-4">
                                                <h4 className="text-sm font-bold text-gray-800 truncate">{item.title}</h4>
                                                <p className="text-xs text-gray-500 uppercase">{item.type} {item.metadata?.resources?.length > 0 && `(${item.metadata.resources.length} itens)`}</p>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(item.id, item.title)}
                                                className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors bg-gray-50"
                                                aria-label={`Excluir ${item.title}`}
                                            >
                                                <FiTrash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {mode === 'create' && (
                    <div className="p-6 border-t border-gray-100 bg-gray-50">
                        <button
                            type="submit"
                            form="library-form"
                            disabled={uploading}
                            className="w-full py-3 bg-abz-blue text-white rounded-xl font-medium shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex justify-center items-center"
                        >
                            {uploading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <FiSave className="mr-2" /> Salvar Item
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
