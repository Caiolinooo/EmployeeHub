'use client';

import React from 'react';
import { toast } from 'react-hot-toast';
import { FiRotateCcw } from 'react-icons/fi';

interface ToastDesfazerOptions {
    mensagem: string;
    labelDesfazer: string;
    onDesfazer: () => void;
    duracaoMs?: number;
}

/**
 * Toast com ação "Desfazer" (react-hot-toast 2.5.x não tem ToastOptions.action —
 * usa render function). Auto-dismiss como os toasts comuns; o clique dispensa o
 * toast e dispara a reversão em cadeia.
 */
export function toastComAcaoDesfazer({
    mensagem,
    labelDesfazer,
    onDesfazer,
    duracaoMs = 6000,
}: ToastDesfazerOptions): string {
    return toast(
        (t) => (
            <span className="flex items-center gap-3 min-w-0">
                <span className="truncate">{mensagem}</span>
                <button
                    type="button"
                    onClick={() => {
                        toast.dismiss(t.id);
                        onDesfazer();
                    }}
                    className="flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors shrink-0"
                >
                    <FiRotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    {labelDesfazer}
                </button>
            </span>
        ),
        { duration: duracaoMs }
    );
}
