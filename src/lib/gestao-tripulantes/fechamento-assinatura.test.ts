import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assinaturaCobreAprovador,
  avaliarAssinaturasFechamento,
  autorizacaoAssinarFechamento,
  displayNameFromUser,
  isFechamentoRole,
  isFechamentoStatus,
  labelFechamentoStatus,
  mensagemErroAssinaturaNegada,
  mesclarAssinaturaFechamento,
  montarHashFechamento,
  normalizeAprovadoresObrigatorios,
  podeAssinarFechamento,
} from './fechamento-assinatura';

const namedList = () => normalizeAprovadoresObrigatorios([
  { id: 'user-ana', nome: 'Ana', email: 'ana@x.com' },
  { id: 'user-beto', nome: 'Beto', email: 'beto@x.com' },
]);

describe('isFechamentoRole', () => {
  it('accepts ADMIN/MANAGER family regardless of case', () => {
    assert.equal(isFechamentoRole('ADMIN'), true);
    assert.equal(isFechamentoRole('manager'), true);
    assert.equal(isFechamentoRole('GERENTE'), true);
    assert.equal(isFechamentoRole('USER'), false);
    assert.equal(isFechamentoRole(''), false);
  });
});

describe('displayNameFromUser', () => {
  it('prefers first+last over name/email', () => {
    assert.equal(displayNameFromUser({
      first_name: 'Ana',
      last_name: 'Silva',
      name: 'Outro',
      email: 'ana@groupabz.com',
    }), 'Ana Silva');
    assert.equal(displayNameFromUser({ email: 'so@email.com' }), 'so@email.com');
  });
});

describe('normalizeAprovadoresObrigatorios', () => {
  it('drops entries without email or id and dedupes by id first', () => {
    const list = normalizeAprovadoresObrigatorios([
      { nome: 'A', email: 'a@x.com' },
      { nome: 'A2', email: 'A@x.com' },
      { nome: 'Sem email' },
      { id: 'u-1', nome: 'B', email: '' },
      { id: 'u-1', nome: 'B2', email: 'other@x.com' },
      null,
    ]);
    assert.equal(list.length, 2);
    assert.equal(list[0].email, 'a@x.com');
    assert.equal(list[1].id, 'u-1');
  });
});

describe('podeAssinarFechamento', () => {
  it('USER on the named list can complete their slot', () => {
    const gate = podeAssinarFechamento(namedList(), {
      userId: 'user-ana',
      email: 'ana@x.com',
      role: 'USER',
    });
    assert.equal(gate.permitido, true);

    const slot = avaliarAssinaturasFechamento(namedList(), [{
      userId: 'user-ana',
      email: 'ana@x.com',
      role: 'USER',
    }]);
    assert.equal(slot.todosAssinaram, false);
    assert.equal(slot.pendentes.length, 1);
    assert.equal(slot.pendentes[0].id, 'user-beto');
    assert.equal(assinaturaCobreAprovador(namedList()[0], [{
      userId: 'user-ana',
      email: 'ana@x.com',
      role: 'USER',
    }]), true);
  });

  it('ADMIN not on a named list cannot sign and does not complete 100%', () => {
    const gate = podeAssinarFechamento(namedList(), {
      userId: 'admin-1',
      email: 'admin@x.com',
      role: 'ADMIN',
    });
    assert.equal(gate.permitido, false);
    if (!gate.permitido) {
      assert.equal(gate.motivo, 'nao_esta_na_lista');
      assert.equal(
        mensagemErroAssinaturaNegada(gate.motivo),
        'Você não está na lista de aprovadores obrigatórios deste mês.',
      );
    }

    const evalAdmin = avaliarAssinaturasFechamento(namedList(), [{
      userId: 'admin-1',
      email: 'admin@x.com',
      role: 'ADMIN',
    }]);
    assert.equal(evalAdmin.todosAssinaram, false);
    assert.equal(evalAdmin.pendentes.length, 2);
  });

  it('empty list allows ADMIN/MANAGER and rejects USER', () => {
    assert.equal(
      podeAssinarFechamento([], { userId: 'a1', email: 'a@x.com', role: 'ADMIN' }).permitido,
      true,
    );
    assert.equal(
      podeAssinarFechamento([], { userId: 'm1', email: 'm@x.com', role: 'MANAGER' }).permitido,
      true,
    );
    const userGate = podeAssinarFechamento([], { userId: 'u1', email: 'u@x.com', role: 'USER' });
    assert.equal(userGate.permitido, false);
    if (!userGate.permitido) {
      assert.equal(userGate.motivo, 'lista_vazia_exige_gestor');
    }
  });
});

