'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Painel flutuante arrastável.
 * Mesmo gesto do painel da escala GT (GTManScheduleTab): header cursor-move,
 * mouse e toque, limites na viewport. O GT deixa a lógica inline; este componente
 * é o mesmo comportamento para o editor de campos de contrato.
 */
export default function DraggableFloatingPanel({
    title,
    children,
    onClose,
    width = 420,
    initialPosition,
    zIndex = 80,
}: {
    title: React.ReactNode;
    children: React.ReactNode;
    onClose?: () => void;
    width?: number;
    initialPosition?: { x: number; y: number };
    zIndex?: number;
}) {
    const [modalPos, setModalPos] = useState<{ x: number; y: number } | null>(initialPosition ?? null);
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
        startX: 0,
        startY: 0,
        posX: 0,
        posY: 0,
    });

    const defaultPos = () => ({
        x: typeof window !== 'undefined' ? Math.max(20, window.innerWidth - width - 24) : 40,
        y: 110,
    });

    const handleDragStart = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return;
        e.preventDefault();
        setIsDragging(true);
        const current = modalPos ?? defaultPos();
        dragRef.current = { startX: e.clientX, startY: e.clientY, posX: current.x, posY: current.y };
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return;
        const touch = e.touches[0];
        setIsDragging(true);
        const current = modalPos ?? defaultPos();
        dragRef.current = { startX: touch.clientX, startY: touch.clientY, posX: current.x, posY: current.y };
    };

    useEffect(() => {
        if (!isDragging) return;

        const moveTo = (clientX: number, clientY: number) => {
            const dx = clientX - dragRef.current.startX;
            const dy = clientY - dragRef.current.startY;
            const maxX = Math.max(10, window.innerWidth - width);
            const maxY = Math.max(10, window.innerHeight - 200);
            setModalPos({
                x: Math.max(10, Math.min(maxX, dragRef.current.posX + dx)),
                y: Math.max(10, Math.min(maxY, dragRef.current.posY + dy)),
            });
        };

        const handleMouseMove = (e: MouseEvent) => moveTo(e.clientX, e.clientY);
        const handleTouchMove = (e: TouchEvent) => {
            const touch = e.touches[0];
            moveTo(touch.clientX, touch.clientY);
        };
        const handleDragEnd = () => setIsDragging(false);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleDragEnd);
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleDragEnd);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, [isDragging, width]);

    const pos = modalPos ?? (typeof window !== 'undefined' ? defaultPos() : { x: 40, y: 110 });

    return (
        <div
            className="fixed pointer-events-auto"
            style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${width}px`,
                maxWidth: 'calc(100vw - 32px)',
                zIndex,
            }}
        >
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[min(86dvh,760px)] ring-1 ring-black/10">
                <div
                    onMouseDown={handleDragStart}
                    onTouchStart={handleTouchStart}
                    className="bg-slate-100/90 px-4 py-3 border-b border-slate-200 flex items-center justify-between cursor-move select-none shrink-0"
                >
                    <div className="min-w-0 text-sm font-semibold text-slate-800">{title}</div>
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-slate-400 hover:text-red-500 text-lg leading-none px-1"
                            aria-label="Fechar"
                        >
                            ×
                        </button>
                    )}
                </div>
                <div className="p-4 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
}
