/**
 * Testes do ponto único de merge de colaboradores (design §3).
 * Mock Supabase mínimo em memória (mesma superfície de query usada pelo
 * service: select/eq/in/order/limit, insert().select().single(), update().eq()).
 * Rodar: npx tsx --test src/lib/payroll/colaborador-merge.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mergeColaborador, type ColaboradorFonte } from './colaborador-merge';

type Row = Record<string, unknown>;

/** Mock mínimo do SupabaseClient com tabelas em memória. */
function criarSupabaseMock(seed: { employees?: Row[] } = {}) {
  const employees: Row[] = (seed.employees ?? []).map((r) => ({ ...r }));
  const audit: Row[] = [];
  let seq = 0;

  const client = {
    from(table: string) {
      if (table === 'payroll_audit_log') {
        return {
          insert: async (row: Row) => {
            audit.push(row);
            return { data: null, error: null };
          },
        };
      }
      assert.equal(table, 'payroll_employees');

      const filtros: Array<(r: Row) => boolean> = [];
      let op:
        | { tipo: 'select' }
        | { tipo: 'insert'; registro: Row }
        | { tipo: 'update'; patch: Row } = { tipo: 'select' };

      const executa = (): { data: unknown; error: null } => {
        if (op.tipo === 'insert') {
          const registro: Row = {
            id: `emp-${++seq}`,
            created_at: new Date().toISOString(),
            ...op.registro,
          };
          employees.push(registro);
          return { data: registro, error: null };
        }
        const alvos = employees.filter((r) => filtros.every((f) => f(r)));
        if (op.tipo === 'update') {
          for (const alvo of alvos) Object.assign(alvo, op.patch);
          return { data: null, error: null };
        }
        return { data: alvos.map((r) => ({ ...r })), error: null };
      };

      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filtros.push((r) => r[col] === val);
          return builder;
        },
        in: (col: string, vals: unknown[]) => {
          filtros.push((r) => vals.includes(r[col]));
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        insert: (registro: Row) => {
          op = { tipo: 'insert', registro };
          return builder;
        },
        update: (patch: Row) => {
          op = { tipo: 'update', patch };
          return builder;
        },
        single: async () => {
          const { data } = executa();
          return { data, error: null };
        },
        then: (resolve: (v: unknown) => unknown) => resolve(executa()),
      };
      return builder;
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    employees,
    audit,
  };
}

const EMPRESA = 'comp-1';

const baseEntrada = (over: Partial<ColaboradorFonte> = {}): ColaboradorFonte => ({
  company_id: EMPRESA,
  registration_number: '783',
  cpf: '12345678909',
  name: 'Fulano da Silva',
  ...over,
});

describe('mergeColaborador — criação', () => {
  it('cria ficha nova com CPF formatado e loga auditoria INSERT', async () => {
    const { client, employees, audit } = criarSupabaseMock();
    const r = await mergeColaborador(client, baseEntrada({ cargo: 'Marinheiro', base_salary: 3000 }), 'manual');

    assert.equal(r.acao, 'criado');
    assert.equal(employees.length, 1);
    assert.equal(employees[0].cpf, '123.456.789-09');
    assert.equal(employees[0].position, 'Marinheiro');
    assert.equal(employees[0].base_salary, 3000);
    assert.equal(employees[0].status, 'active');
    assert.ok(r.campos_adicionados.includes('name'));
    assert.equal(audit.length, 1);
    assert.equal(audit[0].action, 'INSERT');
    assert.equal((audit[0].new_values as Row).origem_evento, 'colaborador_merge');
  });
});

describe('mergeColaborador — match por CPF normalizado', () => {
  it('casa CPF com máscara no banco contra dígitos na entrada e faz merge aditivo', async () => {
    const { client, employees } = criarSupabaseMock({
      employees: [{
        id: 'emp-x', company_id: EMPRESA, cpf: '123.456.789-09',
        registration_number: 'GT-56789090', name: 'Fulano Silva',
        base_salary: 2500, status: 'active', position: null, pis_pasep: null,
        employee_id: null, created_at: '2026-01-01T00:00:00Z',
      }],
    });

    const r = await mergeColaborador(
      client,
      baseEntrada({ registration_number: '783', cargo: 'Mestre', pis: '17012345678', base_salary: 9999 }),
      'wk_xlsx',
    );

    assert.equal(r.acao, 'merged');
    assert.equal(r.id, 'emp-x');
    // Aditivo: preenche vazios…
    assert.equal(employees[0].position, 'Mestre');
    assert.equal(employees[0].pis_pasep, '17012345678');
    // …mas NUNCA sobrescreve o que existe (nome, matrícula, salário).
    assert.equal(employees[0].name, 'Fulano Silva');
    assert.equal(employees[0].registration_number, 'GT-56789090');
    assert.equal(employees[0].base_salary, 2500);
    assert.equal(employees.length, 1, 'não pode criar duplicata');
  });

  it('não duplica quando o CPF vem formatado na entrada e cru no banco', async () => {
    const { client, employees } = criarSupabaseMock({
      employees: [{
        id: 'emp-y', company_id: EMPRESA, cpf: '12345678909',
        registration_number: '783', name: 'Fulano', base_salary: 1000,
        status: 'active', created_at: '2026-01-01T00:00:00Z',
      }],
    });
    const r = await mergeColaborador(client, baseEntrada({ cpf: '123.456.789-09' }), 'gt');
    assert.notEqual(r.acao, 'criado');
    assert.equal(employees.length, 1);
  });
});