describe('avaliarAssinaturasFechamento', () => {
  it('empty list: ADMIN/MANAGER single signature completes; USER does not', () => {
    assert.deepEqual(avaliarAssinaturasFechamento([], []), {
      todosAssinaram: false,
      pendentes: [],
    });
    assert.equal(
      avaliarAssinaturasFechamento([], [{
        email: 'gestor@groupabz.com',
        userId: '1',
        role: 'MANAGER',
      }]).todosAssinaram,
      true,
    );
    assert.equal(
      avaliarAssinaturasFechamento([], [{
        email: 'admin@groupabz.com',
        userId: '2',
        cargo: 'ADMIN',
      }]).todosAssinaram,
      true,
    );
    assert.equal(
      avaliarAssinaturasFechamento([], [{
        email: 'user@groupabz.com',
        userId: '3',
        role: 'USER',
        cargo: 'USER',
      }]).todosAssinaram,
      false,
    );
  });

  it('all listed people signed (including USER) completes; extras do not count toward 100%', () => {
    const obr = namedList();
    const partial = avaliarAssinaturasFechamento(obr, [{
      email: 'ANA@x.com',
      userId: 'user-ana',
      role: 'USER',
    }]);
    assert.equal(partial.todosAssinaram, false);
    assert.equal(partial.pendentes.length, 1);
    assert.equal(partial.pendentes[0].email, 'beto@x.com');

    const extraOnly = avaliarAssinaturasFechamento(obr, [
      { email: 'admin@x.com', userId: 'admin-1', role: 'ADMIN' },
      { email: 'extra@x.com', userId: '9', role: 'MANAGER' },
    ]);
    assert.equal(extraOnly.todosAssinaram, false);
    assert.equal(extraOnly.pendentes.length, 2);

    const done = avaliarAssinaturasFechamento(obr, [
      { email: 'ana@x.com', userId: 'user-ana', role: 'USER' },
      { email: 'beto@x.com', userId: 'user-beto', role: 'USER' },
      { email: 'extra@x.com', userId: '9', role: 'ADMIN' },
    ]);
    assert.equal(done.todosAssinaram, true);
    assert.equal(done.pendentes.length, 0);
  });

  it('matches by user id when emails differ', () => {
    assert.equal(
      assinaturaCobreAprovador(
        { id: 'u-9', nome: 'X', email: 'old@x.com' },
        [{ userId: 'u-9', email: 'new@x.com' }],
      ),
      true,
    );
  });
});

describe('autorizacaoAssinarFechamento', () => {
  it('exposes the same named-list 403 copy', () => {
    const denied = autorizacaoAssinarFechamento({
      obrigatorios: namedList(),
      userId: 'admin-1',
      email: 'admin@x.com',
      role: 'ADMIN',
    });
    assert.equal(denied.permitido, false);
    if (!denied.permitido) {
      assert.equal(denied.motivo, 'Você não está na lista de aprovadores obrigatórios deste mês.');
    }
  });
});

describe('mesclarAssinaturaFechamento', () => {
  it('replaces the same person by user id even if email changed', () => {
    const merged = mesclarAssinaturaFechamento(
      [{ userId: 'u-1', email: 'old@x.com', nome: 'Old' }],
      { userId: 'u-1', email: 'new@x.com', nome: 'New' },
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0].email, 'new@x.com');
  });
});

describe('montarHashFechamento', () => {
  it('uses GT_FECHAMENTO:mesAno:nome:cpf:data:ip', () => {
    const hash = montarHashFechamento({
      mesAno: '2026-08',
      nome: 'Ana Silva',
      cpf: '123.456.789-09',
      dataIso: '2026-09-01T15:00:00.000Z',
      ip: '1.2.3.4',
    });
    assert.equal(hash, 'GT_FECHAMENTO:2026-08:Ana Silva:12345678909:2026-09-01T15:00:00.000Z:1.2.3.4');
  });
});

describe('labelFechamentoStatus', () => {
  it('covers every status variant', () => {
    assert.equal(labelFechamentoStatus('enviado'), 'Enviado ao DP');
    assert.equal(labelFechamentoStatus('aprovado'), 'Aprovado (100%)');
    assert.equal(labelFechamentoStatus('em_aprovacao', { assinados: 1, obrigatorios: 3 }), 'Em Aprovação (1/3)');
    assert.equal(labelFechamentoStatus('em_aprovacao', { assinados: 1, obrigatorios: 0 }), 'Em Aprovação (1/1)');
    assert.equal(labelFechamentoStatus('rejeitado'), 'Rejeitado');
    assert.equal(labelFechamentoStatus('pendente_revisao'), 'Pendente');
    assert.equal(isFechamentoStatus('enviado'), true);
    assert.equal(isFechamentoStatus('nope'), false);
  });
});
