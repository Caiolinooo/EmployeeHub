import React, { useState } from 'react';
import { FiX, FiHash, FiVolume2, FiGlobe, FiUsers, FiLock, FiCheckCircle } from 'react-icons/fi';
import ModalCloseButton from '@/components/ui/ModalCloseButton';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import { useEscapeCapture } from '@/hooks/useEscapeCapture';

interface CreateChannelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: any) => Promise<void>;
    serverId: string;
}

export default function CreateChannelModal({ isOpen, onClose, onCreate, serverId }: CreateChannelModalProps) {
    const [name, setName] = useState('');
    const [type, setType] = useState<'public' | 'voice'>('public');
    const [accessLevel, setAccessLevel] = useState<'public' | 'department' | 'role'>('public');
    const [department, setDepartment] = useState('');
    const [targetRole, setTargetRole] = useState('');
    const [loading, setLoading] = useState(false);
    useEscapeToClose(isOpen, onClose);
    useEscapeCapture(isOpen, onClose);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onCreate({
                name,
                type,
                accessLevel,
                department: accessLevel === 'department' ? department : undefined,
                targetRole: accessLevel === 'role' ? targetRole : undefined,
                serverId
            });
            onClose();
            setName('');
            setAccessLevel('public');
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm max-md:p-4"
            onClick={onClose}
        >
            <div
                data-modal-panel=""
                className="relative bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-white/10 animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/80">
                    <div className="flex items-center gap-3 max-md:min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center max-md:shrink-0">
                            <FiHash className="w-5 h-5 text-blue-400" />
                        </div>
                        <h3 className="font-semibold text-lg text-white max-md:truncate">Criar Novo Canal</h3>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white max-md:hidden">
                        <FiX className="w-5 h-5" />
                    </button>
                    <ModalCloseButton onClick={onClose} mobileOnly mountOnlyWhenMobile className="text-zinc-400 hover:text-white hover:bg-white/5" />
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Channel Name */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Nome do Canal</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                                {type === 'voice' ? <FiVolume2 /> : <FiHash />}
                            </div>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={e => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                className="pl-10 w-full bg-zinc-950/50 border border-white/5 rounded-lg px-4 py-2.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                placeholder="nome-do-canal"
                            />
                        </div>
                    </div>

                    {/* Channel Type */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Tipo de Canal</label>
                        <div className="grid grid-cols-2 gap-3">
                            <label className={`relative border rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all ${type === 'public' ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-zinc-950/50 hover:bg-zinc-950/80'}`}>
                                <input type="radio" name="type" className="sr-only" checked={type === 'public'} onChange={() => setType('public')} />
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${type === 'public' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                    <FiHash className="w-5 h-5" />
                                </div>
                                <div className="text-center">
                                    <div className={`font-medium text-sm ${type === 'public' ? 'text-blue-400' : 'text-zinc-300'}`}>Texto</div>
                                    <div className="text-[10px] text-zinc-500 mt-0.5">Mensagens e arquivos</div>
                                </div>
                                {type === 'public' && <FiCheckCircle className="absolute top-2 right-2 w-4 h-4 text-blue-400" />}
                            </label>

                            <label className={`relative border rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all ${type === 'voice' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 bg-zinc-950/50 hover:bg-zinc-950/80'}`}>
                                <input type="radio" name="type" className="sr-only" checked={type === 'voice'} onChange={() => setType('voice')} />
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${type === 'voice' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                    <FiVolume2 className="w-5 h-5" />
                                </div>
                                <div className="text-center">
                                    <div className={`font-medium text-sm ${type === 'voice' ? 'text-emerald-400' : 'text-zinc-300'}`}>Voz/Vídeo</div>
                                    <div className="text-[10px] text-zinc-500 mt-0.5">Chamadas ao vivo</div>
                                </div>
                                {type === 'voice' && <FiCheckCircle className="absolute top-2 right-2 w-4 h-4 text-emerald-400" />}
                            </label>
                        </div>
                    </div>

                    {/* Access Level */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Permissões de Acesso</label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setAccessLevel('public')}
                                className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all ${accessLevel === 'public' ? 'border-violet-500 bg-violet-500/10 text-violet-400' : 'border-white/5 bg-zinc-950/50 text-zinc-400 hover:bg-zinc-950/80'}`}
                            >
                                <FiGlobe className="w-4 h-4" />
                                <span className="text-xs font-medium">Geral</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setAccessLevel('department')}
                                className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all ${accessLevel === 'department' ? 'border-violet-500 bg-violet-500/10 text-violet-400' : 'border-white/5 bg-zinc-950/50 text-zinc-400 hover:bg-zinc-950/80'}`}
                            >
                                <FiUsers className="w-4 h-4" />
                                <span className="text-xs font-medium">Setor</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setAccessLevel('role')}
                                className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all ${accessLevel === 'role' ? 'border-violet-500 bg-violet-500/10 text-violet-400' : 'border-white/5 bg-zinc-950/50 text-zinc-400 hover:bg-zinc-950/80'}`}
                            >
                                <FiLock className="w-4 h-4" />
                                <span className="text-xs font-medium">Cargo</span>
                            </button>
                        </div>
                    </div>

                    {accessLevel === 'department' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Selecione o Setor</label>
                            <select
                                required
                                value={department}
                                onChange={e => setDepartment(e.target.value)}
                                className="w-full bg-zinc-950/50 border border-white/5 rounded-lg px-4 py-2.5 text-zinc-200 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                            >
                                <option value="">Selecione...</option>
                                <option value="TI">Tecnologia (TI)</option>
                                <option value="RH">Recursos Humanos (RH)</option>
                                <option value="COMERCIAL">Comercial</option>
                                <option value="FINANCEIRO">Financeiro</option>
                                <option value="OPERACIONAL">Operacional</option>
                                <option value="MARKETING">Marketing</option>
                            </select>
                        </div>
                    )}

                    {accessLevel === 'role' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Selecione o Cargo</label>
                            <select
                                required
                                value={targetRole}
                                onChange={e => setTargetRole(e.target.value)}
                                className="w-full bg-zinc-950/50 border border-white/5 rounded-lg px-4 py-2.5 text-zinc-200 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                            >
                                <option value="">Selecione...</option>
                                <option value="ADMIN">Administrador</option>
                                <option value="MANAGER">Gerente</option>
                                <option value="USER">Usuário Padrão</option>
                            </select>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="pt-4 flex justify-end gap-3 border-t border-white/5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/10"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <FiHash className="w-4 h-4" />
                                    Criar Canal
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
