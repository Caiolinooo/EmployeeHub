import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aclNamesWithinModules,
  composeEffectiveModules,
  featureGrantedByAcl,
  featureGrantedByJsonb,
  hasEffectiveFeature,
  mergeEffectiveFeatures,
  resolveGtDocumentPermissionFlags,
  roleBypassesFeature,
  roleBypassesGate,
} from './effective-feature';

const DELETE_KEY = 'gestao-tripulantes.documents.delete';
const EDIT_KEY = 'gestao-tripulantes.documents.edit';

describe('effective feature apply', () => {
  it('does not treat a wrong JSONB key as delete', () => {
    assert.equal(featureGrantedByJsonb({ 'gestao-tripulantes.documents_delete': true }, DELETE_KEY), false);
    assert.equal(featureGrantedByJsonb({ [DELETE_KEY]: true }, DELETE_KEY), true);
    assert.equal(featureGrantedByJsonb(null, DELETE_KEY), false);
  });

  it('grants USER delete from ACL name when JSONB features are null', () => {
    assert.equal(
      hasEffectiveFeature({ role: 'USER', features: null, aclNames: [DELETE_KEY] }, DELETE_KEY),
      true,
    );
    assert.equal(
      hasEffectiveFeature({ role: 'USER', features: null, aclNames: [] }, DELETE_KEY),
      false,
    );
  });

  it('grants USER delete from JSONB when ACL is empty', () => {
    assert.equal(
      hasEffectiveFeature({ role: 'USER', features: { [DELETE_KEY]: true }, aclNames: [] }, DELETE_KEY),
      true,
    );
  });

  it('lets GT manage/admin ACL imply edit and delete (same as documento-permissions)', () => {
    assert.equal(featureGrantedByAcl(['gestao-tripulantes.manage'], DELETE_KEY), true);
    assert.equal(featureGrantedByAcl(['gestao-tripulantes.admin'], EDIT_KEY), true);
    assert.equal(featureGrantedByAcl(['gestao-tripulantes.view'], DELETE_KEY), false);
  });

  it('bypasses ADMIN always and MANAGER except admin.*', () => {
    assert.equal(roleBypassesFeature('ADMIN', DELETE_KEY), true);
    assert.equal(roleBypassesFeature('MANAGER', DELETE_KEY), true);
    assert.equal(roleBypassesFeature('MANAGER', 'admin.users'), false);
    assert.equal(roleBypassesFeature('USER', DELETE_KEY), false);
  });

  it('merges JSONB + ACL names into effective_features including implied keys', () => {
    const merged = mergeEffectiveFeatures({ 'ferias.approve': true }, ['gestao-tripulantes.documents.delete']);
    assert.equal(merged['ferias.approve'], true);
    assert.equal(merged[DELETE_KEY], true);
    const implied = mergeEffectiveFeatures(null, ['gestao-tripulantes.manage']);
    assert.equal(implied[DELETE_KEY], true);
    assert.equal(implied[EDIT_KEY], true);
  });

  it('USER com módulo marcado fora do setor mantém acesso; sem grant não acessa', () => {
    const withGrant = composeEffectiveModules({
      role: 'USER',
      hasSector: true,
      sectorModules: ['dashboard', 'noticias'],
      userModules: { 'gestao-tripulantes': true },
      aclGrants: [],
    });
    assert.equal(withGrant.modules['gestao-tripulantes'], true);
    const withoutGrant = composeEffectiveModules({
      role: 'USER',
      hasSector: true,
      sectorModules: ['dashboard', 'noticias'],
      userModules: {},
      aclGrants: [],
    });
    assert.equal(withoutGrant.modules['gestao-tripulantes'], undefined);
  });

  it('ACL de recurso diferente da chave do módulo habilita o módulo do catálogo', () => {
    const { modules } = composeEffectiveModules({
      role: 'USER',
      hasSector: true,
      sectorModules: ['dashboard'],
      aclGrants: [
        { resource: 'news', action: 'read' },
        { resource: 'reimbursement', action: 'create' },
        { resource: 'folha', action: 'view' },
      ],
    });
    assert.equal(modules.noticias, true);
    assert.equal(modules.reembolso, true);
    assert.equal(modules.financeiro, true);
  });

  it('id legado de setor folha resolve para financeiro', () => {
    const { modules } = composeEffectiveModules({
      role: 'USER',
      hasSector: true,
      sectorModules: ['dashboard', 'folha', 'dp'],
      aclGrants: [],
    });
    assert.equal(modules.financeiro, true);
    assert.equal(modules.dp, true);
  });

  it('false explícito do usuário vence ACL e setor', () => {
    const { modules, aclModulesApplied } = composeEffectiveModules({
      role: 'USER',
      hasSector: true,
      sectorModules: ['dashboard', 'epi'],
      userModules: { epi: false, poliweb: false },
      aclGrants: [{ resource: 'poliweb', action: 'view' }],
    });
    assert.equal(modules.epi, false);
    assert.equal(modules.poliweb, false);
    assert.deepEqual(aclModulesApplied, []);
  });

  it('MANAGER recebe defaults do papel sem depender de setor', () => {
    const { modules } = composeEffectiveModules({
      role: 'MANAGER',
      hasSector: true,
      sectorModules: ['dashboard'],
      aclGrants: [],
    });
    assert.equal(modules.kpi, true);
    assert.equal(modules.admin, false);
  });

  it('gestao-tripulantes.cadastro.manage vem de GT manage/admin, dp manage/admin ou do próprio grant', () => {
    const KEY = 'gestao-tripulantes.cadastro.manage';
    assert.equal(featureGrantedByAcl([KEY], KEY), true);
    assert.equal(featureGrantedByAcl(['gestao-tripulantes.manage'], KEY), true);
    assert.equal(featureGrantedByAcl(['dp.manage'], KEY), true);
    assert.equal(featureGrantedByAcl(['dp.view'], KEY), false);
    assert.equal(featureGrantedByAcl(['gestao-tripulantes.view'], KEY), false);
    assert.equal(featureGrantedByJsonb({ [KEY]: true }, KEY), true);
    assert.equal(hasEffectiveFeature({ role: 'USER', features: null, aclNames: [] }, KEY), false);
  });

  it('feature de nome diferente da ACL (esocial.* ↔ e-social.*, contracts.* ↔ contratos.*)', () => {
    assert.equal(featureGrantedByAcl(['e-social.view'], 'esocial.view'), true);
    assert.equal(featureGrantedByAcl(['e-social.admin'], 'esocial.send'), true);
    assert.equal(featureGrantedByAcl(['e-social.view'], 'esocial.send'), false);
    assert.equal(featureGrantedByAcl(['contratos.manage'], 'contracts.manage'), true);
    assert.equal(featureGrantedByAcl(['reimbursement.approve'], 'reimbursement_approval'), true);
  });

  it('setor estrito: ACL do papel USER não abre módulo do catálogo fora do setor', () => {
    const { modules } = composeEffectiveModules({
      role: 'USER',
      hasSector: true,
      sectorModules: ['dashboard', 'ponto'],
      aclGrants: [
        { resource: 'poliweb', action: 'view', source: 'role' },
        { resource: 'chat', action: 'view', source: 'role' },
        { resource: 'social', action: 'read', source: 'role' },
      ],
    });
    assert.equal(modules.ponto, true);
    assert.equal(modules.dashboard, true);
    assert.notEqual(modules.poliweb, true);
    assert.notEqual(modules.chat, true);
    assert.equal(modules.social, true);
  });

  it('USER sem setor herda defaults e ACL do papel', () => {
    const { modules } = composeEffectiveModules({
      role: 'USER',
      hasSector: false,
      sectorModules: [],
      aclGrants: [{ resource: 'poliweb', action: 'view', source: 'role' }],
    });
    assert.equal(modules.poliweb, true);
    assert.equal(modules.admin, false);
  });

  it('grant explícito do usuário abre módulo fora do setor estrito', () => {
    const { modules } = composeEffectiveModules({
      role: 'USER',
      hasSector: true,
      sectorModules: ['dashboard'],
      userModules: { chat: true },
      aclGrants: [{ resource: 'epi', action: 'view', source: 'user' }],
    });
    assert.equal(modules.chat, true);
    assert.equal(modules.epi, true);
  });

  it('revogação do usuário vence setor, papel e grant', () => {
    const { modules } = composeEffectiveModules({
      role: 'USER',
      hasSector: true,
      sectorModules: ['dashboard', 'ponto', 'ferias', 'epi'],
      userModules: { epi: false, chat: true },
      aclGrants: [{ resource: 'chat', action: 'view', source: 'user' }],
      aclDenied: [
        { resource: 'ponto', action: 'view' },
        { resource: 'chat', action: 'view' },
        { resource: 'ferias', action: 'create' },
      ],
    });
    assert.equal(modules.epi, false);
    assert.equal(modules.ponto, false);
    assert.equal(modules.chat, false);
    assert.equal(modules.ferias, true);
  });

  it('revogação também vence o papel do USER sem setor', () => {
    const { modules } = composeEffectiveModules({
      role: 'USER',
      hasSector: false,
      sectorModules: [],
      aclGrants: [],
      aclDenied: [{ resource: 'contracheque', action: 'view' }],
    });
    assert.equal(modules.contracheque, false);
  });

  it('ADMIN abre tudo mesmo com setor estrito e passa gates de papel', () => {
    const { modules } = composeEffectiveModules({
      role: 'ADMIN',
      hasSector: true,
      sectorModules: ['dashboard'],
      aclGrants: [],
    });
    assert.equal(modules.admin, true);
    assert.equal(modules.poliweb, true);
    assert.equal(modules.ferias_admin, true);
    assert.equal(roleBypassesGate('ADMIN', 'admin'), true);
    assert.equal(roleBypassesGate('MANAGER', 'admin'), false);
    assert.equal(roleBypassesGate('USER', 'staff'), false);
    assert.equal(
      hasEffectiveFeature({ role: 'ADMIN', features: { [DELETE_KEY]: false }, aclNames: [] }, DELETE_KEY),
      true,
    );
  });

  it('MANAGER soma setor aos defaults do papel (default false não apaga o setor)', () => {
    const { modules } = composeEffectiveModules({
      role: 'MANAGER',
      hasSector: true,
      sectorModules: ['dashboard', 'admin'],
      aclGrants: [],
    });
    assert.equal(modules.admin, true);
  });

  it('false no JSONB revoga feature mesmo com ACL (direta ou implícita)', () => {
    assert.equal(
      hasEffectiveFeature({ role: 'USER', features: { [DELETE_KEY]: false }, aclNames: [DELETE_KEY] }, DELETE_KEY),
      false,
    );
    const merged = mergeEffectiveFeatures({ [DELETE_KEY]: false }, ['gestao-tripulantes.manage']);
    assert.equal(merged[DELETE_KEY], undefined);
    assert.equal(merged[EDIT_KEY], true);
  });

  it('nome ACL de módulo do catálogo fechado não vale como grant', () => {
    const names = aclNamesWithinModules(
      [
        { resource: 'epi', name: 'epi.view' },
        { resource: 'ponto', name: 'ponto.view' },
        { resource: 'social', name: 'social.read' },
        { resource: 'news', name: 'news.read' },
      ],
      { ponto: true, epi: false, noticias: true },
    );
    assert.deepEqual(names.sort(), ['news.read', 'ponto.view', 'social.read']);
  });

  it('prefers authoritative server flags over local hasFeature', () => {
    assert.deepEqual(
      resolveGtDocumentPermissionFlags({ canEdit: false, canDelete: false }, { canEdit: true, canDelete: true }),
      { canEdit: true, canDelete: true },
    );
    assert.deepEqual(
      resolveGtDocumentPermissionFlags({ canEdit: true, canDelete: false }, null),
      { canEdit: true, canDelete: false },
    );
  });
});
