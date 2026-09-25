'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import ModalCloseButton from '@/components/ui/ModalCloseButton';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    confirmButtonClass?: string;
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    isDestructive = false,
    confirmButtonClass,
}: ConfirmationModalProps) {
    useEscapeToClose(isOpen, onClose);
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
                        <ModalCloseButton
                            onClick={onClose}
                            mountOnlyWhenMobile
                            className="absolute right-2 top-2 text-white/70 hover:text-white hover:bg-white/10"
                        />
                        <div className="p-6">
                            <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
                            <p className="text-gray-400 mb-6">{message}</p>

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={() => {
                                        onConfirm();
                                        onClose();
                                    }}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${confirmButtonClass || (isDestructive
                                        ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white')
                                        }`}
                                >
                                    {confirmText}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
