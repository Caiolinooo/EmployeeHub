import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDataBr, parseDataColavel } from './date-paste';
import { enderecoDeBrasilApi, enderecoDeViaCep, formatarCep, normalizarCep } from './cep-correios';
import { contaComDigito, labelBanco } from './bancos-br';
import { resolverEmbarcacaoAtual } from './embarcacao-atual';
import { partirDepartamentoTexto, resolverDepartmentId } from '../payroll/departamento-de-cadastro';

describe('parseDataColavel', () => {
  it('aceita colar DD/MM/AAAA, ISO e 8 dígitos', () => {
    assert.equal(parseDataColavel('29/09/1980'), '1980-09-29');
    assert.equal(parseDataColavel('29-09-1980'), '1980-09-29');
    assert.equal(parseDataColavel('1980-09-29'), '1980-09-29');
    assert.equal(parseDataColavel('29091980'), '1980-09-29');
    assert.equal(formatDataBr('1980-09-29'), '29/09/1980');
  });

  it('rejeita data impossível', () => {
    assert.equal(parseDataColavel('31/02/2020'), null);
    assert.equal(parseDataColavel(''), null);
  });
});

describe('CEP Correios', () => {
  it('normaliza e lê ViaCEP', () => {
    assert.equal(normalizarCep('20.240-080'), '20240080');
    assert.equal(formatarCep('20240080'), '20240-080');
    const end = enderecoDeViaCep({
      cep: '20240-080',
      logradouro: 'Rua do Catete',
      complemento: '',
      bairro: 'Catete',
      localidade: 'Rio de Janeiro',
      uf: 'RJ',
    });
    assert.equal(end?.cidade, 'Rio de Janeiro');
    assert.equal(end?.uf, 'RJ');
    assert.equal(enderecoDeViaCep({ erro: true }), null);
  });

  it('lê fallback BrasilAPI', () => {
    const end = enderecoDeBrasilApi({
      cep: '20240080',
      street: 'Rua do Catete',
      neighborhood: 'Catete',
      city: 'Rio de Janeiro',
      state: 'RJ',
    });
    assert.equal(end?.logradouro, 'Rua do Catete');
  });
});

describe('banco', () => {
  it('seleciona código e junta dígito da conta', () => {
    assert.equal(labelBanco('341'), '341 - Itaú');
    assert.equal(contaComDigito('12345', '6'), '12345-6');
    assert.equal(contaComDigito('12345', ''), '12345');
  });
});

describe('embarcação atual', () => {
  const catalogo = [{ id: 'e1', nome: 'NORMAND MAXIMUS' }];

  it('usa a rotação que cobre hoje e ignora DBA', () => {
    const r = resolverEmbarcacaoAtual([
      { tipo: 'dba', data_embarque: '2026-09-01', data_desembarque: '2026-09-30', local_desembarque: 'OUTRA' },
      { tipo: 'normal', data_embarque: '2026-09-10', data_desembarque: '2026-09-30', local_desembarque: 'NORMAND MAXIMUS' },
    ], catalogo, '2026-09-29');
    assert.deepEqual(r, { acao: 'definir', embarcacaoId: 'e1' });
  });

  it('limpa quando a logística não tem rotação hoje', () => {
    const r = resolverEmbarcacaoAtual([
      { tipo: 'normal', data_embarque: '2026-01-01', data_desembarque: '2026-01-15', local_desembarque: 'NORMAND MAXIMUS' },
    ], catalogo, '2026-09-29');
    assert.deepEqual(r, { acao: 'limpar' });
  });
});

describe('departamento WK', () => {
  it('casa o departamento do cadastro, não um centro de custo', () => {
    const porCodigo = new Map([['emp|01', 'dep-wk']]);
    const porNome = new Map([['emp|ABZ SERVICOS- ADMINISTRATIVO', 'dep-wk']]);
    const id = resolverDepartmentId({
      companyId: 'emp',
      departamento: { codigo: '01', nome: 'ABZ SERVIÇOS- ADMINISTRATIVO' },
      texto: null,
      porCodigo,
      porNome,
    });
    assert.equal(id, 'dep-wk');
    assert.deepEqual(partirDepartamentoTexto('01 - ABZ SERVIÇOS- ADMINISTRATIVO'), {
      codigo: '01',
      nome: 'ABZ SERVIÇOS- ADMINISTRATIVO',
    });
  });
});
