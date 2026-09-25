/**
 * GET /api/financeiro/visao-geral — filtro empresa_id e 500 com log.
 * Rodar: npx tsx --test src/app/api/financeiro/visao-geral/visao-geral.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { montarVisaoGeral, resolverEmpresaIdFiltro, type VisaoGeralAdmin, type VisaoGeralQuery } from './visao-geral';

const UUID_OK = '11111111-2222-3333-4444-555555555555';

type EqCall = { coluna: string; valor: unknown };

function createMockAdmin(opts?: {
  faturasError?: { message: string; code?: string };
}): { admin: VisaoGeralAdmin; eqCalls: EqCall[] } {
  const eqCalls: EqCall[] = [];
  const resultFor = (tabela: string) => {
    if (tabela === 'fin_faturas' && opts?.faturasError) {
      return { data: null, error: opts.faturasError, count: null };
    }
    return { data: [], error: null, count: 0 };
  };

  const makeQuery = (tabela: string): VisaoGeralQuery => {
    const q: VisaoGeralQuery = {
      select: () => q,
      eq: (coluna, valor) => {
        eqCalls.push({ coluna, valor });
        return q;
      },
      in: () => q,
      order: () => q,
      limit: () => q,
      gte: () => q,
      lte: () => q,
      then: (onfulfilled, onrejected) => Promise.resolve(resultFor(tabela)).then(onfulfilled, onrejected),
    };
    return q;
  };

  return {
    eqCalls,
    admin: {
      from: (tabela) => makeQuery(tabela),
    },
  };
}

describe('resolverEmpresaIdFiltro', () => {
  it('trata ausente/vazio/todas/null como sem filtro', () => {
    assert.deepEqual(resolverEmpresaIdFiltro(null), { ok: true, empresaId: null });
    assert.deepEqual(resolverEmpresaIdFiltro(''), { ok: true, empresaId: null });
    assert.deepEqual(resolverEmpresaIdFiltro('   '), { ok: true, empresaId: null });
    assert.deepEqual(resolverEmpresaIdFiltro('todas'), { ok: true, empresaId: null });
    assert.deepEqual(resolverEmpresaIdFiltro('TODAS'), { ok: true, empresaId: null });
    assert.deepEqual(resolverEmpresaIdFiltro('null'), { ok: true, empresaId: null });
  });

  it('aceita uuid e rejeita lixo', () => {
    assert.deepEqual(resolverEmpresaIdFiltro(UUID_OK), { ok: true, empresaId: UUID_OK });
    assert.deepEqual(resolverEmpresaIdFiltro('nao-e-uuid'), { ok: false });
  });
});

describe('montarVisaoGeral — filtro empresa_id', () => {
  it('(a) sem empresaId devolve 200 e nunca chama eq(empresa_id, null/undefined)', async () => {
    const { admin, eqCalls } = createMockAdmin();
    const { status, body } = await montarVisaoGeral(
      { url: 'http://localhost/api/financeiro/visao-geral' },
      admin,
    );
    assert.equal(status, 200);
    assert.equal((body as { success: boolean }).success, true);
    assert.ok((body as { data: { kpis: unknown } }).data.kpis);
    const empresaEq = eqCalls.filter((c) => c.coluna === 'empresa_id');
    assert.equal(empresaEq.length, 0);
    assert.equal(eqCalls.some((c) => c.coluna === 'empresa_id' && (c.valor == null)), false);
  });

  it('(b) empresaId=todas devolve 200 e não filtra empresa_id', async () => {
    const { admin, eqCalls } = createMockAdmin();
    const { status, body } = await montarVisaoGeral(
      { url: 'http://localhost/api/financeiro/visao-geral?empresaId=todas' },
      admin,
    );
    assert.equal(status, 200);
    assert.equal((body as { success: boolean }).success, true);
    assert.equal(eqCalls.filter((c) => c.coluna === 'empresa_id').length, 0);
    assert.equal(eqCalls.some((c) => c.valor === null || c.valor === undefined), false);
  });

  it('(c) uuid válido aplica eq(empresa_id, uuid)', async () => {
    const { admin, eqCalls } = createMockAdmin();
    const { status } = await montarVisaoGeral(
      { url: `http://localhost/api/financeiro/visao-geral?empresaId=${UUID_OK}` },
      admin,
    );
    assert.equal(status, 200);
    const empresaEq = eqCalls.filter((c) => c.coluna === 'empresa_id');
    assert.ok(empresaEq.length >= 1);
    assert.ok(empresaEq.every((c) => c.valor === UUID_OK));
    assert.equal(empresaEq.some((c) => c.valor == null), false);
  });

  it('(d) erro de DB devolve 500 e loga message/code', async () => {
    const { admin } = createMockAdmin({
      faturasError: { message: 'invalid input syntax for type uuid: "null"', code: '22P02' },
    });
    const logs: Array<{ message?: string; code?: string }> = [];
    const { status, body } = await montarVisaoGeral(
      { url: 'http://localhost/api/financeiro/visao-geral' },
      admin,
      (info) => {
        logs.push(info);
      },
    );
    assert.equal(status, 500);
    assert.deepEqual(body, {
      success: false,
      error: 'invalid input syntax for type uuid: "null"',
    });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].message, 'invalid input syntax for type uuid: "null"');
    assert.equal(logs[0].code, '22P02');
  });

  it('(d2) logger padrão chama console.error só com message/code', async () => {
    const { admin } = createMockAdmin({
      faturasError: { message: 'db down', code: 'PGRST204' },
    });
    const errorMock = mock.method(console, 'error', () => {});
    try {
      const { status } = await montarVisaoGeral(
        { url: 'http://localhost/api/financeiro/visao-geral' },
        admin,
      );
      assert.equal(status, 500);
      assert.ok(errorMock.mock.calls.length >= 1);
      const args = errorMock.mock.calls[0].arguments;
      assert.equal(args[0], '[api/financeiro/visao-geral]');
      assert.deepEqual(args[1], { message: 'db down', code: 'PGRST204' });
    } finally {
      errorMock.mock.restore();
    }
  });
});
