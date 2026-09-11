import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isDesligamentoGestorRole,
  setorEhDp,
  setorPermiteDesligamento,
} from './desligamento-setor';

describe('isDesligamentoGestorRole', () => {
  it('keeps ADMIN/MANAGER family and rejects USER', () => {
    assert.equal(isDesligamentoGestorRole('ADMIN'), true);
    assert.equal(isDesligamentoGestorRole('MANAGER'), true);
    assert.equal(isDesligamentoGestorRole('SUPERADMIN'), true);
    assert.equal(isDesligamentoGestorRole('USER'), false);
    assert.equal(isDesligamentoGestorRole(undefined), false);
  });
});

describe('setorEhDp', () => {
  it('matches DP / RH names without hardcoded emails', () => {
    assert.equal(setorEhDp('Departamento Pessoal'), true);
    assert.equal(setorEhDp('DP'), true);
    assert.equal(setorEhDp('RH — Corporativo'), true);
    assert.equal(setorEhDp('Recursos Humanos'), true);
    assert.equal(setorEhDp('Logística'), false);
    assert.equal(setorEhDp('QHSE'), false);
    assert.equal(setorEhDp(''), false);
  });
});

describe('setorPermiteDesligamento', () => {
  it('requires DP-like name AND gestao-tripulantes', () => {
    assert.equal(
      setorPermiteDesligamento({
        name: 'Departamento Pessoal',
        allowed_modules: ['gestao-tripulantes', 'ferias'],
      }),
      true,
    );
    assert.equal(
      setorPermiteDesligamento({
        name: 'Departamento Pessoal',
        allowed_modules: ['ferias'],
      }),
      false,
    );
    assert.equal(
      setorPermiteDesligamento({
        name: 'TI',
        allowed_modules: ['gestao-tripulantes'],
      }),
      false,
    );
  });
});
