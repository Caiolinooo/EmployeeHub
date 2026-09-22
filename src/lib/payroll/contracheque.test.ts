/**
 * Testes do renderizador puro do contracheque.
 * Rodar: npx tsx --test src/lib/payroll/contracheque.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { brl, renderContracheque, type ContrachequeDados } from './contracheque';

const fixture: ContrachequeDados = {
  competencia: 'set/2026',
  empresa: { razaoSocial: 'AGUAS BRASILEIRAS LTDA', cnpj: '17.784.306/0001-89' },
  empregado: {
    nome: 'FULANO DE TAL',
    cpf: '123.456.789-09',
    matricula: '427',
    cargo: 'TAIFEIRO',
    departamento: 'ABZ ADM',
    admissao: '2025-01-15',
    pis: '107.55757.53-8',
    salarioBase: 4500,
  },
  rubricas: [
    { codigo: '001', descricao: 'Dias Normais', quantidade: 30, referencia: 150, valor: 4500, natureza: 'provento' },
    { codigo: '104', descricao: 'INSS', quantidade: null, referencia: null, valor: 509.6, natureza: 'desconto' },
    { codigo: '119', descricao: 'FGTS 8%', quantidade: null, referencia: null, valor: 360, natureza: 'informativo' },
  ],
  totais: { proventos: 4500, descontos: 509.6, liquido: 3990.4 },
  bases: { inss: 4500, irrf: 4500, fgts: 4500 },
  valores: { inss: 509.6, irrf: 0, fgts: 360 },
};

describe('brl', () => {
  it('formata pt-BR com 2 casas', () => {
    assert.equal(brl(4500), '4.500,00');
    assert.equal(brl(509.6), '509,60');
    assert.equal(brl(null), '');
  });
});

describe('renderContracheque', () => {
  const html = renderContracheque(fixture);

  it('traz identificação da empresa, competência e empregado', () => {
    assert.ok(html.includes('AGUAS BRASILEIRAS LTDA'));
    assert.ok(html.includes('17.784.306/0001-89'));
    assert.ok(html.includes('set/2026'));
    assert.ok(html.includes('FULANO DE TAL'));
    assert.ok(html.includes('123.456.789-09'));
    assert.ok(html.includes('TAIFEIRO'));
  });

  it('provento, desconto e informativo na coluna certa', () => {
    // Cada rubrica é um bloco <tr>...<td class="cod">NNN</td>...</tr>
    const bloco = (cod: string) => {
      const inicio = html.indexOf(`<td class="cod">${cod}</td>`);
      const fim = html.indexOf('</tr>', inicio);
      return html.slice(inicio, fim);
    };
    const inss = bloco('104');
    // INSS: valor só na coluna descontos (índice 3 das células num: qtde, ref, provento, desconto, informativo)
    assert.ok(inss.includes('509,60'));
    const celulasInss = (inss.match(/<td class="num">([^<]*)<\/td>/g) || []).map((c) => c.replace(/<[^>]+>/g, ''));
    assert.equal(celulasInss[3], '509,60'); // desconto
    assert.equal(celulasInss[4], ''); // informativo vazio

    const fgts = bloco('119');
    const celulasFgts = (fgts.match(/<td class="num">([^<]*)<\/td>/g) || []).map((c) => c.replace(/<[^>]+>/g, ''));
    assert.equal(celulasFgts[3], ''); // desconto vazio
    assert.equal(celulasFgts[4], '360,00'); // informativo
  });

  it('totais e líquido conferem', () => {
    assert.ok(html.includes('4.500,00')); // proventos
    assert.ok(html.includes('3.990,40')); // líquido
  });

  it('escapa HTML nos dados', () => {
    const htmlEsc = renderContracheque({
      ...fixture,
      empregado: { ...fixture.empregado, nome: '<script>alert(1)</script>' },
    });
    assert.ok(!htmlEsc.includes('<script>alert(1)'));
    assert.ok(htmlEsc.includes('&lt;script&gt;'));
  });
});
