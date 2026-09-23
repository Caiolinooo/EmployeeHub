/**
 * Testes dos providers ABRASF 2.02/2.04: montagem XML determinística contra
 * fixtures + ciclo SOAP com HTTP mock (cert pfx gerado em memória — sem rede,
 * sem certificado real). Rodar: npx tsx --test src/lib/financeiro/nfse/abrasf.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as forge from 'node-forge';
import {
  extrairMensagensErro,
  extrairNfse,
  extrairTag,
  montarCancelarNfse,
  montarConsultarNfsePorRps,
  montarConsultarSituacaoLoteRps,
  montarEnvelopeSoap,
  montarLoteRps,
  montarRps,
  resolverCodigoCancelamento,
  situacaoLote,
  ufPorCodigoIbge,
  xmlEscape,
} from './abrasf/templates';
import { criarAbrasf202 } from './abrasf/abrasf202';
import { criarAbrasf204 } from './abrasf/abrasf204';
import type { NfseContext, NfseRpsInput } from './types';
import type { HttpClient, HttpRequestInit } from '../banks/http-mtls';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const CTX: NfseContext = {
  config: {
    nfseConfigId: 'cfg-1',
    empresaId: 'emp-1',
    municipioIbge: '3302403',
    providerKey: 'abrasf202',
    cnpj: '12345678000199',
    razaoSocial: 'ABZ PRESTADORA LTDA',
    inscricaoMunicipal: '123456',
    optanteSimples: false,
    incentivoFiscal: false,
    issRetidoPadrao: false,
    rpsSerie: '1',
    ambiente: 'homologacao',
    configExtra: { wsdl_url: 'https://nfse-mock.prefeitura.gov.br/ws' },
  },
  credenciais: {},
};

const INPUT: NfseRpsInput = {
  rpsNumero: 42,
  rpsSerie: '1',
  dataEmissao: '2026-09-22',
  competencia: '2026-09',
  tomador: {
    nome: 'CLIENTE MARITIMO LTDA',
    documento: '98765432000155',
    municipioIbge: '3304557',
    email: 'financeiro@cliente.com',
    endereco: {
      logradouro: 'AV BRASIL',
      numero: '1000',
      bairro: 'CENTRO',
      cep: '24000000',
    },
  },
  itens: [{ codigoLc116: '0107', descricao: 'CONSULTORIA', quantidade: 1, valorUnitario: 1500, tributavel: true }],
  valorServicos: 1500,
  aliquotaIss: 5,
  issRetido: false,
  discriminacao: 'Fatura 42/2026 - medição setembro',
};

const RPS_202 = `<Rps><InfDeclaracaoPrestacaoServico Id="rps42"><Rps><IdentificacaoRps><Numero>42</Numero><Serie>1</Serie><Tipo>1</Tipo></IdentificacaoRps><DataEmissao>2026-09-22</DataEmissao><Status>1</Status></Rps><Competencia>2026-09</Competencia><Servico><Valores><ValorServicos>1500.00</ValorServicos><Aliquota>5.00</Aliquota><ValorIss>75.00</ValorIss></Valores><IssRetido>2</IssRetido><ItemListaServico>0107</ItemListaServico><Discriminacao>Fatura 42/2026 - medição setembro</Discriminacao><CodigoMunicipio>3304557</CodigoMunicipio><ExigibilidadeISS>1</ExigibilidadeISS></Servico><Prestador><CpfCnpj><Cnpj>12345678000199</Cnpj></CpfCnpj><InscricaoMunicipal>123456</InscricaoMunicipal></Prestador><Tomador><IdentificacaoTomador><CpfCnpj><Cnpj>98765432000155</Cnpj></CpfCnpj></IdentificacaoTomador><RazaoSocial>CLIENTE MARITIMO LTDA</RazaoSocial><Endereco><Logradouro>AV BRASIL</Logradouro><Numero>1000</Numero><Bairro>CENTRO</Bairro><CodigoMunicipio>3304557</CodigoMunicipio><Uf>RJ</Uf><Cep>24000000</Cep></Endereco><Contato><Email>financeiro@cliente.com</Email></Contato></Tomador><OptanteSimplesNacional>2</OptanteSimplesNacional><IncentivoFiscal>2</IncentivoFiscal></InfDeclaracaoPrestacaoServico></Rps>`;

const RESPOSTA_RECEPCAO = `<?xml version="1.0"?><CompNfse><RecepcionarLoteRpsResposta><NumeroLote>42</NumeroLote><DataRecebimento>2026-09-22T10:00:00</DataRecebimento><Protocolo>PROT-9</Protocolo></RecepcionarLoteRpsResposta></CompNfse>`;
const RESPOSTA_SITUACAO_OK = `<ConsultarSituacaoLoteRpsResposta><NumeroLote>42</NumeroLote><Situacao><Codigo>2</Codigo></Situacao></ConsultarSituacaoLoteRpsResposta>`;
const RESPOSTA_SITUACAO_ERRO = `<ConsultarSituacaoLoteRpsResposta><Situacao><Codigo>3</Codigo></Situacao><MensagemRetorno><Codigo>E10</Codigo><Mensagem>Tomador inexistente</Mensagem></MensagemRetorno></ConsultarSituacaoLoteRpsResposta>`;
const RESPOSTA_NFSE = `<CompNfse><Nfse><InfNfse><Numero>777</Numero><CodigoVerificacao>CV-1</CodigoVerificacao><DataEmissao>2026-09-22</DataEmissao><Servico><Valores><ValorServicos>1500.00</ValorServicos><ValorIss>75.00</ValorIss></Valores></Servico></InfNfse></Nfse></CompNfse>`;
const RESPOSTA_CANCELAMENTO = `<CancelarNfseResposta><RetCancelamento><NfseCancelamento><Confirmacao><Sucesso>1</Sucesso><DataHora>2026-09-22T11:00:00</DataHora></Confirmacao></NfseCancelamento></RetCancelamento></CancelarNfseResposta>`;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function gerarPfxTemporario(): string {
  const chaves = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = chaves.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 3600_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 3600_000);
  const a = [{ name: 'commonName', value: 'TESTE ABRASF' }];
  cert.setSubject(a);
  cert.setIssuer(a);
  cert.sign(chaves.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(chaves.privateKey, cert, 'senha-fake');
  const caminho = path.join(os.tmpdir(), `pfx-abrasf-test-${process.pid}.pfx`);
  fs.writeFileSync(caminho, Buffer.from(forge.asn1.toDer(p12).data, 'binary'));
  return caminho;
}

interface Chamada { url: string; headers: Record<string, string>; body: string }

function mockSoap(respostas: string[]) {
  const chamadas: Chamada[] = [];
  const http: HttpClient = async (url: string, init?: HttpRequestInit) => {
    const indice = chamadas.length;
    chamadas.push({
      url,
      headers: init?.headers ?? {},
      body: String(init?.body ?? ''),
    });
    return {
      status: 200,
      ok: true,
      cabecalhos: { 'content-type': 'text/xml' },
      texto: respostas[Math.min(indice, respostas.length - 1)],
    };
  };
  return { chamadas, http };
}

/* ------------------------------------------------------------------ */
/* Montagem XML determinística                                         */
/* ------------------------------------------------------------------ */

