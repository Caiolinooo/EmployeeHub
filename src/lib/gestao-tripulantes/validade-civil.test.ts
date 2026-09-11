import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { abaParaTipoDocumento, documentoPertenceAba } from './validade-civil';

describe('documentoPertenceAba tab routing', () => {
  it('sends occupational exams only to the ASO tab', () => {
    assert.equal(abaParaTipoDocumento('aso'), 'aso');
    assert.equal(abaParaTipoDocumento('laudo'), 'aso');
    assert.equal(documentoPertenceAba('aso', 'aso'), true);
    assert.equal(documentoPertenceAba('laudo', 'aso'), true);
    assert.equal(documentoPertenceAba('aso', 'documentos'), false);
    assert.equal(documentoPertenceAba('aso', 'treinamentos'), false);
    assert.equal(documentoPertenceAba('aso', 'passaportes'), false);
  });

  it('keeps certificates, passports and leftover tipos on their own tabs', () => {
    assert.equal(abaParaTipoDocumento('certificado'), 'treinamentos');
    assert.equal(abaParaTipoDocumento('treinamento'), 'treinamentos');
    assert.equal(abaParaTipoDocumento('passaporte'), 'passaportes');
    assert.equal(abaParaTipoDocumento('cnh'), 'documentos');
    assert.equal(abaParaTipoDocumento('epi'), 'documentos');
  });
});
