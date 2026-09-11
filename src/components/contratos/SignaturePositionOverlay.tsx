'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FiCheck, FiEdit2, FiPenTool, FiBookmark } from 'react-icons/fi';

interface SignaturePositionOverlayProps {
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
    status?: 'PENDING' | 'SIGNED' | 'REJECTED';
    onClick?: () => void;
    interactive?: boolean;
    draggable?: boolean;
    onDragEnd?: (newX: number, newY: number) => void;
    colorClasses?: {
        border: string;
        bg: string;
        text: string;
        ring: string;
    };
    pulse?: boolean;
    tipo?: 'assinatura' | 'rubrica' | 'texto' | 'checkbox';
}

export default function SignaturePositionOverlay({
    x,
    y,
    width,
    height,
    label = 'Assine Aqui',
    status = 'PENDING',
    onClick,
    interactive = false,
    draggable = false,
    onDragEnd,
    colorClasses,
    pulse = false,
    tipo,
}: SignaturePositionOverlayProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [currentPos, setCurrentPos] = useState({ x, y });
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const currentPosRef = useRef({ x, y });
    const onDragEndRef = useRef(onDragEnd);
    onDragEndRef.current = onDragEnd;
    const elementRef = useRef<HTMLDivElement>(null);

    // Sync position if external x,y changes
    useEffect(() => {
        if (!isDragging) {
            setCurrentPos({ x, y });
            currentPosRef.current = { x, y };
        }
    }, [x, y, isDragging]);

    // Handle drag pointer events
    useEffect(() => {
        if (!isDragging) return;

        const handlePointerMove = (e: PointerEvent) => {
            const newX = Math.max(0, e.clientX - dragOffsetRef.current.x);
            const newY = Math.max(0, e.clientY - dragOffsetRef.current.y);
            currentPosRef.current = { x: newX, y: newY };
            setCurrentPos({ x: newX, y: newY });
        };

        const handlePointerUp = () => {
            setIsDragging(false);
            if (onDragEndRef.current) {
                onDragEndRef.current(currentPosRef.current.x, currentPosRef.current.y);
            }
        };

        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);

        return () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging]);

    const statusStyles = {
        PENDING: {
            border: 'border-amber-400',
            bg: 'bg-amber-50/85',
            text: 'text-amber-800',
            ring: 'ring-amber-200',
        },
        SIGNED: {
            border: 'border-emerald-400',
            bg: 'bg-emerald-50/85',
            text: 'text-emerald-800',
            ring: 'ring-emerald-200',
        },
        REJECTED: {
            border: 'border-gray-400',
            bg: 'bg-gray-50/85',
            text: 'text-gray-600',
            ring: 'ring-gray-200',
        },
    };

    // Use custom color tokens if available, fallback to status defaults
    const styles = colorClasses || statusStyles[status] || statusStyles.PENDING;

    // Auto-detect tipo if not provided based on size or label contents
    const resolvedTipo = tipo || (() => {
        const lowerLabel = label.toLowerCase();
        if (width <= 30 || lowerLabel.includes('checkbox') || lowerLabel.includes('seleção')) return 'checkbox';
        if (lowerLabel.includes('rubrica') || lowerLabel.includes('rúbrica')) return 'rubrica';
        if (lowerLabel.includes('texto') || lowerLabel.includes('extenso') || lowerLabel.includes('preencher')) return 'texto';
        return 'assinatura';
    })();

    const statusLabel = status === 'SIGNED' ? '✓ Assinado' : status === 'REJECTED' ? '✕ Rejeitado' : label;

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!draggable) {
            if (interactive && onClick) onClick();
            return;
        }
        
        e.preventDefault();
        e.stopPropagation(); // Prevent triggering background click handlers
        
        dragOffsetRef.current = {
            x: e.clientX - currentPos.x,
            y: e.clientY - currentPos.y,
        };
        currentPosRef.current = { x: currentPos.x, y: currentPos.y };
        setIsDragging(true);
    };

    // Rounding class depends on type (checkbox is square, others are capsule-shaped or rounded rectangles)
    const roundingClass = resolvedTipo === 'checkbox' ? 'rounded-lg' : 'rounded-2xl';

    return (
        <div
            ref={elementRef}
            onPointerDown={handlePointerDown}
            className={`group absolute border-2 ${styles.border} ${styles.bg} ${roundingClass} flex items-center transition-all duration-200 select-none shadow-sm
                ${pulse && status === 'PENDING' ? 'animate-pulse ring-4' : ''}
                ${interactive || draggable ? (isDragging ? 'cursor-grabbing shadow-lg scale-102 ring-2 pointer-events-auto' : 'cursor-grab hover:ring-2 hover:shadow-md pointer-events-auto') : 'pointer-events-none'}
                ${interactive && !draggable ? 'cursor-pointer hover:scale-[1.02] pointer-events-auto' : ''}
                ${interactive ? styles.ring : ''}`}
            style={{
                left: currentPos.x,
                top: currentPos.y,
                width: width,
                height: height,
                zIndex: isDragging ? 50 : 10,
                touchAction: 'none' // Prevent scrolling when dragging on touch devices
            }}
        >
            {/* Tooltip for Checkbox & Rubric if too small */}
            {(resolvedTipo === 'checkbox' || resolvedTipo === 'rubrica' || width < 110 || height < 34) && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
                    {label} ({resolvedTipo.toUpperCase()})
                </div>
            )}

            {/* Checkbox Rendering */}
            {resolvedTipo === 'checkbox' ? (
                <div className="w-full h-full flex items-center justify-center">
                    {status === 'SIGNED' ? (
                        <FiCheck className={`w-4 h-4 ${styles.text} stroke-[3]`} />
                    ) : (
                        <div className={`w-3.5 h-3.5 rounded border border-current opacity-70`} />
                    )}
                </div>
            ) : height < 34 ? (
                /* Compact Row Layout for Small Heights (e.g. 20px - 26px) */
                <div className="w-full h-full px-2 flex items-center justify-between gap-1.5 overflow-hidden text-left">
                    <div className="flex items-center gap-1.5 min-w-0">
                        {resolvedTipo === 'texto' ? (
                            <FiEdit2 className={`w-3.5 h-3.5 ${styles.text} shrink-0 opacity-80`} />
                        ) : resolvedTipo === 'rubrica' ? (
                            <FiBookmark className={`w-3.5 h-3.5 ${styles.text} shrink-0 opacity-80`} />
                        ) : (
                            <FiPenTool className={`w-3.5 h-3.5 ${styles.text} shrink-0 opacity-80`} />
                        )}
                        <span className={`text-[10px] font-bold ${styles.text} truncate`}>
                            {status === 'SIGNED' ? statusLabel : label}
                        </span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-md text-[8px] font-bold bg-white/90 border border-gray-100 shadow-sm text-gray-500 shrink-0 select-none uppercase">
                        {resolvedTipo === 'texto' ? 'Texto' : resolvedTipo === 'rubrica' ? 'Visto' : 'Assin'}
                    </span>
                </div>
            ) : (
                /* Full Two-Row Layout for Larger Heights */
                <div className="w-full h-full px-3 flex items-center gap-2.5 text-left overflow-hidden">
                    <div className={`p-1.5 rounded-xl bg-white border ${styles.border} shrink-0 shadow-sm`}>
                        {resolvedTipo === 'texto' ? (
                            <FiEdit2 className={`w-3.5 h-3.5 ${styles.text}`} />
                        ) : resolvedTipo === 'rubrica' ? (
                            <FiBookmark className={`w-3.5 h-3.5 ${styles.text}`} />
                        ) : (
                            <FiPenTool className={`w-3.5 h-3.5 ${styles.text}`} />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className={`text-[9px] font-bold uppercase tracking-wider ${styles.text} leading-none truncate`}>
                            {resolvedTipo === 'texto' ? 'Campo de Texto' : resolvedTipo === 'rubrica' ? 'Rúbrica / Visto' : 'Assinatura'}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate leading-tight mt-0.5">
                            {status === 'SIGNED' ? statusLabel : label}
                        </p>
                    </div>
                    {status === 'SIGNED' && (
                        <span className="shrink-0 bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-sm">
                            ✓ OK
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

export const PRESET_SIGNER_COLORS = [
    { border: 'border-indigo-500', bg: 'bg-indigo-50/90', text: 'text-indigo-700', ring: 'ring-indigo-300' },
    { border: 'border-teal-500', bg: 'bg-teal-50/90', text: 'text-teal-700', ring: 'ring-teal-300' },
    { border: 'border-orange-500', bg: 'bg-orange-50/90', text: 'text-orange-700', ring: 'ring-orange-300' },
    { border: 'border-purple-500', bg: 'bg-purple-50/90', text: 'text-purple-700', ring: 'ring-purple-300' },
    { border: 'border-rose-500', bg: 'bg-rose-50/90', text: 'text-rose-700', ring: 'ring-rose-300' },
    { border: 'border-cyan-500', bg: 'bg-cyan-50/90', text: 'text-cyan-700', ring: 'ring-cyan-300' },
    { border: 'border-amber-500', bg: 'bg-amber-50/90', text: 'text-amber-700', ring: 'ring-amber-300' },
    { border: 'border-emerald-500', bg: 'bg-emerald-50/90', text: 'text-emerald-700', ring: 'ring-emerald-300' },
];

export function getSignerColor(identifier?: string) {
    if (!identifier) return PRESET_SIGNER_COLORS[0];
    
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
        hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % PRESET_SIGNER_COLORS.length;
    return PRESET_SIGNER_COLORS[index];
}
