import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDepartamentoLabel, normalizarDepartamento } from './departamento-label';

test('rótulo prefixa o código uma única vez', () => {
  assert.equal(formatDepartamentoLabel({ codigo: '01', nome: 'ABZ SERVIÇOS- ADMINISTRATIVO' }), '01 - ABZ SERVIÇOS- ADMINISTRATIVO');
  assert.equal(formatDepartamentoLabel({ codigo: '38', nome: '38 - ABZ - MATRIX' }), '38 - ABZ - MATRIX');
  assert.equal(formatDepartamentoLabel({ codigo: '38', nome: '38 - 38 - ABZ - MATRIX' }), '38 - ABZ - MATRIX');
  assert.equal(formatDepartamentoLabel({ codigo: '42', nome: '42-ABZ SERVIÇOS- APRENDIZES' }), '42-ABZ SERVIÇOS- APRENDIZES');
});

test('rótulo é idempotente', () => {
  const row = { codigo: '38', nome: 'ABZ - MATRIX' };
  const once = formatDepartamentoLabel(row);
  assert.equal(formatDepartamentoLabel({ codigo: '38', nome: once }), once);
});

test('código só ou nome só', () => {
  assert.equal(formatDepartamentoLabel({ codigo: '', nome: 'Offshore' }), 'Offshore');
  assert.equal(formatDepartamentoLabel({ codigo: '07', nome: '' }), '07');
});

test('normalizar separa código do nome e colapsa duplicata', () => {
  assert.deepEqual(normalizarDepartamento('38 - ABZ - MATRIX'), { codigo: '38', nome: 'ABZ - MATRIX' });
  assert.deepEqual(normalizarDepartamento('38 - 38 - ABZ - MATRIX', '38'), { codigo: '38', nome: 'ABZ - MATRIX' });
  assert.deepEqual(normalizarDepartamento('ABZ - MATRIX', '38'), { codigo: '38', nome: 'ABZ - MATRIX' });
  assert.deepEqual(normalizarDepartamento('Offshore'), { codigo: '', nome: 'Offshore' });
});
