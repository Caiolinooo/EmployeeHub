/**
 * Testes do provider NFS-e Padrão Nacional (ADN) com fetch mock (sem rede).
 * Rodar: npx tsx --test src/lib/financeiro/nfse/nacional.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarNacionalProvider, montarDps, NACIONAL_META } from './nacional';
import type { NfseContext, NfseRpsInput } from './types';
import type { HttpClient, HttpRequestInit } from '../banks/http-mtls';

const CTX: NfseContext = {
  config: {
    nfseConfigId: 'cfg-nac',
    empresaId: 'emp-1',
    municipioIbge: '3302403',
    providerKey: 'nacional',
    cnpj: '12345678000199',
    razaoSocial: 'ABZ LTDA',
    inscricaoMunicipal: '98765',
    optanteSimples: false,
    incentivoFiscal: false,
    issRetidoPadrao: false,
    rpsSerie: '1',
    ambiente: 'homologacao',
    configExtra: {},
  },
  credenciais: {},
  certificado: { pfxPath: 'C:/tmp/fake.pfx', pfxPassphrase: 'x', fingerprint: 'ff' },
};

const INPUT: NfseRpsInput = {
  rpsNumero: 7,
  rpsSerie: '1',
  dataEmissao: '2026-09-22',
  competencia: '2026-09',
  tomador: {
    nome: 'TOMADOR LTDA',
    documento: '98765432000155',
    municipioIbge: '3304557',
    email: 'a@b.com',
    endereco: { logradouro: 'R X', numero: '10', bairro: 'CENTRO', cep: '24000-000' },
  },
  itens: [{ codigoLc116: '010701', descricao: 'SERV', quantidade: 2, valorUnitario: 100, tributavel: true }],
  valorServicos: 200,
  aliquotaIss: 2,
  issRetido: false,
  discriminacao: 'Medição 09/2026',
};

interface Chamada { url: string; method: string; headers: Record<string, string>; body?: string }

function mockJson(respostas: Array<(c: Chamada) => { status: number; texto: string }>) {
  const chamadas: Chamada[] = [];
  const http: HttpClient = async (url: string, init?: HttpRequestInit) => {
    const c: Chamada = {
      url,
      method: init?.method ?? 'GET',
      headers: init?.headers ?? {},
      body: init?.body !== undefined ? String(init.body) : undefined,
    };
    chamadas.push(c);
    const r = respostas[Math.min(chamadas.length - 1, respostas.length - 1)](c);
    return { status: r.status, ok: r.status >= 200 && r.status < 300, cabecalhos: {}, texto: r.texto };
  };
  return { chamadas, http };
}

describe('nacional — montarDps (leiaute JSON)', () => {
  it('mapeia RPS para DPS com tpAmb, prest, toma, serv e valores', () => {
    const dps = montarDps(CTX, INPUT) as {
      dps: {
        tpAmb: string; nDps: number; dCompet: string;
        prest: { CNPJ: string; IM: string };
        toma: { CNPJ: string; xNome: string; end: { cMun: string; CEP: string } };
        serv: { cServ: { cTribNac: string }; iss: { tribISS: string } };
        valores: { vServP: number; pAliq: number; vISSRet: number };
      };
    };
    assert.equal(dps.dps.tpAmb, '2'); // homologação
    assert.equal(dps.dps.nDps, 7);
    assert.equal(dps.dps.dCompet, '2026-09');
    assert.equal(dps.dps.prest.CNPJ, '12345678000199');
    assert.equal(dps.dps.toma.CNPJ, '98765432000155');
    assert.equal(dps.dps.toma.end.cMun, '3304557');
    assert.equal(dps.dps.toma.end.CEP, '24000000');
    assert.equal(dps.dps.serv.cServ.cTribNac, '010701');
    assert.equal(dps.dps.serv.iss.tribISS, '4'); // não retido
    assert.equal(dps.dps.valores.vServP, 200);
    assert.equal(dps.dps.valores.pAliq, 2);
    assert.equal(dps.dps.valores.vISSRet, 0);
  });

  it('ISS retido marca tribISS=1 e vISSRet>0; produção usa tpAmb=1', () => {
    const dps = montarDps(
      { ...CTX, config: { ...CTX.config, ambiente: 'producao' } },
      { ...INPUT, issRetido: true },
    ) as { dps: { tpAmb: string; serv: { iss: { tribISS: string } }; valores: { vISSRet: number } } };
    assert.equal(dps.dps.tpAmb, '1');
    assert.equal(dps.dps.serv.iss.tribISS, '1');
    assert.equal(dps.dps.valores.vISSRet, 4);
  });
});

describe('nacional — provider REST (HTTP mock)', () => {
  it('emitirRps POST no ADN de homologação e devolve recibo', async () => {
    const { chamadas, http } = mockJson([
      () => ({ status: 200, texto: JSON.stringify({ recibo: 'REC-1', numero: '2026/0007', codigoVerificacao: 'CV9' }) }),
    ]);
    const resultado = await criarNacionalProvider({ http }).emitirRps(CTX, INPUT);
    assert.equal(resultado.ok, true);
    assert.equal(resultado.protocolo, 'REC-1');
    assert.equal(resultado.numeroNfse, '2026/0007');
    assert.equal(chamadas[0].url, 'https://adn.tst.nfse.gov.br/api/dps');
    assert.equal(chamadas[0].method, 'POST');
    assert.ok((chamadas[0].body ?? '').includes('"nDps":7'));
    assert.ok(chamadas[0].headers['Content-Type'].includes('application/json'));
  });

  it('produção usa adn.nfse.gov.br e override base_url tem precedência', async () => {
    const { chamadas, http } = mockJson([
      () => ({ status: 200, texto: JSON.stringify({ recibo: 'R2' }) }),
      () => ({ status: 200, texto: JSON.stringify({ recibo: 'R3' }) }),
    ]);
    const provider = criarNacionalProvider({ http });
    await provider.emitirRps({ ...CTX, config: { ...CTX.config, ambiente: 'producao' } }, INPUT);
    assert.equal(chamadas[0].url, 'https://adn.nfse.gov.br/api/dps');
    await provider.emitirRps(
      { ...CTX, config: { ...CTX.config, configExtra: { base_url: 'https://adn-parceiro.example' } } },
      INPUT,
    );
    assert.equal(chamadas[1].url, 'https://adn-parceiro.example/api/dps');
  });

  it('consulta por recibo faz GET em /api/nfse/recibos e mapeia situação', async () => {
    const { chamadas, http } = mockJson([
      () => ({ status: 200, texto: JSON.stringify({ situacao: 'AUTORIZADA', numero: '2026/0007', codigoVerificacao: 'CV9' }) }),
    ]);
    const resultado = await criarNacionalProvider({ http }).consultar(CTX, { protocolo: 'REC-1' });
    assert.equal(resultado.ok, true);
    assert.equal(resultado.situacao, 'autorizado');
    assert.equal(resultado.numeroNfse, '2026/0007');
    assert.equal(chamadas[0].url, 'https://adn.tst.nfse.gov.br/api/nfse/recibos?recibo=REC-1');
  });

  it('cancelamento POST /api/nfse/cancelamento', async () => {
    const { chamadas, http } = mockJson([
      () => ({ status: 200, texto: JSON.stringify({ cancelada: true }) }),
    ]);
    const resultado = await criarNacionalProvider({ http }).cancelar(CTX, {
      numeroNfse: '2026/0007',
      codigoCancelamento: '1',
      motivo: 'erro de valor',
    });
    assert.equal(resultado.ok, true);
    assert.equal(chamadas[0].url, 'https://adn.tst.nfse.gov.br/api/nfse/cancelamento');
    assert.ok(chamadas[0].body!.includes('"numeroNfse":"2026/0007"'));
  });

  it('cancelamento sem código resolve para 1 no corpo do pedido', async () => {
    const { chamadas, http } = mockJson([
      () => ({ status: 200, texto: JSON.stringify({ cancelada: true }) }),
    ]);
    await criarNacionalProvider({ http }).cancelar(CTX, { numeroNfse: '2026/0007', codigoCancelamento: '' });
    assert.ok(chamadas[0].body!.includes('"codigoCancelamento":"1"'));
  });

  it('rejeição HTTP mapeia erro sem vazar credenciais', async () => {
    const { http } = mockJson([
      () => ({ status: 422, texto: JSON.stringify({ codigo: 'E99', mensagem: 'cTribNac inválido', Authorization: 'Bearer x' }) }),
    ]);
    const resultado = await criarNacionalProvider({ http }).emitirRps(CTX, INPUT);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.erro?.codigo, 'E99');
    const raw = resultado.raw as Record<string, unknown>;
    assert.equal(raw.Authorization, '[removido]');
  });

  it('sem certificado devolve erro claro', async () => {
    const { http } = mockJson([]);
    const resultado = await criarNacionalProvider({ http }).emitirRps({ ...CTX, certificado: undefined }, INPUT);
    assert.equal(resultado.ok, false);
    assert.match(resultado.erro!.mensagem, /Certificado A1/);
  });

  it('meta: exige certificado A1', () => {
    assert.equal(NACIONAL_META.exigeCertificadoA1, true);
  });
});
