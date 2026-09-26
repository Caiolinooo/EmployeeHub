import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaServer, FaPlus } from 'react-icons/fa';
import ModalCloseButton from '@/components/ui/ModalCloseButton';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import { useEscapeCapture } from '@/hooks/useEscapeCapture';

interface CreateServerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string) => Promise<void>;
}

export default function CreateServerModal({ isOpen, onClose, onCreate }: CreateServerModalProps) {
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    useEscapeToClose(isOpen, onClose);
    useEscapeCapture(isOpen, onClose);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            await onCreate(name);
            setName('');
            onClose();
        } catch (error) {
            console.error('Error creating server:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        data-modal-panel=""
                        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-[#1A1A1A] border border-white/10 shadow-2xl"
                    >
                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                    <FaServer className="text-blue-500 text-lg" />
                                </div>
                                <h3 className="text-xl font-semibold text-white max-md:flex-1 max-md:min-w-0">Criar Servidor</h3>
                                <ModalCloseButton onClick={onClose} mobileOnly mountOnlyWhenMobile className="text-zinc-400 hover:text-white hover:bg-white/10" />
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        Nome do Servidor
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ex: Projetos Internos"
                                        className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                                        autoFocus
                                        onKeyDown={(event) => {
                                            if (event.key === 'Escape' || event.key === 'Esc') {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                onClose();
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 max-md:min-h-11 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
                                    disabled={isSubmitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!name.trim() || isSubmitting}
                                    className="px-4 py-2 max-md:min-h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <FaPlus />
                                            Criar Servidor
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
