import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { autoCorrigirDadosEvento } from './esocialAutoCorrector';
import { gerarS2220 } from './eventos/s-2220';
import { resolverMatricula } from './esocial-matricula';
import { isValidTsNome } from './ts-nome';

describe('autoCorrigirDadosEvento S-2220 nmMed', () => {
  it('cleans OCR doctor name and flags XML rebuild', () => {
    const { dadosCorrigidos, correcoes, xmlPrecisaRebuildar } = autoCorrigirDadosEvento('S-2220', {
      cpf: '15511345784',
      cnpj: '17784306000189',
      dadosEspecificos: {
        medico_nome: 'Thalia Leal Dibo\nMédica\nà Á',
        medico_crm: '521311816',
        medico_uf: 'RJ',
      },
    });

    assert.equal(dadosCorrigidos.medico_nome, 'Thalia Leal Dibo');
    assert.equal(dadosCorrigidos.nmMed, 'Thalia Leal Dibo');
    assert.equal(dadosCorrigidos.dadosEspecificos.medico_nome, 'Thalia Leal Dibo');
    assert.equal(xmlPrecisaRebuildar, true);
    assert.ok(correcoes.some((c) => c.campo === 'medico_nome' && c.para === 'Thalia Leal Dibo'));
  });

  it('gerarS2220 emits TS_nome-valid nmMed', () => {
    const xml = gerarS2220({
      cpf: '15511345784',
      cnpj: '17784306000189',
      tpAmb: 1,
      matricula: '668',
      dadosEspecificos: {
        tipoExame: 1,
        dataRealizacao: '2026-10-08',
        resultado: 1,
        medico_nome: 'Thalia Leal Dibo\nMédica\nà Á',
        medico_crm: '521311816',
        medico_uf: 'RJ',
      },
    });
    const match = xml.match(/<nmMed>([\s\S]*?)<\/nmMed>/);
    assert.ok(match);
    assert.equal(match[1], 'Thalia Leal Dibo');
    assert.equal(isValidTsNome(match[1]), true);
  });
});

describe('resolverMatricula', () => {
  it('prefers event column over stale dados', () => {
    assert.equal(
      resolverMatricula({
        matricula: '17784306000189.000649',
        dados_evento: { matricula: 'velha', dadosEspecificos: { matricula_esocial: 'ainda-mais-velha' } },
      }),
      '17784306000189.000649',
    );
  });
});
