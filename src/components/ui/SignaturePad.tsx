'use client';

import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { FiRefreshCcw, FiCheck } from 'react-icons/fi';

interface SignaturePadProps {
    onSignatureChange: (base64: string | null) => void;
    initialSignature?: string | null;
    width?: number;
    height?: number;
    penColor?: string;
    placeholder?: string;
    disabled?: boolean;
}

/**
 * SignaturePad — Canvas puro para desenhar assinatura.
 * Componente reutilizável sem lógica de modal ou autenticação.
 * Apenas captura o desenho e retorna base64.
 */
export default function SignaturePad({
    onSignatureChange,
    initialSignature,
    penColor = 'black',
    placeholder = 'Assine aqui',
    disabled = false,
}: SignaturePadProps) {
    const sigCanvas = useRef<SignatureCanvas>(null);
    const [isEmpty, setIsEmpty] = useState(true);

    useEffect(() => {
        if (initialSignature && sigCanvas.current) {
            // Load an existing signature into the canvas
            try {
                sigCanvas.current.fromDataURL(initialSignature);
                setIsEmpty(false);
            } catch {
                // Ignore load errors
            }
        }
    }, [initialSignature]);

    const clear = () => {
        sigCanvas.current?.clear();
        setIsEmpty(true);
        onSignatureChange(null);
    };

    const handleEnd = () => {
        const empty = sigCanvas.current?.isEmpty() ?? true;
        setIsEmpty(empty);
        if (!empty) {
            const data = sigCanvas.current?.getCanvas().toDataURL('image/png');
            onSignatureChange(data || null);
        }
    };

    return (
        <div className="space-y-2">
            <div className={`border-2 border-dashed rounded-lg bg-gray-50 relative ${disabled ? 'opacity-50 pointer-events-none' : 'border-gray-300'}`}>
                <SignatureCanvas
                    ref={sigCanvas}
                    penColor={penColor}
                    canvasProps={{
                        className: 'signature-canvas w-full rounded-lg cursor-crosshair',
                        style: { height: '200px' },
                    }}
                    onEnd={handleEnd}
                />
                {isEmpty && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-500 text-sm">
                        {placeholder}
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={clear}
                    disabled={disabled || isEmpty}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition-colors border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <FiRefreshCcw className="w-3 h-3" />
                    Limpar
                </button>
                {!isEmpty && (
                    <span className="flex items-center gap-1 text-xs text-abz-green-dark">
                        <FiCheck className="w-3 h-3" />
                        Assinatura capturada
                    </span>
                )}
            </div>
        </div>
    );
}