describe('abrasf templates — montagem pura', () => {
  it('RPS 2.02 fixture determinística (valores, tomador, Uf derivada do IBGE)', () => {
    assert.equal(montarRps(202, CTX.config, { ...INPUT, tomador: { ...INPUT.tomador } }), RPS_202);
  });

  it('lote 2.02 e 2.04 diferem apenas no atributo versao', () => {
    const lote202 = montarLoteRps(202, { loteNumero: 42, cnpj: CTX.config.cnpj, inscricaoMunicipal: '123456', rpsXmls: ['<Rps/>'] });
    const lote204 = montarLoteRps(204, { loteNumero: 42, cnpj: CTX.config.cnpj, inscricaoMunicipal: '123456', rpsXmls: ['<Rps/>'] });
    assert.ok(lote202.includes('<LoteRps versao="2.02" Id="lote42">'));
    assert.ok(lote204.includes('<LoteRps versao="2.04" Id="lote42">'));
    assert.ok(lote202.includes('<QuantidadeRps>1</QuantidadeRps>'));
    assert.ok(lote202.startsWith('<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">'));
  });

  it('consultas e cancelamento 2.02 (sem pedido assinável)', () => {
    assert.equal(
      montarConsultarSituacaoLoteRps({ cnpj: '123', protocolo: 'P1' }),
      '<ConsultarSituacaoLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd"><Prestador><CpfCnpj><Cnpj>123</Cnpj></CpfCnpj></Prestador><Protocolo>P1</Protocolo></ConsultarSituacaoLoteRpsEnvio>',
    );
    assert.equal(
      montarConsultarNfsePorRps({ cnpj: '123', numero: 42, serie: '1' }),
      '<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd"><IdentificacaoRps><Numero>42</Numero><Serie>1</Serie><Tipo>1</Tipo></IdentificacaoRps><Prestador><CpfCnpj><Cnpj>123</Cnpj></CpfCnpj></Prestador></ConsultarNfseRpsEnvio>',
    );
    const cancel = montarCancelarNfse(202, { cnpj: '123', numeroNfse: '777', codigoCancelamento: '1' });
    assert.equal(cancel.idAssinavel, undefined);
    assert.ok(cancel.xml.includes('<NumeroNfse>777</NumeroNfse>'));
    assert.ok(cancel.xml.includes('<CodigoCancelamento>1</CodigoCancelamento>'));
  });

  it('cancelamento 2.04 devolve InfPedidoCancelamento com Id assinável', () => {
    const cancel = montarCancelarNfse(204, { cnpj: '123', numeroNfse: '777', codigoCancelamento: '2', motivo: 'erro de emissão' });
    assert.equal(cancel.idAssinavel, 'canc777');
    assert.ok(cancel.xml.includes('<InfPedidoCancelamento Id="canc777">'));
    assert.ok(cancel.xml.includes('<MotivoCancelamento>erro de emissão</MotivoCancelamento>'));
  });

  it('envelope SOAP escapa o payload quando configurado', () => {
    const cru = montarEnvelopeSoap('RecepcionarLoteRps', 'http://ns', '<a>1</a>', false);
    assert.ok(cru.includes('<RecepcionarLoteRps xmlns="http://ns"><a>1</a></RecepcionarLoteRps>'));
    const escapado = montarEnvelopeSoap('RecepcionarLoteRps', 'http://ns', '<a>1</a>', true);
    assert.ok(escapado.includes('&lt;a&gt;1&lt;/a&gt;'));
    assert.ok(escapado.startsWith('<?xml'));
  });

  it('escape e helpers de parsing de resposta', () => {
    assert.equal(xmlEscape('a<b>&"c"'), 'a&lt;b&gt;&amp;&quot;c&quot;');
    assert.equal(ufPorCodigoIbge('3302403'), 'RJ');
    assert.equal(ufPorCodigoIbge('3550308'), 'SP');
    assert.equal(situacaoLote(RESPOSTA_SITUACAO_OK), 'sucesso');
    assert.equal(situacaoLote(RESPOSTA_SITUACAO_ERRO), 'erro');
    assert.equal(situacaoLote('<Situacao><Codigo>1</Codigo></Situacao>'), 'processando');
    const nfse = extrairNfse(RESPOSTA_NFSE);
    assert.deepEqual(nfse, { numeroNfse: '777', codigoVerificacao: 'CV-1' });
    const erros = extrairMensagensErro(RESPOSTA_SITUACAO_ERRO);
    assert.deepEqual(erros, [{ codigo: 'E10', mensagem: 'Tomador inexistente' }]);
    assert.equal(extrairTag(RESPOSTA_RECEPCAO, 'Protocolo'), 'PROT-9');
  });
});

