/**
 * Testes dos placeholders BB/Santander/Bradesco e do registry de bancos.
 * Rodar: npx tsx --test src/lib/financeiro/banks/placeholders.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bbAdapter,
  bradescoAdapter,
  BB_META,
  BRADESCO_META,
  SANTANDER_META,
  santanderAdapter,
} from './placeholders';
import { BANK_CATALOG, getBankAdapter } from './registry';
import { CapacidadeNaoSuportadaError, type BankAdapter, type BankContext } from './types';

const ctx: BankContext = {
  integracaoId: 'int-bb-1',
  ambiente: 'sandbox',
  credenciais: {},
  conta: {
    bancoCodigo: '001', agencia: '1234', conta: '5678', digito: '9',
    titularNome: 'A', titularDocumento: '1',
  },
};

describe('registry — BANK_CATALOG', () => {
  it('ordem e chaves: itau, xp, bb, santander, bradesco', () => {
    assert.deepEqual(
      BANK_CATALOG.map((m) => m.key),
      ['itau', 'xp', 'bb', 'santander', 'bradesco'],
    );
  });

  it('códigos FEBRABAN e metas completas', () => {
    const porCodigo = Object.fromEntries(BANK_CATALOG.map((m) => [m.key, m]));
    assert.equal(porCodigo.itau.codigoFebraban, '341');
    assert.equal(porCodigo.xp.codigoFebraban, '348');
    assert.equal(porCodigo.bb.codigoFebraban, '001');
    assert.equal(porCodigo.santander.codigoFebraban, '033');
    assert.equal(porCodigo.bradesco.codigoFebraban, '237');
    for (const meta of BANK_CATALOG) {
      assert.ok(meta.nome.length > 0);
      assert.ok(meta.ambientes.length > 0);
      assert.ok(meta.credentialSchema.length > 0);
      assert.ok(meta.descricaoCredenciais.length > 0);
      assert.ok(Array.isArray(meta.certificados));
    }
  });

  it('getBankAdapter resolve instâncias; key inválida → erro tipado', () => {
    assert.equal(getBankAdapter('itau').meta.codigoFebraban, '341');
    assert.equal(getBankAdapter('xp').meta.key, 'xp');
    assert.throws(() => getBankAdapter('inexistente'), CapacidadeNaoSuportadaError);
  });
});

describe('placeholders — credenciais exigidas (§4)', () => {
  it('BB: client_id/secret, api_key gw-dev-exp e pfx Extranet', () => {
    const chaves = BB_META.credentialSchema.map((c) => c.key);
    assert.ok(chaves.includes('client_id'));
    assert.ok(chaves.includes('client_secret'));
    assert.ok(chaves.includes('api_key'));
    assert.ok(chaves.includes('pfx_senha'));
    assert.equal(BB_META.certificados[0]?.key, 'pfx');
    assert.match(BB_META.descricaoCredenciais, /gw-dev-exp/i);
  });

  it('Santander: Open Banking/DevBank com certificado mTLS', () => {
    const chaves = SANTANDER_META.credentialSchema.map((c) => c.key);
    assert.deepEqual(chaves, ['client_id', 'client_secret', 'pfx_senha']);
    assert.equal(SANTANDER_META.certificados[0]?.required, true);
  });

  it('Bradesco: Pix/Boleto com chave_pix', () => {
    const chaves = BRADESCO_META.credentialSchema.map((c) => c.key);
    assert.ok(chaves.includes('chave_pix'));
    assert.match(BRADESCO_META.descricaoCredenciais, /chave Pix/i);
  });
});

describe('placeholders — métodos lançam CapacidadeNaoSuportadaError', () => {
  const casos: Array<[string, BankAdapter]> = [
    ['bb', bbAdapter],
    ['santander', santanderAdapter],
    ['bradesco', bradescoAdapter],
  ];

  for (const [nome, adapter] of casos) {
    it(`${nome}: listarConciliacao/boleto/pix/lote/status`, async () => {
      await assert.rejects(adapter.listarConciliacao(ctx, { de: '2026-09-01', ate: '2026-09-30' }), CapacidadeNaoSuportadaError);
      await assert.rejects(
        adapter.gerarCobrancaBoleto!(ctx, {
          valor: 1, vencimento: '2026-10-01',
          pagador: { nome: 'A', documento: '1' }, descricao: 'd',
        }),
        CapacidadeNaoSuportadaError,
      );
      await assert.rejects(adapter.gerarCobrancaPix!(ctx, { valor: 1 }), CapacidadeNaoSuportadaError);
      await assert.rejects(
        adapter.enviarPagamentoLote!(ctx, [{
          idLocal: '1',
          favorecido: { nome: 'A', documento: '1', tipoConta: 'cc', banco: '001', agencia: '1', conta: '1', digitoConta: '1' },
          valor: 1, dataPrevista: '2026-10-01', descricao: 'd',
        }]),
        CapacidadeNaoSuportadaError,
      );
      await assert.rejects(adapter.status(ctx), CapacidadeNaoSuportadaError);
    });

    it(`${nome}: capacidades vazias até implementação real`, () => {
      assert.deepEqual(adapter.meta.capacidades, []);
    });
  }
});
