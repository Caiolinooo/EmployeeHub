import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertEmail,
  formatQuickRegisterPhone,
  mapInitiateFailure,
  mapVerifyFailure,
  postLoginPath,
  validateQuickRegister,
} from './mobile-login-flow';

const t = (key: string, fallback?: string) => fallback || key;

describe('postLoginPath', () => {
  it('matches desktop destinations', () => {
    assert.equal(postLoginPath(false), '/dashboard');
    assert.equal(postLoginPath(true), '/set-password');
  });
});

describe('mapInitiateFailure', () => {
  it('maps the same authStatus branches as desktop login', () => {
    assert.equal(mapInitiateFailure('pending', t).step, 'pending');
    assert.equal(mapInitiateFailure('unauthorized', t).step, 'unauthorized');
    assert.match(mapInitiateFailure('inactive', t).error || '', /desativada/);
    assert.equal(mapInitiateFailure('new_email', t).step, 'quick_register');
    assert.equal(mapInitiateFailure('pending_registration', t).step, 'quick_register');
    assert.equal(mapInitiateFailure('unknown', t).error, 'auth.invalidEmail');
  });
});

describe('mapVerifyFailure', () => {
  it('maps pending / unauthorized / invalid code', () => {
    assert.equal(mapVerifyFailure('pending', t), 'auth.pendingRequestMessage');
    assert.equal(mapVerifyFailure('unauthorized', t), 'auth.unauthorizedAccessMessage');
    assert.equal(mapVerifyFailure(null, t), 'auth.invalidCode');
  });
});

describe('assertEmail', () => {
  it('rejects empty and accepts a basic address', () => {
    assert.ok(assertEmail('', t));
    assert.equal(assertEmail('a@b.com', t), null);
  });
});

describe('quick register helpers', () => {
  it('formats BR phone like desktop', () => {
    assert.equal(formatQuickRegisterPhone('22999998888'), '+5522999998888');
    assert.equal(formatQuickRegisterPhone('+5511999'), '+5511999');
  });

  it('validates the same required fields', () => {
    const missing = validateQuickRegister(
      {
        firstName: '',
        lastName: '',
        phone: '',
        cpf: '',
        cargo: '',
        password: '',
        confirmPassword: '',
      },
      t,
    );
    assert.ok(missing);
    const ok = validateQuickRegister(
      {
        firstName: 'Ana',
        lastName: 'Silva',
        phone: '22999998888',
        cpf: '12345678901',
        cargo: 'Analista',
        password: '12345678',
        confirmPassword: '12345678',
      },
      t,
    );
    assert.equal(ok, null);
  });
});