/* ------------------------------------------------------------------ */
/* Ciclo completo 2.02 (SOAP mock)                                     */
/* ------------------------------------------------------------------ */

describe('abrasf202 — ciclo com HTTP mock', () => {
  it('emitirRps assina o RPS e devolve protocolo', async () => {
    const pfxPath = gerarPfxTemporario();
    const { chamadas, http } = mockSoap([RESPOSTA_RECEPCAO]);
    const provider = criarAbrasf202({ http });
    const resultado = await provider.emitirRps(
      { ...CTX, certificado: { pfxPath, pfxPassphrase: 'senha-fake', fingerprint: 'fc1' } },
      INPUT,
    );
    assert.equal(resultado.ok, true);
    assert.equal(resultado.protocolo, 'PROT-9');
    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0].url, 'https://nfse-mock.prefeitura.gov.br/ws');
    assert.equal(chamadas[0].headers['Content-Type'], 'text/xml;charset=utf-8');
    // Lote escapado dentro da operação SOAP + assinatura presente:
    assert.ok(chamadas[0].body.includes('<RecepcionarLoteRps xmlns="http://www.abrasf.org.br/nfse.xsd">'));
    assert.ok(chamadas[0].body.includes('&lt;Signature'));
    // pfx temporário já removido pelo adapter (apagarPfxTemporario)
  });

  it('emitirRps sem certificado devolve erro tipado certificado_ausente', async () => {
    const { http } = mockSoap([]);
    const provider = criarAbrasf202({ http });
    const resultado = await provider.emitirRps(CTX, INPUT);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.erro?.codigo, 'certificado_ausente');
  });

  it('consultar: processando → nao_encontrado; sucesso → autorizado com número', async () => {
    const { http } = mockSoap([RESPOSTA_SITUACAO_ERRO]);
    const provider = criarAbrasf202({ http });
    const rejeitado = await provider.consultar(CTX, { protocolo: 'PROT-9' });
    assert.equal(rejeitado.situacao, 'rejeitado');
    assert.equal(rejeitado.erro?.codigo, 'E10');

    const { chamadas: c2, http: h2 } = mockSoap([RESPOSTA_SITUACAO_OK, RESPOSTA_NFSE]);
    const autorizado = await criarAbrasf202({ http: h2 }).consultar(CTX, { protocolo: 'PROT-9', rpsNumero: 42, rpsSerie: '1' });
    assert.equal(autorizado.situacao, 'autorizado');
    assert.equal(autorizado.numeroNfse, '777');
    assert.equal(autorizado.codigoVerificacao, 'CV-1');
    assert.equal(c2.length, 2, 'situacao + nfse por rps');
    assert.ok(c2[1].body.includes('<ConsultarNfsePorRps'));
  });

  it('cancelar 2.02 confirma via Sucesso=1 e devolve xml do pedido', async () => {
    const { http } = mockSoap([RESPOSTA_CANCELAMENTO]);
    const provider = criarAbrasf202({ http });
    const resultado = await provider.cancelar(CTX, { numeroNfse: '777', codigoCancelamento: '1', motivo: 'duplicidade' });
    assert.equal(resultado.ok, true);
    assert.ok(resultado.xmlCancelamento!.includes('<NumeroNfse>777</NumeroNfse>'));
  });

  it('cancelar sem codigoCancelamento resolve para código 1 (nunca tag vazia/ausente)', async () => {
    const { http } = mockSoap([RESPOSTA_CANCELAMENTO]);
    const resultado = await criarAbrasf202({ http }).cancelar(CTX, { numeroNfse: '777', codigoCancelamento: '' });
    assert.equal(resultado.ok, true);
    assert.ok(resultado.xmlCancelamento!.includes('<CodigoCancelamento>1</CodigoCancelamento>'));
    assert.equal(
      resolverCodigoCancelamento(undefined),
      '1',
    );
    assert.equal(resolverCodigoCancelamento('5'), '5', 'código informado é preservado');
  });

  it('emitirRps com rejeição mapeia MensagemRetorno', async () => {
    const pfxPath = gerarPfxTemporario();
    const respostaErro = '<RecepcionarLoteRpsResposta><NumeroLote>42</NumeroLote><MensagemRetorno><Codigo>E17</Codigo><Mensagem>Discriminacao obrigatoria</Mensagem></MensagemRetorno></RecepcionarLoteRpsResposta>';
    const { http } = mockSoap([respostaErro]);
    const provider = criarAbrasf202({ http });
    const resultado = await provider.emitirRps(
      { ...CTX, certificado: { pfxPath, pfxPassphrase: 'senha-fake', fingerprint: 'fc1' } },
      INPUT,
    );
    assert.equal(resultado.ok, false);
    assert.deepEqual(resultado.erro, { codigo: 'E17', mensagem: 'Discriminacao obrigatoria' });
    // pfx temporário já removido pelo adapter (apagarPfxTemporario)
  });

  it('URL por ambiente via configExtra.ambiente_urls quando não há wsdl_url', async () => {
    const pfxPath = gerarPfxTemporario();
    const ctxSemWsdl: NfseContext = {
      ...CTX,
      certificado: { pfxPath, pfxPassphrase: 'senha-fake', fingerprint: 'fc1' },
      config: {
        ...CTX.config,
        configExtra: { ambiente_urls: { homologacao: 'https://hom.prefeitura.gov.br/ws', producao: 'https://prod.prefeitura.gov.br/ws' } },
      },
    };
    const { chamadas, http } = mockSoap([RESPOSTA_RECEPCAO]);
    await criarAbrasf202({ http }).emitirRps(ctxSemWsdl, INPUT);
    assert.equal(chamadas[0].url, 'https://hom.prefeitura.gov.br/ws');
    // pfx temporário já removido pelo adapter (apagarPfxTemporario)
  });
});

