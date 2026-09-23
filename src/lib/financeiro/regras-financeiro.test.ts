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
  type CobrancaConciliavel,
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
