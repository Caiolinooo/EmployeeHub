/**
 * Testes do provider 'proprietário' genérico + config default Macaé (3302403),
 * com fetch mock (sem rede). Rodar: npx tsx --test src/lib/financeiro/nfse/proprietario.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cabecalhosAutenticacao,
  criarProprietario,
  interpretarResposta,
  renderTemplate,
  resolverConfigMunicipio,
} from './proprietario';
import { MACAE_CODIGO_IBGE, MACAE_CONFIG } from './municipios/macae';
import type { NfseContext, NfseRpsInput } from './types';
import type { HttpClient, HttpRequestInit } from '../banks/http-mtls';

const CTX_BASE: NfseContext = {
  config: {
    nfseConfigId: 'cfg-mac',
    empresaId: 'emp-1',
    municipioIbge: MACAE_CODIGO_IBGE,
    providerKey: 'proprietario',
    cnpj: '12345678000199',
    razaoSocial: 'ABZ LTDA',
    inscricaoMunicipal: '555',
    optanteSimples: true,
    incentivoFiscal: false,
    issRetidoPadrao: false,
    rpsSerie: '9',
    ambiente: 'homologacao',
    configExtra: {},
  },
  credenciais: { usuario: 'prefeitura-user', senha: 'prefeitura-pass' },
};

const INPUT: NfseRpsInput = {
  rpsNumero: 3,
  rpsSerie: '9',
  dataEmissao: '2026-09-22',
  competencia: '2026-09',
  tomador: { nome: 'TOMADOR', documento: '12345678909', municipioIbge: '3304557' },
  itens: [{ codigoLc116: '0107', descricao: 'SERVICO', quantidade: 1, valorUnitario: 500, tributavel: true }],
  valorServicos: 500,
  aliquotaIss: 3,
  issRetido: false,
  discriminacao: 'Fat 3',
};

interface Chamada { url: string; method: string; headers: Record<string, string>; body: string }

function mock(respostas: string[]) {
  const chamadas: Chamada[] = [];
  const http: HttpClient = async (url: string, init?: HttpRequestInit) => {
    const indice = chamadas.length;
    chamadas.push({
      url,
      method: init?.method ?? 'GET',
      headers: init?.headers ?? {},
      body: String(init?.body ?? ''),
    });
    return { status: 200, ok: true, cabecalhos: {}, texto: respostas[Math.min(indice, respostas.length - 1)] };
  };
  return { chamadas, http };
}

describe('proprietario — configuração do município', () => {
  it('Macaé 3302403 usa a config default concreta (§5.1)', () => {
    const cfg = resolverConfigMunicipio(CTX_BASE);
    assert.equal(cfg.municipioIbge, MACAE_CODIGO_IBGE);
    assert.equal(cfg.nomeMunicipio, 'Macaé');
    assert.equal(cfg.authTipo, MACAE_CONFIG.authTipo);
    assert.ok(cfg.templates.emitir.includes('{{rps_xml}}'));
    assert.equal(cfg.urls.homologacao.length > 0, true);
  });

  it('município sem templates nem config lança erro claro', () => {
    assert.throws(
      () => resolverConfigMunicipio({ ...CTX_BASE, config: { ...CTX_BASE.config, municipioIbge: '9999999' } }),
      /sem templates/i,
    );
  });

  it('configExtra sobrepõe templates/urls/auth do município', () => {
    const ctx: NfseContext = {
      ...CTX_BASE,
      config: {
        ...CTX_BASE.config,
        municipioIbge: '9999999',
        configExtra: {
          authTipo: 'token',
          templates: { emitir: '<E>{{rps_numero}}/>', consultar: '<C/>', cancelar: '<X/>' },
          ambiente_urls: { homologacao: 'https://hom.mun.gov/ws', producao: 'https://prod.mun.gov/ws' },
        },
      },
      credenciais: { token: 'tok-1' },
    };
    const cfg = resolverConfigMunicipio(ctx);
    assert.equal(cfg.authTipo, 'token');
    assert.ok(cfg.templates.emitir.includes('{{rps_numero}}'));
    const cab = cabecalhosAutenticacao(cfg, ctx.credenciais);
    assert.deepEqual(cab, { Authorization: 'tok-1' });
  });
});

describe('proprietario — autenticação', () => {
  it('basic usa Base64 usuario:senha; token usa header configurado', () => {
    const basic = cabecalhosAutenticacao(
      { ...MACAE_CONFIG, authTipo: 'basic' } as never,
      { usuario: 'u', senha: 'p' },
    );
    assert.equal(basic.Authorization, `Basic ${Buffer.from('u:p').toString('base64')}`);

    const token = cabecalhosAutenticacao(
      { ...MACAE_CONFIG, authTipo: 'token', authHeaderToken: 'X-Token', authPrefixoToken: 'Bearer ' } as never,
      { token: 'abc' },
    );
    assert.deepEqual(token, { 'X-Token': 'Bearer abc' });

    assert.deepEqual(cabecalhosAutenticacao({ ...MACAE_CONFIG, authTipo: 'none' } as never, {}), {});

    assert.throws(
      () => cabecalhosAutenticacao({ ...MACAE_CONFIG, authTipo: 'token' } as never, {}),
      /credencial token ausente/i,
    );
  });
});

describe('proprietario — template e interpretação', () => {
  it('renderTemplate substitui e deixa vazio o ausente', () => {
    assert.equal(renderTemplate('<n>{{a}}</n><m>{{falta}}</m>', { a: 7 }), '<n>7</n><m></m>');
  });

  it('interpretarResposta aceita JSON e XML municipais', () => {
    const json = interpretarResposta('{"numero_nfse":"123","codigo_verificacao":"AB1","status":"AUTORIZADO"}');
    assert.equal(json.numeroNfse, '123');
    assert.equal(json.situacao, 'AUTORIZADO');

    const xml = interpretarResposta('<Resposta><NumeroNfse>55</NumeroNfse><MensagemRetorno>Motivo qualquer</MensagemRetorno></Resposta>');
    assert.equal(xml.numeroNfse, '55');
    assert.equal(xml.erro?.mensagem, 'Motivo qualquer');
  });
});

describe('proprietario — ciclo com HTTP mock (Macaé default)', () => {
  it('emitirRps monta template com placeholders e devolve número', async () => {
    const { chamadas, http } = mock([
      '<Resposta><NumeroNfse>8080</NumeroNfse><CodigoVerificacao>CV2</CodigoVerificacao></Resposta>',
    ]);
    const resultado = await criarProprietario({ http }).emitirRps(CTX_BASE, INPUT);
    assert.equal(resultado.ok, true);
    assert.equal(resultado.numeroNfse, '8080');
    assert.equal(resultado.codigoVerificacao, 'CV2');
    const corpo = chamadas[0].body;
    assert.ok(corpo.includes('<Numero>3</Numero>'));
    assert.ok(corpo.includes('<Serie>9</Serie>'));
    assert.ok(corpo.includes('<Cnpj>12345678000199</Cnpj>'));
    assert.ok(corpo.includes('<InscricaoMunicipal>555</InscricaoMunicipal>'));
    assert.ok(corpo.includes('<Cpf>12345678909</Cpf>')); // tomador CPF (11 dígitos)
    assert.ok(corpo.includes('<ValorServicos>500.00</ValorServicos>'));
    assert.ok(corpo.includes('<IssRetido>2</IssRetido>'));
    assert.ok(corpo.includes('<OptanteSimplesNacional>1</OptanteSimplesNacional>'));
    assert.equal(chamadas[0].headers['Content-Type'], 'application/xml');
    // SPE Macaé autentica por A1 (mTLS), não por usuário/senha:
    assert.equal(chamadas[0].headers.Authorization, undefined);
    assert.ok(chamadas[0].url.startsWith('https://macaehomologacao.nfe.com.br'));
  });

  it('wsdl_url da empresa sobrepõe a URL default', async () => {
    const { chamadas, http } = mock(['<Resposta><NumeroNfse>1</NumeroNfse></Resposta>']);
    await criarProprietario({ http }).emitirRps(
      { ...CTX_BASE, config: { ...CTX_BASE.config, configExtra: { wsdl_url: 'https://portal.prefeitura/ws' } } },
      INPUT,
    );
    assert.equal(chamadas[0].url, 'https://portal.prefeitura/ws');
  });

  it('resposta sem número nem protocolo → erro', async () => {
    const { http } = mock(['<Resposta><Vazio/></Resposta>']);
    const resultado = await criarProprietario({ http }).emitirRps(CTX_BASE, INPUT);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.erro?.codigo, 'sem_resposta');
  });

  it('consultar mapeia situação autorizado/cancelado', async () => {
    const ok = mock(['<Resposta><Situacao>AUTORIZADO</Situacao><NumeroNfse>8080</NumeroNfse></Resposta>']);
    const autorizado = await criarProprietario({ http: ok.http }).consultar(CTX_BASE, { rpsNumero: 3, rpsSerie: '9' });
    assert.equal(autorizado.situacao, 'autorizado');
    assert.equal(autorizado.numeroNfse, '8080');
    assert.ok(ok.chamadas[0].body.includes('<Numero>3</Numero>'));

    const cancel = mock(['<Resposta><Situacao>CANCELADO</Situacao><NumeroNfse>8080</NumeroNfse></Resposta>']);
    const cancelado = await criarProprietario({ http: cancel.http }).consultar(CTX_BASE, { numeroNfse: '8080' });
    assert.equal(cancelado.situacao, 'cancelado');
  });

  it('cancelar confirma via Sucesso=1 e devolve o xml enviado', async () => {
    const { chamadas, http } = mock(['<Resposta><Sucesso>1</Sucesso></Resposta>']);
    const resultado = await criarProprietario({ http }).cancelar(CTX_BASE, {
      numeroNfse: '8080',
      codigoCancelamento: '1',
      motivo: 'duplicidade',
    });
    assert.equal(resultado.ok, true);
    assert.ok(resultado.xmlCancelamento!.includes('<NumeroNfse>8080</NumeroNfse>'));
    assert.ok(resultado.xmlCancelamento!.includes('<CodigoCancelamento>1</CodigoCancelamento>'));
    assert.ok(/macaehomologacao\.nfe\.com\.br|spe\.macae\.rj\.gov\.br/.test(chamadas[0].url));
  });

  it('cancelar sem código de cancelamento resolve para 1', async () => {
    const { http } = mock(['<Resposta><Sucesso>1</Sucesso></Resposta>']);
    const resultado = await criarProprietario({ http }).cancelar(CTX_BASE, {
      numeroNfse: '8080',
      codigoCancelamento: '',
      motivo: 'x',
    });
    assert.equal(resultado.ok, true);
    assert.ok(resultado.xmlCancelamento!.includes('<CodigoCancelamento>1</CodigoCancelamento>'));
  });

  it('produção usa URL de produção de Macaé', async () => {
    const { chamadas, http } = mock(['<Resposta><NumeroNfse>9</NumeroNfse></Resposta>']);
    await criarProprietario({ http }).emitirRps(
      { ...CTX_BASE, config: { ...CTX_BASE.config, ambiente: 'producao' } },
      INPUT,
    );
    assert.ok(chamadas[0].url.startsWith('https://spe.macae.rj.gov.br'));
  });
});
