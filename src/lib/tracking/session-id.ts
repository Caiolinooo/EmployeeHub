const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Same alphabet/length ballpark as `Math.random().toString(36).substring(7)`. */
export const TRACKING_SESSION_ID_LENGTH = 6;

export function newTrackingSessionId(
  length: number = TRACKING_SESSION_ID_LENGTH,
): string {
  const n = Math.max(1, Math.min(32, length | 0));
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < n; i++) {
    out += BASE36[bytes[i]! % 36];
  }
  return out;
}
