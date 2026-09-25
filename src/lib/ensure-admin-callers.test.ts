import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('ensure-admin runtime callers', () => {
  it('login page does not call the gated bootstrap endpoint', () => {
    const src = readFileSync(join(root, 'src/app/login/page.tsx'), 'utf8');
    assert.equal(src.includes('ensure-admin'), false);
  });

  it('test-user-management does not call ensure-admin', () => {
    const src = readFileSync(join(root, 'src/app/test-user-management/page.tsx'), 'utf8');
    assert.equal(src.includes('ensure-admin'), false);
  });

  it('login-test only posts /api/auth/login', () => {
    const src = readFileSync(join(root, 'src/app/login-test/page.tsx'), 'utf8');
    assert.equal(src.includes('ensure-admin'), false);
    assert.ok(src.includes('/api/auth/login'));
  });
});
