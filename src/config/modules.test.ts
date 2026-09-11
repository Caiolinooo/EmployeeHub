import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXTRA_ACL_RESOURCES,
  SYSTEM_MODULES,
  getAclResourceLabel,
  getAclRoleGrants,
  getAclSeedPermissions,
  getCatalogFeaturesForUi,
  getFullPermissionsForRole,
  getModuleKeyForCatalogFeature,
  getPermissionCatalogModules,
} from './modules';
import { SYSTEM_MODULES as SIDEBAR_MODULES } from '../constants/modules';

const REQUIRED_MODULE_KEYS = [
  'dashboard',
  'noticias',
  'calendario',
  'ia-assistant',
  'ponto',
  'contracheque',
  'reembolso',
  'kpi',
  'avaliacao',
  'epi',
  'ferias',
  'lista-presenca',
  'contratos',
  'academy',
  'biblioteca',
  'ajuda',
  'compras',
  'poliweb',
  'man-schedule',
  'chat',
  'wkradar',
  'admin',
  'integracao-erp',
  'gestao-tripulantes',
  'e-social',
  'dp',
] as const;

describe('live permission catalog', () => {
  it('lists current portal modules including GT, e-social, dp, epi, ferias, kpi', () => {
    const keys = new Set(SYSTEM_MODULES.map((mod) => mod.key));
    for (const key of REQUIRED_MODULE_KEYS) {
      assert.equal(keys.has(key), true, `missing module ${key}`);
    }
  });

  it('keeps sidebar keys in the same catalog (no second dead list)', () => {
    const catalogKeys = new Set(SYSTEM_MODULES.map((mod) => mod.key));
    for (const item of SIDEBAR_MODULES) {
      assert.equal(catalogKeys.has(item.id), true, `sidebar ${item.id} missing from catalog`);
    }
    assert.equal(SIDEBAR_MODULES.length, SYSTEM_MODULES.length);
  });

  it('seeds ACL for GT, e-social, ferias, epi, kpi, reimbursement, admin', () => {
    const names = new Set(getAclSeedPermissions().map((perm) => perm.name));
    for (const name of [
      'gestao-tripulantes.view',
      'gestao-tripulantes.documents.edit',
      'gestao-tripulantes.documents.delete',
      'gestao-tripulantes.matrizes.manage',
      'e-social.view',
      'e-social.send',
      'ferias.read',
      'ferias.approve',
      'epi.view',
      'kpi.view',
      'reimbursement.create',
      'admin.users',
      'dp.view',
    ]) {
      assert.equal(names.has(name), true, `missing ACL seed ${name}`);
    }
  });

  it('does not drop extra ACL resources (comments, social, reminders)', () => {
    const resources = new Set(EXTRA_ACL_RESOURCES.map((item) => item.resource));
    assert.equal(resources.has('comments'), true);
    assert.equal(resources.has('social'), true);
    assert.equal(resources.has('reminders'), true);
  });

  it('exposes UserEditor features from the catalog, including GT and reimbursement', () => {
    const keys = new Set(getCatalogFeaturesForUi().map((feat) => feat.key));
    assert.equal(keys.has('gestao-tripulantes.documents.edit'), true);
    assert.equal(keys.has('reimbursement_approval'), true);
    assert.equal(keys.has('news_editor'), true);
    assert.equal(keys.has('ferias.approve'), true);
  });

  it('maps catalog feature keys back to the owning module', () => {
    assert.equal(getModuleKeyForCatalogFeature('gestao-tripulantes.documents.delete'), 'gestao-tripulantes');
    assert.equal(getModuleKeyForCatalogFeature('ferias.approve'), 'ferias');
    assert.equal(getModuleKeyForCatalogFeature('not-a-real-feature'), null);
  });

  it('assigns role defaults from the same catalog', () => {
    const admin = getFullPermissionsForRole('ADMIN');
    const user = getFullPermissionsForRole('USER');
    assert.equal(admin.admin, true);
    assert.equal(admin['gestao-tripulantes'], true);
    assert.equal(admin.dp, true);
    assert.equal(user.dashboard, true);
    assert.equal(user.admin, false);
    assert.equal(user.dp, false);
  });

  it('labels ACL resources from the catalog', () => {
    assert.equal(getAclResourceLabel('gestao-tripulantes'), 'Gestão de Tripulantes');
    assert.equal(getAclResourceLabel('e-social'), 'e-Social');
    assert.equal(getAclResourceLabel('reimbursement'), 'Reembolso');
    assert.equal(getAclResourceLabel('epi'), 'EPI / QHSE');
  });

  it('grants every seeded ACL name to ADMIN', () => {
    const seed = getAclSeedPermissions().map((perm) => perm.name);
    const admin = new Set(getAclRoleGrants().ADMIN);
    for (const name of seed) {
      assert.equal(admin.has(name), true, `ADMIN missing grant ${name}`);
    }
  });

  it('picks up a new module shape without a second hardcoded UI list', () => {
    const modules = getPermissionCatalogModules();
    const sample = modules.find((mod) => mod.key === 'epi');
    assert.ok(sample);
    assert.equal(sample?.aclResource, 'epi');
    assert.ok((sample?.acl.length || 0) > 0);
  });
});
