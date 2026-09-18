import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizarJanelaPeriodoBRT } from './escala-edicoes-periodo';

describe('normalizarJanelaPeriodoBRT — ausente/branco não filtra', () => {
  it('sem de/ate devolve janela vazia (ok, sem limites)', () => {
    const r = normalizarJanelaPeriodoBRT();
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.janela, { de: null, ate: null, createdDe: null, createdAte: null });
    }
  });

  it('strings vazias e brancas são tratadas como ausentes', () => {
    for (const args of [
      ['', ''],
      [null, null],
      [undefined, undefined],
      ['  ', '\t'],
    ]) {
      const r = normalizarJanelaPeriodoBRT(args[0] as string, args[1] as string);
      assert.equal(r.ok, true, JSON.stringify(args));
      if (r.ok) assert.equal(r.janela.createdDe, null);
    }
  });
});

describe('normalizarJanelaPeriodoBRT — limites BRT inclusivos', () => {
  it('de sozinho ancora só o início do dia em BRT', () => {
    const r = normalizarJanelaPeriodoBRT('2026-09-17', null);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.janela.de, '2026-09-17');
      assert.equal(r.janela.ate, null);
      assert.equal(r.janela.createdDe, '2026-09-17T00:00:00-03:00');
      assert.equal(r.janela.createdAte, null);
    }
  });

  it('ate sozinho ancora só o fim do dia em BRT', () => {
    const r = normalizarJanelaPeriodoBRT(null, '2026-09-17');
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.janela.createdDe, null);
      assert.equal(r.janela.createdAte, '2026-09-17T23:59:59-03:00');
    }
  });

  it('dia único (de == ate) cobre o dia inteiro em BRT', () => {
    const r = normalizarJanelaPeriodoBRT('2026-09-17', ' 2026-09-17 ');
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.janela.createdDe, '2026-09-17T00:00:00-03:00');
      assert.equal(r.janela.createdAte, '2026-09-17T23:59:59-03:00');
    }
  });

  it('faixa completa mantém os dois limites', () => {
    const r = normalizarJanelaPeriodoBRT('2026-09-01', '2026-09-30');
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.janela.createdDe, '2026-09-01T00:00:00-03:00');
      assert.equal(r.janela.createdAte, '2026-09-30T23:59:59-03:00');
    }
  });
});

describe('normalizarJanelaPeriodoBRT — rejeições (rota responde 400)', () => {
  it('data incompleta ou com hora é rejeitada', () => {
    for (const [de, ate] of [
      ['2026-09', null],
      ['2026', null],
      ['2026-9-17', null],
      ['17/09/2026', null],
      ['2026-09-17T10:00', null],
      [null, '2026-09-17 10:00'],
    ] as const) {
      const r = normalizarJanelaPeriodoBRT(de as string, ate as string);
      assert.equal(r.ok, false, JSON.stringify([de, ate]));
      if (!r.ok) assert.match(r.error, /YYYY-MM-DD/);
    }
  });

  it('data de calendário inexistente é rejeitada (incl. fev. de ano bissexto)', () => {
    for (const [de, ate] of [
      ['2026-02-30', null],
      [null, '2026-13-01'],
      ['2026-00-10', null],
      ['2026-04-31', null],
      [null, '2025-02-29'], // 2025 não é bissexto
    ] as const) {
      const r = normalizarJanelaPeriodoBRT(de as string, ate as string);
      assert.equal(r.ok, false, JSON.stringify([de, ate]));
    }
    // 2024 é bissexto — 29/02 passa.
    const ok = normalizarJanelaPeriodoBRT('2024-02-29', null);
    assert.equal(ok.ok, true);
  });

  it('de > ate é rejeitado (400, sem inverter em silêncio)', () => {
    const r = normalizarJanelaPeriodoBRT('2026-09-18', '2026-09-17');
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /posterior/);
  });

  it('de == ate na virada de mês/ano é aceito (ordenação lexicográfica)', () => {
    assert.equal(normalizarJanelaPeriodoBRT('2026-12-31', '2027-01-02').ok, true);
    assert.equal(normalizarJanelaPeriodoBRT('2026-09-30', '2026-10-01').ok, true);
  });
});
