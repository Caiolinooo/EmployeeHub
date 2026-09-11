'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AICompanionStatus,
  getCompanionMotion,
  statusAccent,
} from './companion-logo-motion';
import { MASCOT_PREFETCH_SRC } from './companion-mascot-frames';
import CompanionMascotRive, { type CompanionMascotRuntime } from './CompanionMascotRive';

export type { AICompanionStatus };

interface AnimatedABZLogoProps {
  status?: AICompanionStatus;
  size?: number;
  className?: string;
  /** Optional TTS-driven viseme index (0–3). Omit for fake lip-sync. */
  visemeIndex?: number;
  /** @deprecated — kept for API compat */
  showWordmark?: boolean;
  /** @deprecated — kept for API compat */
  compactLabel?: boolean;
}

/**
 * Companion FAB / panel mascot — Rive when `.riv` present, else Rive-like sprites.
 * Calm float/aura only when Rive is NOT driving (avoids double bob). No spin/wobble.
 */
export default function AnimatedABZLogo({
  status = 'idle',
  size = 56,
  className = '',
  visemeIndex,
}: AnimatedABZLogoProps) {
  const shouldReduceMotion = useReducedMotion();
  const accent = statusAccent(status);
  const [runtime, setRuntime] = useState<CompanionMascotRuntime>('rive-like');
  const onRuntimeChange = useCallback((next: CompanionMascotRuntime) => {
    setRuntime(next);
  }, []);

  // Rive file already bakes float/breathe — do not stack Framer bob on top
  const wrapperMotionOff = !!shouldReduceMotion || runtime === 'rive';
  const motionPreset = getCompanionMotion(status, wrapperMotionOff);
  const iconSize = Math.round(size * 0.92);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    for (const src of MASCOT_PREFETCH_SRC) {
      const img = new window.Image();
      img.decoding = 'async';
      img.src = src;
    }
  }, []);

  return (
    <motion.div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-label="ABZ Companion"
      title="ABZ Companion"
      animate={wrapperMotionOff ? undefined : motionPreset.float}
      transition={motionPreset.floatTransition}
    >
      {!wrapperMotionOff && (
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: -4,
            background: `radial-gradient(circle at 40% 35%, ${accent}22 0%, transparent 65%)`,
          }}
          animate={motionPreset.aura}
          transition={motionPreset.auraTransition}
        />
      )}

      {motionPreset.showRadar && !wrapperMotionOff && (
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: -2,
            border: `1px solid ${accent}`,
          }}
          initial={{ scale: 0.9, opacity: 0.3 }}
          animate={{ scale: 1.35, opacity: 0 }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      )}

      <div className="relative z-10 flex items-center justify-center">
        <CompanionMascotRive
          status={status}
          size={iconSize}
          reducedMotion={!!shouldReduceMotion}
          visemeIndex={visemeIndex}
          onRuntimeChange={onRuntimeChange}
        />
      </div>
    </motion.div>
  );
}
