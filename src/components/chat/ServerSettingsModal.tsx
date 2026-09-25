import React, { useState, useEffect } from 'react';
import { FiX, FiSave, FiTrash2, FiImage, FiGlobe, FiLock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import ModalCloseButton from '@/components/ui/ModalCloseButton';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';

interface ServerSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    server: {
        id: string;
        name: string;
        description?: string;
        icon_url?: string;
        is_public: boolean;
    };
    onUpdate: (serverId: string, data: any) => Promise<void>;
    onDelete: (serverId: string) => void;
}

export default function ServerSettingsModal({
    isOpen,
    onClose,
    server,
    onUpdate,
    onDelete
}: ServerSettingsModalProps) {
    const [name, setName] = useState(server.name);
    const [description, setDescription] = useState(server.description || '');
    const [iconUrl, setIconUrl] = useState(server.icon_url || '');
    const [isPublic, setIsPublic] = useState(server.is_public);
    const [isLoading, setIsLoading] = useState(false);
    useEscapeToClose(isOpen, onClose);

    useEffect(() => {
        if (isOpen) {
            setName(server.name);
            setDescription(server.description || '');
            setIconUrl(server.icon_url || '');
            setIsPublic(server.is_public);
        }
    }, [isOpen, server]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsLoading(true);
        try {
            await onUpdate(server.id, {
                name,
                description,
                icon_url: iconUrl,
                is_public: isPublic
            });
            toast.success('Servidor atualizado!');
            onClose();
        } catch (error) {
            toast.error('Erro ao atualizar servidor');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div data-modal-panel="" className="relative bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
                    <h2 className="text-lg font-semibold text-white min-w-0 truncate">Configurações do Servidor</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="hidden md:inline-flex p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
                    >
                        <FiX size={20} />
                    </button>
                    <ModalCloseButton onClick={onClose} mobileOnly className="text-zinc-400 hover:text-white hover:bg-zinc-800" />
                </div>

                <div className="p-6 space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                                Nome do Servidor
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                                placeholder="Ex: Recursos Humanos"
                                disabled={isLoading}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                                Descrição
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all resize-none h-24"
                                placeholder="Uma breve descrição sobre este servidor..."
                                disabled={isLoading}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide flex items-center gap-2">
                                <FiImage /> URL do Ícone (Opcional)
                            </label>
                            <input
                                type="url"
                                value={iconUrl}
                                onChange={(e) => setIconUrl(e.target.value)}
                                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                                placeholder="https://..."
                                disabled={isLoading}
                            />
                        </div>

                        <div className="flex items-center justify-between p-3 bg-zinc-950/30 rounded-lg border border-zinc-800/50">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isPublic ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-400'}`}>
                                    {isPublic ? <FiGlobe size={18} /> : <FiLock size={18} />}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-zinc-200">Visibilidade</p>
                                    <p className="text-xs text-zinc-500">
                                        {isPublic ? 'Visível para todos' : 'Apenas convidados'}
                                    </p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={isPublic}
                                    onChange={(e) => setIsPublic(e.target.checked)}
                                    disabled={isLoading}
                                />
                                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !name.trim()}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <FiSave size={18} />
                                    Salvar Alterações
                                </>
                            )}
                        </button>
                    </form>

                    <div className="pt-6 border-t border-zinc-800">
                        <h3 className="text-xs font-medium text-red-500 uppercase tracking-wide mb-3">Zona de Perigo</h3>
                        <button
                            onClick={() => onDelete(server.id)}
                            type="button"
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 border border-red-500/20 hover:border-red-500/30 rounded-lg font-medium transition-all"
                        >
                            <FiTrash2 size={18} />
                            Excluir Servidor
                        </button>
                        <p className="text-xs text-zinc-500 text-center mt-2">
                            Esta ação não pode ser desfeita. Todos os canais e mensagens serão apagados.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
