import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  featureGrantedByAcl,
  featureGrantedByJsonb,
  hasEffectiveFeature,
  mergeEffectiveFeatures,
  resolveGtDocumentPermissionFlags,
  roleBypassesFeature,
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
