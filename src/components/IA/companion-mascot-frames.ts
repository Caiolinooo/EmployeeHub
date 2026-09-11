import type { AICompanionStatus } from './companion-logo-motion';

/** Public paths for keyed RGBA body frames (see public/images/companion-mascot/frames.json). */
export const MASCOT_BODY = {
  idle_stand: '/images/companion-mascot/body/idle_stand.png',
  idle_wave: '/images/companion-mascot/body/idle_wave.png',
  idle_alt: '/images/companion-mascot/body/idle_alt.png',
  listen_ear: '/images/companion-mascot/body/listen_ear.png',
  listen_tilt: '/images/companion-mascot/body/listen_tilt.png',
  listen_point: '/images/companion-mascot/body/listen_point.png',
  think_chin: '/images/companion-mascot/body/think_chin.png',
  speak_open: '/images/companion-mascot/body/speak_open.png',
  speak_grin: '/images/companion-mascot/body/speak_grin.png',
  speak_gesture: '/images/companion-mascot/body/speak_gesture.png',
  speak_active: '/images/companion-mascot/body/speak_active.png',
  exec_bulb: '/images/companion-mascot/body/exec_bulb.png',
  exec_type_a: '/images/companion-mascot/body/exec_type_a.png',
  exec_type_b: '/images/companion-mascot/body/exec_type_b.png',
  exec_point: '/images/companion-mascot/body/exec_point.png',
  exec_read: '/images/companion-mascot/body/exec_read.png',
  exec_stretch: '/images/companion-mascot/body/exec_stretch.png',
} as const;

/**
 * Face overlays exist as assets but are OFF by default.
 * Body PNGs already include faces — stacking overlays causes gray skull / double-face.
 * Keep for future blank-face bodies + true alpha cutouts only.
 */
export const MASCOT_USE_FACE_OVERLAY = false;

/** Face overlays (64×64) — only when MASCOT_USE_FACE_OVERLAY + blank-face bodies. */
export const MASCOT_FACE = {
  face_neutral: '/images/companion-mascot/face/face_neutral.png',
  face_blink: '/images/companion-mascot/face/face_blink.png',
  viseme_a: '/images/companion-mascot/face/viseme_a.png',
  viseme_e: '/images/companion-mascot/face/viseme_e.png',
  viseme_i: '/images/companion-mascot/face/viseme_i.png',
  viseme_u: '/images/companion-mascot/face/viseme_u.png',
} as const;

export type MascotBodyId = keyof typeof MASCOT_BODY;
export type MascotFaceId = keyof typeof MASCOT_FACE;

/**
 * Face layer placement on the body box.
 * - x/y/w/h: normalized fractions
 * - left/top/width/height: CSS % strings
 */
export const MASCOT_FACE_OVERLAY = {
  x: 0.21875,
  y: 0.140625,
  w: 0.5,
  h: 0.46875,
  left: '21.875%',
  top: '14.0625%',
  width: '50%',
  height: '46.875%',
} as const;

/** Idle blink timing (random interval between min/max). */
export const MASCOT_BLINK = {
  idleMsMin: 2800,
  idleMsMax: 6200,
  holdMs: 140,
} as const;

/**
 * Fake lip-sync cycle while status === 'speaking'.
 * Order = mouth shapes; `face_neutral` = rest.
 * Keep ~2–3 fps — faster looks like a strobe.
 */
export const MASCOT_VISEMES: MascotFaceId[] = [
  'viseme_a',
  'viseme_e',
  'viseme_i',
  'viseme_u',
  'face_neutral',
];

/** Alias for Rive / Rive-like drivers (a/e/i/u). */
export const MASCOT_VISEME_IDS: MascotFaceId[] = [
  'viseme_a',
  'viseme_e',
  'viseme_i',
  'viseme_u',
];

/** Mouth cycle rate (~2.5 fps). Never flash every animation frame. */
export const MASCOT_LIP_SYNC_FPS = 2.5;

/** Face / viseme opacity crossfade (ms). */
export const MASCOT_FACE_CROSSFADE_MS = 280;

/** Default body crossfade when a cycle omits an override. */
export const MASCOT_DEFAULT_CROSSFADE_MS = 360;

/** Status-change blend when swapping cycles (keep previous until new ready). */
export const MASCOT_STATUS_BLEND_MS = 480;

export function lipSyncIntervalMs(): number {
  return Math.max(320, Math.round(1000 / MASCOT_LIP_SYNC_FPS));
}

