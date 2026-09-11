import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aplicaDobraAutomaticaRegime,
  extractEscalaDias,
  formatRegimeDisplay,
  inferRegimeUi,
  isRegimeSemRotacao,
  labelRegimeCompacto,
  labelRegimeSelect,
  mapMioRegimeToLocal,
  mesclarRegimeMio,
  parseRegimeTrabalho,
  persistirCamposEscala,
  REGIME_TRABALHO_OPTIONS,
  REGIMES_ROTACAO_NXN,
  REGIMES_SEM_ROTACAO,
  escalaDiasParaForm,
  type RegimeTrabalhoConhecido,
} from './regime-escala';

describe('parseRegimeTrabalho', () => {
  it('recognizes no-rotation aliases in PT-BR', () => {
    assert.equal(parseRegimeTrabalho('sem_escala'), 'sem_escala');
    assert.equal(parseRegimeTrabalho('Sem escala'), 'sem_escala');
    assert.equal(parseRegimeTrabalho('administrativo'), 'administrativo');
    assert.equal(parseRegimeTrabalho('Administrativo'), 'administrativo');
    assert.equal(parseRegimeTrabalho('onshore'), 'onshore');
    assert.equal(parseRegimeTrabalho('Onshore'), 'onshore');
  });

  it('recognizes NxN including spaced forms', () => {
    assert.equal(parseRegimeTrabalho('14x14'), '14x14');
    assert.equal(parseRegimeTrabalho('14 x 14'), '14x14');
    assert.equal(parseRegimeTrabalho('28x28'), '28x28');
    assert.equal(parseRegimeTrabalho('15/15'), '15x15');
  });

  it('does not coerce empty or unknown to 14x14', () => {
    assert.equal(parseRegimeTrabalho(null), null);
    assert.equal(parseRegimeTrabalho(''), null);
    assert.equal(parseRegimeTrabalho('Offshore'), null);
    assert.equal(parseRegimeTrabalho('14x21'), null);
  });
});

describe('extractEscalaDias defaults', () => {
  it('never coerces empty/null to 14x14', () => {
    const empty = extractEscalaDias({});
    assert.equal(empty.diasEmbarque, 0);
    assert.equal(empty.diasFolga, 0);
    assert.equal(empty.aplicaDobraAutomatica, false);
    assert.equal(empty.label, '—');

    const nulled = extractEscalaDias({
      regime_trabalho: null,
      escala_embarque: null,
      escala_folga: null,
    });
    assert.equal(nulled.diasEmbarque, 0);
    assert.equal(nulled.aplicaDobraAutomatica, false);
  });

  it('treats sem_escala / administrativo / onshore as 0 days without DBA auto', () => {
    for (const regime of REGIMES_SEM_ROTACAO) {
      const r = extractEscalaDias({
        regime_trabalho: regime,
        escala_embarque: 14,
        escala_folga: 14,
      });
      assert.equal(r.diasEmbarque, 0, regime);
      assert.equal(r.diasFolga, 0, regime);
      assert.equal(r.aplicaDobraAutomatica, false, regime);
      assert.equal(r.label, labelRegimeCompacto(regime));
    }
  });

  it('ignores leftover 14 in day fields when regime is no-rotation', () => {
    const r = extractEscalaDias({
      regime_trabalho: 'sem_escala',
      escala_embarque: '14',
      escala_folga: '14',
    });
    assert.deepEqual(r, {
      diasEmbarque: 0,
      diasFolga: 0,
      label: 'Sem escala',
      aplicaDobraAutomatica: false,
    });
  });

  it('parses NxN and numeric day fields for rotation people', () => {
    const fromRegime = extractEscalaDias({ regime_trabalho: '28x28' });
    assert.equal(fromRegime.diasEmbarque, 28);
    assert.equal(fromRegime.diasFolga, 28);
    assert.equal(fromRegime.aplicaDobraAutomatica, true);

    const fromDays = extractEscalaDias({
      escala_embarque: 15,
      escala_folga: 15,
    });
    assert.equal(fromDays.diasEmbarque, 15);
    assert.equal(fromDays.diasFolga, 15);
    assert.equal(fromDays.aplicaDobraAutomatica, true);
    assert.equal(fromDays.label, '15x15');
  });

  it('does not treat 0 day fields as 14', () => {
    const r = extractEscalaDias({
      regime_trabalho: 'sem_escala',
      escala_embarque: 0,
      escala_folga: 0,
    });
    assert.equal(r.diasEmbarque, 0);
    assert.equal(r.aplicaDobraAutomatica, false);
  });

  it('parses unknown NxN like 14x21 without coercing to 14x14', () => {
    const r = extractEscalaDias({ regime_trabalho: '14x21' });
    assert.equal(r.diasEmbarque, 14);
    assert.equal(r.diasFolga, 21);
    assert.equal(r.aplicaDobraAutomatica, true);
    assert.equal(r.label, '14x21');
  });
});

