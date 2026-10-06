import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hashPersonPayload,
  mapColaboradorToPerson,
  type ColaboradorSyncInput,
  type MapperContext,
} from './mapper';

const BASE: ColaboradorSyncInput = {
  id: '11111111-1111-1111-1111-111111111111',
  nome_completo: 'João da Silva',
  cpf: '529.982.247-25',
  user_id: '22222222-2222-2222-2222-222222222222',
  empresa_id: '33333333-3333-3333-3333-333333333333',
  ativo: true,
  contabilizar_timesheet: true,
  regime_trabalho: null,
  escala_embarque: null,
  escala_folga: null,
};

const CTX: MapperContext = {
  email: 'joao@abz.com',
  empresaTenantConfigurada: true,
  anchorEmbarque: null,
};

describe('mapColaboradorToPerson — erros estruturais', () => {
  it('sem user_id → sem_login', () => {
    const r = mapColaboradorToPerson({ ...BASE, user_id: null }, CTX);
    assert.deepEqual(r, { ok: false, reason: 'sem_login' });
  });

  it('sem email resolvido → sem_login', () => {
    const r = mapColaboradorToPerson(BASE, { ...CTX, email: null });
    assert.deepEqual(r, { ok: false, reason: 'sem_login' });
  });

  it('empresa sem ts_empresa_config → empresa_sem_tenant', () => {
    const r = mapColaboradorToPerson(BASE, { ...CTX, empresaTenantConfigurada: false });
    assert.deepEqual(r, { ok: false, reason: 'empresa_sem_tenant' });
  });

  it('sem empresa_id → empresa_sem_tenant', () => {
    const r = mapColaboradorToPerson({ ...BASE, empresa_id: null }, CTX);
    assert.deepEqual(r, { ok: false, reason: 'empresa_sem_tenant' });
  });
});

describe('mapColaboradorToPerson — schedule NxN', () => {
  it('14x14 com âncora → pattern(14,14,anchor)', () => {
    const r = mapColaboradorToPerson(
      { ...BASE, regime_trabalho: '14x14' },
      { ...CTX, anchorEmbarque: '2026-09-14' },
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.person.schedule, {
        kind: 'pattern', daysOn: 14, daysOff: 14, anchor: '2026-09-14',
      });
    }
  });

  it('28x28 via campos escala_embarque/folga → pattern(28,28,anchor)', () => {
    const r = mapColaboradorToPerson(
      { ...BASE, regime_trabalho: '28x28', escala_embarque: 28, escala_folga: 28 },
      { ...CTX, anchorEmbarque: '2026-10-01' },
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.person.schedule, {
        kind: 'pattern', daysOn: 28, daysOff: 28, anchor: '2026-10-01',
      });
    }
  });

  it('NxN sem evento de embarque → sem_ancora', () => {
    const r = mapColaboradorToPerson({ ...BASE, regime_trabalho: '14x14' }, CTX);
    assert.deepEqual(r, { ok: false, reason: 'sem_ancora' });
  });
});

describe('mapColaboradorToPerson — schedule weekly', () => {
  it('onshore → weekly seg–sex', () => {
    const r = mapColaboradorToPerson({ ...BASE, regime_trabalho: 'onshore' }, CTX);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.person.schedule, { kind: 'weekly', workdays: [1, 2, 3, 4, 5] });
    }
  });

  it('sem escala (regime vazio, dias 0) → weekly seg–sex, nunca 14x14 default', () => {
    const r = mapColaboradorToPerson(BASE, CTX);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.person.schedule, { kind: 'weekly', workdays: [1, 2, 3, 4, 5] });
    }
  });
});

describe('mapColaboradorToPerson — payload', () => {
  it('active = flag && ativo; desligado (ativo=false) → active false', () => {
    const r = mapColaboradorToPerson({ ...BASE, ativo: false }, CTX);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.person.active, false);
  });

  it('flag off → active false', () => {
    const r = mapColaboradorToPerson({ ...BASE, contabilizar_timesheet: false }, CTX);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.person.active, false);
  });

  it('externalId = id do colaborador; cpf normalizado em 11 dígitos', () => {
    const r = mapColaboradorToPerson(BASE, CTX);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.person.externalId, BASE.id);
      assert.equal(r.person.email, 'joao@abz.com');
      assert.equal(r.person.displayName, 'João da Silva');
      assert.equal(r.person.cpf, '52998224725');
      assert.equal(r.person.active, true);
    }
  });

  it('cpf inválido/ausente não entra no payload', () => {
    const r = mapColaboradorToPerson({ ...BASE, cpf: '123' }, CTX);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.person.cpf, undefined);
  });
});

describe('hashPersonPayload', () => {
  it('estável para o mesmo payload e sensível a mudanças', () => {
    const r = mapColaboradorToPerson(BASE, CTX);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const h1 = hashPersonPayload(r.person);
    const h2 = hashPersonPayload({ ...r.person });
    assert.equal(h1, h2);
    const h3 = hashPersonPayload({ ...r.person, email: 'outro@abz.com' });
    assert.notEqual(h1, h3);
    const h4 = hashPersonPayload({ ...r.person, active: false });
    assert.notEqual(h1, h4);
  });
});
