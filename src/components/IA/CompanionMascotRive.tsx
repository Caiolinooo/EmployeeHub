'use client';

import React, { Suspense, lazy, useEffect, useState } from 'react';
import type { AICompanionStatus } from './companion-logo-motion';
import CompanionMascotRiveLike from './CompanionMascotRiveLike';
import { lipSyncIntervalMs, MASCOT_VISEME_IDS } from './companion-mascot-frames';
import { probeCompanionRiveAsset } from './companion-mascot-rive-probe';

const CompanionMascotRivePlayer = lazy(() => import('./CompanionMascotRivePlayer'));

export type CompanionMascotRuntime = 'rive' | 'rive-like';

export interface CompanionMascotRiveProps {
  status: AICompanionStatus;
  size: number;
  reducedMotion?: boolean;
  className?: string;
  /** Optional TTS-driven viseme (0–3). Omit for fake lip-sync while speaking. */
  visemeIndex?: number;
  /** Notify shell when Rive owns motion (so Framer float/aura can stay off). */
  onRuntimeChange?: (runtime: CompanionMascotRuntime) => void;
}

function useCompanionRiveAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    probeCompanionRiveAsset().then(ok => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return available;
}

/**
 * Companion mascot runtime gate:
 * - If `/rive/companion-mascot.riv` exists → lazy Rive player
 * - Else → CompanionMascotRiveLike (crossfade body; face overlay optional)
 *
 * Fake lip-sync only while status === 'speaking' (~2–3 Hz). Idle never drives open-A.
 */
export default function CompanionMascotRive({
  status,
  size,
  reducedMotion = false,
  className = '',
  visemeIndex: visemeIndexProp,
  onRuntimeChange,
}: CompanionMascotRiveProps) {
  const riveAvailable = useCompanionRiveAvailable();
  const [riveFailed, setRiveFailed] = useState(false);
  /** null = mouth at rest (do not feed open-A / viseme 0 to idle) */
  const [fakeViseme, setFakeViseme] = useState<number | null>(null);

  const useRiveRuntime = riveAvailable === true && !riveFailed && !reducedMotion;
  const runtime: CompanionMascotRuntime = useRiveRuntime ? 'rive' : 'rive-like';

  useEffect(() => {
    onRuntimeChange?.(runtime);
  }, [runtime, onRuntimeChange]);

  useEffect(() => {
    if (typeof visemeIndexProp === 'number') return;
    if (reducedMotion || status !== 'speaking') {
      setFakeViseme(null);
      return;
    }
    // Start on E (1), not A (0) — softer first mouth shape
    setFakeViseme(1);
    const id = window.setInterval(() => {
      setFakeViseme(i => {
        const cur = i ?? 1;
        return (cur + 1) % MASCOT_VISEME_IDS.length;
      });
    }, lipSyncIntervalMs());
    return () => window.clearInterval(id);
  }, [status, reducedMotion, visemeIndexProp]);

  // Only pass a viseme while speaking. null → player/Rive-like keep mouth rest / hide layer.
  const activeViseme: number | undefined =
    status !== 'speaking'
      ? undefined
      : typeof visemeIndexProp === 'number'
        ? visemeIndexProp
        : fakeViseme ?? undefined;

  if (useRiveRuntime) {
    return (
      <Suspense
        fallback={
          <CompanionMascotRiveLike
            status={status}
            size={size}
            reducedMotion={reducedMotion}
            className={className}
            visemeIndex={activeViseme}
          />
        }
      >
        <CompanionMascotRivePlayer
          status={status}
          size={size}
          reducedMotion={reducedMotion}
          visemeIndex={activeViseme}
          className={className}
          onLoadError={() => setRiveFailed(true)}
        />
      </Suspense>
    );
  }

  return (
    <CompanionMascotRiveLike
      status={status}
      size={size}
      reducedMotion={reducedMotion}
      className={className}
      visemeIndex={activeViseme}
    />
  );
}
