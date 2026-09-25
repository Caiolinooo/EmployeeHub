import React, { useState, useEffect } from 'react';
import { FiX, FiSearch, FiMessageCircle } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';
import ModalCloseButton from '@/components/ui/ModalCloseButton';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';

interface User {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    drive_photo_url?: string;
    status?: string;
}

interface StartDMModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUserId: string;
    onStartConversation: (userId: string) => Promise<void>;
}

export default function StartDMModal({ isOpen, onClose, currentUserId, onStartConversation }: StartDMModalProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [starting, setStarting] = useState<string | null>(null);
    useEscapeToClose(isOpen, onClose);

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
        }
    }, [isOpen]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('users_unified')
                .select('id, first_name, last_name, email, drive_photo_url, status')
                .neq('id', currentUserId)
                .order('first_name');

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStartDM = async (userId: string) => {
        setStarting(userId);
        try {
            await onStartConversation(userId);
            onClose();
        } catch (error) {
            console.error('Error starting DM:', error);
        } finally {
            setStarting(null);
        }
    };

    const filteredUsers = users.filter(user => {
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
        const email = (user.email || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return fullName.includes(query) || email.includes(query);
    });

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'online': return 'bg-green-500';
            case 'away': return 'bg-yellow-500';
            case 'dnd': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm max-md:p-4"
            onClick={onClose}
        >
            <div
                data-modal-panel=""
                className="bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-white/10 animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/80">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                            <FiMessageCircle className="w-5 h-5 text-violet-400" />
                        </div>
                        <h3 className="font-semibold text-lg text-white truncate">Nova Conversa</h3>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white max-md:hidden">
                        <FiX className="w-5 h-5" />
                    </button>
                    <ModalCloseButton onClick={onClose} mobileOnly className="text-zinc-400 hover:text-white hover:bg-white/5" />
                </div>

                {/* Search */}
                <div className="px-4 py-3 border-b border-white/5">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar usuário..."
                            className="w-full bg-zinc-950/50 border border-white/5 rounded-lg pl-10 pr-4 py-2.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                            autoFocus
                        />
                    </div>
                </div>

                {/* User List */}
                <div className="max-h-80 overflow-y-auto py-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="text-center py-8 px-4">
                            <p className="text-sm text-zinc-500">Nenhum usuário encontrado</p>
                        </div>
                    ) : (
                        filteredUsers.map(user => (
                            <button
                                key={user.id}
                                onClick={() => handleStartDM(user.id)}
                                disabled={starting === user.id}
                                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-colors disabled:opacity-50"
                            >
                                <div className="relative shrink-0">
                                    <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center overflow-hidden">
                                        {user.drive_photo_url ? (
                                            <img src={user.drive_photo_url} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <span className="text-sm font-bold text-white">
                                                {(user.first_name || user.email || '?').charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-900 ${getStatusColor(user.status)}`}></div>
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="text-sm font-medium text-zinc-200 truncate">
                                        {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.email}
                                    </div>
                                    <div className="text-xs text-zinc-500 truncate">{user.email}</div>
                                </div>
                                {starting === user.id && (
                                    <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
