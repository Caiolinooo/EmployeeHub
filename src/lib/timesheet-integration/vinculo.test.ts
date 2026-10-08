import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  candidatosDoLogin,
  nomesCompartilhados,
  phoneKey,
  pickPayroll,
  podeReassumirLogin,
  resolveVinculoByExternalId,
  resolveVinculoByUser,
  type ColaboradorVinculoRow,
  type PayrollVinculoRow,
  type VinculoStore,
} from './vinculo';

const GT = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';
const EMPRESA = '33333333-3333-3333-3333-333333333333';

function colab(over: Partial<ColaboradorVinculoRow> = {}): ColaboradorVinculoRow {
  return {
    id: GT,
    user_id: USER,
    empresa_id: EMPRESA,
    cpf: '529.982.247-25',
    email: 'joao@abz.com',
    nome_completo: 'João',
    contabilizar_timesheet: true,
    ativo: true,
    ...over,
  };
}

function payroll(over: Partial<PayrollVinculoRow> = {}): PayrollVinculoRow {
  return {
    id: 'pay-1',
    employee_id: GT,
    cpf: '52998224725',
    company_id: 'company-1',
    ...over,
  };
}

function store(init: {
  byUser?: ColaboradorVinculoRow | null;
  byId?: ColaboradorVinculoRow | null;
  user?: { id: string; email: string | null; tax_id: string | null } | null;
  users?: Record<string, { id: string; email: string | null; tax_id: string | null; phone_number?: string | null; first_name?: string | null; last_name?: string | null }>;
  candidatos?: ColaboradorVinculoRow[];
  map?: { tsEmployeeId: string; empresaId: string } | null;
  empresa?: boolean;
  payrollGt?: PayrollVinculoRow | null;
  payrollCpf?: PayrollVinculoRow[];
}): VinculoStore & { userWrites: string[]; payrollWrites: string[]; enqueued: string[] } {
  const userWrites: string[] = [];
  const payrollWrites: string[] = [];
  const enqueued: string[] = [];
  let byUser = init.byUser ?? null;
  let payrollGt = init.payrollGt ?? null;
  const payrollCpf = [...(init.payrollCpf || [])];
  return {
    userWrites,
    payrollWrites,
    enqueued,
    async colaboradorByUserId() {
      return byUser;
    },
    async colaboradorById() {
      return init.byId ?? null;
    },
    async userById(userId: string) {
      if (init.users) return init.users[userId] ?? null;
      return init.user === undefined ? null : init.user;
    },
    async candidatos() {
      return init.candidatos || [];
    },
    async setUserIdIfEmpty(colaboradorId, userId) {
      userWrites.push(`${colaboradorId}:${userId}`);
      byUser = colab({ ...(init.candidatos?.[0] || colab()), user_id: userId });
      return true;
    },
    async setUserIdFrom(colaboradorId, fromUserId, toUserId) {
      userWrites.push(`${colaboradorId}:${fromUserId}>${toUserId}`);
      byUser = colab({ ...(init.candidatos?.[0] || colab()), user_id: toUserId });
      return true;
    },
    async peopleMap() {
      return init.map === undefined ? { tsEmployeeId: 'ts-1', empresaId: EMPRESA } : init.map;
    },
    async empresaEnabled() {
      return init.empresa !== false;
    },
    async payrollByGtId() {
      return payrollGt;
    },
    async payrollByCpf() {
      return payrollCpf;
    },
    async setPayrollGtIdIfEmpty(payrollId, gtId) {
      payrollWrites.push(`${payrollId}:${gtId}`);
      const row = payrollCpf.find((r) => r.id === payrollId);
      if (!row || row.employee_id) return false;
      row.employee_id = gtId;
      payrollGt = { ...row };
      return true;
    },
    async enqueueActive(id) {
      enqueued.push(id);
    },
  };
}

describe('phoneKey / podeReassumirLogin', () => {
  it('telefone com 55 e máscara caem nos mesmos 11 dígitos', () => {
    assert.equal(phoneKey('+55 22 99999-0000'), '22999990000');
    assert.equal(phoneKey('22 99999-0000'), '22999990000');
  });

  it('dois nomes em comum liberam a troca; um nome não', () => {
    assert.equal(nomesCompartilhados('Joao Silva', 'JOAO SILVA SOUZA'), 2);
    const pessoal = '44444444-4444-4444-4444-444444444444';
    const base = {
      id: USER,
      email: 'joao.silva@groupabz.com',
      tax_id: null,
      phone_number: '+5522999990000',
      first_name: 'Joao',
      last_name: 'Silva',
    };
    const row = colab({
      user_id: pessoal,
      email: 'joao@gmail.com',
      telefone: '22 99999-0000',
      nome_completo: 'JOAO SILVA SOUZA',
    });
    assert.equal(
      podeReassumirLogin(base, row, { id: pessoal, email: 'joao@gmail.com', tax_id: null }),
      true,
    );
    assert.equal(
      podeReassumirLogin(
        base,
        { ...row, nome_completo: 'MARIA OLIVEIRA' },
        { id: pessoal, email: 'joao@gmail.com', tax_id: null },
      ),
      false,
    );
  });
});

