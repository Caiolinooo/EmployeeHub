/**
 * Build public/rive/companion-mascot.riv via rive-mcp-server createRiv.
 *
 * Natural-motion body-only (v5.58):
 * - NO face/viseme image overlays (body PNGs already include faces — overlays = gray skull)
 * - Opacity crossfades between body poses (NOT soloActive hard cuts)
 * - float-idle / sway / breathing presets on root (calmer premium idle)
 * - Soft SM mix durations (~500ms) between status states
 * - Exec parity with Rive-like: think + bulb + type + point + read + stretch
 * - `viseme` input kept for contract; Viseme layer is a no-op (mouth lives in body keyframes)
 *
 * Usage (from repo root):
 *   node scratch/build-companion-mascot-riv.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = join(ROOT, 'public', 'rive', 'companion-mascot.riv');
const BODY = join(ROOT, 'public', 'images', 'companion-mascot', 'body');

const writerPath = join(
  __dirname,
  'rive-gen',
  'node_modules',
  'rive-mcp-server',
  'dist',
  'rivWriter.js'
);
if (!existsSync(writerPath)) {
  console.error(
    'Missing rive-mcp-server. Install once:\n' +
      '  cd scratch/rive-gen && npm install rive-mcp-server@0.4.1'
  );
  process.exit(1);
}
const { createRiv } = await import(pathToFileURL(writerPath).href);

const AB = 128;
const FPS = 60;
const CX = AB / 2;
const CY = AB / 2;
/** Soft status blends — gate prefers ≥420–500ms */
const STATUS_MIX_MS = 500;
const VISEME_MIX_MS = 200;

function mustPng(dir, name) {
  const p = join(dir, name);
  if (!existsSync(p)) throw new Error(`Missing asset: ${p}`);
  return p;
}

const bodyIds = [
  'idle_stand',
  'idle_wave',
  'idle_alt',
  'listen_ear',
  'listen_tilt',
  'listen_point',
  'speak_open',
  'speak_grin',
  'speak_gesture',
  'speak_active',
  'think_chin',
  'exec_bulb',
  'exec_type_a',
  'exec_type_b',
  'exec_point',
  'exec_read',
  'exec_stretch',
];

const bodyFiles = Object.fromEntries(
  bodyIds.map(id => [id, mustPng(BODY, `${id}.png`)])
);

/** Hold each pose, ease crossfade to next. */
function opacityCycleTracks(ids, { holdSec = 1.35, fadeSec = 0.45, durationSec = 8 } = {}) {
  const hold = Math.round(holdSec * FPS);
  const fade = Math.round(fadeSec * FPS);
  const step = hold + fade;
  const duration = Math.round(durationSec * FPS);
  const tracks = ids.map(id => ({
    target: id,
    property: 'opacity',
    keyframes: [{ frame: 0, value: 0, easing: 'hold' }],
  }));
  const byId = Object.fromEntries(tracks.map(t => [t.target, t]));

  let t = 0;
  let i = 0;
  while (t + hold <= duration) {
    const cur = ids[i % ids.length];
    const next = ids[(i + 1) % ids.length];
    const tFade = t + hold;
    const tEnd = Math.min(duration, tFade + fade);

    for (const id of ids) {
      const kf = byId[id].keyframes;
      const last = kf[kf.length - 1];
      if (last.frame < t) {
        kf.push({ frame: t, value: last.value, easing: 'hold' });
      }
    }

    byId[cur].keyframes.push({ frame: t, value: 1, easing: 'hold' });
    if (tFade < duration) {
      byId[cur].keyframes.push({ frame: tFade, value: 1, easing: 'smooth' });
      byId[cur].keyframes.push({
        frame: tEnd,
        value: cur === next ? 1 : 0,
        easing: 'hold',
      });
    }

    if (next !== cur && tFade < duration) {
      byId[next].keyframes.push({ frame: tFade, value: 0, easing: 'smooth' });
      byId[next].keyframes.push({ frame: tEnd, value: 1, easing: 'hold' });
    }

    t += step;
    i += 1;
  }

  for (const id of ids) {
    const kf = byId[id].keyframes;
    const endVal = id === ids[0] ? 1 : 0;
    const last = kf[kf.length - 1];
    if (last.frame < duration) {
      kf.push({ frame: duration, value: endVal, easing: 'smooth' });
    } else {
      last.value = endVal;
    }
  }

  return tracks;
}

