/**
 * Testes das regras puras do módulo Financeiro (§5.2/§6) — regras de nº
 * sequencial, cálculo de itens, máquina de estados NFS-e/RPS, bloqueio de
 * moeda e conciliação automática. Rodar: npx tsx --test src/lib/financeiro/*.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  proximoNumeroFatura,
  podeEditarFatura,
  podeEmitirFatura,
  podeCancelarFatura,
  calcularItem,
  calcularItensFatura,
  parseCompetencia,
  verificarEmissaoNfse,
  transicaoNfseValida,
  eventoDeTransicaoNfse,
  podeReemitirNfse,
  podeConsultarNfse,
  podeCancelarNfse,
  statusFaturaAposNfse,
  conciliarMovimento,
  podeAtualizarCobranca,
  podeCobrarFatura,
  diasEntre,
  diasAtraso,
  faixaAging,
  agingCarteira,
  FAIXAS_AGING,
  type CobrancaConciliavel,
  type TituloCarteira,
} from './regras-financeiro';

const cobranca = (over: Partial<CobrancaConciliavel>): CobrancaConciliavel => ({
  id: 'cob-1',
  valor: 1000,
  status: 'gerada',
  ...over,
});

describe('nº sequencial de fatura (por empresa+ano)', () => {
  it('primeiro número do período é 1', () => {
    assert.equal(proximoNumeroFatura([]), 1);
  });
  it('max+1 com buracos na sequência', () => {
    assert.equal(proximoNumeroFatura([1, 2, 7, 4]), 8);
  });
  it('ignora números negativos/zero históricos', () => {
    assert.equal(proximoNumeroFatura([0, -5, 3]), 4);
  });
});

describe('máquina de estados da fatura (§6)', () => {
  it('só rascunho edita e emite', () => {
    assert.equal(podeEditarFatura('rascunho'), true);
    assert.equal(podeEditarFatura('emitida'), false);
    assert.equal(podeEmitirFatura('rascunho'), true);
    assert.equal(podeEmitirFatura('nfse_emitida'), false);
  });
  it('DELETE cancela rascunho e emitida, não paga/nfse_emitida/cancelada', () => {
    assert.equal(podeCancelarFatura('rascunho'), true);
    assert.equal(podeCancelarFatura('emitida'), true);
    assert.equal(podeCancelarFatura('paga'), false);
    assert.equal(podeCancelarFatura('nfse_emitida'), false);
    assert.equal(podeCancelarFatura('cancelada'), false);
  });
  it('cobrança exige fatura emitida ou nfse_emitida', () => {
    assert.equal(podeCobrarFatura('rascunho'), false);
    assert.equal(podeCobrarFatura('emitida'), true);
    assert.equal(podeCobrarFatura('nfse_emitida'), true);
    assert.equal(podeCobrarFatura('cancelada'), false);
  });
});

describe('cálculo de itens e total', () => {
  it('item: default quantidade 1 e total = qty × unitário (arredondado)', () => {
    assert.deepEqual(calcularItem({ descricao: 'Diária', valor_unitario: 123.456 }), {
      descricao: 'Diária',
      quantidade: 1,
      valor_unitario: 123.46,
      valor_total: 123.46,
    });
    assert.equal(calcularItem({ descricao: 'X', quantidade: 3, valor_unitario: 10 }).valor_total, 30);
  });
  it('lista válida soma o total', () => {
    const r = calcularItensFatura([
      { descricao: 'A', quantidade: 2, valor_unitario: 100 },
      { descricao: 'B', quantidade: 1, valor_unitario: 50.5 },
    ]);
    assert.ok(r.ok);
    assert.equal(r.total, 250.5);
  });
  it('rejeita lista vazia, item sem descrição e quantidade<=0', () => {
    assert.equal(calcularItensFatura([]).ok, false);
    assert.equal(calcularItensFatura([{ descricao: ' ', valor_unitario: 1 }]).ok, false);
    assert.equal(calcularItensFatura([{ descricao: 'A', quantidade: 0, valor_unitario: 1 }]).ok, false);
  });
});

describe('competência', () => {
  it('aceita YYYY-MM válido e rejeita o resto', () => {
    assert.deepEqual(parseCompetencia('2026-09'), { ano: 2026, mes: 9 });
    assert.equal(parseCompetencia('2026-13'), null);
    assert.equal(parseCompetencia('09/2026'), null);
    assert.equal(parseCompetencia(null), null);
  });
});

describe('emissão NFS-e (§5.2.1): status + moeda BRL', () => {
  it('fatura emitida em BRL passa', () => {
    assert.deepEqual(verificarEmissaoNfse({ status: 'emitida', moeda: 'BRL' }), { ok: true });
  });
  it('moeda estrangeira → 409 fatura_moeda_invalida', () => {
    assert.deepEqual(verificarEmissaoNfse({ status: 'emitida', moeda: 'GBP' }), {
      ok: false,
      motivo: 'fatura_moeda_invalida',
    });
  });
  it('rascunho/paga → fatura_status_invalido (mesmo em BRL)', () => {
    assert.deepEqual(verificarEmissaoNfse({ status: 'rascunho', moeda: 'BRL' }), {
      ok: false,
      motivo: 'fatura_status_invalido',
    });
    assert.deepEqual(verificarEmissaoNfse({ status: 'paga', moeda: 'BRL' }), {
      ok: false,
      motivo: 'fatura_status_invalido',
    });
  });
});

describe('máquina de estados da emissão (§5.2.3/5)', () => {
  it('rps_gerado → enviado → autorizado|rejeitado; rejeitado → enviado', () => {
    assert.equal(transicaoNfseValida('rps_gerado', 'enviado'), true);
    assert.equal(transicaoNfseValida('enviado', 'autorizado'), true);
    assert.equal(transicaoNfseValida('enviado', 'rejeitado'), true);
    assert.equal(transicaoNfseValida('rejeitado', 'enviado'), true);
  });
  it('autorizado só → cancelado; cancelado é terminal; pulos são inválidos', () => {
    assert.equal(transicaoNfseValida('autorizado', 'cancelado'), true);
    assert.equal(transicaoNfseValida('cancelado', 'enviado'), false);
    assert.equal(transicaoNfseValida('rps_gerado', 'autorizado'), false);
    assert.equal(transicaoNfseValida('autorizado', 'rejeitado'), false);
  });
  it('eventos por transição', () => {
    assert.equal(eventoDeTransicaoNfse('enviado'), 'nfse.enviado');
    assert.equal(eventoDeTransicaoNfse('autorizado'), 'nfse.autorizada');
    assert.equal(eventoDeTransicaoNfse('rejeitado'), 'nfse.rejeitada');
    assert.equal(eventoDeTransicaoNfse('cancelado'), 'nfse.cancelada');
    assert.equal(eventoDeTransicaoNfse('rps_gerado'), null);
  });
  it('reemitir só rps_gerado|rejeitado; consultar nunca cancelado; cancelar só autorizado', () => {
    assert.equal(podeReemitirNfse('rps_gerado'), true);
    assert.equal(podeReemitirNfse('rejeitado'), true);
    assert.equal(podeReemitirNfse('autorizado'), false);
    assert.equal(podeConsultarNfse('cancelado'), false);
    assert.equal(podeConsultarNfse('enviado'), true);
    assert.equal(podeCancelarNfse('autorizado'), true);
    assert.equal(podeCancelarNfse('enviado'), false);
  });
  it('fatura acompanha: autorizado→nfse_emitida, cancelado→emitida', () => {
    assert.equal(statusFaturaAposNfse('autorizado'), 'nfse_emitida');
    assert.equal(statusFaturaAposNfse('cancelado'), 'emitida');
    assert.equal(statusFaturaAposNfse('enviado'), null);
  });
});

describe('conciliação automática (§6): txid > nosso_numero > valor+data', () => {
  it('caso por txid', () => {
    const r = conciliarMovimento(
      { idExterno: 'm1', data: '2026-09-20', tipo: 'credito', valor: 1000, txid: 'TX1' },
      [cobranca({ id: 'cob-a', txid: 'TX1' }), cobranca({ id: 'cob-b', valor: 1000, vencimento: '2026-09-20' })],
    );
    assert.deepEqual(r, { cobrancaId: 'cob-a', criterio: 'txid' });
  });
  it('nosso_numero vence valor+data', () => {
    const r = conciliarMovimento(
      { idExterno: 'm2', data: '2026-09-20', tipo: 'credito', valor: 1000, nossoNumero: 'NN9' },
      [cobranca({ id: 'cob-a', nosso_numero: 'NN9', valor: 999 }), cobranca({ id: 'cob-b', valor: 1000, vencimento: '2026-09-20' })],
    );
    assert.deepEqual(r, { cobrancaId: 'cob-a', criterio: 'nosso_numero' });
  });
  it('valor+data exatos casam quando não há txid/nosso número', () => {
    const r = conciliarMovimento(
      { idExterno: 'm3', data: '2026-09-20', tipo: 'credito', valor: 750.5 },
      [cobranca({ id: 'cob-a', valor: 750.5, vencimento: '2026-09-20' })],
    );
    assert.deepEqual(r, { cobrancaId: 'cob-a', criterio: 'valor_data' });
  });
  it('sem match: valor certo em data errada (e vice-versa)', () => {
    const r = conciliarMovimento(
      { idExterno: 'm4', data: '2026-09-21', tipo: 'credito', valor: 750.5 },
      [cobranca({ id: 'cob-a', valor: 750.5, vencimento: '2026-09-20' })],
    );
    assert.deepEqual(r, { cobrancaId: null, criterio: null });
    const r2 = conciliarMovimento(
      { idExterno: 'm5', data: '2026-09-20', tipo: 'credito', valor: 751 },
      [cobranca({ id: 'cob-a', valor: 750.5, vencimento: '2026-09-20' })],
    );
    assert.deepEqual(r2, { cobrancaId: null, criterio: null });
  });
  it('débito nunca concilia; cobrança liquidada/cancelada nunca casa', () => {
    const mov = { idExterno: 'm6', data: '2026-09-20', tipo: 'debito' as const, valor: 1000 };
    assert.equal(conciliarMovimento(mov, [cobranca({})]).cobrancaId, null);
    const r = conciliarMovimento(
      { idExterno: 'm7', data: '2026-09-20', tipo: 'credito', valor: 1000 },
      [cobranca({ status: 'liquidada' }), cobranca({ status: 'cancelada' })],
    );
    assert.equal(r.cobrancaId, null);
  });
  it('débitos de tarifa não derrubam a importação (retornam não conciliado)', () => {
    const r = conciliarMovimento(
      { idExterno: 'm8', data: '2026-09-20', tipo: 'debito', valor: 25 },
      [cobranca({})],
    );
    assert.deepEqual(r, { cobrancaId: null, criterio: null });
  });
});

describe('cobranças: atualização', () => {
  it('só pendente/gerada podem ser atualizadas', () => {
    assert.equal(podeAtualizarCobranca('pendente'), true);
    assert.equal(podeAtualizarCobranca('gerada'), true);
    assert.equal(podeAtualizarCobranca('liquidada'), false);
    assert.equal(podeAtualizarCobranca('expirada'), false);
  });
});

describe('carteira: dias de atraso (sem escorregar por timezone)', () => {
  it('conta dias corridos entre vencimento e referência', () => {
    assert.equal(diasEntre('2026-10-05', '2026-10-20'), 15);
    assert.equal(diasEntre('2026-10-20', '2026-10-05'), -15);
  });
  it('atravessa mês e ano (fev de ano não-bissexto = 28 dias)', () => {
    assert.equal(diasEntre('2026-02-01', '2026-03-01'), 28);
    assert.equal(diasEntre('2025-12-31', '2026-01-01'), 1);
  });
  it('vencimento ausente não gera atraso', () => {
    assert.equal(diasAtraso(null, '2026-10-05'), 0);
    assert.equal(diasAtraso(undefined, '2026-10-05'), 0);
  });
});

describe('carteira: faixas de aging', () => {
  it('não vencido (inclusive o dia do vencimento) fica a vencer', () => {
    assert.equal(faixaAging(-5), 'a_vencer');
    assert.equal(faixaAging(0), 'a_vencer');
  });
  it('fronteiras 30/60/90 caem na faixa de baixo', () => {
    assert.equal(faixaAging(1), '1_30');
    assert.equal(faixaAging(30), '1_30');
    assert.equal(faixaAging(31), '31_60');
    assert.equal(faixaAging(60), '31_60');
    assert.equal(faixaAging(61), '61_90');
    assert.equal(faixaAging(90), '61_90');
    assert.equal(faixaAging(91), '90_mais');
    assert.equal(faixaAging(365), '90_mais');
  });
});

describe('carteira: aging e inadimplência', () => {
  const REF = '2026-10-05';
  const titulo = (over: Partial<TituloCarteira> & { id: string }): TituloCarteira => ({
    clienteId: 'c1',
    clienteNome: 'Cliente A',
    valor: 1000,
    vencimento: '2026-10-20',
    ...over,
  });

  it('carteira vazia não divide por zero e devolve todas as faixas zeradas', () => {
    const r = agingCarteira([], REF);
    assert.equal(r.total, 0);
    assert.equal(r.percentualVencido, 0);
    assert.equal(r.maiorAtraso, 0);
    assert.deepEqual(r.faixas.map((f) => f.faixa), [...FAIXAS_AGING]);
    assert.ok(r.faixas.every((f) => f.quantidade === 0 && f.valor === 0));
  });
  it('distribui por faixa e fecha total/vencido', () => {
    const r = agingCarteira(
      [
        titulo({ id: 't1', vencimento: '2026-09-25', valor: 100 }), // 10 dias
        titulo({ id: 't2', vencimento: '2026-08-20', valor: 200 }), // 46 dias
        titulo({ id: 't3', vencimento: '2026-06-01', valor: 300 }), // 126 dias
        titulo({ id: 't4', vencimento: '2026-10-20', valor: 400 }), // a vencer
      ],
      REF,
    );
    const porFaixa = Object.fromEntries(r.faixas.map((f) => [f.faixa, f.valor]));
    assert.deepEqual(porFaixa, { a_vencer: 400, '1_30': 100, '31_60': 200, '61_90': 0, '90_mais': 300 });
    assert.equal(r.total, 1000);
    assert.equal(r.vencido, 600);
    assert.equal(r.aVencer, 400);
    assert.equal(r.titulos, 4);
    assert.equal(r.titulosVencidos, 3);
    assert.equal(r.maiorAtraso, 126);
    assert.equal(r.percentualVencido, 60);
  });
  it('título sem vencimento conta como a vencer', () => {
    const r = agingCarteira([titulo({ id: 't1', vencimento: null })], REF);
    assert.equal(r.aVencer, 1000);
    assert.equal(r.vencido, 0);
    assert.equal(r.percentualVencido, 0);
  });
  it('saldo <= 0 (integralmente liquidado) não entra na carteira', () => {
    const r = agingCarteira(
      [titulo({ id: 't1', vencimento: '2026-09-01', valor: 0 }), titulo({ id: 't2', vencimento: '2026-09-01', valor: -50 })],
      REF,
    );
    assert.equal(r.total, 0);
    assert.equal(r.titulos, 0);
    assert.equal(r.maiorAtraso, 0);
  });
  it('agrupa devedores por cliente e ordena pelo maior saldo', () => {
    const r = agingCarteira(
      [
        titulo({ id: 't1', clienteId: 'c1', clienteNome: 'Cliente A', valor: 100, vencimento: '2026-09-01' }),
        titulo({ id: 't2', clienteId: 'c1', clienteNome: 'Cliente A', valor: 250, vencimento: '2026-07-01' }),
        titulo({ id: 't3', clienteId: 'c2', clienteNome: 'Cliente B', valor: 900, vencimento: '2026-10-01' }),
      ],
      REF,
    );
    assert.deepEqual(r.clientes.map((c) => [c.clienteId, c.valor, c.titulos]), [
      ['c2', 900, 1],
      ['c1', 350, 2],
    ]);
    assert.equal(r.clientes[1].maiorAtraso, 96); // 2026-07-01 → 2026-10-05
  });
  it('cliente sem id agrupa por nome', () => {
    const r = agingCarteira(
      [
        titulo({ id: 't1', clienteId: null, clienteNome: 'PF nao cadastrada', valor: 100 }),
        titulo({ id: 't2', clienteId: null, clienteNome: 'PF nao cadastrada', valor: 200 }),
      ],
      REF,
    );
    assert.equal(r.clientes.length, 1);
    assert.equal(r.clientes[0].valor, 300);
  });
  it('arredonda a 2 casas para não somar centavos fantasma', () => {
    const r = agingCarteira(
      [titulo({ id: 't1', valor: 0.1, vencimento: '2026-10-01' }), titulo({ id: 't2', valor: 0.2, vencimento: '2026-10-01' })],
      REF,
    );
    assert.equal(r.vencido, 0.3);
    assert.equal(r.total, 0.3);
  });
});
