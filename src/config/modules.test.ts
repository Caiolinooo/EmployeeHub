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
  resolveModuleKey,
} from './modules';
import { EXTRA_RESOURCE_GRANTS, MODULE_GRANTS } from './module-grants';
import { SYSTEM_MODULES as SIDEBAR_MODULES } from '../constants/modules';

/** USER-default feature/ACL names that existed before the granular grants (excluding contratos). */
const LEGACY_USER_DEFAULTS = new Set([
  'academy.comment', 'academy.enroll', 'academy.rate', 'academy.read', 'biblioteca.view', 'calendario.read',
  'chat.send', 'chat.view', 'comments.create', 'comments.read', 'contracheque.view', 'epi.view',
  'ferias.create', 'ferias.read', 'ia-assistant.view', 'lista-presenca.create', 'lista-presenca.read',
  'news.read', 'poliweb.view', 'ponto.view', 'reimbursement.create', 'reimbursement_view',
  'reminders.create', 'social.comment', 'social.create', 'social.follow', 'social.like', 'social.read',
  'social.story', 'social.update',
]);

/** The only new USER defaults: personal-scope actions USER already performs. */
const NEW_USER_OWN_SCOPE = [
  'dashboard.view', 'dashboard.customize', 'dashboard.pendencies.view',
  'news.attachments.download',
  'calendario.export_ics', 'calendario.company.view',
  'ia-assistant.voice', 'ia-assistant.knowledge.view',
  'ponto.punch', 'ponto.view_own', 'ponto.biometric.manage',
  'contracheque.view_own', 'contracheque.accept', 'contracheque.download',
  'reimbursement.view_own', 'reimbursement.pdf_own', 'reimbursement.attach',
  'ferias.view_own', 'ferias.pdf_own',
  'lista-presenca.sign', 'lista-presenca.pdf',
  'academy.certificates.download_own',
  'biblioteca.download',
  'chat.messages.edit_own', 'chat.attach', 'chat.dm', 'chat.presence.view',
  'comments.report',
  'reminders.read', 'reminders.update', 'reminders.delete',
  'social.report', 'social.mention',
];

/**
 * Modules whose catalog already shipped a USER ACL (another one does not widen sector scope), plus
 * `dashboard`, which `composeEffectiveModules` enables for every USER regardless of sector.
 */
