/**
 * TLS pin for WK Radar (wk.groupabz.com). Validation stays ON.
 * Self-signed CN=WKSistemas — hostname check is replaced by SHA-256 pin.
 */
import { X509Certificate } from 'node:crypto';
import https from 'node:https';
import type { PeerCertificate } from 'node:tls';

export const WK_PINNED_HOST = 'wk.groupabz.com';

/** openssl x509 -fingerprint -sha256 — handshake only, 2026-09-25. */
export const WK_PIN_FINGERPRINT256 =
  '40:AB:FB:8C:B5:AE:15:30:1D:D8:52:1C:B8:77:4B:5E:68:DE:7B:B4:37:3B:16:BB:69:E4:72:A6:01:11:B5:46';

/** openssl x509 -enddate — Dec  6 16:54:40 2121 GMT */
export const WK_PIN_NOT_AFTER = '2121-12-06T16:54:40.000Z';

export const WK_TLS_PIN_MISMATCH =
  'WK Radar TLS pin mismatch: o certificado de wk.groupabz.com mudou; atualize o pin conforme src/lib/wkradar/AGENTS.md';

/** Embedded copy of wk-ca.pem so Next bundling does not depend on cwd. */
export const WK_PINNED_CA_PEM = `-----BEGIN CERTIFICATE-----
MIIDHTCCAgWgAwIBAgIQXT2ykiRtO7lDYbPtW6mvIjANBgkqhkiG9w0BAQsFADAV
MRMwEQYDVQQDDApXS1Npc3RlbWFzMCAXDTIxMTIwNjE2NDQ0MFoYDzIxMjExMjA2
MTY1NDQwWjAVMRMwEQYDVQQDDApXS1Npc3RlbWFzMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAuV0EQbcgYeuybB4ekNaQ8JHYWYNpYtbmiIgx6+D8gsEJ
2DP+BUP0F1YSyC8a+8UTziKohnfjqgB+11W/eOvsHp7lX6CMto6bUnuCfu4e9+az
/5UG79B1qa0+CKZ6jpYcfPZaN7KAgVFcD4rKUn1+1/TSoomColONCw0upldw7CuI
7rSIFcZRuXAIOQllv7HSpFk2CyqFmw19WSngIEtzi+CCTxvAc4fiqAPL6qlMegK3
n226TEF9RukkDSzU5hPIOz87uenk5oswLVl3UlEuHOoDL6O1nWApmlSS9bJ2kTGu
iEsvNaGY6u3Q+frtfBwOzKWTJmcnp4jYizzJUpkfXQIDAQABo2cwZTAOBgNVHQ8B
Af8EBAMCBaAwHQYDVR0lBBYwFAYIKwYBBQUHAwIGCCsGAQUFBwMBMBUGA1UdEQQO
MAyCCldLU2lzdGVtYXMwHQYDVR0OBBYEFKMRitg6iVAgFzdq6CqksBj2AbraMA0G
CSqGSIb3DQEBCwUAA4IBAQCb/sctRnBxB8abvgZionzeIE2fxX+BjT4hJF5CSDUz
i+KKyo59Rja5U+c59/AMexiGK+WM+gEv10+qWxYnoWFBveUMNJptXA+BkGh02+h7
2l/b0tx52lnCBUtN9yKBDisFAMZsjG/PcclZyKygI+L8j4h7LNvp2KNV7OqoXJ2+
JcBryaP6wAC6PVg4FU84dSHfbmqjv/JQ7kD+gk+UhlTWvXfKXnZHB3ycDhFW88pg
BEAxBXz67XMhqwLE8jj1KI6hKztW8SDeRxyhjcQgyXMYYhxM2e1BQZfBIrcmHcfm
MAI24fglfONSQ3uuglqVT9aBKuZyxqJqj5iD5bBWxt7Z
-----END CERTIFICATE-----`;

export function normalizeFingerprint(fp: string): string {
  let out = '';
  for (let i = 0; i < fp.length; i++) {
    const ch = fp.charCodeAt(i);
    if (ch === 58) continue; // ':'
    if (ch >= 65 && ch <= 90) {
      out += String.fromCharCode(ch + 32);
      continue;
    }
    out += fp[i];
  }
  return out;
}

export function trimTrailingChar(value: string, ch: string): string {
  const code = ch.charCodeAt(0);
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === code) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

function fingerprintsMatch(got: string | undefined, expected: string): boolean {
  if (!got) return false;
  return normalizeFingerprint(got) === normalizeFingerprint(expected);
}

/**
 * Compare peer fingerprint to the pin. Never returns undefined without a compare.
 */
export function checkWkServerIdentity(
  _host: string,
  cert: PeerCertificate,
  expectedFingerprint = WK_PIN_FINGERPRINT256,
): Error | undefined {
  const got = cert.fingerprint256;
  if (!fingerprintsMatch(got, expectedFingerprint)) {
    return new Error(WK_TLS_PIN_MISMATCH);
  }
  return undefined;
}

export type WkHttpsAgentOverrides = {
  ca?: string;
  fingerprint256?: string;
};

export function createWkHttpsAgent(overrides?: WkHttpsAgentOverrides): https.Agent {
  const ca = overrides?.ca ?? WK_PINNED_CA_PEM;
  const pin = overrides?.fingerprint256 ?? WK_PIN_FINGERPRINT256;
  return new https.Agent({
    ca,
    rejectUnauthorized: true,
    checkServerIdentity(host, cert) {
      return checkWkServerIdentity(host, cert, pin);
    },
  });
}

function wrapTlsError(err: unknown): Error {
  if (err instanceof Error && err.message === WK_TLS_PIN_MISMATCH) {
    return err;
  }
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
  const msg = err instanceof Error ? err.message : String(err);
  const certFailure =
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'CERT_SIGNATURE_FAILURE' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
    /certificate|fingerprint|unable to verify/i.test(msg);
  if (certFailure) {
    return new Error(WK_TLS_PIN_MISMATCH);
  }
  return err instanceof Error ? err : new Error(String(err));
}

export function wkHttpsRequestJson(
  destino: string,
  opcoes: {
    metodo: 'GET' | 'POST';
    headers: Record<string, string>;
    corpo?: string;
    timeoutMs: number;
    agent?: https.Agent;
  },
): Promise<{ status: number; corpo: string }> {
  const { promise, resolve, reject } = Promise.withResolvers<{ status: number; corpo: string }>();
  const url = new URL(destino);
  if (url.protocol !== 'https:') {
    reject(new Error('[WK] TLS pin exige https'));
    return promise;
  }

  const agent = opcoes.agent ?? createWkHttpsAgent();
  if (agent.options.rejectUnauthorized !== true) {
    reject(new Error('[WK] rejectUnauthorized deve permanecer true'));
    return promise;
  }

  const req = https.request(
    {
      method: opcoes.metodo,
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      headers: opcoes.headers,
      agent,
      rejectUnauthorized: true,
      ca: agent.options.ca,
      checkServerIdentity: agent.options.checkServerIdentity,
    },
    (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, corpo: Buffer.concat(chunks).toString('utf8') }),
      );
    },
  );
  req.setTimeout(opcoes.timeoutMs, () => {
    req.destroy(new Error(`[WK] Timeout de ${opcoes.timeoutMs / 1000}s na Radar.API`));
  });
  req.on('error', (err) => reject(wrapTlsError(err)));
  if (opcoes.corpo) req.write(opcoes.corpo);
  req.end();
  return promise;
}

export function pinnedCaFingerprint(): string {
  return new X509Certificate(WK_PINNED_CA_PEM).fingerprint256;
}
