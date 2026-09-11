/**
 * Validate public/rive/companion-mascot.riv via rive-mcp-server RiveHost
 * (official runtime in headless Chromium).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const RIV = join(ROOT, 'public', 'rive', 'companion-mascot.riv');
const MCP_DIST = join(__dirname, 'rive-gen', 'node_modules', 'rive-mcp-server', 'dist');

if (!existsSync(RIV)) throw new Error(`Missing ${RIV}`);
if (!existsSync(join(MCP_DIST, 'riveHost.js'))) {
  throw new Error('Install rive-mcp-server under scratch/rive-gen first');
}

process.env.RIVE_MCP_CHROME =
  process.env.RIVE_MCP_CHROME ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const { RiveHost } = await import(pathToFileURL(join(MCP_DIST, 'riveHost.js')).href);
const { PAGE_SCRIPT } = await import(pathToFileURL(join(MCP_DIST, 'pageScript.js')).href);
const host = new RiveHost(PAGE_SCRIPT);

const bytes = readFileSync(RIV);
const magic = bytes.subarray(0, 4).toString('ascii');
if (magic !== 'RIVE') throw new Error(`Bad magic: ${magic}`);

try {
  const info = await host.inspect(bytes);
  const ab = info.artboards?.[0];
  const sm = ab?.stateMachines?.find(s => s.name === 'CompanionSM') ?? ab?.stateMachines?.[0];
  const inputNames = (sm?.inputs ?? []).map(i => `${i.name}:${i.type}`);

  if (sm?.name !== 'CompanionSM') {
    throw new Error(`Expected CompanionSM, got ${sm?.name}`);
  }
  const hasStatus = sm.inputs?.some(i => i.name === 'status' && /number/i.test(String(i.type)));
  const hasViseme = sm.inputs?.some(i => i.name === 'viseme' && /number/i.test(String(i.type)));
  if (!hasStatus || !hasViseme) {
    throw new Error(`Missing number inputs status/viseme: ${JSON.stringify(sm.inputs)}`);
  }

  const play = await host.playStateMachine(bytes, {
    stateMachine: 'CompanionSM',
    steps: [
      { advance: 0.05 },
      { input: 'status', value: 1, advance: 0.1, capture: true },
      { input: 'status', value: 2, advance: 0.05 },
      { input: 'viseme', value: 2, advance: 0.1, capture: true },
      { input: 'status', value: 3, advance: 0.1, capture: true },
      { input: 'status', value: 0, advance: 0.1, capture: true },
    ],
    width: 128,
  });

  const framesDir = join(__dirname, 'rive-gen', 'validate-frames');
  const { mkdirSync, writeFileSync: wfs } = await import('node:fs');
  mkdirSync(framesDir, { recursive: true });
  (play.frames ?? []).forEach((b64, i) => {
    wfs(join(framesDir, `frame-${i}.png`), Buffer.from(b64, 'base64'));
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        path: RIV,
        bytes: bytes.length,
        artboard: ab?.name,
        stateMachine: sm.name,
        inputs: inputNames,
        playReport: play?.report ?? play,
        framesWritten: (play.frames ?? []).length,
        framesDir,
      },
      null,
      2
    )
  );
} finally {
  await host.close();
}