const USER_ACL_MODULES = new Set([
  'dashboard', 'noticias', 'calendario', 'ia-assistant', 'ponto', 'contracheque', 'reembolso', 'epi', 'ferias',
  'lista-presenca', 'academy', 'biblioteca', 'chat', 'poliweb', 'comments', 'reminders', 'social',
]);

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
      'contratos.view_all',
      'contratos.view_own',
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
    assert.equal(keys.has('contratos.view_all'), true);
    assert.equal(keys.has('contratos.view_own'), true);
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

  it('resolves ACL resources, sector legacy ids and labels to the catalog module key', () => {
    assert.equal(resolveModuleKey('news'), 'noticias');
    assert.equal(resolveModuleKey('reimbursement'), 'reembolso');
    assert.equal(resolveModuleKey('folha'), 'financeiro');
    assert.equal(resolveModuleKey('Purchase-Orders'), 'compras');
    assert.equal(resolveModuleKey('gestao-tripulantes'), 'gestao-tripulantes');
    assert.equal(resolveModuleKey('ferias_admin'), 'ferias_admin');
  });

  it('every ACL resource of a module maps back to a module key or an extra resource', () => {
    const extra = new Set(EXTRA_ACL_RESOURCES.map((item) => item.resource));
    const keys = new Set(SYSTEM_MODULES.map((mod) => mod.key));
    for (const perm of getAclSeedPermissions()) {
      const target = resolveModuleKey(perm.resource);
      assert.equal(
        keys.has(target) || extra.has(perm.resource) || perm.resource === 'folha',
        true,
        `ACL resource ${perm.resource} has no module`,
      );
    }
  });

  it('keeps every feature key, ACL name and (resource, action) unique', () => {
    const featureKeys = getCatalogFeaturesForUi().map((feat) => feat.key);
    assert.equal(new Set(featureKeys).size, featureKeys.length, 'duplicate feature key');
    const seed = getAclSeedPermissions();
    assert.equal(new Set(seed.map((perm) => perm.name)).size, seed.length, 'duplicate ACL name');
    const pairs = seed.map((perm) => `${perm.resource}::${perm.action}`);
    const dupes = pairs.filter((pair, index) => pairs.indexOf(pair) !== index);
    assert.deepEqual(
      dupes.filter((pair) => !pair.startsWith('financeiro::')),
      [],
      'duplicate (resource, action)',
    );
  });

  it('attaches every feature to an existing module and every grant key to its module prefix', () => {
    for (const mod of SYSTEM_MODULES) {
      for (const feature of mod.features || []) {
        assert.equal(getModuleKeyForCatalogFeature(feature.key), mod.key);
      }
    }
    for (const [moduleKey, grants] of Object.entries(MODULE_GRANTS)) {
      assert.equal(
        SYSTEM_MODULES.some((mod) => mod.key === moduleKey),
        true,
        `grants for unknown module ${moduleKey}`,
      );
      for (const feature of grants.features) {
        assert.equal(getModuleKeyForCatalogFeature(feature.key), moduleKey, `${feature.key} not in ${moduleKey}`);
      }
      for (const perm of grants.acl) {
        assert.equal(resolveModuleKey(perm.name.split('.')[0]), moduleKey, `${perm.name} resolves elsewhere`);
      }
    }
    for (const [resource, grants] of Object.entries(EXTRA_RESOURCE_GRANTS)) {
      const extra = EXTRA_ACL_RESOURCES.find((item) => item.resource === resource);
      assert.ok(extra, `unknown extra resource ${resource}`);
      for (const perm of grants.acl) {
        assert.equal(extra?.permissions.some((item) => item.name === perm.name), true, `${perm.name} not merged`);
      }
    }
  });

  it('declares the new granular grants as feature + ACL with the same name', () => {
    for (const [moduleKey, grants] of Object.entries(MODULE_GRANTS)) {
      const mod = SYSTEM_MODULES.find((item) => item.key === moduleKey);
      for (const perm of grants.acl) {
        assert.equal(mod?.acl?.some((item) => item.name === perm.name), true, `ACL ${perm.name} not merged`);
        assert.equal(mod?.features?.some((item) => item.key === perm.name), true, `feature ${perm.name} not merged`);
      }
    }
  });

  it('never grants USER anything new by default beyond own-scope actions', () => {
    const userDefaults = new Set<string>();
    for (const mod of SYSTEM_MODULES) {
      if (mod.key === 'contratos') continue;
      for (const feature of mod.features || []) if (feature.defaultRoles.includes('USER')) userDefaults.add(feature.key);
      for (const perm of mod.acl || []) if (perm.defaultRoles.includes('USER')) userDefaults.add(perm.name);
    }
    for (const extra of EXTRA_ACL_RESOURCES) {
      for (const perm of extra.permissions) if (perm.defaultRoles.includes('USER')) userDefaults.add(perm.name);
    }
    const added = [...userDefaults].filter((name) => !LEGACY_USER_DEFAULTS.has(name)).sort();
    assert.deepEqual(added, [...NEW_USER_OWN_SCOPE].sort());
  });

  it('only adds USER-default ACL where the module already had a USER ACL (no sector leak)', () => {
    for (const name of NEW_USER_OWN_SCOPE) {
      const resource = getAclSeedPermissions().find((perm) => perm.name === name)?.resource || '';
      assert.equal(USER_ACL_MODULES.has(resolveModuleKey(resource)), true, `${name} would open ${resource} for USER`);
    }
  });

  it('keeps ADMIN_ONLY modules free of non-admin ACL defaults for new grants (no MANAGER module leak)', () => {
    for (const moduleKey of ['admin', 'feedback', 'metrics', 'engagement', 'integracao-erp']) {
      for (const perm of MODULE_GRANTS[moduleKey]?.acl || []) {
        assert.deepEqual(perm.defaultRoles, ['ADMIN'], `${perm.name} must default to ADMIN only`);
      }
    }
  });

  it('registers the DP cadastro grant as feature and ACL with STAFF defaults', () => {
    assert.equal(getModuleKeyForCatalogFeature('gestao-tripulantes.cadastro.manage'), 'gestao-tripulantes');
    const seed = getAclSeedPermissions().find((perm) => perm.name === 'gestao-tripulantes.cadastro.manage');
    assert.equal(seed?.action, 'cadastro.manage');
    assert.equal(seed?.resource, 'gestao-tripulantes');
    const grants = getAclRoleGrants();
    assert.equal(grants.MANAGER.includes('gestao-tripulantes.cadastro.manage'), true);
    assert.equal(grants.USER.includes('gestao-tripulantes.cadastro.manage'), false);
  });
});
