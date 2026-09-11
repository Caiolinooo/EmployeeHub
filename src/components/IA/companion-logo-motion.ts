import type { Transition, TargetAndTransition } from 'framer-motion';

export type AICompanionStatus = 'idle' | 'listening' | 'speaking' | 'executing';

/** Brand blue — ABZ UI chrome */
export const BRAND_BLUE = '#005B96';
export const BRAND_BLUE_BRIGHT = '#0B72E7';

export const ICON_GREEN = '#22C55E';
export const ICON_GOLD = '#F59E0B';
export const ICON_CYAN = '#0EA5E9';

export function statusAccent(status: AICompanionStatus): string {
  switch (status) {
    case 'idle':
      return BRAND_BLUE;
    case 'listening':
      return ICON_CYAN;
    case 'speaking':
      return BRAND_BLUE_BRIGHT;
    case 'executing':
      return ICON_GREEN;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export type CompanionMotionPreset = {
  /** Subtle vertical float — keep amplitude small so Rive/sprites stay premium */
  float?: TargetAndTransition;
  floatTransition?: Transition;
  /** @deprecated pinwheel spin — mascote usa troca de frames */
  icon?: TargetAndTransition;
  iconTransition?: Transition;
  aura?: TargetAndTransition;
  auraTransition?: Transition;
  showRadar: boolean;
};

/**
 * Calm wrapper motion (soft float + aura). Pose/lip-sync live in the mascot runtime.
 * Avoid spin/wobble — reduced motion → estático.
 */
export function getCompanionMotion(
  status: AICompanionStatus,
  reduced: boolean
): CompanionMotionPreset {
  if (reduced) {
    return { showRadar: false };
  }

  // Shared calm float — slow breath, tiny travel (no robotic bounce)
  const calmFloat: TargetAndTransition = { y: [0, -2.5, 0] };
  const calmFloatTransition: Transition = {
    duration: 4.8,
    repeat: Infinity,
    ease: 'easeInOut',
  };
  const softAura: TargetAndTransition = {
    opacity: [0.28, 0.42, 0.28],
    scale: [1, 1.04, 1],
  };
  const softAuraTransition: Transition = {
    duration: 4.8,
    repeat: Infinity,
    ease: 'easeInOut',
  };

  switch (status) {
    case 'idle':
      return {
        showRadar: false,
        float: calmFloat,
        floatTransition: calmFloatTransition,
        aura: softAura,
        auraTransition: softAuraTransition,
      };
    case 'listening':
      return {
        showRadar: true,
        float: { y: [0, -1.5, 0] },
        floatTransition: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' },
        aura: { opacity: [0.32, 0.5, 0.32], scale: [1, 1.05, 1] },
        auraTransition: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' },
      };
    case 'speaking':
      return {
        showRadar: false,
        float: calmFloat,
        floatTransition: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' },
        aura: { opacity: [0.34, 0.52, 0.34], scale: [1, 1.05, 1] },
        auraTransition: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' },
      };
    case 'executing':
      return {
        showRadar: false,
        float: { y: [0, -1.5, 0] },
        floatTransition: { duration: 3.8, repeat: Infinity, ease: 'easeInOut' },
        aura: { opacity: [0.3, 0.48, 0.3], scale: [1, 1.04, 1] },
        auraTransition: { duration: 3.8, repeat: Infinity, ease: 'easeInOut' },
      };
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
