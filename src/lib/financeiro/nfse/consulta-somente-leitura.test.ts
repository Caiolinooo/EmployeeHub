/**
 * Testes da consulta NFS-e somente-leitura — sem rede, sem emissão.
 * Rodar: npx tsx --test src/lib/financeiro/nfse/consulta-somente-leitura.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compararComTemplate,
  garantirOperacaoSomenteLeitura,
  inventariarTags,
  envelopesConsultaPrestado,
  montarPedidoConsultaPrestado,
  parsearNotasCompNfse,
  partirPeriodoEmJanelas,
} from './consulta-somente-leitura';

describe('consulta-somente-leitura', () => {
  it('bloqueia emitir/cancelar/substituir', () => {
    for (const op of ['RecepcionarLoteRps', 'GerarNfse', 'CancelarNfse', 'SubstituirNfse', 'EnviarLoteRpsSincrono']) {
      assert.throws(() => garantirOperacaoSomenteLeitura(op), /bloqueada/i);
    }
  });

  it('libera só operações de consulta', () => {
    assert.doesNotThrow(() => garantirOperacaoSomenteLeitura('ConsultarNfseServicoPrestado'));
    assert.doesNotThrow(() => garantirOperacaoSomenteLeitura('ConsultarNfsePorRps'));
  });

  it('envelope ABRASF 2.03 de consulta por período (sem tags de emissão)', () => {
    const { operacao, envelope } = montarPedidoConsultaPrestado({
      cnpj: '12.345.678/0001-99',
      inscricaoMunicipal: '123456',
      dataInicial: '2026-01-01',
      dataFinal: '2026-03-31',
      pagina: 1,
    });
    assert.equal(operacao, 'ConsultarNfseServicoPrestado');
    assert.match(envelope, /ConsultarNfseServicoPrestadoRequest/);
    assert.match(envelope, /ConsultarNfseServicoPrestadoEnvio/);
    assert.match(envelope, /xmlns:tns="http:\/\/nfse\.abrasf\.org\.br\/"/);
    assert.match(envelope, /&lt;versaoDados&gt;2\.03&lt;\/versaoDados&gt;/);
    assert.match(envelope, /&lt;Cnpj&gt;12345678000199&lt;\/Cnpj&gt;/);
    assert.match(envelope, /&lt;DataInicial&gt;2026-01-01&lt;\/DataInicial&gt;/);
    assert.match(envelope, /&lt;DataFinal&gt;2026-03-31&lt;\/DataFinal&gt;/);
    assert.equal(/Recepcionar|GerarNfse|Cancelar/i.test(envelope), false);
    const variantes = envelopesConsultaPrestado({
      cnpj: '12345678000199',
      dataInicial: '2026-01-01',
      dataFinal: '2026-03-31',
    });
    assert.ok(variantes.some((v) => v.envelope.includes('nfseCabecMsg') && v.envelope.includes('nfseDadosMsg')));
    for (const v of variantes) {
      assert.equal(/Recepcionar|GerarNfse|Cancelar/i.test(v.envelope), false);
      assert.match(v.envelope, /tns:ConsultarNfseServicoPrestadoRequest/);
    }
  });

  it('parte período em janelas de 30 dias (limite X135 da SPE)', () => {
    const janelas = partirPeriodoEmJanelas('2026-01-01', '2026-03-02');
    assert.equal(janelas[0].ate, '2026-03-02');
    assert.equal(janelas[0].de, '2026-02-01');
    assert.ok(janelas.every((j) => {
      const d = (Date.parse(`${j.ate}T00:00:00Z`) - Date.parse(`${j.de}T00:00:00Z`)) / 86400000;
      return d <= 29;
    }));
    assert.equal(janelas.at(-1)?.de, '2026-01-01');
  });

  it('parseia CompNfse realista e inventaria tags', () => {
    const xml = `<?xml version="1.0"?><ConsultarNfseServicoPrestadoResposta>
      <ListaNfse><CompNfse><Nfse><InfNfse>
        <Numero>8801</Numero><CodigoVerificacao>AB12CD</CodigoVerificacao>
        <DataEmissao>2026-02-10</DataEmissao><Competencia>2026-02</Competencia>
        <Servico><Valores><ValorServicos>1500.00</ValorServicos><Aliquota>5.00</Aliquota></Valores>
        <ItemListaServico>17.05</ItemListaServico>
        <CodigoTributacaoMunicipio>1705</CodigoTributacaoMunicipio>
        <Discriminacao>Medição fevereiro</Discriminacao>
        <CodigoMunicipio>3302403</CodigoMunicipio>
        <ExigibilidadeISS>1</ExigibilidadeISS><IssRetido>2</IssRetido>
        </Servico>
        <TomadorServico><RazaoSocial>FMS LTD</RazaoSocial>
          <IdentificacaoTomador><CpfCnpj><Cnpj>99888777000166</Cnpj></CpfCnpj></IdentificacaoTomador>
        </TomadorServico>
      </InfNfse></Nfse></CompNfse></ListaNfse>
    </ConsultarNfseServicoPrestadoResposta>`;
    const notas = parsearNotasCompNfse(xml);
    assert.equal(notas.length, 1);
    assert.equal(notas[0].numeroNfse, '8801');
    assert.equal(notas[0].codigoVerificacao, 'AB12CD');
    assert.equal(notas[0].itemListaServico, '17.05');
    assert.equal(notas[0].codigoTributacaoMunicipio, '1705');
    assert.equal(notas[0].tomadorNome, 'FMS LTD');
    assert.equal(notas[0].tomadorDocumento, '99888777000166');
    const tags = inventariarTags(xml);
    assert.ok(tags.includes('CodigoTributacaoMunicipio'));
    const diff = compararComTemplate(tags);
    assert.ok(diff.noRealAusenteNoNosso.includes('TomadorServico'));
  });

  it('extrai tomador da declaração, não o prestador, e ignora tags da resposta municipal', () => {
    const xml = `<CompNfse><Nfse versao="2.03"><InfNfse>
      <Numero>1413</Numero><CodigoVerificacao>HQUHSCPX</CodigoVerificacao>
      <PrestadorServico><RazaoSocial>PRESTADOR ABZ LTDA</RazaoSocial>
        <IdentificacaoPrestador><CpfCnpj><Cnpj>11111111000111</Cnpj></CpfCnpj></IdentificacaoPrestador>
      </PrestadorServico>
      <DeclaracaoPrestacaoServico><InfDeclaracaoPrestacaoServico>
        <Rps><IdentificacaoRps><Numero>1413</Numero><Serie>1</Serie></IdentificacaoRps></Rps>
        <Servico><Valores><ValorServicos>6880</ValorServicos><ValorIss>258</ValorIss><Aliquota>3.75</Aliquota></Valores>
          <ItemListaServico>17.01</ItemListaServico><CodigoCnae>7020400</CodigoCnae>
          <CodigoTributacaoMunicipio>17.01</CodigoTributacaoMunicipio><CodigoNbs>114011300</CodigoNbs>
          <ExigibilidadeISS>1</ExigibilidadeISS>
        </Servico>
        <Tomador><IdentificacaoTomador><CpfCnpj><Cnpj>22222222000122</Cnpj></CpfCnpj></IdentificacaoTomador>
          <RazaoSocial>CLIENTE BRASIL LTDA</RazaoSocial>
        </Tomador>
      </InfDeclaracaoPrestacaoServico></DeclaracaoPrestacaoServico>
      <ChaveADN>CHAVE-TESTE</ChaveADN>
    </InfNfse></Nfse></CompNfse>`;
    const notas = parsearNotasCompNfse(xml);
    assert.equal(notas[0].tomadorNome, 'CLIENTE BRASIL LTDA');
    assert.equal(notas[0].tomadorDocumento, '22222222000122');
    assert.equal(notas[0].tomadorExterior, false);
    assert.equal(notas[0].codigoCnae, '7020400');
    assert.equal(notas[0].codigoNbs, '114011300');
    assert.equal(notas[0].chaveAdn, 'CHAVE-TESTE');
    const decl = compararComTemplate(notas[0].tagsDeclaracao);
    assert.equal(decl.noRealAusenteNoNosso.includes('ChaveADN'), false);
    assert.equal(decl.noRealAusenteNoNosso.includes('PrestadorServico'), false);
  });
});