/* ------------------------------------------------------------------ */
/* Ciclo 2.04 (cancelamento assinado)                                  */
/* ------------------------------------------------------------------ */

describe('abrasf204 — cancelamento com InfPedidoCancelamento assinado', () => {
  it('cancelar assina o pedido e confirma cancelamento', async () => {
    const pfxPath = gerarPfxTemporario();
    const { chamadas, http } = mockSoap([RESPOSTA_CANCELAMENTO]);
    const provider = criarAbrasf204({ http });
    const resultado = await provider.cancelar(
      { ...CTX, certificado: { pfxPath, pfxPassphrase: 'senha-fake', fingerprint: 'fc2' } },
      { numeroNfse: '777', codigoCancelamento: '2', motivo: 'erro de valor' },
    );
    assert.equal(resultado.ok, true);
    assert.ok(resultado.xmlCancelamento!.includes('<InfPedidoCancelamento Id="canc777">'));
    assert.ok(resultado.xmlCancelamento!.includes('<Signature'), 'pedido 2.04 vai assinado (xml cru)');
    assert.ok(chamadas[0].body.includes('&lt;Signature'), 'SOAP carrega o pedido assinado escapado');
    assert.ok(chamadas[0].body.includes('<CancelarNfse'));
    // pfx temporário já removido pelo adapter (apagarPfxTemporario)
  });

  it('cancelar 2.04 sem certificado falha com mensagem clara', async () => {
    const { http } = mockSoap([RESPOSTA_CANCELAMENTO]);
    const resultado = await criarAbrasf204({ http }).cancelar(CTX, { numeroNfse: '777', codigoCancelamento: '2' });
    assert.equal(resultado.ok, false);
    assert.match(resultado.erro!.mensagem, /Certificado A1/);
  });

  it('meta e key da variante 2.04', () => {
    const provider = criarAbrasf204();
    assert.equal(provider.key, 'abrasf204');
    assert.equal(provider.meta.exigeCertificadoA1, true);
    assert.match(provider.meta.descricao, /2\.04/);
  });
});
