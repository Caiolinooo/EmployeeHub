/**
 * Testes das regras puras do enriquecimento WK → portal.
 * Rodar: npx tsx --test src/lib/wkradar/enriquecer.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calcularMudancasGt,
  calcularMudancasPayroll,
  formatarMatriculaEsocial,
  type ColaboradorGt,
  type EmployeePayroll,
} from './enriquecer-regras';

const CNPJ = '17784306000189';

describe('formatarMatriculaEsocial', () => {
  it('padrão CNPJ + 6 dígitos', () => {
    assert.equal(formatarMatriculaEsocial('803', CNPJ), '17784306000189.000803');
    assert.equal(formatarMatriculaEsocial('7', CNPJ), '17784306000189.000007');
  });
});

describe('calcularMudancasGt', () => {
  const base: ColaboradorGt = {
    id: 'g1',
    matricula: '803',
    pis_pasep: null,
    salario: null,
    data_nascimento: null,
    matricula_esocial: null,
    empresa_id: null,
  };

  it('preenche matricula_esocial quando nula', () => {
    const r = calcularMudancasGt(base, undefined, CNPJ);
    assert.ok(r && 'changes' in r);
    assert.equal(r.changes.matricula_esocial, '17784306000189.000803');
  });

  it('NUNCA toca matricula_esocial existente (exceção confirmada 803→783 fica)', () => {
    const r = calcularMudancasGt(
      { ...base, matricula_esocial: '17784306000189.000783' },
      undefined,
      CNPJ,
    );
    assert.equal(r, null);
  });

  it('matrícula não numérica vira pendência', () => {
    const r = calcularMudancasGt(
      { ...base, matricula: '17784306000189.000783' },
      undefined,
      CNPJ,
    );
    assert.ok(r && 'pendencia' in r);
  });

  it('backup estável preenche salario e nascimento (aprendiz incluído, sem piso)', () => {
    const r = calcularMudancasGt(
      base,
      { pis: '207.77452.61-2', nascimento: '1987-04-13', moda: 761.55, estavel: true },
      CNPJ,
    );
    assert.ok(r && 'changes' in r);
    assert.equal(r.changes.salario, 761.55);
    assert.equal(r.changes.data_nascimento, '1987-04-13');
    assert.equal(r.changes.pis_pasep, '207.77452.61-2');
  });

  it('não sobrescreve pis/salário/nascimento já preenchidos', () => {
    const r = calcularMudancasGt(
      { ...base, pis_pasep: '111.11111.11-1', salario: 100, data_nascimento: '1990-01-01' },
      { pis: '222.22222.22-2', nascimento: '1987-04-13', moda: 9000, estavel: true },
      CNPJ,
    );
    assert.ok(r && 'changes' in r);
    assert.equal(r.changes.pis_pasep, undefined);
    assert.equal(r.changes.salario, undefined);
    assert.equal(r.changes.data_nascimento, undefined);
  });
});

describe('calcularMudancasPayroll', () => {
  const base: EmployeePayroll = {
    id: 'p1',
    registration_number: '803',
    cpf: '37030265882',
    position: null,
    base_salary: 0,
    pis_pasep: null,
    department_id: null,
    company_id: 'c1',
  };
  const depts = [{ id: 'd1', code: 'ABZADM', name: 'ABZ SERVIÇOS- ADMINISTRATIVO', company_id: 'c1' }];

  it('cargo e departamento da API WK', () => {
    const r = calcularMudancasPayroll(
      base,
      { id: 1, codigo: '803', nome: 'X', departamento: 'ABZ SERVIÇOS- ADMINISTRATIVO', cargo: 'PILOTO DE ROV' },
      undefined,
      depts,
    );
    assert.ok(r);
    assert.equal(r.position, 'PILOTO DE ROV');
    assert.equal(r.department_id, 'd1');
  });

  it('base_salary só com remuneração estável do backup', () => {
    const r = calcularMudancasPayroll(base, undefined, { pis: null, nascimento: null, moda: 9000, estavel: true }, depts);
    assert.ok(r);
    assert.equal(r.base_salary, 9000);

    const variavel = calcularMudancasPayroll(base, undefined, { pis: null, nascimento: null, moda: 9000, estavel: false }, depts);
    assert.equal(variavel, null);
  });

  it('não preenche position/pis já preenchidos', () => {
    const r = calcularMudancasPayroll(
      { ...base, position: 'TAIFEIRO', pis_pasep: '111.11111.11-1' },
      { id: 1, codigo: '803', nome: 'X', departamento: null, cargo: 'OUTRO' },
      { pis: '222.22222.22-2', nascimento: null, moda: null, estavel: false },
      depts,
    );
    assert.equal(r, null);
  });
});
