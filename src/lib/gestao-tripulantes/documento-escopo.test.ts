import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DOCS_VIEW_ALL,
  decidirEscopoDocumentos,
  viewAllNegadoNoUsuario,
  escopoVeColaborador,
  escopoVeUsuario,
  type EntradaEscopoDocumentos,
} from './documento-escopo-regra';

const base: EntradaEscopoDocumentos = { role: 'USER', setorDp: false, viewAll: false, viewAllNegado: false };
const escopo = (over: Partial<EntradaEscopoDocumentos>) => decidirEscopoDocumentos({ ...base, ...over });

describe('decidirEscopoDocumentos', () => {
  it('ADMIN/SUPERADMIN veem todos, mesmo com view_all negado', () => {
    assert.equal(escopo({ role: 'ADMIN' }), 'todos');
    assert.equal(escopo({ role: 'SUPERADMIN', viewAllNegado: true }), 'todos');
  });

  it('USER do setor DP/RH + GT vê todos', () => {
    assert.equal(escopo({ setorDp: true }), 'todos');
  });

  it('DP com view_all desmarcado só vê os próprios', () => {
    assert.equal(escopo({ setorDp: true, viewAllNegado: true }), 'proprios');
  });

  it('USER de outro setor (interno ou externo) só vê os próprios', () => {
    assert.equal(escopo({}), 'proprios');
  });

  it('view_all explícito vê todos', () => {
    assert.equal(escopo({ viewAll: true }), 'todos');
  });

  it('MANAGER de outro setor mantém todos (contrato legado) e perde com deny explícito', () => {
    assert.equal(escopo({ role: 'MANAGER' }), 'todos');
    assert.equal(escopo({ role: 'manager', viewAllNegado: true }), 'proprios');
  });

  it('deny ACL de view_all (granted=false) vale como o false do JSONB', () => {
    const viewAllNegado = viewAllNegadoNoUsuario(null, [DOCS_VIEW_ALL]);
    assert.equal(escopo({ setorDp: true, viewAll: false, viewAllNegado }), 'proprios');
    assert.equal(escopo({ role: 'MANAGER', viewAllNegado }), 'proprios');
    assert.equal(escopo({ role: 'ADMIN', viewAllNegado }), 'todos');
  });

  it('viewAllNegadoNoUsuario: só JSONB false ou ACL negada contam', () => {
    assert.equal(viewAllNegadoNoUsuario({ [DOCS_VIEW_ALL]: false }, []), true);
    assert.equal(viewAllNegadoNoUsuario({ [DOCS_VIEW_ALL]: true }, undefined), false);
    assert.equal(viewAllNegadoNoUsuario(undefined, ['gestao-tripulantes.documents.edit']), false);
  });
});

describe('escopoVeColaborador / escopoVeUsuario', () => {
  const proprios = { escopo: 'proprios' as const, colaboradorIds: ['c-own'] };
  const todos = { escopo: 'todos' as const, colaboradorIds: [] };

  it('escopo próprio só passa no colaborador vinculado', () => {
    assert.equal(escopoVeColaborador(proprios, 'c-own'), true);
    assert.equal(escopoVeColaborador(proprios, 'c-outro'), false);
    assert.equal(escopoVeColaborador(proprios, null), false);
    assert.equal(escopoVeColaborador(todos, 'c-outro'), true);
  });

  it('escopo próprio só passa no próprio usuário do portal', () => {
    assert.equal(escopoVeUsuario(proprios, 'u1', 'u1'), true);
    assert.equal(escopoVeUsuario(proprios, 'u1', 'u2'), false);
    assert.equal(escopoVeUsuario(todos, 'u1', 'u2'), true);
  });
});