describe('mergeColaborador — match por matrícula', () => {
  it('casa por (company_id, registration_number) quando o CPF não casa', async () => {
    const { client, employees } = criarSupabaseMock({
      employees: [{
        id: 'emp-z', company_id: EMPRESA, cpf: null,
        registration_number: '783', name: 'Fulano', base_salary: 0,
        status: 'active', employee_id: null, created_at: '2026-01-01T00:00:00Z',
      }],
    });

    const r = await mergeColaborador(
      client,
      baseEntrada({ cpf: '99988877766', base_salary: 4200 }),
      'wk_xlsx',
    );

    assert.equal(r.acao, 'merged');
    assert.equal(r.id, 'emp-z');
    assert.equal(employees[0].cpf, '999.888.777-66', 'CPF vazio é preenchido (formatado)');
    assert.equal(employees[0].base_salary, 4200, 'salário 0 na ficha é preenchido');
    assert.equal(employees.length, 1);
  });
});

describe('mergeColaborador — salário', () => {
  it('salário 0 da fonte não zera salário existente', async () => {
    const { client, employees } = criarSupabaseMock({
      employees: [{
        id: 'emp-s', company_id: EMPRESA, cpf: '12345678909',
        registration_number: '783', name: 'Fulano', base_salary: 5000,
        status: 'active', created_at: '2026-01-01T00:00:00Z',
      }],
    });
    const r = await mergeColaborador(client, baseEntrada({ base_salary: 0 }), 'gt');
    assert.equal(r.acao, 'intocado');
    assert.equal(employees[0].base_salary, 5000);
  });
});

describe('mergeColaborador — vínculo employee_id', () => {
  it('gt_colaborador_id preenche employee_id vazio e preserva o existente', async () => {
    const { client, employees } = criarSupabaseMock({
      employees: [
        {
          id: 'emp-v1', company_id: EMPRESA, cpf: '12345678909',
          registration_number: '783', name: 'Sem Vínculo', base_salary: 1000,
          status: 'active', employee_id: null, created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'emp-v2', company_id: EMPRESA, cpf: '98765432100',
          registration_number: '784', name: 'Com Vínculo', base_salary: 1000,
          status: 'active', employee_id: 'gt-original', created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    const r1 = await mergeColaborador(client, baseEntrada({ gt_colaborador_id: 'gt-novo' }), 'gt');
    assert.equal(r1.acao, 'merged');
    assert.equal(employees[0].employee_id, 'gt-novo', 'vínculo preenchido');
    assert.ok(r1.campos_adicionados.includes('employee_id'));

    const r2 = await mergeColaborador(
      client,
      baseEntrada({ cpf: '98765432100', registration_number: '784', gt_colaborador_id: 'gt-outro' }),
      'gt',
    );
    assert.equal(employees[1].employee_id, 'gt-original', 'vínculo existente nunca é trocado');
    assert.ok(!r2.campos_adicionados.includes('employee_id'));
  });
});

describe('mergeColaborador — precedência de rescisão', () => {
  it('fonte wk/desligamento sempre atualiza data_demissao e status', async () => {
    const seed = [{
      id: 'emp-d', company_id: EMPRESA, cpf: '12345678909',
      registration_number: '783', name: 'Fulano', base_salary: 3000,
      status: 'active', termination_date: null, created_at: '2026-01-01T00:00:00Z',
    }];

    const wk = criarSupabaseMock({ employees: seed });
    const rw = await mergeColaborador(
      wk.client,
      baseEntrada({ data_demissao: '2026-09-15', status: 'terminated' }),
      'wk_xlsx',
    );
    assert.equal(rw.acao, 'merged');
    assert.equal(wk.employees[0].termination_date, '2026-09-15');
    assert.equal(wk.employees[0].status, 'terminated');

    const desl = criarSupabaseMock({ employees: seed });
    await mergeColaborador(
      desl.client,
      baseEntrada({ data_demissao: '2026-09-20', status: 'terminated' }),
      'desligamento',
    );
    assert.equal(desl.employees[0].termination_date, '2026-09-20');
    assert.equal(desl.employees[0].status, 'terminated');
  });

  it('fonte gt NÃO sobrescreve status existente (só preenche vazio)', async () => {
    const { client, employees } = criarSupabaseMock({
      employees: [{
        id: 'emp-g', company_id: EMPRESA, cpf: '12345678909',
        registration_number: '783', name: 'Fulano', base_salary: 3000,
        status: 'active', termination_date: '2026-08-01', created_at: '2026-01-01T00:00:00Z',
      }],
    });
    const r = await mergeColaborador(
      client,
      baseEntrada({ status: 'terminated', data_demissao: '2026-09-01' }),
      'gt',
    );
    assert.equal(r.acao, 'intocado');
    assert.equal(employees[0].status, 'active');
    assert.equal(employees[0].termination_date, '2026-08-01');
  });
});