export function visemeIdAt(index: number): MascotFaceId {
  const ids = MASCOT_VISEME_IDS;
  if (ids.length === 0) return 'face_neutral';
  const i = ((index % ids.length) + ids.length) % ids.length;
  return ids[i] ?? 'face_neutral';
}

export type MascotStatusCycle = {
  frames: MascotBodyId[];
  /** Frames per second; 0 = static first frame */
  fps: number;
  /** Body crossfade duration (Rive-like) — prefer 200–400ms */
  crossfadeMs: number;
  /**
   * Face driver (only if MASCOT_USE_FACE_OVERLAY).
   * Default body-only: use `none` — mouths live in speak_* body keyframes.
   */
  face: 'none' | 'blink' | 'lipSync' | 'neutral';
};

/**
 * Status → pose cycle. Body-only natural look — slow poses, long crossfades.
 * Mouth variation = speak_* body frames (no face overlay stack).
 */
export const MASCOT_STATUS_CYCLES: Record<AICompanionStatus, MascotStatusCycle> = {
  idle: {
    // ~2.7s per pose step (≥2.5s gate) — stand / wave / alt holds
    frames: ['idle_stand', 'idle_wave', 'idle_alt', 'idle_stand'],
    fps: 0.37,
    crossfadeMs: 420,
    face: 'none',
  },
  listening: {
    frames: ['listen_ear', 'listen_tilt', 'listen_point', 'listen_ear'],
    fps: 0.7,
    crossfadeMs: 380,
    face: 'none',
  },
  speaking: {
    frames: ['speak_open', 'speak_grin', 'speak_active', 'speak_gesture'],
    fps: 1.2,
    crossfadeMs: 340,
    face: 'none',
  },
  executing: {
    frames: [
      'think_chin',
      'exec_bulb',
      'exec_type_a',
      'exec_type_b',
      'exec_point',
      'exec_read',
      'exec_stretch',
    ],
    fps: 0.85,
    crossfadeMs: 380,
    face: 'none',
  },
};

/** Body PNGs only — face overlays off by default (skip unused face prefetch). */
const MASCOT_BODY_PREFETCH: string[] = [
  MASCOT_BODY.idle_stand,
  MASCOT_BODY.idle_wave,
  MASCOT_BODY.idle_alt,
  MASCOT_BODY.listen_ear,
  MASCOT_BODY.listen_tilt,
  MASCOT_BODY.listen_point,
  MASCOT_BODY.think_chin,
  MASCOT_BODY.speak_open,
  MASCOT_BODY.speak_grin,
  MASCOT_BODY.speak_gesture,
  MASCOT_BODY.speak_active,
  MASCOT_BODY.exec_bulb,
  MASCOT_BODY.exec_type_a,
  MASCOT_BODY.exec_type_b,
  MASCOT_BODY.exec_point,
  MASCOT_BODY.exec_read,
  MASCOT_BODY.exec_stretch,
];

const MASCOT_FACE_PREFETCH: string[] = [
  MASCOT_FACE.face_neutral,
  MASCOT_FACE.face_blink,
  MASCOT_FACE.viseme_a,
  MASCOT_FACE.viseme_e,
  MASCOT_FACE.viseme_i,
  MASCOT_FACE.viseme_u,
];

/** Key PNGs to warm the browser cache (body always; face only if overlays on). */
export const MASCOT_PREFETCH_SRC: string[] = MASCOT_USE_FACE_OVERLAY
  ? [...MASCOT_BODY_PREFETCH, ...MASCOT_FACE_PREFETCH]
  : MASCOT_BODY_PREFETCH;

/** Drop-in Rive artboard (optional). */
export const COMPANION_RIVE_SRC = '/rive/companion-mascot.riv';

export const COMPANION_RIVE_SM = {
  stateMachine: 'CompanionSM',
  statusInput: 'status',
  visemeInput: 'viseme',
} as const;

export const STATUS_TO_RIVE_INDEX: Record<AICompanionStatus, number> = {
  idle: 0,
  listening: 1,
  speaking: 2,
  executing: 3,
};

export function mascotFrameSrc(frameId: MascotBodyId): string {
  return MASCOT_BODY[frameId];
}

export function mascotFaceSrc(faceId: MascotFaceId): string {
  return MASCOT_FACE[faceId];
}

export function hasMascotFaceAssets(): boolean {
  return Object.keys(MASCOT_FACE).length > 0;
}
