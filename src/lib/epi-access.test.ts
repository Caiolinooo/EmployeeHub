import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { snapshotPodeGerenciarEpi } from './effective-feature';

const base = { role: 'USER', explicitModules: {}, sectorModulesRaw: [] as string[], features: {}, aclNames: [] as string[] };

describe('EPI manage gate', () => {
  it('USER com módulo epi marcado no usuário gerencia (antes lia a chave errada e exigia MANAGER)', () => {
    assert.equal(snapshotPodeGerenciarEpi({ ...base, explicitModules: { epi: true } }), true);
  });

  it('módulo epi no setor gerencia, a menos que o usuário o desligue', () => {
    assert.equal(snapshotPodeGerenciarEpi({ ...base, sectorModulesRaw: ['dashboard', 'epi'] }), true);
    assert.equal(
      snapshotPodeGerenciarEpi({ ...base, sectorModulesRaw: ['epi'], explicitModules: { epi: false } }),
      false,
    );
  });

  it('USER sem módulo nem grant não gerencia; ACL view do papel não basta', () => {
    assert.equal(snapshotPodeGerenciarEpi({ ...base, aclNames: ['epi.view'] }), false);
    assert.equal(snapshotPodeGerenciarEpi(base), false);
  });

  it('feature ou ACL epi.manage libera; MANAGER/ADMIN sempre', () => {
    assert.equal(snapshotPodeGerenciarEpi({ ...base, aclNames: ['epi.manage'] }), true);
    assert.equal(snapshotPodeGerenciarEpi({ ...base, features: { 'epi.admin': true } }), true);
    assert.equal(snapshotPodeGerenciarEpi({ ...base, role: 'MANAGER' }), true);
  });
});
