/**
 * Testes do renderizador HTML puro da fatura (§3.3) — determinismo com
 * fixtures, metadados (nº/data/call-off), tabela de serviços, seção
 * "Corporate Account Details" e escape de HTML. Rodar:
 *   npx tsx --test src/lib/financeiro/invoice/*.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderFaturaHtml } from './render-html';
import type { FaturaRenderInput } from './types';

const FIXTURE: FaturaRenderInput = {
  fatura: {
    numero: 334,
    ano: 2026,
    dataEmissao: '2026-09-01',
    dataVencimento: '2026-09-30',
    moeda: 'BRL',
    valorTotal: 15100,
    callOff: 'CO-77',
    observacoes: 'Pagamento em 30 dias',
    competencia: '08/2026',
    status: 'emitida',
  },
  emissor: {
    razaoSocial: 'ABZ Group Serviços Offshore Ltda',
    cnpj: '12.345.678/0001-90',
    endereco: 'Rua do Porto, 100 — Macaé/RJ',
    email: 'financeiro@abzgroup.com',
    telefone: '+55 22 99999-0000',
  },
  cliente: {
    nome: 'Omega Subsea Ltd',
    documento: 'GB 12345678',
    endereco: '30 Abercrombie Court, Westhill, UK',
  },
  itens: [
    { descricao: 'Foo, Foo — Master DPO', referencia: '1001 · 08/2026', quantidade: 1, valorUnitario: 12000, valorTotal: 12000 },
    { descricao: 'Brazilian Payroll Additional', referencia: '08/2026', quantidade: 1, valorUnitario: 3100, valorTotal: 3100 },
  ],
  contaBancaria: {
    bancoNome: 'Itaú Unibanco',
    agencia: '1234',
    conta: '56789-0',
    titularNome: 'ABZ Group Serviços Offshore Ltda',
    pixChave: 'financeiro@abzgroup.com',
  },
};

describe('renderFaturaHtml (função pura, layout 1_Invoice)', () => {
  it('determinístico: mesma entrada → mesmo HTML byte a byte', () => {
    assert.equal(renderFaturaHtml(FIXTURE), renderFaturaHtml(FIXTURE));
  });

  it('metadados: nº da fatura, data e call-off', () => {
    const html = renderFaturaHtml(FIXTURE);
    assert.match(html, /Invoice No\./);
    assert.match(html, /0000334\/2026/);
    assert.match(html, /2026-09-01/);
    assert.match(html, /Call Off/);
    assert.match(html, /CO-77/);
  });

  it('tabela de serviços com todos os itens e total', () => {
    const html = renderFaturaHtml(FIXTURE);
    assert.match(html, /Foo, Foo — Master DPO/);
    assert.match(html, /Brazilian Payroll Additional/);
    assert.match(html, /1001 · 08\/2026/);
    assert.match(html, /R\$ 15\.100,00/);
    assert.match(html, /TOTAL BRL/);
  });

  it('seção Corporate Account Details com dados da conta', () => {
    const html = renderFaturaHtml(FIXTURE);
    assert.match(html, /CORPORATE ACCOUNT DETAILS/);
    assert.match(html, /Itaú Unibanco/);
    assert.match(html, /56789-0/);
    assert.match(html, /financeiro@abzgroup\.com/);
  });

  it('escape de HTML em descrição/nome (injeção não vira markup)', () => {
    const html = renderFaturaHtml({
      ...FIXTURE,
      cliente: { nome: '<script>alert(1)</script> Ltd' },
    });
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.match(html, /&lt;script&gt;/);
  });

  it('rascunho marcado como DRAFT; sem conta bancária a seção some', () => {
    const rascunho = renderFaturaHtml({ ...FIXTURE, fatura: { ...FIXTURE.fatura, status: 'rascunho' } });
    assert.match(rascunho, /DRAFT/);
    const semConta = renderFaturaHtml({ ...FIXTURE, contaBancaria: undefined });
    assert.ok(!semConta.includes('CORPORATE ACCOUNT DETAILS'));
  });

  it('moeda estrangeira usa o símbolo certo (GBP)', () => {
    const html = renderFaturaHtml({
      ...FIXTURE,
      fatura: { ...FIXTURE.fatura, moeda: 'GBP', valorTotal: 2500 },
      itens: [{ descricao: 'Charge rate', quantidade: 1, valorUnitario: 2500, valorTotal: 2500 }],
    });
    assert.match(html, /£ 2\.500,00/);
  });
});
