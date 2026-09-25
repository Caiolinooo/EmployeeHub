import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import {
  WK_PIN_FINGERPRINT256,
  WK_PINNED_CA_PEM,
  WK_TLS_PIN_MISMATCH,
  createWkHttpsAgent,
  pinnedCaFingerprint,
  wkHttpsRequestJson,
} from './tls-pin';

function makeLocalCert(): { pem: string; key: string; fingerprint256: string; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'wk-pin-'));
  const keyPath = join(dir, 'key.pem');
  const certPath = join(dir, 'cert.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '1',
      '-nodes',
      '-subj',
      '/CN=wk-pin-test',
    ],
    { stdio: 'pipe' },
  );
  const pem = readFileSync(certPath, 'utf8');
  const key = readFileSync(keyPath, 'utf8');
  return { pem, key, fingerprint256: new X509Certificate(pem).fingerprint256, dir };
}

const local = makeLocalCert();
after(() => {
  rmSync(local.dir, { recursive: true, force: true });
});

describe('WK TLS pin artifacts', () => {
  it('embedded PEM matches wk-ca.pem and the recorded fingerprint', () => {
    const disk = readFileSync(join(process.cwd(), 'src/lib/wkradar/wk-ca.pem'), 'utf8').trim();
    assert.equal(WK_PINNED_CA_PEM.trim(), disk);
    assert.equal(
      pinnedCaFingerprint().replace(/:/g, '').toLowerCase(),
      WK_PIN_FINGERPRINT256.replace(/:/g, '').toLowerCase(),
    );
  });

  it('agent keeps rejectUnauthorized true', () => {
    const agent = createWkHttpsAgent();
    assert.equal(agent.options.rejectUnauthorized, true);
    const testAgent = createWkHttpsAgent({
      ca: local.pem,
      fingerprint256: local.fingerprint256,
    });
    assert.equal(testAgent.options.rejectUnauthorized, true);
  });
});

describe('WK TLS pin against a local server', () => {
  it('connects with the matching fingerprint and fails closed on a wrong pin', async () => {
    const server = https.createServer({ key: local.key, cert: local.pem }, (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const url = `https://127.0.0.1:${address.port}/`;

    try {
      const good = await wkHttpsRequestJson(url, {
        metodo: 'GET',
        headers: { Accept: 'text/plain' },
        timeoutMs: 4000,
        agent: createWkHttpsAgent({
          ca: local.pem,
          fingerprint256: local.fingerprint256,
        }),
      });
      assert.equal(good.status, 200);
      assert.equal(good.corpo, 'ok');

      await assert.rejects(
        () =>
          wkHttpsRequestJson(url, {
            metodo: 'GET',
            headers: { Accept: 'text/plain' },
            timeoutMs: 4000,
            agent: createWkHttpsAgent({
              ca: local.pem,
              fingerprint256: '00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF',
            }),
          }),
        (err: unknown) => err instanceof Error && err.message === WK_TLS_PIN_MISMATCH,
      );
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((closeErr) => (closeErr ? reject(closeErr) : resolve()));
      });
    }
  });
});

describe('WK TLS bypass is gone', () => {
  it('does not contain rejectUnauthorized: false or NODE_TLS_REJECT_UNAUTHORIZED', () => {
    const files = [
      'src/lib/wkradar/api-client.ts',
      'src/lib/wkradar/tls-pin.ts',
      'scripts/wk-extrair-api.ts',
    ];
    for (const file of files) {
      const text = readFileSync(join(process.cwd(), file), 'utf8');
      assert.equal(text.includes('rejectUnauthorized: false'), false, file);
      assert.equal(text.includes('NODE_TLS_REJECT_UNAUTHORIZED'), false, file);
    }
  });
});
