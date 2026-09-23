/**
 * Testes do adapter Itaú (OAuth2 + mTLS com HTTP mock, sem rede real).
 * Rodar: npx tsx --test src/lib/financeiro/banks/itau.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { criarItauAdapter, corpoBoleto, corpoPix, mapearMovimento } from './itau';
import {
  apagarPfxTemporario,
  clienteHttp,
  liberarAgenteMtls,
  limparCacheTokens,
  limparRecursosMtls,
  obterTokenOAuth2,
  sanitizarRaw,
  type HttpResponse,
  type HttpRequestInit,
} from './http-mtls';
import type { BankContext } from './types';

const ctx: BankContext = {
  integracaoId: 'int-itau-1',
  ambiente: 'sandbox',
  credenciais: { client_id: 'cid', client_secret: 'csecret', api_key: 'ak-123' },
  certificado: { pfxPath: 'C:/tmp/fake.pfx', pfxPassphrase: 'senha-fake', fingerprint: 'ab12' },
  conta: {
    bancoCodigo: '341', agencia: '1234', conta: '567890', digito: '1',
    titularNome: 'ABZ LTDA', titularDocumento: '12345678000199',
  },
};

interface Chamada { url: string; method: string; headers: Record<string, string>; body?: string }

function criarMock(respostas: Array<(c: Chamada) => HttpResponse>) {
  const chamadas: Chamada[] = [];
  const http = async (url: string, init?: HttpRequestInit) => {
    const c: Chamada = {
      url,
      method: init?.method ?? 'GET',
      headers: init?.headers ?? {},
      body: init?.body !== undefined ? String(init.body) : undefined,
    };
    chamadas.push(c);
    const indice = chamadas.length - 1;
    return respostas[Math.min(indice, respostas.length - 1)](c);
  };
  return { chamadas, http };
}

const jsonRes = (status: number, corpo: unknown): HttpResponse => ({
  status,
  ok: status >= 200 && status < 300,
  cabecalhos: {},
  texto: JSON.stringify(corpo),
});

const RESPOSTA_TOKEN = () => jsonRes(200, { access_token: 'tok-1', expires_in: 300 });
const RESPOSTA_BOLETO = () =>
  jsonRes(200, {
    idBoleto: 'B-1',
    codigoLinhaDigitavel: '3419109000000012345678901234567890123456',
    urlPdf: 'https://sandbox.devportal.itau.com.br/boleto/B-1.pdf',
  });

describe('itau — fluxo oauth → boleto', () => {
  it('autentica client_credentials e depois gera boleto com Bearer + apikey', async () => {
    limparCacheTokens(ctx.integracaoId);
    const { chamadas, http } = criarMock([
      RESPOSTA_TOKEN,
      RESPOSTA_BOLETO,
    ]);
    const adapter = criarItauAdapter({ http });
    const resultado = await adapter.gerarCobrancaBoleto!(ctx, {
      valor: 1500.5,
      vencimento: '2026-10-05',
      pagador: { nome: 'CLIENTE X', documento: '98765432109' },
      descricao: 'Fatura 10/2026',
    });
    assert.equal(resultado.idExterno, 'B-1');
    assert.equal(resultado.linhaDigitavel, '3419109000000012345678901234567890123456');
    assert.ok(resultado.raw);

    // 1ª chamada: token
    const tokenCall = chamadas[0];
    assert.equal(tokenCall.method, 'POST');
    assert.ok(tokenCall.url.startsWith('https://sandbox.devportal.itau.com.br/api/oauth/token'));
    const basic = Buffer.from('cid:csecret').toString('base64');
    assert.equal(tokenCall.headers.Authorization, `Basic ${basic}`);
    assert.equal(tokenCall.headers['x-itau-apikey'], 'ak-123');
    assert.ok(tokenCall.body!.includes('grant_type=client_credentials'));

    // 2ª chamada: boletos
    const boletoCall = chamadas[1];
    assert.equal(boletoCall.method, 'POST');
    assert.ok(boletoCall.url.includes('/itau-ep9-gat-cnab/v1/boletos'));
    assert.equal(boletoCall.headers.Authorization, 'Bearer tok-1');
    assert.equal(boletoCall.headers['x-itau-apikey'], 'ak-123');
    const corpo = JSON.parse(boletoCall.body!) as { boleto: { valorNominal: string; dataVencimento: string } };
    assert.equal(corpo.boleto.valorNominal, '1500.50');
    assert.equal(corpo.boleto.dataVencimento, '2026-10-05');
  });

  it('cacheia token por integracaoId (2ª operação não refaz OAuth)', async () => {
    limparCacheTokens(ctx.integracaoId);
    let chamadasToken = 0;
    const { http } = criarMock([
      () => {
        chamadasToken += 1;
        return RESPOSTA_TOKEN();
      },
      RESPOSTA_BOLETO,
      () => jsonRes(200, { txid: 'PIX-9', pixCopiaECola: '00020101' }),
    ]);
    const adapter = criarItauAdapter({ http });
    await adapter.gerarCobrancaBoleto!(ctx, {
      valor: 1, vencimento: '2026-10-05',
      pagador: { nome: 'A', documento: '1' }, descricao: 'd',
    });
    await adapter.gerarCobrancaPix!(ctx, { valor: 2 });
    assert.equal(chamadasToken, 1, 'token deve ser reutilizado do cache');
  });

  it('expiração −60 s: expires_in=60 → TTL zero → refaz token na próxima chamada', async () => {
    limparCacheTokens(ctx.integracaoId);
    let chamadasToken = 0;
    const http = async (url: string) => {
      if (url.includes('/api/oauth/token')) {
        chamadasToken += 1;
        return jsonRes(200, { access_token: `t${chamadasToken}`, expires_in: 60 });
      }
      return RESPOSTA_BOLETO();
    };
    const adapter = criarItauAdapter({ http });
    const input = {
      valor: 1, vencimento: '2026-10-05',
      pagador: { nome: 'A', documento: '1' }, descricao: 'd',
    };
    await adapter.gerarCobrancaBoleto!(ctx, input);
    await adapter.gerarCobrancaBoleto!(ctx, input);
    assert.equal(chamadasToken, 2, 'token com expires_in 60s expira imediatamente (−60s)');
  });

  it('produção usa host api.itau.com.br', async () => {
    limparCacheTokens('int-itau-prod');
    const { chamadas, http } = criarMock([RESPOSTA_TOKEN, RESPOSTA_BOLETO]);
    const adapter = criarItauAdapter({ http });
    await adapter.gerarCobrancaBoleto!({ ...ctx, integracaoId: 'int-itau-prod', ambiente: 'producao' }, {
      valor: 1, vencimento: '2026-10-05',
      pagador: { nome: 'A', documento: '1' }, descricao: 'd',
    });
    assert.ok(chamadas[0].url.startsWith('https://api.itau.com.br/api/oauth/token'));
    assert.ok(chamadas[1].url.startsWith('https://api.itau.com.br/itau-ep9-gat-cnab'));
  });

  it('falha OAuth2 lança erro sem vazar segredo', async () => {
    limparCacheTokens(ctx.integracaoId);
    const { http } = criarMock([() => jsonRes(401, { error: 'invalid_client', client_secret: 'csecret' })]);
    const adapter = criarItauAdapter({ http });
    await assert.rejects(
      adapter.gerarCobrancaBoleto!(ctx, {
        valor: 1, vencimento: '2026-10-05',
        pagador: { nome: 'A', documento: '1' }, descricao: 'd',
      }),
      (e: Error) => e.message.includes('401') && !e.message.includes('csecret'),
    );
  });
});

describe('itau — conciliação e status', () => {
  it('mapeia lançamentos do extrato para ConciliacaoMovimento', async () => {
    limparCacheTokens(ctx.integracaoId);
    const { http } = criarMock([
      RESPOSTA_TOKEN,
      () =>
        jsonRes(200, {
          movimentos: [
            { dataMovimento: '2026-09-01', valorLancamento: 1500.5, tipoLancamento: 'C', descricao: 'PIX RECEBIDO', idTransacao: 'E123', txid: 'TX9' },
            { dataMovimento: '2026-09-02', valorLancamento: -45.9, tipoLancamento: 'D', descricao: 'TARIFA', nsu: 'N77' },
          ],
        }),
    ]);
    const adapter = criarItauAdapter({ http });
    const movimentos = await adapter.listarConciliacao(ctx, { de: '2026-09-01', ate: '2026-09-30' });
    assert.equal(movimentos.length, 2);
    assert.deepEqual(movimentos[0], {
      idExterno: 'E123',
      data: '2026-09-01',
      tipo: 'credito',
      valor: 1500.5,
      descricao: 'PIX RECEBIDO',
      txid: 'TX9',
      raw: movimentos[0].raw,
    });
    assert.equal(movimentos[1].tipo, 'debito');
    assert.equal(movimentos[1].valor, 45.9);
  });

  it('status devolve saldo em sucesso e ok:false em falha', async () => {
    limparCacheTokens(ctx.integracaoId);
    const okMock = criarMock([RESPOSTA_TOKEN, () => jsonRes(200, { data: '2026-09-22', disponivel: 9876.54 })]);
    const adapterOk = criarItauAdapter({ http: okMock.http });
    const statusOk = await adapterOk.status(ctx);
    assert.equal(statusOk.ok, true);
    assert.deepEqual(statusOk.saldo, { data: '2026-09-22', disponivel: 9876.54 });

    limparCacheTokens(ctx.integracaoId);
    const falhaMock = criarMock([() => jsonRes(500, {})]);
    const adapterFalha = criarItauAdapter({ http: falhaMock.http });
    const statusFalha = await adapterFalha.status(ctx);
    assert.equal(statusFalha.ok, false);
    assert.ok(statusFalha.detalhe);
  });
});

describe('itau — mapeamentos puros e sanitização', () => {
  it('corpoBoleto/corpoPix refletem conta e input', () => {
    const boleto = corpoBoleto(ctx, {
      valor: 10,
      vencimento: '2026-11-01',
      pagador: { nome: 'P', documento: '2' },
      descricao: 'x',
      nossoNumero: 'NN1',
      faturaId: 'fat-1',
    }) as { beneficiario: Record<string, string>; boleto: Record<string, string>; tpamb: string };
    assert.equal(boleto.beneficiario.cnpj, '12345678000199');
    assert.equal(boleto.boleto.nossoNumero, 'NN1');
    assert.equal(boleto.boleto.seuNumero, 'fat-1');
    assert.equal(boleto.tpamb, 'T');

    const pix = corpoPix(ctx, { valor: 20, txid: 'TX', expiracaoSegundos: 3600 }) as {
      valor: { original: string };
      txid: string;
      calendario: { expiracao: number };
    };
    assert.equal(pix.valor.original, '20.00');
    assert.equal(pix.txid, 'TX');
    assert.equal(pix.calendario.expiracao, 3600);
  });

  it('sanitizarRaw remove segredos de respostas do banco', () => {
    const limpo = sanitizarRaw({
      access_token: 'SEGREDÃO',
      Authorization: 'Bearer x',
      outro: { api_key: 'k', senhaPfx: 's', ok: 1 },
      lista: [{ pfx: 'binário', valor: 2 }],
    });
    assert.equal(limpo.access_token, '[removido]');
    assert.equal(limpo.Authorization, '[removido]');
    const aninhado = limpo.outro as Record<string, unknown>;
    assert.equal(aninhado.api_key, '[removido]');
    assert.equal(aninhado.ok, 1);
    const item = (limpo.lista as { itens: Array<Record<string, unknown>> }).itens[0];
    assert.equal(item.pfx, '[removido]');
    assert.equal(item.valor, 2);
  });

  it('mapearMovimento tolera campos ausentes', () => {
    const m = mapearMovimento({ data: '2026-09-03', valor: '7,5', descricao: 'TED' });
    assert.equal(m.data, '2026-09-03');
    assert.equal(m.tipo, 'credito');
    assert.equal(m.valor, 7.5);
  });
});

describe('http-mtls — limpeza de recursos (achado P1 Reviewer)', () => {
  it('apagarPfxTemporario remove arquivo em os.tmpdir() e ignora caminhos fora dele', () => {
    const tmp = path.join(os.tmpdir(), `pfx-cleanup-test-${process.pid}.pfx`);
    fs.writeFileSync(tmp, 'conteudo-fake');
    apagarPfxTemporario(tmp);
    assert.equal(fs.existsSync(tmp), false, 'pfx temporário removido');

    const fora = path.join(process.cwd(), 'nao-apagar-fixture.pfx');
    fs.writeFileSync(fora, 'x');
    apagarPfxTemporario(fora);
    assert.equal(fs.existsSync(fora), true, 'arquivo fora do tmpdir não é tocado');
    fs.unlinkSync(fora);

    // caminho inexistente não lança (best-effort)
    apagarPfxTemporario(path.join(os.tmpdir(), 'inexistente-999.pfx'));
  });

  it('limparRecursosMtls/liberarAgenteMtls não lançam com estado vazio ou desconhecido', () => {
    limparCacheTokens();
    assert.doesNotThrow(() => liberarAgenteMtls('C:/caminho/desconhecido.pfx'));
    assert.doesNotThrow(() => limparRecursosMtls('int-x', 'C:/tmp/cert.pfx'));
    assert.doesNotThrow(() => limparRecursosMtls());
  });
});

describe('itau — cliente default', () => {
  it('clienteHttp usa cliente injetado quando presente', async () => {
    let chamou = false;
    const injetado = async () => {
      chamou = true;
      return { status: 200, ok: true, cabecalhos: {}, texto: '{}' };
    };
    const http = clienteHttp(ctx, injetado);
    await http('https://exemplo.invalid');
    assert.equal(chamou, true);
  });
});

describe('itau — obterTokenOAuth2 direto', () => {
  it('autenticação no corpo quando autenticacao=corpo', async () => {
    limparCacheTokens('int-itau-corpo');
    const { chamadas, http } = criarMock([RESPOSTA_TOKEN]);
    await obterTokenOAuth2(
      { integracaoId: 'int-itau-corpo', credenciais: { client_id: 'cid2', client_secret: 's2' } },
      { tokenUrl: 'https://t/token', autenticacao: 'corpo' },
      http,
    );
    assert.ok(!chamadas[0].headers.Authorization);
    assert.ok(chamadas[0].body!.includes('client_id=cid2'));
    assert.ok(chamadas[0].body!.includes('client_secret=s2'));
  });
});
