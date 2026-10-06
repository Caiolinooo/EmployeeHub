import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  enqueueSync,
  syncColaboradorAfterSave,
  type OutboxDbClient,
} from './outbox';

interface MockError { message: string; code?: string }
interface MockResponse { data: unknown; error: MockError | null }
interface MockCall {
  table: string;
  op: 'select' | 'insert' | 'update';
  payload?: unknown;
  filters: [string, string, unknown][];
}

type Resolver = (call: MockCall) => MockResponse;

interface MockBuilder extends PromiseLike<MockResponse> {
  select(cols: string): MockBuilder;
  eq(col: string, val: unknown): MockBuilder;
  is(col: string, val: unknown): MockBuilder;
  order(col: string, opts: unknown): MockBuilder;
  limit(n: number): MockBuilder;
  update(payload: unknown): MockBuilder;
  insert(payload: unknown): MockBuilder;
  maybeSingle(): Promise<MockResponse>;
}

/** Mock mínimo do PostgREST: cadeia thenable que resolve via resolver. */
function createMockDb(resolver: Resolver) {
  const calls: MockCall[] = [];
  const db = {
    from(table: string): MockBuilder {
      const call: MockCall = { table, op: 'select', filters: [] };
      calls.push(call);
      const builder: MockBuilder = {
        select: () => builder,
        eq: (col, val) => { call.filters.push(['eq', col, val]); return builder; },
        is: (col, val) => { call.filters.push(['is', col, val]); return builder; },
        order: () => builder,
        limit: () => builder,
        update: (payload) => { call.op = 'update'; call.payload = payload; return builder; },
        insert: (payload) => { call.op = 'insert'; call.payload = payload; return builder; },
        maybeSingle: () => Promise.resolve(resolver(call)),
        then: (onF, onR) => Promise.resolve(resolver(call)).then(onF, onR),
      };
      return builder;
    },
  };
  // Cast justificado: mock estrutural do builder PostgREST p/ node:test env-less.
  return { calls, db: db as unknown as OutboxDbClient };
}

const OK: MockResponse = { data: null, error: null };
const COLAB_ID = '11111111-1111-1111-1111-111111111111';

describe('enqueueSync — coalescing (1 pendente/colab, último desired vence)', () => {
  it('sem job vivo → insert + status pending', async () => {
    const { calls, db } = createMockDb(call => {
      if (call.table === 'ts_integration_outbox' && call.op === 'select') {
        return { data: null, error: null };
      }
      return OK;
    });

    await enqueueSync(COLAB_ID, 'active', db);

    const inserts = calls.filter(c => c.table === 'ts_integration_outbox' && c.op === 'insert');
    assert.equal(inserts.length, 1);
    assert.deepEqual(
      { colaborador_id: COLAB_ID, desired: 'active' },
      {
        colaborador_id: (inserts[0].payload as Record<string, unknown>).colaborador_id,
        desired: (inserts[0].payload as Record<string, unknown>).desired,
      },
    );
    const statusUpdates = calls.filter(c => c.table === 'gt_colaboradores' && c.op === 'update');
    assert.equal(statusUpdates.length, 1);
    assert.equal(
      (statusUpdates[0].payload as Record<string, unknown>).timesheet_sync_status,
      'pending',
    );
  });

  it('toggle 2x converge a 1 job (update, nunca 2º insert) com último desired', async () => {
    const { calls, db } = createMockDb(call => {
      if (call.table === 'ts_integration_outbox' && call.op === 'select') {
        return { data: { id: 'job-1' }, error: null };
      }
      return OK;
    });

    await enqueueSync(COLAB_ID, 'active', db);
    await enqueueSync(COLAB_ID, 'inactive', db);

    const inserts = calls.filter(c => c.table === 'ts_integration_outbox' && c.op === 'insert');
    assert.equal(inserts.length, 0);
    const updates = calls.filter(c => c.table === 'ts_integration_outbox' && c.op === 'update');
    assert.equal(updates.length, 2);
    assert.equal((updates[1].payload as Record<string, unknown>).desired, 'inactive');
  });

  it('race de insert (23505) vira update no job existente', async () => {
    const { calls, db } = createMockDb(call => {
      if (call.table === 'ts_integration_outbox' && call.op === 'select') {
        return { data: null, error: null };
      }
      if (call.table === 'ts_integration_outbox' && call.op === 'insert') {
        return { data: null, error: { message: 'duplicate key', code: '23505' } };
      }
      return OK;
    });

    await enqueueSync(COLAB_ID, 'inactive', db);

    const updates = calls.filter(c => c.table === 'ts_integration_outbox' && c.op === 'update');
    assert.equal(updates.length, 1);
    assert.equal((updates[0].payload as Record<string, unknown>).desired, 'inactive');
  });

  it('erro inesperado de insert propaga (rota captura best-effort)', async () => {
    const { db } = createMockDb(call => {
      if (call.table === 'ts_integration_outbox' && call.op === 'insert') {
        return { data: null, error: { message: 'connection reset' } };
      }
      return { data: null, error: null };
    });
    await assert.rejects(() => enqueueSync(COLAB_ID, 'active', db), /connection reset/);
  });
});