describe('persistirCamposEscala', () => {
  it('forces 0 days for no-rotation even if the form still has 14', () => {
    const r = persistirCamposEscala({
      regime_trabalho: 'sem_escala',
      escala_embarque: 14,
      escala_folga: 14,
    });
    assert.deepEqual(r, {
      regime_trabalho: 'sem_escala',
      escala_embarque: 0,
      escala_folga: 0,
    });
  });

  it('keeps 0 as 0 (not null) for administrativo', () => {
    const r = persistirCamposEscala({
      regime_trabalho: 'administrativo',
      escala_embarque: 0,
      escala_folga: 0,
    });
    assert.equal(r.escala_embarque, 0);
    assert.equal(r.escala_folga, 0);
  });

  it('fills NxN days from the token when day fields are empty', () => {
    const r = persistirCamposEscala({ regime_trabalho: '14x14' });
    assert.equal(r.regime_trabalho, '14x14');
    assert.equal(r.escala_embarque, 14);
    assert.equal(r.escala_folga, 14);
  });

  it('does not default empty regime to 14x14', () => {
    const r = persistirCamposEscala({ regime_trabalho: '', escala_embarque: null, escala_folga: null });
    assert.deepEqual(r, {
      regime_trabalho: null,
      escala_embarque: null,
      escala_folga: null,
    });
  });
});

describe('escalaDiasParaForm / formatRegimeDisplay', () => {
  it('form init keeps sem_escala as 0 not 14', () => {
    assert.equal(escalaDiasParaForm('sem_escala', 14), '0');
    assert.equal(escalaDiasParaForm('sem_escala', null), '0');
    assert.equal(escalaDiasParaForm('14x14', 14), '14');
    assert.equal(escalaDiasParaForm(null, null), '');
    assert.equal(escalaDiasParaForm('14x14', 0), '0');
  });

  it('read-only display never falls back to 14x14', () => {
    assert.equal(formatRegimeDisplay({ regime_trabalho: 'sem_escala' }), 'Sem escala');
    assert.equal(formatRegimeDisplay({}), '—');
    assert.equal(formatRegimeDisplay({ regime_trabalho: null }), '—');
  });

  it('treats null token + 0/0 days as Sem escala (Aislan-like row)', () => {
    const aislan = { regime_trabalho: null, escala_embarque: 0, escala_folga: 0 };
    assert.equal(inferRegimeUi(aislan), 'sem_escala');
    assert.equal(formatRegimeDisplay(aislan), 'Sem escala');
    assert.equal(escalaDiasParaForm(inferRegimeUi(aislan), 0), '0');
  });
});

describe('MIO map / local override', () => {
  it('maps empty and onshore to no-rotation, never 14x14', () => {
    assert.deepEqual(mapMioRegimeToLocal(null), {
      regime_trabalho: 'sem_escala',
      escala_embarque: 0,
      escala_folga: 0,
    });
    assert.deepEqual(mapMioRegimeToLocal('Onshore'), {
      regime_trabalho: 'onshore',
      escala_embarque: 0,
      escala_folga: 0,
    });
    assert.equal(mapMioRegimeToLocal('Offshore').regime_trabalho, 'Offshore');
    assert.equal(mapMioRegimeToLocal('Offshore').escala_embarque, null);
  });

  it('protects local sem_escala / administrativo / onshore on pull', () => {
    assert.equal(
      mesclarRegimeMio({ regime_trabalho: 'sem_escala', escala_embarque: 0, escala_folga: 0 }, 'Offshore'),
      null,
    );
    assert.equal(
      mesclarRegimeMio({ regime_trabalho: '14x14', escala_embarque: 14, escala_folga: 14 }, 'Onshore'),
      null,
    );
  });

  it('fills local empty from MIO onshore', () => {
    const filled = mesclarRegimeMio({ regime_trabalho: null }, 'Onshore');
    assert.equal(filled?.regime_trabalho, 'onshore');
    assert.equal(filled?.escala_embarque, 0);
  });

  it('applies map on insert (no local row)', () => {
    const inserted = mesclarRegimeMio(null, '');
    assert.equal(inserted?.regime_trabalho, 'sem_escala');
  });
});

describe('exhaustive known regimes', () => {
  it('covers every option in the select list', () => {
    const values = REGIME_TRABALHO_OPTIONS.map((o) => o.value);
    assert.deepEqual(values, [...REGIMES_SEM_ROTACAO, ...REGIMES_ROTACAO_NXN]);
  });

  it('labels and DBA flag via exhaustive switch', () => {
    const all: RegimeTrabalhoConhecido[] = [...REGIMES_SEM_ROTACAO, ...REGIMES_ROTACAO_NXN];
    for (const regime of all) {
      assert.ok(labelRegimeSelect(regime).length > 0);
      assert.ok(labelRegimeCompacto(regime).length > 0);
      assert.equal(aplicaDobraAutomaticaRegime(regime), isRegimeSemRotacao(regime) === false);
    }
  });
});
