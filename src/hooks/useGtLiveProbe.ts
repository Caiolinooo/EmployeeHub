'use client';

/**
 * GT v2 (R3) — polling leve de mudanças via GET /api/gestao-tripulantes/live-probe.
 *
 * - Consulta a cada `intervalMs` (default 15s) e chama `onChange` quando a
 *   assinatura muda (a 1ª resposta só estabelece a baseline).
 * - Robusto a erro: mantém a última assinatura, expõe `erro` e continua
 *   tentando no próximo tick — nunca lança, nunca entra em loop de fetch
 *   (guarda de requisição em voo + pausa quando a aba está oculta).
 * - `verificarAgora()` força uma checagem imediata (ex.: logo após salvar um
 *   evento — embora o POST/PUT/DELETE já buste o cache no servidor, o probe
 *   sincroniza abas/painéis abertos em paralelo).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '@/lib/tokenStorage';

export type GtLiveProbeEscopo = 'escala' | 'fechamento' | 'colaboradores';

export interface UseGtLiveProbeOptions {
  escopo?: GtLiveProbeEscopo | string;
  intervalMs?: number;
  enabled?: boolean;
  onChange?: (assinatura: string, assinaturaAnterior: string | null) => void;
}

export interface UseGtLiveProbeResult {
  assinatura: string | null;
  carregando: boolean;
  erro: string | null;
  verificarAgora: () => void;
}

interface ProbeResponse {
  success?: boolean;
  assinatura?: string;
  error?: string;
}

export function useGtLiveProbe({
  escopo = 'escala',
  intervalMs = 15000,
  enabled = true,
  onChange,
}: UseGtLiveProbeOptions = {}): UseGtLiveProbeResult {
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const assinaturaRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const verificar = useCallback(async () => {
    if (!enabled || inFlightRef.current) return;
    // Aba oculta: economiza requisições; o próximo tick ao voltar detecta.
    if (typeof document !== 'undefined' && document.hidden) return;
    inFlightRef.current = true;
    setCarregando(true);
    try {
      const headers: Record<string, string> = { 'Cache-Control': 'no-cache' };
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(
        `/api/gestao-tripulantes/live-probe?escopo=${encodeURIComponent(escopo)}`,
        { headers, cache: 'no-store' },
      );
      const json = (await res.json().catch(() => ({}))) as ProbeResponse;
      if (!res.ok || !json.success || typeof json.assinatura !== 'string') {
        throw new Error(json.error || `Probe falhou (HTTP ${res.status})`);
      }
      const anterior = assinaturaRef.current;
      if (json.assinatura !== anterior) {
        assinaturaRef.current = json.assinatura;
        setAssinatura(json.assinatura);
        if (anterior !== null) {
          // Só notifica mudança REAL (a 1ª resposta é a baseline).
          try {
            onChangeRef.current?.(json.assinatura, anterior);
          } catch (err) {
            console.error('[useGtLiveProbe] onChange lançou:', err);
          }
        }
      }
      setErro(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro no probe de mudanças');
    } finally {
      inFlightRef.current = false;
      setCarregando(false);
    }
  }, [escopo, enabled]);

  const verificarRef = useRef(verificar);
  useEffect(() => {
    verificarRef.current = verificar;
  }, [verificar]);

  useEffect(() => {
    if (!enabled) return undefined;
    verificarRef.current();
    const id = window.setInterval(() => verificarRef.current(), Math.max(3000, intervalMs));
    const onVisible = () => {
      if (!document.hidden) verificarRef.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, intervalMs, escopo]);

  const verificarAgora = useCallback(() => {
    verificarRef.current();
  }, []);

  return { assinatura, carregando, erro, verificarAgora };
}