describe('syncColaboradorAfterSave', () => {
  it('flag off + flagChanged → enfileira inactive', async () => {
    const { calls, db } = createMockDb(call => {
      if (call.table === 'gt_colaboradores' && call.op === 'select') {
        return {
          data: {
            id: COLAB_ID,
            user_id: null,
            empresa_id: null,
            ativo: true,
            contabilizar_timesheet: false,
            timesheet_sync_status: 'active',
          },
          error: null,
        };
      }
      return OK;
    });

    const r = await syncColaboradorAfterSave(COLAB_ID, { flagChanged: true }, db);

    assert.deepEqual(r, { enqueued: true, desired: 'inactive' });
    const inserts = calls.filter(c => c.table === 'ts_integration_outbox' && c.op === 'insert');
    assert.equal(inserts.length, 1);
    assert.equal((inserts[0].payload as Record<string, unknown>).desired, 'inactive');
  });

  it('flag off sem mudança → no-op', async () => {
    const { calls, db } = createMockDb(call => {
      if (call.table === 'gt_colaboradores' && call.op === 'select') {
        return {
          data: { id: COLAB_ID, contabilizar_timesheet: false, timesheet_sync_status: 'none' },
          error: null,
        };
      }
      return OK;
    });

    const r = await syncColaboradorAfterSave(COLAB_ID, {}, db);

    assert.equal(r.enqueued, false);
    assert.equal(calls.filter(c => c.table === 'ts_integration_outbox').length, 0);
  });

  it('flag on sem login → status error sem_login, sem job', async () => {
    const { calls, db } = createMockDb(call => {
      if (call.table === 'gt_colaboradores' && call.op === 'select') {
        return {
          data: {
            id: COLAB_ID,
            nome_completo: 'Sem Login',
            user_id: null,
            empresa_id: '33333333-3333-3333-3333-333333333333',
            ativo: true,
            contabilizar_timesheet: true,
            timesheet_sync_status: 'pending',
          },
          error: null,
        };
      }
      return OK;
    });

    const r = await syncColaboradorAfterSave(COLAB_ID, { flagChanged: true }, db);

    assert.deepEqual(r, { enqueued: false, reason: 'sem_login' });
    assert.equal(calls.filter(c => c.table === 'ts_integration_outbox').length, 0);
    const errUpdates = calls.filter(c => c.table === 'gt_colaboradores' && c.op === 'update');
    assert.equal(errUpdates.length, 1);
    assert.equal((errUpdates[0].payload as Record<string, unknown>).timesheet_sync_status, 'error');
    assert.equal((errUpdates[0].payload as Record<string, unknown>).timesheet_sync_error, 'sem_login');
  });
});
