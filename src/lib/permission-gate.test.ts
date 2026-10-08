import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { roleBypassesGate } from './effective-feature';

describe('roleBypassesGate', () => {
  it('staff bypass keeps ADMIN, SUPERADMIN and MANAGER', () => {
    assert.equal(roleBypassesGate('ADMIN', 'staff'), true);
    assert.equal(roleBypassesGate('superadmin', 'staff'), true);
    assert.equal(roleBypassesGate('MANAGER', 'staff'), true);
    assert.equal(roleBypassesGate('USER', 'staff'), false);
    assert.equal(roleBypassesGate(undefined, 'staff'), false);
  });

  it('admin bypass excludes MANAGER (ADMIN-only gates keep today behavior)', () => {
    assert.equal(roleBypassesGate('ADMIN', 'admin'), true);
    assert.equal(roleBypassesGate('MANAGER', 'admin'), false);
    assert.equal(roleBypassesGate('USER', 'admin'), false);
  });

  it('none never bypasses by role', () => {
    assert.equal(roleBypassesGate('ADMIN', 'none'), false);
  });
});
