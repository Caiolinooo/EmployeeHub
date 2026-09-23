/**
 * Testes do parser CSV de extrato + adapter XP (Fase 1 conciliação).
 * Rodar: npx tsx --test src/lib/financeiro/banks/xp.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectarDelimitador,
  dividirLinhaCsv,
  parseCsvExtrato,
  parseDataIso,
  parseValorBrl,
} from './csv-extrato';
import { criarXpAdapter, importarCsvExtrato, XP_META } from './xp';
import { CapacidadeNaoSuportadaError, type BankContext } from './types';
import type { HttpRequestInit } from './http-mtls';

const ctx: BankContext = {
  integracaoId: 'int-xp-1',
  ambiente: 'producao',
  credenciais: {},
  conta: {
    bancoCodigo: '348', agencia: '0001', conta: '1234567', digito: '0',
    titularNome: 'ABZ LTDA', titularDocumento: '12345678000199',
  },
};

describe('csv-extrato — valores e datas', () => {
  it('parseValorBrl trata R$, milhar, negativos e parênteses', () => {
    assert.equal(parseValorBrl('R$ 1.234,56'), 1234.56);
    assert.equal(parseValorBrl('-1.234,56'), -1234.56);
    assert.equal(parseValorBrl('(2.500,00)'), -2500);
    assert.equal(parseValorBrl('50,00'), 50);
    assert.equal(parseValorBrl('50.00'), 50);
    assert.equal(parseValorBrl('1.234'), 1234); // ponto de milhar
    assert.equal(parseValorBrl('1.5'), 1.5);    // ponto decimal
  });

  it('parseDataIso aceita dd/mm/aaaa e aaaa-mm-dd', () => {
    assert.equal(parseDataIso('05/10/2026'), '2026-10-05');
    assert.equal(parseDataIso('2026-10-05'), '2026-10-05');
    assert.equal(parseDataIso('5-10-2026'), '2026-10-05');
    assert.throws(() => parseDataIso('não é data'));
  });

  it('detectarDelimitador escolhe por frequência fora de aspas', () => {
    assert.equal(detectarDelimitador('a;b;c\n1;2;3'), ';');
    assert.equal(detectarDelimitador('a,b,c\n1,2,3'), ',');
    assert.equal(detectarDelimitador('a\tb\tc\n1\t2\t3'), '\t');
  });

  it('dividirLinhaCsv respeita aspas e aspas dobradas', () => {
    assert.deepEqual(
      dividirLinhaCsv('a;"b;c";"d""e"', ';'),
      ['a', 'b;c', 'd"e'],
    );
  });
});

describe('csv-extrato — parseCsvExtrato', () => {
  it('CSV do XP com ; e valores R$ (cabeçalho PT-BR)', () => {
    const csv = [
      'Data Movimento;Descrição;Valor (R$)',
      '01/09/2026;PIX RECEBIDO FATURA 10;R$ 1.500,00',
      '02/09/2026;TARIFA BANCÁRIA;R$ -45,90',
    ].join('\n');
    const movimentos = parseCsvExtrato(csv);
    assert.equal(movimentos.length, 2);
    assert.equal(movimentos[0].data, '2026-09-01');
    assert.equal(movimentos[0].tipo, 'credito');
    assert.equal(movimentos[0].valor, 1500);
    assert.equal(movimentos[1].tipo, 'debito');
    assert.equal(movimentos[1].valor, 45.9);
    assert.equal(movimentos[0].raw?.linha, 2);
  });

  it('CSV com , e colunas Entrada/Saída', () => {
    const csv = [
      'Data,Histórico,Entrada,Saída',
      '2026-09-03,DEPÓSITO,"3.100,25",',
      '2026-09-04,PAGAMENTO BOLETO,,"310,25"',
    ].join('\n');
    const movimentos = parseCsvExtrato(csv);
    assert.equal(movimentos[0].valor, 3100.25);
    assert.equal(movimentos[0].tipo, 'credito');
    assert.equal(movimentos[1].tipo, 'debito');
    assert.equal(movimentos[1].valor, 310.25);
  });

  it('CSV com tab e coluna tipo C/D', () => {
    const csv = [
      'Data\tDescrição\tValor\tTipo',
      '2026-09-05\tTRANSFERÊNCIA\t100,00\tC',
      '2026-09-06\tSAQUE\t100,00\tD',
    ].join('\n');
    const movimentos = parseCsvExtrato(csv);
    assert.equal(movimentos[0].tipo, 'credito');
    assert.equal(movimentos[1].tipo, 'debito');
  });

  it('extrai txid e nosso número da descrição quando não há coluna', () => {
    const csv = [
      'Data;Descrição;Valor',
      '01/09/2026;"PIX  TXID=E1234567820260901ABCDE  liquidado";100,00',
      '02/09/2026;"BOLETO nosso número 12345670001 pago";200,00',
    ].join('\n');
    const movimentos = parseCsvExtrato(csv);
    assert.equal(movimentos[0].txid, 'E1234567820260901ABCDE');
    assert.equal(movimentos[1].nossoNumero, '12345670001');
  });

  it('usa colunas dedicadas de txid/nosso número/NSU quando presentes', () => {
    const csv = [
      'Data;Descrição;Valor;NSU;Txid;NossoNúmero',
      '01/09/2026;X;10,00;N-1;T-1;NN-1',
    ].join('\n');
    const [m] = parseCsvExtrato(csv);
    assert.equal(m.idExterno, 'N-1');
    assert.equal(m.txid, 'T-1');
    assert.equal(m.nossoNumero, 'NN-1');
  });

  it('idExterno fallback é determinístico por conteúdo/posição', () => {
    const csv = 'Data;Descrição;Valor\n01/09/2026;A;1,00\n01/09/2026;A;1,00';
    const movimentos = parseCsvExtrato(csv);
    assert.notEqual(movimentos[0].idExterno, movimentos[1].idExterno); // posições distintas
    const deNovo = parseCsvExtrato(csv);
    assert.equal(movimentos[0].idExterno, deNovo[0].idExterno); // idempotente entre execuções
  });

  it('fallback posicional quando o cabeçalho não é reconhecido', () => {
    const csv = 'Linha 1 qualquer sem colunas\n01/09/2026;TESTE;5,00';
    const movimentos = parseCsvExtrato(csv);
    assert.equal(movimentos.length, 1);
    assert.equal(movimentos[0].valor, 5);
  });

  it('lança erro em CSV vazio ou sem movimentos', () => {
    assert.throws(() => parseCsvExtrato(''), /vazio/i);
    assert.throws(() => parseCsvExtrato('Data;Descrição;Valor\n'), /movimentos/i);
  });
});

describe('xp — adapter', () => {
  it('meta: FEBRABAN 348, só conciliação, credenciais opcionais de API futura', () => {
    assert.equal(XP_META.codigoFebraban, '348');
    assert.deepEqual(XP_META.capacidades, ['conciliacao']);
    const chaves = XP_META.credentialSchema.map((c) => c.key);
    assert.deepEqual(chaves, ['api_url', 'api_token']);
    assert.ok(XP_META.credentialSchema.every((c) => !c.required));
    assert.deepEqual(XP_META.certificados, []);
  });

  it('importarCsvExtrato parseia CSV do Internet Banking', () => {
    const csv = 'Data;Descrição;Valor\n01/09/2026;CDB RESGATE;R$ 10.000,00';
    const movimentos = importarCsvExtrato(csv);
    assert.equal(movimentos[0].valor, 10000);
  });

  it('cobrança/pagamento lançam CapacidadeNaoSuportadaError', async () => {
    const adapter = criarXpAdapter();
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
  });

  it('listarConciliacao sem API configurada aponta para o upload CSV', async () => {
    const adapter = criarXpAdapter();
    await assert.rejects(
      adapter.listarConciliacao(ctx, { de: '2026-09-01', ate: '2026-09-30' }),
      (e: unknown) => e instanceof CapacidadeNaoSuportadaError && /CSV/i.test(e.message),
    );
  });

  it('listarConciliacao usa o hook da API privada quando credenciada', async () => {
    let urlCapturada = '';
    let authCapturada = '';
    const http = async (url: string, init?: HttpRequestInit) => {
      urlCapturada = url;
      authCapturada = init?.headers?.Authorization ?? '';
      return {
        status: 200,
        ok: true,
        cabecalhos: {},
        texto: JSON.stringify({
          movimentos: [{ id: 'X1', data: '2026-09-01', valor: 100, descricao: 'CDB' }],
        }),
      };
    };
    const adapter = criarXpAdapter({ http });
    const movimentos = await adapter.listarConciliacao(
      { ...ctx, credenciais: { api_url: 'https://api.xp.example', api_token: 'tok' } },
      { de: '2026-09-01', ate: '2026-09-30' },
    );
    assert.ok(urlCapturada.includes('https://api.xp.example/extrato'));
    assert.equal(authCapturada, 'Bearer tok');
    assert.equal(movimentos[0].idExterno, 'X1');
  });

  it('status reflete estado da API (sem credenciais → ok com detalhe CSV)', async () => {
    const adapter = criarXpAdapter();
    const status = await adapter.status(ctx);
    assert.equal(status.ok, true);
    assert.match(status.detalhe ?? '', /CSV/);
  });
});
