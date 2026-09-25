import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extrairCnhOcr,
  extrairCtpsOcr,
  extrairLogradouroOcr,
  extrairNomeMaeOcr,
  extrairNomeOcr,
  extrairNomePaiOcr,
  extrairPisOcr,
} from './ocr-field-extract';

function upper(s: string): string {
  return s.toUpperCase();
}

function assertFast(fn: () => void, limitMs = 100): void {
  const t0 = performance.now();
  fn();
  const dt = performance.now() - t0;
  assert.ok(dt < limitMs, `pathological input took ${dt.toFixed(1)}ms (limit ${limitMs}ms)`);
}

describe('ocr-field-extract characterization', () => {
  it('matches current nome samples (incl. NOME-first COMPLETO quirk)', () => {
    assert.equal(extrairNomeOcr(upper('NOME: JOAO DA SILVA CPF 123')), 'JOAO DA SILVA');
    assert.equal(extrairNomeOcr(upper('NOME COMPLETO: MARIA JOSE SANTOS')), 'COMPLETO');
    assert.equal(extrairNomeOcr(upper('TRABALHADOR: PEDRO ALVES')), 'PEDRO ALVES');
    assert.equal(extrairNomeOcr(upper('PACIENTE JOAO')), 'JOAO');
    assert.equal(extrairNomeOcr(upper('NOME:   ANA PAULA')), 'ANA PAULA');
    assert.equal(extrairNomeOcr(upper('SEM LABEL AQUI')), null);
  });

  it('matches current filiação / mãe / pai samples', () => {
    assert.equal(extrairNomeMaeOcr(upper('FILIAÇÃO: MARIA DAS DORES PAI JOAO')), 'MARIA DAS DORES');
    assert.equal(extrairNomeMaeOcr(upper('MÃE: ANA PAULA SILVA')), 'ANA PAULA SILVA');
    assert.equal(extrairNomeMaeOcr(upper('MAE: ROSA LIMA CPF 000')), 'ROSA LIMA');
    assert.equal(extrairNomeMaeOcr(upper('MÃE....---  CARLA SOUZA')), 'CARLA SOUZA');
    assert.equal(extrairNomePaiOcr(upper('PAI: JOSE DA SILVA MAE MARIA')), 'JOSE DA SILVA');
    assert.equal(extrairNomePaiOcr(upper('PAI: CARLOS ALBERTO RG 12')), 'CARLOS ALBERTO');
    assert.equal(extrairNomePaiOcr(upper('PAI   ANTONIO NATURALIDADE SP')), 'ANTONIO');
  });

  it('matches current CTPS / CNH / PIS / logradouro samples', () => {
    assert.equal(extrairCtpsOcr(upper('CTPS: 1234567')), '1234567');
    assert.equal(extrairCtpsOcr(upper('CTPS 999')), '999');
    assert.equal(extrairCtpsOcr(upper('CTPS:...|  55555')), '55555');
    assert.equal(extrairCtpsOcr(upper('CTPS12345')), '12345');
    assert.equal(extrairCtpsOcr(upper('SEM CTPS')), null);
    assert.equal(extrairCnhOcr(upper('CNH: 12345678900')), '12345678900');
    assert.equal(extrairCnhOcr(upper('CNH 998877')), '998877');
    assert.equal(extrairPisOcr(upper('PIS: 12345678900')), '12345678900');
    assert.equal(extrairPisOcr(upper('PIS-| 111')), '111');
    assert.equal(extrairLogradouroOcr(upper('RUA: DAS FLORES 100')), 'DAS FLORES 100');
    assert.equal(extrairLogradouroOcr(upper('AVENIDA BRASIL')), 'BRASIL');
    assert.equal(extrairLogradouroOcr(upper('AV. PAULISTA')), 'PAULISTA');
    assert.equal(extrairLogradouroOcr(upper('ESTRADA DO MAR 12')), 'DO MAR 12');
  });

  it('rejects 50k-space filiação in under 100ms', () => {
    const pathological = `FILIAÇÃO${' '.repeat(50_000)}X`;
    assertFast(() => {
      assert.equal(extrairNomeMaeOcr(pathological), null);
    });
  });
});
