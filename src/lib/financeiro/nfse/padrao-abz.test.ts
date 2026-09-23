/**
 * Padrão ABZ extraído das NFS-e reais da SPE Macaé.
 * Rodar: npx tsx --test src/lib/financeiro/nfse/padrao-abz.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  competenciaAbrasf,
  formatarItemLc116,
  resolverCamposFiscaisAbz,
  tomadorEhExterior,
} from './padrao-abz';

describe('padrao-abz', () => {
  it('formata LC116 com ponto (SPE)', () => {
    assert.equal(formatarItemLc116('17.01'), '17.01');
    assert.equal(formatarItemLc116('1701'), '17.01');
    assert.equal(formatarItemLc116('0107'), '01.07');
  });

  it('competência vira YYYY-MM-DD', () => {
    assert.equal(competenciaAbrasf('2026-08-25', '2026-08-25'), '2026-08-25');
    assert.equal(competenciaAbrasf('2026-08', '2026-08-25'), '2026-08-25');
    assert.equal(competenciaAbrasf('2026-07', '2026-08-25'), '2026-07-01');
  });

  it('tomador exterior sem CPF/CNPJ ou com NIF', () => {
    assert.equal(tomadorEhExterior({ documento: '17784306000189' }), false);
    assert.equal(tomadorEhExterior({ documento: '12345678909' }), false);
    assert.equal(tomadorEhExterior({ documento: '' }), true);
    assert.equal(tomadorEhExterior({ documento: '17784306000189', motivoNifNaoInformado: '1' }), true);
  });

  it('resolve nacional vs exportação no padrão Macaé', () => {
    const nac = resolverCamposFiscaisAbz({
      municipioIbgePrestador: '3302403',
      competencia: '2026-07',
      dataEmissao: '2026-07-30',
      tomador: { documento: '63607103000134', municipioIbge: '3302403' },
      itemLc116: '17.01',
      valorServicos: 6880,
      aliquotaIss: 3.75,
    });
    assert.equal(nac.exterior, false);
    assert.equal(nac.exigibilidadeIss, '1');
    assert.equal(nac.codigoNbs, '114011300');
    assert.equal(nac.valorIss, 258);
    assert.equal(nac.ibscbs?.operacao, '100301');
    assert.equal(nac.competencia, '2026-07-30');

    const exp = resolverCamposFiscaisAbz({
      municipioIbgePrestador: '3302403',
      competencia: '2026-08-25',
      dataEmissao: '2026-08-25',
      tomador: { documento: '', codigoPais: '2445' },
      itemLc116: '17.01',
      valorServicos: 204081.45,
      aliquotaIss: 3.75,
    });
    assert.equal(exp.exterior, true);
    assert.equal(exp.exigibilidadeIss, '4');
    assert.equal(exp.codigoNbs, '114011900');
    assert.equal(exp.valorIss, 0);
    assert.equal(exp.ibscbs, undefined);
    assert.equal(exp.motivoNifNaoInformado, '1');
  });
});
