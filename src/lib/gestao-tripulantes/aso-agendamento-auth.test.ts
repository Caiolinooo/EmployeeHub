import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isLogisticaRole,
  mensagemErroAsoLogisticaNegada,
  setorEhLogistica,
  setorPermiteAsoLogistica,
  setorTemModuloGestaoTripulantes,
} from './aso-agendamento-logistica';

describe('isLogisticaRole', () => {
  it('keeps ADMIN/MANAGER family and rejects USER', () => {
    assert.equal(isLogisticaRole('ADMIN'), true);
    assert.equal(isLogisticaRole('MANAGER'), true);
    assert.equal(isLogisticaRole('USER'), false);
    assert.equal(isLogisticaRole(undefined), false);
  });
});

describe('setorEhLogistica', () => {
  it('matches logística with or without accent', () => {
    assert.equal(setorEhLogistica('Logística'), true);
    assert.equal(setorEhLogistica('LOGISTICA'), true);
    assert.equal(setorEhLogistica('Setor Logística / Ops'), true);
    assert.equal(setorEhLogistica('Departamento Pessoal'), false);
    assert.equal(setorEhLogistica('QHSE'), false);
    assert.equal(setorEhLogistica(''), false);
  });
});

describe('setorPermiteAsoLogistica', () => {
  it('requires logística-like name AND gestao-tripulantes', () => {
    assert.equal(
      setorPermiteAsoLogistica({
        name: 'Logística',
        allowed_modules: ['ferias', 'gestao-tripulantes'],
      }),
      true,
    );
    assert.equal(
      setorPermiteAsoLogistica({
        name: 'Logística',
        allowed_modules: ['ferias'],
      }),
      false,
    );
    assert.equal(
      setorPermiteAsoLogistica({
        name: 'TI',
        allowed_modules: ['gestao-tripulantes', 'dp'],
      }),
      false,
    );
    assert.equal(setorTemModuloGestaoTripulantes(['Gestao-Tripulantes']), true);
  });
});

describe('mensagemErroAsoLogisticaNegada', () => {
  it('returns a clear 403 for each action', () => {
    assert.match(mensagemErroAsoLogisticaNegada('aprovar'), /logística/i);
    assert.match(mensagemErroAsoLogisticaNegada('reprovar'), /reprovar/i);
    assert.match(mensagemErroAsoLogisticaNegada('cancelar'), /cancelar/i);
  });
});