describe('candidatosDoLogin / pickPayroll', () => {
  it('ignora colaborador já ligado a outro login', () => {
    const r = candidatosDoLogin(
      [colab({ user_id: 'outro' }), colab({ id: 'b', user_id: null })],
      USER,
    );
    assert.equal(r.kind, 'one');
    if (r.kind === 'one') assert.equal(r.row.id, 'b');
  });

  it('dois elegíveis = ambiguo', () => {
    assert.equal(
      candidatosDoLogin([colab({ user_id: null }), colab({ id: 'b', user_id: null })], USER).kind,
      'many',
    );
  });

  it('folha de outra pessoa não entra', () => {
    assert.equal(pickPayroll([payroll({ employee_id: 'outro-gt' })], GT).kind, 'none');
  });
});

describe('resolveVinculoByUser', () => {
  it('cadeia completa', async () => {
    const r = await resolveVinculoByUser(store({ byUser: colab(), payrollGt: payroll() }), USER);
    assert.equal(r.completo, true);
    assert.equal(r.motivo, null);
    assert.equal(r.tsEmployeeId, 'ts-1');
    assert.equal(r.payrollEmployeeId, 'pay-1');
  });

  it('sem user_id no GT e um CPF → preenche e segue', async () => {
    const s = store({
      byUser: null,
      user: { id: USER, email: 'joao@abz.com', tax_id: '52998224725' },
      candidatos: [colab({ user_id: null })],
      payrollGt: payroll(),
    });
    const r = await resolveVinculoByUser(s, USER);
    assert.deepEqual(s.userWrites, [`${GT}:${USER}`]);
    assert.equal(r.completo, true);
    assert.equal(r.colaborador?.user_id, USER);
  });

  it('dois CPFs → ambiguo, sem gravar', async () => {
    const s = store({
      byUser: null,
      user: { id: USER, email: null, tax_id: '52998224725' },
      candidatos: [colab({ id: 'a', user_id: null }), colab({ id: 'b', user_id: null })],
    });
    const r = await resolveVinculoByUser(s, USER);
    assert.equal(r.motivo, 'ambiguo');
    assert.equal(s.userWrites.length, 0);
  });

  it('sem people map enfileira e a batida espera', async () => {
    const s = store({ byUser: colab(), map: null, payrollGt: payroll() });
    const r = await resolveVinculoByUser(s, USER);
    assert.equal(r.motivo, 'sem_people_map');
    assert.equal(r.completo, false);
    assert.deepEqual(s.enqueued, [GT]);
  });

  it('folha vazia no employee_id preenche sem criar outra', async () => {
    const row = payroll({ employee_id: null });
    const s = store({ byUser: colab(), payrollGt: null, payrollCpf: [row] });
    const r = await resolveVinculoByUser(s, USER);
    assert.equal(r.completo, true);
    assert.deepEqual(s.payrollWrites, ['pay-1:' + GT]);
  });

  it('sem ficha na folha → sem_folha', async () => {
    const r = await resolveVinculoByUser(
      store({ byUser: colab(), payrollGt: null, payrollCpf: [] }),
      USER,
    );
    assert.equal(r.motivo, 'sem_folha');
  });

  it('telefone único no login corporativo reassumir o elo do e-mail pessoal', async () => {
    const pessoal = '44444444-4444-4444-4444-444444444444';
    const row = colab({
      user_id: pessoal,
      email: 'joao@gmail.com',
      telefone: '22 99999-0000',
      nome_completo: 'JOAO SILVA SOUZA',
    });
    const s = store({
      byUser: null,
      users: {
        [USER]: {
          id: USER,
          email: 'joao.silva@groupabz.com',
          tax_id: null,
          phone_number: '+5522999990000',
          first_name: 'Joao',
          last_name: 'Silva',
        },
        [pessoal]: { id: pessoal, email: 'joao@gmail.com', tax_id: null },
      },
      candidatos: [row],
      payrollGt: payroll(),
    });
    const r = await resolveVinculoByUser(s, USER);
    assert.equal(r.completo, true);
    assert.deepEqual(s.userWrites, [`${GT}:${pessoal}>${USER}`]);
    assert.equal(r.colaborador?.user_id, USER);
  });

  it('telefone de outro nome não troca o user_id', async () => {
    const pessoal = '44444444-4444-4444-4444-444444444444';
    const row = colab({
      user_id: pessoal,
      email: 'maria@gmail.com',
      telefone: '22 99999-0000',
      nome_completo: 'MARIA OLIVEIRA',
    });
    const s = store({
      byUser: null,
      users: {
        [USER]: {
          id: USER,
          email: 'joao.silva@groupabz.com',
          tax_id: null,
          phone_number: '+5522999990000',
          first_name: 'Joao',
          last_name: 'Silva',
        },
        [pessoal]: { id: pessoal, email: 'maria@gmail.com', tax_id: null },
      },
      candidatos: [row],
    });
    const r = await resolveVinculoByUser(s, USER);
    assert.equal(r.motivo, 'sem_colaborador');
    assert.equal(s.userWrites.length, 0);
  });

  it('flag off → flag_inativa', async () => {
    const r = await resolveVinculoByUser(
      store({ byUser: colab({ contabilizar_timesheet: false }) }),
      USER,
    );
    assert.equal(r.motivo, 'flag_inativa');
  });
});

describe('resolveVinculoByExternalId', () => {
  it('webhook sem folha não enfileira por padrão', async () => {
    const s = store({ byId: colab(), payrollGt: null, payrollCpf: [] });
    const r = await resolveVinculoByExternalId(s, GT);
    assert.equal(r.motivo, 'sem_folha');
    assert.equal(s.enqueued.length, 0);
  });
});
