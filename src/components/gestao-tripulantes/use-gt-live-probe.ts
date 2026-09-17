'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getToken } from '@/lib/tokenStorage';

/**
 * R3 — poll leve (15s) da assinatura de dados (GET /api/gestao-tripulantes/live-probe).
 * Ao detectar mudança chama `onChange` (refetch silencioso), preservando as regras
 * de geração/stale-guard de quem consome.
 *
 * Garantias:
 * - Fail-soft total: rota ausente/erro apenas mantém a última assinatura (sem
 *   console.error — usa fetch cru + getToken, não fetchWithToken, para não poluir
 *   o console durante o rollout do endpoint).
 * - `canProbe()` permite ao consumidor pausar o poll enquanto um refetch pós-save
 *   está em voo (não rodar probe durante save/refetch).
 * - `notifyLocalWrite()` re-basa a assinatura após gravação local: o próximo probe
 *   não dispara refetch redundante por mudança que o próprio usuário causou.
 * - Aba oculta (document.hidden) não faz probe; ao voltar, a 1ª leitura detecta a
 *   diferença acumulada e atualiza.
 */
export type GtLiveProbeEscopo = 'escala' | 'fechamento' | 'colaboradores';

interface UseGtLiveProbeOptions {
    escopo: GtLiveProbeEscopo;
    enabled?: boolean;
    intervalMs?: number;
    canProbe?: () => boolean;
    onChange?: () => void;
}

interface UseGtLiveProbeResult {
    /** Chame após gravar localmente (save/delete) para não tratar a própria mudança como externa. */
    notifyLocalWrite: () => void;
}

export function useGtLiveProbe({
    escopo,
    enabled = true,
    intervalMs = 15000,
    canProbe,
    onChange,
}: UseGtLiveProbeOptions): UseGtLiveProbeResult {
    const onChangeRef = useRef(onChange);
    const canProbeRef = useRef(canProbe);
    const lastSignatureRef = useRef<string | null>(null);
    const busyRef = useRef(false);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        canProbeRef.current = canProbe;
    }, [canProbe]);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;

        const probe = async () => {
            if (cancelled || busyRef.current) return;
            if (typeof document !== 'undefined' && document.hidden) return;
            const gate = canProbeRef.current;
            if (gate && !gate()) return;

            busyRef.current = true;
            try {
                const token = getToken();
                const headers: Record<string, string> = { 'Cache-Control': 'no-cache' };
                if (token) headers.Authorization = `Bearer ${token}`;
                const res = await fetch(
                    `/api/gestao-tripulantes/live-probe?escopo=${encodeURIComponent(escopo)}&_t=${Date.now()}`,
                    { headers, cache: 'no-store' }
                );
                if (!res.ok) return; // rollout/erro: mantém baseline, sem ruído
                const json = await res.json().catch(() => null);
                const assinatura = json?.data?.assinatura ?? json?.assinatura;
                if (typeof assinatura !== 'string' || assinatura.length === 0) return;
                const previous = lastSignatureRef.current;
                lastSignatureRef.current = assinatura;
                if (previous !== null && previous !== assinatura) {
                    onChangeRef.current?.();
                }
            } catch {
                // probe é best-effort
            } finally {
                busyRef.current = false;
            }
        };

        const timer = window.setInterval(probe, intervalMs);
        const kickoff = window.setTimeout(probe, 2000); // define baseline sem disparar
        return () => {
            cancelled = true;
            window.clearInterval(timer);
            window.clearTimeout(kickoff);
        };
    }, [escopo, enabled, intervalMs]);

    const notifyLocalWrite = useCallback(() => {
        lastSignatureRef.current = null;
    }, []);

    return { notifyLocalWrite };
}