function staticOpacityTracks(onIds, allIds, durationSec) {
  const duration = Math.round(durationSec * FPS);
  const on = new Set(onIds);
  return allIds.map(id => ({
    target: id,
    property: 'opacity',
    keyframes: [
      { frame: 0, value: on.has(id) ? 1 : 0, easing: 'hold' },
      { frame: duration, value: on.has(id) ? 1 : 0, easing: 'hold' },
    ],
  }));
}

/** Contract-only viseme anim — no visual change (body keyframes own mouths). */
function noopAnim(name, durationSec = 1.2) {
  const duration = Math.round(durationSec * FPS);
  return {
    name,
    fps: FPS,
    duration,
    loop: 'loop',
    tracks: [
      {
        target: 'root',
        property: 'opacity',
        keyframes: [
          { frame: 0, value: 1, easing: 'hold' },
          { frame: duration, value: 1, easing: 'hold' },
        ],
      },
    ],
  };
}

/** Idle step = hold+fade ≥2.5s so motion stays continuously alive without twitch. */
const IDLE_SEC = 10.5;
const LISTEN_SEC = 7.2;
const SPEAK_SEC = 6.0;
const EXEC_SEC = 12.0;

const idleBodies = ['idle_stand', 'idle_wave', 'idle_alt'];
const listenBodies = ['listen_ear', 'listen_tilt', 'listen_point'];
const speakBodies = ['speak_open', 'speak_grin', 'speak_active', 'speak_gesture'];
const execBodies = [
  'think_chin',
  'exec_bulb',
  'exec_type_a',
  'exec_type_b',
  'exec_point',
  'exec_read',
  'exec_stretch',
];

