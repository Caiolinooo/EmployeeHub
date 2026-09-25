import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLINICA_OCR_RE,
  CNPJ_OCR_RE,
  crmComUfRe,
  crmSemUfRe,
  MEDICO_NOME_RE,
  MEDICO_PREFIXO_INICIO_RE,
  MEDICO_PREFIXO_MEIO_RE,
  extrairNumeroDocumentoDoTexto,
  isTabelaHeaderLinha,
} from './ocr-linear';

function assertFast(fn: () => void, limitMs = 100): void {
  const t0 = performance.now();
  fn();
  const dt = performance.now() - t0;
  assert.ok(dt < limitMs, `pathological input took ${dt.toFixed(1)}ms (limit ${limitMs}ms)`);
}

function crmMatches(re: RegExp, s: string): string[][] {
  const copy = new RegExp(re.source, re.flags);
  return [...s.matchAll(copy)].map((m) => m.slice(1).map((g) => g ?? ''));
}

describe('ocr-linear characterization', () => {
  it('matches CRM samples with the same capture groups', () => {
    assert.deepEqual(crmMatches(crmComUfRe(), 'CRM-SP: 123456'), [['SP', '123456']]);
    assert.deepEqual(crmMatches(crmComUfRe(), 'CRM SP 123456'), [['SP', '123456']]);
    assert.deepEqual(crmMatches(crmComUfRe(), 'CRM: 123456'), [['', '123456']]);
    assert.deepEqual(crmMatches(crmComUfRe(), 'C.R.M. 12.345-6'), [['', '12.345-6']]);
    assert.deepEqual(crmMatches(crmComUfRe(), 'CRM 99999'), []);
    assert.deepEqual(crmMatches(crmSemUfRe(), 'CRM: 123456'), [['123456']]);
    assert.deepEqual(crmMatches(crmSemUfRe(), 'C.R.M. 12.345-6'), [['12.345']]);
  });

  it('matches Dr/Dra name samples from ASO comments', () => {
    assert.equal('Dr. Heloana Antunes Sabino'.match(MEDICO_NOME_RE)?.[1], 'Heloana Antunes Sabino');
    assert.equal('Dra. Maria da Silva Santos'.match(MEDICO_NOME_RE)?.[1], 'Maria da Silva Santos');
    assert.equal('Drª Thalia Leal Dibo'.match(MEDICO_NOME_RE)?.[1], 'Thalia Leal Dibo');
    assert.equal('Dr Joao da Silva Extra'.match(MEDICO_NOME_RE)?.[1], 'Joao da Silva Extra');
    assert.equal('DRA. ANA PAULA FERREIRA'.match(MEDICO_NOME_RE)?.[1], 'ANA PAULA FERREIRA');
  });

  it('strips Dr/Médica prefixes the same way', () => {
    const strip = (s: string) =>
      s.replace(MEDICO_PREFIXO_INICIO_RE, '').replace(MEDICO_PREFIXO_MEIO_RE, '').trim();
    assert.equal(strip('Dra. Heloana Antunes'), 'Heloana Antunes');
    assert.equal(strip('Médica Thalia Leal'), 'Thalia Leal');
    assert.equal(strip('Dr Joao da Silva'), 'Joao da Silva');
    assert.equal(strip('Nome: Dr. Pedro'), 'Nome: Pedro');
  });

  it('classifies tabela header lines the same way', () => {
    assert.equal(isTabelaHeaderLinha('procedimentos | data'), true);
    assert.equal(isTabelaHeaderLinha('exame'), true);
    assert.equal(isTabelaHeaderLinha('exame clinico'), false);
    assert.equal(isTabelaHeaderLinha(' | | | '), true);
    assert.equal(isTabelaHeaderLinha('PROCEDIMENTOS'), true);
    assert.equal(isTabelaHeaderLinha('data exame'), false);
    assert.equal(isTabelaHeaderLinha('Hemograma 10/08/2026'), false);
  });

  it('extracts document numbers from ASO / passaporte / certificado samples', () => {
    assert.equal(extrairNumeroDocumentoDoTexto('ASO nº 01234/2025', 'aso'), '01234/2025');
    assert.equal(extrairNumeroDocumentoDoTexto('Nº do exame: 998877', 'aso'), '998877');
    assert.equal(extrairNumeroDocumentoDoTexto('Número do laudo: ABC-1234', 'aso'), 'ABC-1234');
    assert.equal(extrairNumeroDocumentoDoTexto('Passport No: BR1234567', 'passaporte'), 'BR1234567');
    assert.equal(extrairNumeroDocumentoDoTexto('Nº do passaporte: AB123456', 'passaporte'), 'AB123456');
    assert.equal(extrairNumeroDocumentoDoTexto('Certificado nº 12345', 'certificado'), '12345');
    assert.equal(extrairNumeroDocumentoDoTexto('NR-35 nº 778899', 'treinamento'), '778899');
    assert.equal(extrairNumeroDocumentoDoTexto('Nº do documento: REG-2024-01', ''), 'REG-2024-01');
  });

  it('matches CNPJ / clínica OCR samples', () => {
    const cnpj = 'CNPJ: 17.784.306/0001-89'.match(CNPJ_OCR_RE);
    assert.equal(cnpj?.[1]?.replace(/[^\d]/g, ''), '17784306000189');
    const clinica = 'Clínica: Policlínica do Trabalhador'.match(CLINICA_OCR_RE);
    assert.equal(clinica?.[1]?.trim(), 'Policlínica do Trabalhador');
  });

  it('rejects 50k pathological OCR inputs in under 100ms', () => {
    const spaces = ' '.repeat(50_000);
    assertFast(() => {
      assert.deepEqual(crmMatches(crmComUfRe(), `CRM${spaces}1`), []);
      assert.equal(`Dr${spaces}X`.match(MEDICO_NOME_RE), null);
      assert.equal(isTabelaHeaderLinha(`${'|'.repeat(50_000)}`), true);
      assert.equal(extrairNumeroDocumentoDoTexto(`ASO${spaces}nº 1`, 'aso'), null);
    });
  });
});
