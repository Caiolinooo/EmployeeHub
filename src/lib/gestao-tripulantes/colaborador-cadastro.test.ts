import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  montarPayloadCadastro,
  resolverMatriculaEsocial,
  validarCadastroMinimo,
} from './colaborador-cadastro';

const CPF_OK = '529.982.247-25';
const CPF_DIGITS = '52998224725';

describe('validarCadastroMinimo', () => {
  it('exige nome e CPF válido no create', () => {
    assert.equal(validarCadastroMinimo({}).ok, false);
    assert.equal(validarCadastroMinimo({ nome_completo: 'Ana', cpf: '111' }).ok, false);
    const ok = validarCadastroMinimo({ nome_completo: '  Ana Silva  ', cpf: CPF_OK });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.nome, 'Ana Silva');
      assert.equal(ok.cpf, CPF_DIGITS);
    }
  });

  it('no update, valida só os campos enviados', () => {
    const soEmail = validarCadastroMinimo({ email: 'a@b.com' }, { requireNome: false, requireCpf: false });
    assert.equal(soEmail.ok, true);
    const cpfRuim = validarCadastroMinimo({ cpf: '000.000.000-00' }, { requireNome: false, requireCpf: false });
    assert.equal(cpfRuim.ok, false);
    if (!cpfRuim.ok) assert.equal(cpfRuim.error, 'CPF inválido');
  });
});

describe('resolverMatriculaEsocial', () => {
  it('copia matricula quando e-Social vem vazio', () => {
    assert.equal(resolverMatriculaEsocial({ matricula: '123', matricula_esocial: '' }), '123');
    assert.equal(resolverMatriculaEsocial({ matricula: '123', matricula_esocial: '  99.1  ' }), '99.1');
    assert.equal(resolverMatriculaEsocial({}), null);
  });
});

describe('montarPayloadCadastro', () => {
  it('create grava origem manual, CPF normalizado e defaults', () => {
    const result = montarPayloadCadastro({
      nome_completo: 'Ana Silva',
      cpf: CPF_OK,
      salario: '1500.5',
      dados_bancarios: {},
    }, 'create');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.cpf, CPF_DIGITS);
    assert.equal(result.data.origem, 'manual');
    assert.equal(result.data.nacionalidade, 'BRASILEIRA');
    assert.equal(result.data.pais_nascimento, 'Brasil');
    assert.equal(result.data.status_embarque, 'desembarcado');
    assert.equal(result.data.salario, 1500.5);
    assert.equal(result.data.dados_bancarios, null);
  });

  it('create sem_escala zera dias e não inventa 14x14', () => {
    const result = montarPayloadCadastro({
      nome_completo: 'Ana Silva',
      cpf: CPF_OK,
      regime_trabalho: 'sem_escala',
    }, 'create');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.regime_trabalho, 'sem_escala');
    assert.equal(result.data.escala_embarque, 0);
    assert.equal(result.data.escala_folga, 0);
  });

  it('create copia matricula para matricula_esocial', () => {
    const result = montarPayloadCadastro({
      nome_completo: 'Ana Silva',
      cpf: CPF_OK,
      matricula: 'M-99',
    }, 'create');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.matricula, 'M-99');
    assert.equal(result.data.matricula_esocial, 'M-99');
  });

  it('update parcial não exige nome/CPF e ignora campos de sistema', () => {
    const result = montarPayloadCadastro({
      salario: 2000,
      mio_id: 'x',
      deleted_at: 'nope',
    }, 'update');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.salario, 2000);
    assert.equal(result.data.mio_id, undefined);
    assert.equal(result.data.deleted_at, undefined);
    assert.equal(typeof result.data.updated_at, 'string');
  });

  it('update com CPF inválido falha', () => {
    const result = montarPayloadCadastro({ cpf: '123' }, 'update');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'CPF inválido');
  });

  it('rejeita número inválido', () => {
    const result = montarPayloadCadastro({
      nome_completo: 'Ana',
      cpf: CPF_OK,
      salario: 'abc',
    }, 'create');
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /salario/);
  });

  it('e-Social: escala NxN "14x21" extrai o primeiro inteiro em vez de falhar', () => {
    const result = montarPayloadCadastro({
      nome_completo: 'Ana Silva',
      cpf: CPF_OK,
      escala_embarque: '14x21',
      escala_folga: '21x14',
    }, 'create');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.escala_embarque, 14);
    assert.equal(result.data.escala_folga, 21);
  });

  it('e-Social: variantes de separador e número puro continuam válidos', () => {
    const barra = montarPayloadCadastro({ escala_embarque: '14 / 21' }, 'update');
    assert.equal(barra.ok, true);
    if (barra.ok) assert.equal(barra.data.escala_embarque, 14);

    const doisDigitos = montarPayloadCadastro({ escala_folga: '28X28' }, 'update');
    assert.equal(doisDigitos.ok, true);
    if (doisDigitos.ok) assert.equal(doisDigitos.data.escala_folga, 28);

    const puro = montarPayloadCadastro({ escala_embarque: 21 }, 'update');
    assert.equal(puro.ok, true);
    if (puro.ok) assert.equal(puro.data.escala_embarque, 21);
  });

  it('e-Social: texto sem inteiro inicial continua rejeitado', () => {
    const result = montarPayloadCadastro({ escala_embarque: 'quatorze x vinte e um' }, 'update');
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /escala_embarque/);
  });
});
