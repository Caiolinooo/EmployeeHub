/**
 * Verificação de webhooks PontoFlow → Portal (design §8).
 * Header `X-PontoFlow-Signature: t=<unix>,v1=<hmac_sha256_hex(t + "." + body)>`.
 * Lib pura (sem Next/Supabase) para ser testável isoladamente.
 */
import { createHmac, timingSafeEqual } from 'crypto';

function parseSignatureHeader(header: string): { t: string; v1: string } | null {
  if (!header) return null;
  let t: string | null = null;
  let v1: string | null = null;
  for (const part of header.split(',')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === 't') t = value;
    if (key === 'v1') v1 = value;
  }
  return t && v1 ? { t, v1 } : null;
}

/**
 * Valida assinatura HMAC e skew de timestamp (default 300 s).
 * Comparação em tempo constante (timingSafeEqual).
 */
export function verifyWebhook(
  rawBody: string,
  header: string,
  secret: string,
  toleranceSec = 300,
): boolean {
  if (!secret) return false;
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;

  const timestamp = Number(parsed.t);
  if (!Number.isFinite(timestamp)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestamp) > toleranceSec) return false;

  const expected = createHmac('sha256', secret)
    .update(`${parsed.t}.${rawBody}`, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(parsed.v1, 'utf8');
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