const scene = {
  artboard: { name: 'Companion', width: AB, height: AB },
  groups: [
    { id: 'root', x: CX, y: CY },
    { id: 'bodyStack', x: 0, y: 0, parent: 'root' },
  ],
  images: bodyIds.map((id, i) => ({
    id,
    pngPath: bodyFiles[id],
    x: 0,
    y: 0,
    scale: 1,
    opacity: id === 'idle_stand' ? 1 : 0,
    parent: 'bodyStack',
    z: 1000 + i,
  })),
  animations: [
    {
      name: 'pose_idle',
      fps: FPS,
      duration: Math.round(IDLE_SEC * FPS),
      loop: 'loop',
      presets: [
        // Calmer premium bob — longer cycle, lower intensity than v5.57
        { preset: 'float-idle', target: 'root', intensity: 0.38, cycleSeconds: 5.0 },
      ],
      tracks: [
        ...opacityCycleTracks(idleBodies, {
          holdSec: 2.05,
          fadeSec: 0.65,
          durationSec: IDLE_SEC,
        }),
        ...staticOpacityTracks([], [...listenBodies, ...speakBodies, ...execBodies], IDLE_SEC),
      ],
    },
    {
      name: 'pose_listen',
      fps: FPS,
      duration: Math.round(LISTEN_SEC * FPS),
      loop: 'loop',
      presets: [
        { preset: 'sway', target: 'root', intensity: 0.32, cycleSeconds: 3.2 },
        { preset: 'float', target: 'root', intensity: 0.25, cycleSeconds: 2.8 },
      ],
      tracks: [
        ...opacityCycleTracks(listenBodies, {
          holdSec: 1.45,
          fadeSec: 0.5,
          durationSec: LISTEN_SEC,
        }),
        ...staticOpacityTracks([], [...idleBodies, ...speakBodies, ...execBodies], LISTEN_SEC),
      ],
    },
    {
      name: 'pose_speak',
      fps: FPS,
      duration: Math.round(SPEAK_SEC * FPS),
      loop: 'loop',
      presets: [
        { preset: 'float', target: 'root', intensity: 0.3, cycleSeconds: 2.4 },
        { preset: 'breathing', target: 'root', intensity: 0.55, cycleSeconds: 2.1 },
      ],
      tracks: [
        // Slow body mouth/gesture cycle — natural speech without overlay spam
        ...opacityCycleTracks(speakBodies, {
          holdSec: 1.05,
          fadeSec: 0.48,
          durationSec: SPEAK_SEC,
        }),
        ...staticOpacityTracks([], [...idleBodies, ...listenBodies, ...execBodies], SPEAK_SEC),
      ],
    },
    {
      name: 'pose_exec',
      fps: FPS,
      duration: Math.round(EXEC_SEC * FPS),
      loop: 'loop',
      presets: [
        { preset: 'float-idle', target: 'root', intensity: 0.36, cycleSeconds: 3.4 },
      ],
      tracks: [
        ...opacityCycleTracks(execBodies, {
          holdSec: 1.15,
          fadeSec: 0.5,
          durationSec: EXEC_SEC,
        }),
        ...staticOpacityTracks([], [...idleBodies, ...listenBodies, ...speakBodies], EXEC_SEC),
      ],
    },
    noopAnim('mouth_a'),
    noopAnim('mouth_e'),
    noopAnim('mouth_i'),
    noopAnim('mouth_u'),
  ],
  stateMachine: {
    name: 'CompanionSM',
    inputs: [
      { name: 'status', type: 'number', initial: 0 },
      { name: 'viseme', type: 'number', initial: 0 },
    ],
    layers: [
      {
        name: 'Status',
        states: [
          { name: 'idle', animation: 'pose_idle' },
          { name: 'listening', animation: 'pose_listen' },
          { name: 'speaking', animation: 'pose_speak' },
          { name: 'executing', animation: 'pose_exec' },
        ],
        transitions: [
          { from: 'entry', to: 'idle' },
          {
            from: 'any',
            to: 'idle',
            durationMs: STATUS_MIX_MS,
            condition: { input: 'status', op: '==', value: 0 },
          },
          {
            from: 'any',
            to: 'listening',
            durationMs: STATUS_MIX_MS,
            condition: { input: 'status', op: '==', value: 1 },
          },
          {
            from: 'any',
            to: 'speaking',
            durationMs: STATUS_MIX_MS,
            condition: { input: 'status', op: '==', value: 2 },
          },
          {
            from: 'any',
            to: 'executing',
            durationMs: STATUS_MIX_MS,
            condition: { input: 'status', op: '==', value: 3 },
          },
        ],
      },
      {
        // Contract-only — no visual mouth overlays (avoids double-face)
        name: 'Viseme',
        states: [
          { name: 'v0', animation: 'mouth_a' },
          { name: 'v1', animation: 'mouth_e' },
          { name: 'v2', animation: 'mouth_i' },
          { name: 'v3', animation: 'mouth_u' },
        ],
        transitions: [
          { from: 'entry', to: 'v0' },
          {
            from: 'any',
            to: 'v0',
            durationMs: VISEME_MIX_MS,
            condition: { input: 'viseme', op: '==', value: 0 },
          },
          {
            from: 'any',
            to: 'v1',
            durationMs: VISEME_MIX_MS,
            condition: { input: 'viseme', op: '==', value: 1 },
          },
          {
            from: 'any',
            to: 'v2',
            durationMs: VISEME_MIX_MS,
            condition: { input: 'viseme', op: '==', value: 2 },
          },
          {
            from: 'any',
            to: 'v3',
            durationMs: VISEME_MIX_MS,
            condition: { input: 'viseme', op: '==', value: 3 },
          },
        ],
      },
    ],
  },
};

for (const img of scene.images) {
  img.bytes = new Uint8Array(readFileSync(img.pngPath));
  delete img.pngPath;
}

let bytes;
let warnings;
try {
  ({ bytes, warnings } = createRiv(scene));
} catch (e) {
  console.error('createRiv failed:', e.message);
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, bytes);
console.log(`Wrote ${OUT} (${bytes.length} bytes) — body-only, no face overlays`);
if (warnings?.length) console.log('warnings:', warnings);

const magic = Buffer.from(bytes.slice(0, 4)).toString('ascii');
if (magic !== 'RIVE') throw new Error(`Bad magic: ${magic}`);
console.log('Done.');
