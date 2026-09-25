import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidImportEmail } from './import-email';

function assertFast(fn: () => void, limitMs = 100): void {
  const t0 = performance.now();
  fn();
  const dt = performance.now() - t0;
  assert.ok(dt < limitMs, `pathological input took ${dt.toFixed(1)}ms (limit ${limitMs}ms)`);
}

describe('isValidImportEmail characterization', () => {
  it('accepts the same realistic import emails as the old regex', () => {
    assert.equal(isValidImportEmail('user@groupabz.com'), true);
    assert.equal(isValidImportEmail('a.b+c@x.com'), true);
    assert.equal(isValidImportEmail('a@b.c'), true);
    assert.equal(isValidImportEmail('user@domain.x'), true);
  });

  it('rejects the same invalid import emails', () => {
    assert.equal(isValidImportEmail('bad'), false);
    assert.equal(isValidImportEmail('foo@bar'), false);
    assert.equal(isValidImportEmail('@x.com'), false);
    assert.equal(isValidImportEmail('not an@email.com'), false);
  });

  it('rejects 50k-char local-less junk in under 100ms', () => {
    const pathological = `a@${'a'.repeat(50_000)}`;
    assertFast(() => {
      assert.equal(isValidImportEmail(pathological), false);
    });
  });
});
