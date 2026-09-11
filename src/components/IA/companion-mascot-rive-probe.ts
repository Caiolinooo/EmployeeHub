import { COMPANION_RIVE_SRC } from './companion-mascot-frames';

/** HEAD/GET probe — true when designer dropped public/rive/companion-mascot.riv */
export async function probeCompanionRiveAsset(): Promise<boolean> {
  try {
    const res = await fetch(COMPANION_RIVE_SRC, { method: 'HEAD', cache: 'no-store' });
    if (res.ok) return true;
    const get = await fetch(COMPANION_RIVE_SRC, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      cache: 'no-store',
    });
    return get.ok || get.status === 206;
  } catch {
    return false;
  }
}
