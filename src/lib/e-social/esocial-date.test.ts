import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  alinharDataExamePtBr,
  corrigirXmlDatasS2220PtBr,
  isSwapDiaMes,
  normalizeEsocialDate,
  xmlTemDtExmInvertida,
} from './esocial-date';
import { autoCorrigirDadosEvento } from './esocialAutoCorrector';
import { gerarS2220 } from './eventos/s-2220';

const XML_MISTO = `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtMonit/v_S_01_03_00">
  <evtMonit Id="ID1177843060000002026090914552296912">
  <ideEvento>
    <indRetif>1</indRetif>
    <tpAmb>1</tpAmb>
    <procEmi>1</procEmi>
    <verProc>5.14.0</verProc>
  </ideEvento>
  <ideEmpregador>
    <tpInsc>1</tpInsc>
    <nrInsc>17784306</nrInsc>
  </ideEmpregador>
  <ideVinculo>
    <cpfTrab>15511345784</cpfTrab>
    <matricula>17784306000189.000649</matricula>
  </ideVinculo>
  <exMedOcup>
    <tpExameOcup>1</tpExameOcup>
    <aso>
      <dtAso>2026-08-10</dtAso>
      <resAso>1</resAso>
      <exame>
        <dtExm>2026-08-10</dtExm>
        <procRealizado>0290</procRealizado>
        <obsProc>ok</obsProc>
        <ordExame>1</ordExame>
      </exame>
      <exame>
        <dtExm>2026-10-08</dtExm>
        <procRealizado>9999</procRealizado>
        <obsProc>ok</obsProc>
        <ordExame>1</ordExame>
      </exame>
      <exame>
        <dtExm>2026-10-08</dtExm>
        <procRealizado>0296</procRealizado>
        <obsProc>ok</obsProc>
        <ordExame>1</ordExame>
      </exame>
      <medico>
        <nmMed>Thalia Leal Dibo</nmMed>
        <nrCRM>521311816</nrCRM>
        <ufCRM>RJ</ufCRM>
      </medico>
    </aso>
  </exMedOcup>
  </evtMonit>
</eSocial>`;

describe('esocial-date PT-BR', () => {
  it('slash dates are always DD/MM, never US', () => {
    assert.equal(normalizeEsocialDate('10/08/2026'), '2026-08-10');
    assert.equal(normalizeEsocialDate('08/10/2026'), '2026-10-08');
    assert.equal(normalizeEsocialDate('10-08-2026'), '2026-08-10');
  });

  it('reads English and Portuguese month names', () => {
    assert.equal(normalizeEsocialDate('10 de agosto de 2026'), '2026-08-10');
    assert.equal(normalizeEsocialDate('10 Aug 2026'), '2026-08-10');
    assert.equal(normalizeEsocialDate('August 10, 2026'), '2026-08-10');
    assert.equal(normalizeEsocialDate('10 October 2026'), '2026-10-10');
  });

  it('aligns mixed EN/PT exam dates to dtAso', () => {
    assert.equal(alinharDataExamePtBr('10/08/2026', '2026-08-10'), '2026-08-10');
    assert.equal(alinharDataExamePtBr('08/10/2026', '2026-08-10'), '2026-08-10');
    assert.equal(alinharDataExamePtBr('2026-10-08', '2026-08-10'), '2026-08-10');
    assert.equal(alinharDataExamePtBr('2026-08-10', '2026-08-10'), '2026-08-10');
  });

  it('detects day/month swap', () => {
    assert.equal(isSwapDiaMes('2026-08-10', '2026-10-08'), true);
    assert.equal(isSwapDiaMes('2026-08-10', '2026-08-10'), false);
    assert.equal(isSwapDiaMes('2026-08-10', '2026-08-11'), false);
  });

  it('patches the Renan/Thalia XML so every dtExm matches dtAso', () => {
    assert.equal(xmlTemDtExmInvertida(XML_MISTO), true);
    const { xml, alterado } = corrigirXmlDatasS2220PtBr(XML_MISTO);
    assert.equal(alterado, true);
    assert.equal(xmlTemDtExmInvertida(xml), false);
    assert.equal((xml.match(/<dtExm>2026-10-08<\/dtExm>/g) || []).length, 0);
    assert.ok((xml.match(/<dtExm>2026-08-10<\/dtExm>/g) || []).length >= 3);
    assert.ok(xml.includes('<dtAso>2026-08-10</dtAso>'));
  });

  it('gerarS2220 emits aligned exam dates', () => {
    const xml = gerarS2220({
      cpf: '15511345784',
      cnpj: '17784306000189',
      tpAmb: 1,
      matricula: '17784306000189.000649',
      dadosEspecificos: {
        tipoExame: 1,
        dataRealizacao: '10/08/2026',
        resultado: 1,
        medico_nome: 'Thalia Leal Dibo',
        medico_crm: '521311816',
        medico_uf: 'RJ',
        exames_realizados: [
          { nome: 'AUDIOMETRIA', data: '10/08/2026', codProc: '0290' },
          { nome: 'OUTRO', dtExm: '08/10/2026', procRealizado: '9999' },
          { nome: 'ECG', data: '2026-10-08', procRealizado: '0296' },
        ],
      },
    });
    assert.ok(xml.includes('<dtAso>2026-08-10</dtAso>'));
    assert.equal((xml.match(/<dtExm>2026-10-08<\/dtExm>/g) || []).length, 0);
    assert.ok((xml.match(/<dtExm>2026-08-10<\/dtExm>/g) || []).length >= 3);
  });

  it('auto-corrector aligns exames_realizados and asks for XML rebuild', () => {
    const { dadosCorrigidos, correcoes, xmlPrecisaRebuildar } = autoCorrigirDadosEvento('S-2220', {
      cpf: '15511345784',
      cnpj: '17784306000189',
      dadosEspecificos: {
        data_realizacao: '2026-08-10',
        exames_realizados: [
          { nome: 'A', data: '2026-08-10', procRealizado: '0290' },
          { nome: 'B', dtExm: '2026-10-08', procRealizado: '9999' },
          { nome: 'C', data: '08/10/2026', procRealizado: '0296' },
        ],
      },
    });

    assert.equal(xmlPrecisaRebuildar, true);
    assert.ok(correcoes.some((c) => c.campo === 'dtExm'));
    const exames = dadosCorrigidos.dadosEspecificos.exames_realizados;
    assert.equal(exames[0].data, '2026-08-10');
    assert.equal(exames[1].dtExm, '2026-08-10');
    assert.equal(exames[2].data, '2026-08-10');
  });
});
