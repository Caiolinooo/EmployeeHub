import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveContractViewScope } from './view-scope';

describe('resolveContractViewScope', () => {
  it('ADMIN/MANAGER veem todos', () => {
    assert.equal(resolveContractViewScope({ role: 'ADMIN' }), 'all');
    assert.equal(resolveContractViewScope({ role: 'MANAGER', features: { 'contratos.view_own': true } }), 'all');
  });

  it('view_all (JSONB ou ACL) vê todos', () => {
    assert.equal(resolveContractViewScope({ role: 'USER', features: { 'contratos.view_all': true } }), 'all');
    assert.equal(resolveContractViewScope({ role: 'USER', aclNames: ['contratos.view_all'] }), 'all');
  });

  it('view_own vê só os próprios, inclusive com contracts.manage', () => {
    assert.equal(resolveContractViewScope({ role: 'USER', aclNames: ['contratos.view_own'] }), 'own');
    assert.equal(
      resolveContractViewScope({ role: 'USER', features: { 'contratos.view_own': true, 'contracts.manage': true } }),
      'own',
    );
  });

  it('view_all vence view_own', () => {
    assert.equal(
      resolveContractViewScope({ role: 'USER', aclNames: ['contratos.view_own', 'contratos.view_all'] }),
      'all',
    );
  });

  it('sem nenhuma das duas mantém o legado', () => {
    assert.equal(resolveContractViewScope({ role: 'USER' }), 'own');
    assert.equal(resolveContractViewScope({ role: 'USER', features: { 'contracts.manage': true } }), 'all');
    assert.equal(resolveContractViewScope({ role: 'USER', features: { 'contratos.view_all': false } }), 'own');
  });

  it('ACL contratos.manage (sem JSONB) conta como contracts.manage legado', () => {
    assert.equal(resolveContractViewScope({ role: 'USER', aclNames: ['contratos.manage'] }), 'all');
  });

  it('false explícito vence ACL e o legado', () => {
    assert.equal(
      resolveContractViewScope({ role: 'USER', features: { 'contratos.view_all': false }, aclNames: ['contratos.view_all'] }),
      'own',
    );
    assert.equal(
      resolveContractViewScope({ role: 'USER', features: { 'contratos.view_all': false, 'contracts.manage': true } }),
      'own',
    );
    assert.equal(
      resolveContractViewScope({ role: 'USER', features: { 'contracts.manage': false }, aclNames: ['contratos.manage'] }),
      'own',
    );
  });

  it('módulo desligado = none, exceto ADMIN/MANAGER', () => {
    assert.equal(resolveContractViewScope({ role: 'USER', moduleEnabled: false, aclNames: ['contratos.view_all'] }), 'none');
    assert.equal(resolveContractViewScope({ role: 'MANAGER', moduleEnabled: false }), 'all');
    assert.equal(resolveContractViewScope({ role: 'USER', moduleEnabled: true }), 'own');
  });

  it('matriz papel x grants', () => {
    const rows: Array<[string, Parameters<typeof resolveContractViewScope>[0], string]> = [
      ['USER sem grant', { role: 'USER' }, 'own'],
      ['USER view_own', { role: 'USER', aclNames: ['contratos.view_own'] }, 'own'],
      ['USER view_all', { role: 'USER', features: { 'contratos.view_all': true } }, 'all'],
      ['USER manage JSONB', { role: 'USER', features: { 'contracts.manage': true } }, 'all'],
      ['USER manage + view_own', { role: 'USER', aclNames: ['contratos.manage', 'contratos.view_own'] }, 'own'],
      ['SUPERADMIN', { role: 'SUPERADMIN' }, 'all'],
    ];
    for (const [label, input, expected] of rows) {
      assert.equal(resolveContractViewScope(input), expected, label);
    }
  });
});
