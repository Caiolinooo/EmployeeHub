import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isValidTsNome,
  sanitizeTsNome,
  xmlTemNomeTsInvalido,
  coletarNomeMedico,
} from './ts-nome';

describe('sanitizeTsNome', () => {
  it('strips OCR title, leftover glyphs and newlines from nmMed', () => {
    const dirty = 'Thalia Leal Dibo\nMédica\nà Á';
    assert.equal(sanitizeTsNome(dirty), 'Thalia Leal Dibo');
    assert.equal(isValidTsNome(sanitizeTsNome(dirty)), true);
    assert.equal(isValidTsNome(dirty), false);
  });

  it('accepts the same name already collapsed but with cargo + junk', () => {
    assert.equal(sanitizeTsNome('Thalia Leal Dibo Médica à Á'), 'Thalia Leal Dibo');
  });

  it('strips Dr/Dra prefixes', () => {
    assert.equal(sanitizeTsNome('Dra. Heloana Antunes Sabino de Azevedo'), 'Heloana Antunes Sabino de Azevedo');
    assert.equal(sanitizeTsNome('Dr Joao da Silva'), 'Joao da Silva');
  });

  it('keeps a valid name unchanged', () => {
    assert.equal(sanitizeTsNome('Heloana Antunes Sabino de Azevedo'), 'Heloana Antunes Sabino de Azevedo');
  });

  it('collapses unicode spaces and NFC-composes accents', () => {
    const decomposed = 'Jose\u0301 da Silva';
    assert.equal(sanitizeTsNome(decomposed), 'José da Silva');
  });

  it('truncates to 70 chars without trailing separator', () => {
    const long = `${'Maria '.repeat(20)}Silva`;
    const out = sanitizeTsNome(long);
    assert.ok(out.length <= 70);
    assert.equal(isValidTsNome(out), true);
  });

  it('does not empty a title-only placeholder that already matches TS_nome', () => {
    assert.equal(sanitizeTsNome('Médico Ocupacional'), 'Médico Ocupacional');
  });
});

describe('xmlTemNomeTsInvalido', () => {
  it('flags newline inside nmMed', () => {
    const xml = '<medico><nmMed>Thalia Leal Dibo\nMédica\nà Á</nmMed></medico>';
    assert.equal(xmlTemNomeTsInvalido(xml), true);
  });

  it('accepts a clean nmMed', () => {
    const xml = '<medico><nmMed>Thalia Leal Dibo</nmMed></medico>';
    assert.equal(xmlTemNomeTsInvalido(xml), false);
  });
});

describe('coletarNomeMedico', () => {
  it('reads nested aso.medico.nmMed', () => {
    assert.equal(
      coletarNomeMedico({
        exMedOcup: { aso: { medico: { nmMed: 'Thalia Leal Dibo' } } },
      }),
      'Thalia Leal Dibo',
    );
  });
});
