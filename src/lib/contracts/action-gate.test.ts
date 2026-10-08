import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildContractAccess, canContractAction, CONTRACT_ACTIONS, type ContractAction } from './action-gate';
import { resolveModuleKey, SYSTEM_MODULES } from '../../config/modules';

const MANAGE_LEVEL: ContractAction[] = [
  'create', 'edit', 'delete', 'dispatch', 'send', 'cancel', 'resend',
  'templates.view', 'templates.manage', 'templates.use', 'signers.manage', 'audit.view', 'export',
];
const OPEN: ContractAction[] = ['download', 'download_signed', 'sign'];

describe('canContractAction', () => {
  it('ADMIN/MANAGER/SUPERADMIN fazem tudo, mesmo com false explícito ou módulo desligado', () => {
    for (const role of ['ADMIN', 'MANAGER', 'SUPERADMIN']) {
      for (const action of CONTRACT_ACTIONS) {
        assert.equal(
          canContractAction({ role, moduleEnabled: false, features: { [`contratos.${action}`]: false } }, action),
          true,
          `${role} ${action}`,
        );
      }
    }
  });

  it('USER sem grant: só as ações abertas (download, assinado, sign)', () => {
    for (const action of MANAGE_LEVEL) assert.equal(canContractAction({ role: 'USER' }, action), false, action);
    for (const action of OPEN) assert.equal(canContractAction({ role: 'USER' }, action), true, action);
  });

  it('grant granular por JSONB ou ACL libera só aquela ação', () => {
    assert.equal(canContractAction({ role: 'USER', features: { 'contratos.create': true } }, 'create'), true);
    assert.equal(canContractAction({ role: 'USER', features: { 'contratos.create': true } }, 'delete'), false);
    assert.equal(canContractAction({ role: 'USER', aclNames: ['contratos.templates.use'] }, 'templates.use'), true);
    assert.equal(canContractAction({ role: 'USER', aclNames: ['contratos.templates.use'] }, 'templates.manage'), false);
  });

  it('contracts.manage (JSONB) e ACL contratos.manage liberam toda a gestão (compat)', () => {
    for (const input of [
      { role: 'USER', features: { 'contracts.manage': true } },
      { role: 'USER', aclNames: ['contratos.manage'] },
    ]) {
      for (const action of MANAGE_LEVEL) assert.equal(canContractAction(input, action), true, action);
    }
  });

  it('false explícito vence grant e umbrella', () => {
    assert.equal(
      canContractAction({ role: 'USER', features: { 'contratos.delete': false }, aclNames: ['contratos.delete'] }, 'delete'),
      false,
    );
    assert.equal(
      canContractAction({ role: 'USER', features: { 'contracts.manage': true, 'contratos.delete': false } }, 'delete'),
      false,
    );
    assert.equal(canContractAction({ role: 'USER', features: { 'contracts.manage': false }, aclNames: ['contratos.manage'] }, 'create'), false);
    assert.equal(canContractAction({ role: 'USER', features: { 'contratos.download': false } }, 'download'), false);
  });

  it('sign aceita contracts.sign legado; false em qualquer chave bloqueia', () => {
    assert.equal(canContractAction({ role: 'USER' }, 'sign'), true);
    assert.equal(canContractAction({ role: 'USER', features: { 'contracts.sign': false } }, 'sign'), false);
    assert.equal(canContractAction({ role: 'USER', features: { 'contratos.sign': false }, aclNames: ['contratos.sign'] }, 'sign'), false);
  });

  it('módulo desligado nega tudo, menos sign (assinatura do próprio contrato)', () => {
    const input = { role: 'USER', moduleEnabled: false, features: { 'contracts.manage': true } };
    for (const action of CONTRACT_ACTIONS) {
      assert.equal(canContractAction(input, action), action === 'sign', action);
    }
  });
});

describe('buildContractAccess', () => {
  it('USER só view_own: escopo own e sem gestão', () => {
    const access = buildContractAccess({ role: 'USER', aclNames: ['contratos.view_own'], moduleEnabled: true });
    assert.equal(access.scope, 'own');
    assert.equal(access.can.create, false);
    assert.equal(access.can.download, true);
  });

  it('USER com view_all e sem gestão: vê todos, não muta nem vê token', () => {
    const access = buildContractAccess({ role: 'USER', features: { 'contratos.view_all': true }, moduleEnabled: true });
    assert.equal(access.scope, 'all');
    assert.equal(access.can['signers.manage'], false);
    assert.equal(access.can.dispatch, false);
  });

  it('sem módulo: none', () => {
    assert.equal(buildContractAccess({ role: 'USER', moduleEnabled: false }).scope, 'none');
  });
});

describe('catálogo `contratos`', () => {
  it('cada ação do gate tem feature e ACL no catálogo; o módulo aceita o alias legado `contracts`', () => {
    const mod = SYSTEM_MODULES.find((m) => m.key === 'contratos');
    assert.ok(mod);
    const features = new Set(mod.features?.map((f) => f.key));
    const aclNames = new Set(mod.acl?.map((a) => a.name));
    for (const action of CONTRACT_ACTIONS) {
      const key = `contratos.${action}`;
      assert.equal(aclNames.has(key), true, `ACL ${key}`);
      if (action !== 'sign') assert.equal(features.has(key), true, `feature ${key}`);
    }
    assert.equal(features.has('contracts.sign'), true);
    assert.equal(resolveModuleKey('contracts'), 'contratos');
    assert.equal(resolveModuleKey('contratos'), 'contratos');
  });
});
