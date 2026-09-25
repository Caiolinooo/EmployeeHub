import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { resolveInside } from './resolve-inside';

const BASE = path.resolve('/safe-base');

describe('resolveInside', () => {
  it('accepts a valid relative path', () => {
    const result = resolveInside(BASE, 'subdir/file.txt');
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.resolved, path.join(BASE, 'subdir', 'file.txt'));
    }
  });

  it('accepts a valid filename with asName', () => {
    const result = resolveInside(BASE, 'report.json', { asName: true });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.resolved, path.join(BASE, 'report.json'));
    }
  });

  it('rejects ../ traversal', () => {
    const result = resolveInside(BASE, '../secret.txt');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, 'Caminho fora do diretório permitido');
    }
  });

  it('rejects nested ../ traversal', () => {
    const result = resolveInside(BASE, 'foo/../../etc/passwd');
    assert.equal(result.ok, false);
  });

  it('rejects absolute paths', () => {
    const result = resolveInside(BASE, '/etc/passwd');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, 'Caminho fora do diretório permitido');
    }
  });

  it('rejects encoded ..%2f traversal', () => {
    const result = resolveInside(BASE, '..%2fetc/passwd');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, 'Caminho fora do diretório permitido');
    }
  });

  it('rejects double-encoded traversal', () => {
    const result = resolveInside(BASE, '..%252fetc/passwd');
    assert.equal(result.ok, false);
  });

  it('rejects a null byte in the input', () => {
    const result = resolveInside(BASE, 'foo\0bar.txt');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, 'Caminho inválido');
    }
  });

  it('rejects an encoded null byte', () => {
    const result = resolveInside(BASE, 'foo%00bar.txt');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, 'Caminho inválido');
    }
  });

  it('rejects empty input', () => {
    const result = resolveInside(BASE, '');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, 'Caminho inválido');
    }
  });

  it('rejects asName values with path separators', () => {
    const result = resolveInside(BASE, 'foo/bar.json', { asName: true });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, 'Nome de arquivo inválido');
    }
  });

  it('rejects asName traversal instead of taking basename', () => {
    const result = resolveInside(BASE, '../../../etc/passwd', { asName: true });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, 'Nome de arquivo inválido');
    }
  });

  it('rejects asName values with characters outside the whitelist', () => {
    const result = resolveInside(BASE, 'foo@bar.json', { asName: true });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, 'Nome de arquivo inválido');
    }
  });

  it('resolves a UUID-like name used as a config filename', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000.json';
    const result = resolveInside(BASE, userId, { asName: true });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.resolved, path.join(BASE, userId));
    }
  });

  it('rejects userId traversal used as a config filename', () => {
    const result = resolveInside(BASE, '../etc/passwd.json', { asName: true });
    assert.equal(result.ok, false);
  });

  it('accepts the default criteria workbook name under docs', () => {
    const docsBase = path.resolve('/safe-base', 'docs');
    const fileName = 'AN-TED-002-R0 - Avaliação de Desempenho.xlsx';
    const result = resolveInside(docsBase, fileName);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.resolved, path.join(docsBase, fileName));
    }
  });
});
