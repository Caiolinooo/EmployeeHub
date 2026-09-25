import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateEmployeePayroll,
  calculateINSS,
  calculateIRRF,
  reducaoMensalIRRF,
  type PayrollItem,
} from './calculations';

const salario = (valor: number, natureza?: PayrollItem['natureza']): PayrollItem => ({
  codeId: '001',
  code: '001',
  type: 'provento',
  name: 'Salário',
  calculationType: 'fixed',
  value: valor,
  quantity: 1,
  ...(natureza ? { natureza } : {}),
});

describe('INSS por vigência', () => {
  it('2025: salário de 4.000 e o teto continuam na tabela antiga', () => {
    assert.equal(calculateINSS(4000, '2025').value, 373.41);
    assert.equal(calculateINSS(8157.41, '2025').value, 951.62);
    assert.equal(calculateINSS(20000, '2025').value, 951.62);
  });

  it('2026: faixas da Portaria MPS/MF 13/2026', () => {
    assert.equal(calculateINSS(1621, '2026').value, 121.58);
    assert.equal(calculateINSS(4000, '2026').value, 368.6);
    assert.equal(calculateINSS(8475.55, '2026').value, 988.07);
    assert.equal(calculateINSS(20000, '2026').value, 988.07);
  });
});

describe('redutor da Lei 15.270/2025', () => {
  it('segue os exemplos da Receita, com o INSS que a própria Receita usou', () => {
    assert.equal(reducaoMensalIRRF(6000, '2026'), 179.75);
    assert.equal(reducaoMensalIRRF(5000, '2026'), 312.89);
    assert.equal(reducaoMensalIRRF(7607.2, '2026'), 0);
    assert.equal(reducaoMensalIRRF(6000, '2025'), 0);

    assert.equal(calculateIRRF(4000, 373.41, 0, true, '2026').value, 0);
    assert.equal(calculateIRRF(5000, 509.6, 0, true, '2026').value, 0);
    assert.equal(calculateIRRF(6000, 649.6, 0, true, '2026').value, 382.88);
    assert.equal(calculateIRRF(7607.2, 0, 0, true, '2026').value, 1016.27);
  });

  it('competência de 2025 não zera o IR de quem ganha 4.000', () => {
    const r = calculateEmployeePayroll(
      { id: 'a', name: 'A', baseSalary: 4000 },
      [salario(4000)],
      undefined,
      { ano: 2025, mes: 12 },
    );
    assert.equal(r.inssValue, 373.41);
    assert.equal(r.irrfValue, 114.76);
  });

  it('competência de 2026 zera o IR de quem ganha 4.000', () => {
    const r = calculateEmployeePayroll(
      { id: 'b', name: 'B', baseSalary: 4000 },
      [salario(4000)],
      undefined,
      { ano: 2026, mes: 1 },
    );
    assert.equal(r.inssValue, 368.6);
    assert.equal(r.irrfValue, 0);
  });

  it('férias usam o rendimento sem o 1/3 no redutor', () => {
    const r = calculateEmployeePayroll(
      { id: 'c', name: 'C', baseSalary: 9000 },
      [salario(9000, 'ferias')],
      undefined,
      { ano: 2026, mes: 3 },
    );
    assert.equal(r.inssValue, 988.07);
    assert.equal(r.irrfValue, 289.8);
  });

  it('13º continua sem IRRF', () => {
    const r = calculateEmployeePayroll(
      { id: 'd', name: 'D', baseSalary: 6000 },
      [salario(6000, 'decimo')],
      undefined,
      { ano: 2026, mes: 11 },
    );
    assert.equal(r.irrfValue, 0);
    assert.equal(r.inssValue, 641.51);
  });
});

describe('FORMULAS_FOLHA lookup', () => {
  const formulaItem = (formula: string, quantity = 1): PayrollItem => ({
    codeId: 'f1',
    code: '999',
    type: 'provento',
    name: 'Fórmula',
    calculationType: 'formula',
    formula,
    value: 0,
    quantity,
  });

  it('calcula dsr só para chave própria do mapa', () => {
    const r = calculateEmployeePayroll(
      { id: 'f', name: 'F', baseSalary: 3000 },
      [formulaItem('dsr', 2)],
    );
    const item = r.items.find((i) => i.code === '999');
    assert.equal(item?.calculatedValue, 200);
    assert.equal(item?.aviso, undefined);
  });

  it('não invoca __proto__, constructor nem toString', () => {
    for (const chave of ['__proto__', 'constructor', 'toString']) {
      const r = calculateEmployeePayroll(
        { id: 'evil', name: 'E', baseSalary: 3000 },
        [formulaItem(chave)],
      );
      const item = r.items.find((i) => i.code === '999');
      assert.equal(item?.calculatedValue, 0, chave);
      assert.equal(item?.aviso, 'formula_nao_implementada', chave);
    }
  });
});
