import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  derivarDatasEscala,
  hojeCivil,
  toCivilYmd,
  type EventoEscalaDatasLike,
} from './embarques-datas';

// Data civil fixa: 2026-09-14 (construída local — nunca new Date('YYYY-MM-DD')).
const HOJE = new Date(2026, 8, 14);

const ev = (over: Partial<EventoEscalaDatasLike>): EventoEscalaDatasLike => ({
  data_embarque: null,
  data_desembarque: null,
  ...over,
});

describe('toCivilYmd / hojeCivil', () => {
  it('formata data civil local sem shift de UTC', () => {
    assert.equal(toCivilYmd(new Date(2026, 8, 14)), '2026-09-14');
    assert.equal(toCivilYmd(new Date(2026, 0, 1)), '2026-01-01');
  });

  it('hojeCivil zera horário e mantém o dia local', () => {
    const h = hojeCivil(new Date(2026, 8, 14, 23, 59, 59));
    assert.equal(toCivilYmd(h), '2026-09-14');
    assert.equal(h.getHours(), 0);
  });
});

describe('derivarDatasEscala — ficha do colaborador (bug da escala antiga)', () => {
  it('sem eventos → tudo null (chamador mantém a coluna como fallback)', () => {
    assert.deepEqual(
      derivarDatasEscala([], HOJE),
      { data_ultimo_embarque: null, data_ultimo_desembarque: null, data_proximo_embarque: null },
    );
    assert.deepEqual(
      derivarDatasEscala(null, HOJE),
      { data_ultimo_embarque: null, data_ultimo_desembarque: null, data_proximo_embarque: null },
    );
  });

  it('evento aberto (data_desembarque null) conta no último embarque e não inventa desembarque', () => {
    const r = derivarDatasEscala([
      ev({ data_embarque: '2026-09-01', data_desembarque: null }),
    ], HOJE);
    assert.equal(r.data_ultimo_embarque, '2026-09-01');
    assert.equal(r.data_ultimo_desembarque, null);
    assert.equal(r.data_proximo_embarque, null);
  });

  it('eventos futuros viram próximo embarque (menor data futura) e não poluem o último', () => {
    const r = derivarDatasEscala([
      ev({ data_embarque: '2026-10-20', data_desembarque: '2026-11-03' }),
      ev({ data_embarque: '2026-09-25', data_desembarque: '2026-10-09' }),
    ], HOJE);
    assert.equal(r.data_proximo_embarque, '2026-09-25');
    assert.equal(r.data_ultimo_embarque, null);
    assert.equal(r.data_ultimo_desembarque, null);
  });

  it('histórico completo: último = max ≤ hoje, próximo = min > hoje', () => {
    const r = derivarDatasEscala([
      ev({ data_embarque: '2026-01-10', data_desembarque: '2026-01-24' }),
      ev({ data_embarque: '2026-06-05', data_desembarque: '2026-06-19' }),
      ev({ data_embarque: '2026-12-01', data_desembarque: '2026-12-15' }),
    ], HOJE);
    assert.equal(r.data_ultimo_embarque, '2026-06-05');
    assert.equal(r.data_ultimo_desembarque, '2026-06-19');
    assert.equal(r.data_proximo_embarque, '2026-12-01');
  });

  it('soft-deletados são ignorados', () => {
    const r = derivarDatasEscala([
      ev({ data_embarque: '2026-08-01', data_desembarque: '2026-08-15', deleted_at: '2026-09-01T10:00:00Z' }),
      ev({ data_embarque: '2026-07-01', data_desembarque: '2026-07-15' }),
    ], HOJE);
    assert.equal(r.data_ultimo_embarque, '2026-07-01');
    assert.equal(r.data_ultimo_desembarque, '2026-07-15');
    assert.equal(r.data_proximo_embarque, null);
  });

  it('data de hoje conta como último (≤ hoje) e nunca como próximo', () => {
    const r = derivarDatasEscala([
      ev({ data_embarque: '2026-09-14' }),
    ], HOJE);
    assert.equal(r.data_ultimo_embarque, '2026-09-14');
    assert.equal(r.data_proximo_embarque, null);
  });

  it('desembarque futuro ainda não é último desembarque', () => {
    const r = derivarDatasEscala([
      ev({ data_embarque: '2026-09-01', data_desembarque: '2026-09-20' }),
    ], HOJE);
    assert.equal(r.data_ultimo_embarque, '2026-09-01');
    assert.equal(r.data_ultimo_desembarque, null);
  });

  it('datas inválidas/ausentes não quebram o cálculo', () => {
    const r = derivarDatasEscala([
      ev({ data_embarque: '', data_desembarque: 'não-date' }),
      ev({ data_embarque: '2026-08-10', data_desembarque: '2026-08-24' }),
    ], HOJE);
    assert.equal(r.data_ultimo_embarque, '2026-08-10');
    assert.equal(r.data_ultimo_desembarque, '2026-08-24');
  });

  it('sem hoje explícito, usa a data civil local corrente', () => {
    const r = derivarDatasEscala([
      ev({ data_embarque: '1999-12-31', data_desembarque: '2000-01-15' }),
    ]);
    assert.equal(r.data_ultimo_embarque, '1999-12-31');
    assert.equal(r.data_ultimo_desembarque, '2000-01-15');
    assert.equal(r.data_proximo_embarque, null);
  });
});
