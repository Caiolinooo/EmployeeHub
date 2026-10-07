import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  competenciaFromPeriodEnd,
  parseRubricaLines,
  planejarItensFolha,
} from './folha-lancamento';

describe('folha a partir do timesheet aprovado', () => {
  it('competência sai do fim do período', () => {
    assert.deepEqual(competenciaFromPeriodEnd('2026-10-31'), { mes: 10, ano: 2026 });
    assert.equal(competenciaFromPeriodEnd('31/10/2026'), null);
  });

  it('ignora line inválida', () => {
    const lines = parseRubricaLines([
      { code: 'DIAS', quantity: 20 },
      { code: '', quantity: 1 },
      { code: 'HE50', quantity: -1 },
      { foo: 1 },
    ]);
    assert.deepEqual(lines, [{ code: 'DIAS', quantity: 20 }]);
  });

  it('código sem mapa vira aviso e não vira item', () => {
    const r = planejarItensFolha(
      [
        { code: 'DIAS', quantity: 20 },
        { code: 'HE50', quantity: 3.5 },
      ],
      [{ tsCode: 'DIAS', payrollCodeId: 'code-dias' }],
    );
    assert.deepEqual(r.itens, [{ payrollCodeId: 'code-dias', tsCode: 'DIAS', quantity: 20 }]);
    assert.deepEqual(r.avisos, ['Código HE50 sem rubrica mapeada']);
  });
});
