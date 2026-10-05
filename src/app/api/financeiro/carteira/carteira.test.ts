/**
 * GET /api/financeiro/carteira — saldo em aberto e filtros de consulta.
 * Rodar: npx tsx --test src/app/api/financeiro/carteira/carteira.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { montarCarteira, type CarteiraAdmin, type CarteiraQuery } from './carteira';

const UUID_OK = '11111111-2222-3333-4444-555555555555';
const REF = '2025-03-31';

type Filtro = { tabela: string; coluna: string; valor: unknown };

function createMockAdmin(opts?: {
  faturas?: unknown[];
  cobrancas?: unknown[];
  faturasError?: { message: string; code?: string };
  cobrancasError?: { message: string; code?: string };
}): { admin: CarteiraAdmin; eq: Filtro[]; ins: { tabela: string; coluna: string; valores: unknown[] }[] } {
  const eq: Filtro[] = [];
  const ins: { tabela: string; coluna: string; valores: unknown[] }[] = [];

  const resultFor = (tabela: string) => {
    if (tabela === 'fin_faturas') return { data: opts?.faturas ?? [], error: opts?.faturasError ?? null };
    return { data: opts?.cobrancas ?? [], error: opts?.cobrancasError ?? null };
  };

  const admin: CarteiraAdmin = {
    from: (tabela: string) => {
      const q: CarteiraQuery = {
        select: () => q,
        eq: (coluna, valor) => {
          eq.push({ tabela, coluna, valor });
          return q;
        },
        in: (coluna, valores) => {
          ins.push({ tabela, coluna, valores });
          return q;
        },
        then: (onfulfilled) => Promise.resolve(resultFor(tabela)).then(onfulfilled),
      };
      return q;
    },
  };

  return { admin, eq, ins };
}

function fatura(over: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    cliente_id: 'c1',
    valor_total: 1000,
    data_vencimento: '2025-02-14',
    cliente_snapshot: null,
    cliente: { id: 'c1', nome: 'ACME' },
    ...over,
  };
}

describe('montarCarteira — saldo em aberto', () => {
  it('subtrai cada cobrança liquidada da fatura (1000 − 300 − 200 = 500)', async () => {
    const { admin } = createMockAdmin({
      faturas: [fatura()],
      cobrancas: [
        { fatura_id: 'f1', valor: 300 },
        { fatura_id: 'f1', valor: 200 },
      ],
    });

    const r = await montarCarteira(admin, { empresaId: null, moeda: 'BRL', referencia: REF });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.carteira.total, 500);
  });

  it('liquidada de outra fatura não derruba o saldo desta', async () => {
    const { admin } = createMockAdmin({
      faturas: [fatura()],
      cobrancas: [{ fatura_id: 'outra', valor: 999 }],
    });

    const r = await montarCarteira(admin, { empresaId: null, moeda: 'BRL', referencia: REF });
    if (!r.ok) return assert.fail('esperava ok');
    assert.equal(r.carteira.total, 1000);
  });

  it('agrupa aging, vencido e inadimplência pela data de referência', async () => {
    const { admin } = createMockAdmin({
      faturas: [
        fatura({ id: 'f1', valor_total: 1000, data_vencimento: '2025-02-14' }), // 45 dias → 31_60
        fatura({ id: 'f2', valor_total: 500, data_vencimento: '2025-04-30' }), // a vencer
      ],
    });

    const r = await montarCarteira(admin, { empresaId: null, moeda: 'BRL', referencia: REF });
    if (!r.ok) return assert.fail('esperava ok');
    assert.equal(r.carteira.total, 1500);
    assert.equal(r.carteira.vencido, 1000);
    assert.equal(r.carteira.maiorAtraso, 45);
    assert.equal(r.carteira.titulos, 2);
    assert.equal(r.carteira.faixas.find((f) => f.faixa === '31_60')?.valor, 1000);
    assert.equal(r.carteira.faixas.find((f) => f.faixa === 'a_vencer')?.valor, 500);
  });

  it('nome do devedor cai no snapshot quando a relação cliente vem nula', async () => {
    const { admin } = createMockAdmin({
      faturas: [fatura({ cliente: null, cliente_snapshot: { nome: '  Beta Ltda  ' } })],
    });

    const r = await montarCarteira(admin, { empresaId: null, moeda: 'BRL', referencia: REF });
    if (!r.ok) return assert.fail('esperava ok');
    assert.equal(r.carteira.clientes[0]?.clienteNome, 'Beta Ltda');
  });
});

describe('montarCarteira — envelope da resposta', () => {
  it('ecoa referencia e moeda: sem isso o cliente não sabe o corte dos totais', async () => {
    const { admin } = createMockAdmin({ faturas: [fatura()] });

    const r = await montarCarteira(admin, { empresaId: null, moeda: 'USD', referencia: REF });
    if (!r.ok) return assert.fail('esperava ok');

    assert.equal(r.carteira.referencia, REF);
    assert.equal(r.carteira.moeda, 'USD');
  });
});

describe('montarCarteira — filtros de consulta', () => {
  it('conta só cobrança liquidada e filtra a moeda', async () => {
    const { admin, eq } = createMockAdmin({ faturas: [fatura()] });

    await montarCarteira(admin, { empresaId: null, moeda: 'BRL', referencia: REF });

    assert.ok(eq.some((c) => c.tabela === 'fin_cobrancas' && c.coluna === 'status' && c.valor === 'liquidada'));
    assert.ok(eq.some((c) => c.tabela === 'fin_faturas' && c.coluna === 'moeda' && c.valor === 'BRL'));
  });

  it('empresaId uuid aplica eq(empresa_id, uuid); nulo não filtra', async () => {
    const comFiltro = createMockAdmin({ faturas: [fatura()] });
    await montarCarteira(comFiltro.admin, { empresaId: UUID_OK, moeda: 'BRL', referencia: REF });
    assert.ok(comFiltro.eq.some((c) => c.coluna === 'empresa_id' && c.valor === UUID_OK));

    const semFiltro = createMockAdmin({ faturas: [fatura()] });
    await montarCarteira(semFiltro.admin, { empresaId: null, moeda: 'BRL', referencia: REF });
    assert.equal(semFiltro.eq.some((c) => c.coluna === 'empresa_id'), false);
  });

  it('carteira vazia não consulta fin_cobrancas', async () => {
    const { admin, ins } = createMockAdmin({ faturas: [] });

    const r = await montarCarteira(admin, { empresaId: null, moeda: 'BRL', referencia: REF });
    if (!r.ok) return assert.fail('esperava ok');

    assert.equal(r.carteira.total, 0);
    assert.equal(r.carteira.percentualVencido, 0);
    assert.equal(ins.some((c) => c.tabela === 'fin_cobrancas'), false);
  });
});

describe('montarCarteira — erro de banco', () => {
  it('erro ao ler faturas devolve 500 sem quebrar', async () => {
    const { admin } = createMockAdmin({ faturasError: { message: 'boom', code: '42P01' } });

    const r = await montarCarteira(admin, { empresaId: null, moeda: 'BRL', referencia: REF });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 500);
    assert.equal(r.error, 'boom');
  });

  it('erro ao ler cobranças devolve 500', async () => {
    const { admin } = createMockAdmin({
      faturas: [fatura()],
      cobrancasError: { message: 'semperm' },
    });

    const r = await montarCarteira(admin, { empresaId: null, moeda: 'BRL', referencia: REF });
    if (r.ok) return assert.fail('esperava erro');
    assert.equal(r.status, 500);
    assert.equal(r.error, 'semperm');
  });
});
