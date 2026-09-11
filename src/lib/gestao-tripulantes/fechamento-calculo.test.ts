import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calcularFechamentoColaborador,
  daysInclusive,
  montarRubricasFolha,
  somarTotaisFechamento,
  ymdFromDate,
} from './fechamento-calculo';

function d(ymd: string): Date {
  const [y, m, day] = ymd.split('-').map(Number);
  return new Date(y, m - 1, day, 0, 0, 0, 0);
}

const SETEMBRO = { dataInicio: d('2026-09-01'), dataFim: d('2026-09-30') };
const ESCALA_14 = { regime_trabalho: '14x14', escala_embarque: 14, escala_folga: 14 };
const ESCALA_28 = { regime_trabalho: '28x28', escala_embarque: 28, escala_folga: 28 };

describe('daysInclusive', () => {
  it('counts start and end (14x14 window)', () => {
    assert.equal(daysInclusive(d('2026-09-01'), d('2026-09-14')), 14);
    assert.equal(daysInclusive(d('2026-09-01'), d('2026-09-01')), 1);
  });
});

describe('calcularFechamentoColaborador comparativo NxN', () => {
  it('14x14 exact cycle: 14 ON + 14 FOLGA, no DBA/FI', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [{ tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-14' }],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_on, 14);
    assert.equal(calc.dias_dba, 0);
    assert.equal(calc.dias_fi, 0);
    assert.equal(calc.dias_folga, 14);
    assert.equal(calc.dias_stb, 0);
    assert.equal(calc.embarques.length, 1);
    assert.equal(calc.embarques[0].dias_totais, 14);
    assert.equal(calc.embarques[0].escala_ok, true);
    assert.equal(calc.embarques[0].soma_ok, true);
    assert.equal(calc.checagens.escala_ok, true);
  });

  it('14 days aboard + 2 extra = 14 ON + 2 DBA', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [{ tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-16' }],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_on, 14);
    assert.equal(calc.dias_dba, 2);
    assert.equal(calc.embarques[0].dias_totais, 16);
    assert.equal(calc.embarques[0].soma_ok, true);
    assert.equal(calc.embarques[0].escala_ok, false);
    assert.ok(calc.checagens.alertas.some((a) => a.includes('DBA')));
  });

  it('returns early: rest 6 of 14 yields FI deficit 8', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [
        { tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-14' },
        { tipo: 'normal', data_embarque: '2026-09-21', data_desembarque: '2026-10-04' },
      ],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_on, 14 + 10);
    assert.equal(calc.dias_folga, 6);
    assert.equal(calc.dias_fi_deficit, 8);
    assert.equal(calc.dias_fi, 8);
    assert.equal(calc.embarques[0].dias_folga_real, 6);
    assert.equal(calc.embarques[0].dias_fi_deficit, 8);
    assert.equal(calc.embarques[0].escala_ok, false);
  });

  it('does not invent end date when dt_fim is missing', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [{ tipo: 'normal', data_embarque: '2026-09-01' }],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_on, 0);
    assert.equal(calc.dias_dba, 0);
    assert.equal(calc.checagens.sem_dt_fim, 1);
    assert.equal(calc.embarques.length, 0);
    assert.ok(calc.checagens.alertas.some((a) => a.includes('sem dt fim')));
  });

  it('uses prevista as fim and flags fim_previsto', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [{ tipo: 'normal', data_embarque: '2026-09-01', data_prevista_desembarque: '2026-09-14' }],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_on, 14);
    assert.equal(calc.embarques[0].fim_previsto, true);
  });

  it('sem_escala never auto-creates DBA or FI', () => {
    const calc = calcularFechamentoColaborador(
      { regime_trabalho: 'sem_escala', escala_embarque: 0, escala_folga: 0 },
      [
        { tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-20' },
        { tipo: 'normal', data_embarque: '2026-09-22', data_desembarque: '2026-09-30' },
      ],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_on, 20 + 9);
    assert.equal(calc.dias_dba, 0);
    assert.equal(calc.dias_fi, 0);
    assert.equal(calc.aplica_dobra_automatica, false);
  });

  it('28x28 with 30 days aboard = 28 ON + 2 DBA', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_28,
      [{ tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-30' }],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_on, 28);
    assert.equal(calc.dias_dba, 2);
    assert.equal(calc.embarques[0].dias_totais, 30);
    assert.equal(calc.embarques[0].soma_ok, true);
  });

  it('clips overflow DBA to the period (cycle starts previous month)', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [{ tipo: 'normal', data_embarque: '2026-08-20', data_desembarque: '2026-09-05' }],
      [],
      SETEMBRO,
    );
    // Aug 20–Sep 2 = 14 ON; Sep 3–5 = 3 DBA. Period Sep: Sep 1–2 ON + Sep 3–5 DBA.
    assert.equal(calc.dias_on, 2);
    assert.equal(calc.dias_dba, 3);
    assert.equal(calc.embarques[0].dias_totais, 17);
  });

  it('STB in the rest window counts as STB not FOLGA', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [
        { tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-14' },
        { tipo: 'stb', data_embarque: '2026-09-15', data_desembarque: '2026-09-18' },
      ],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_on, 14);
    assert.equal(calc.dias_stb, 4);
    assert.equal(calc.dias_folga, 10);
  });

  it('explicit FI days plus deficit do not double-count', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [
        { tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-14' },
        { tipo: 'fi', data_embarque: '2026-09-15', data_desembarque: '2026-09-16' },
        { tipo: 'normal', data_embarque: '2026-09-21', data_desembarque: '2026-10-04' },
      ],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_fi_evento, 2);
    assert.equal(calc.dias_fi_deficit, 8);
    assert.equal(calc.dias_fi, 8);
  });

  it('FER from afastamento wins over ON', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [{ tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-14' }],
      [{ tipo_afastamento: 'ferias', data_inicio: '2026-09-10', data_fim: '2026-09-12' }],
      SETEMBRO,
    );
    assert.equal(calc.dias_fer, 3);
    assert.equal(calc.dias_on, 11);
    assert.equal(calc.embarques[0].dias_on, 11);
  });

  it('explicit DBA event counts all days as DBA', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [
        { tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-14' },
        { tipo: 'dba', data_embarque: '2026-09-15', data_desembarque: '2026-09-16' },
      ],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_on, 14);
    assert.equal(calc.dias_dba, 2);
  });

  it('previsto ON* is not boarded time', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [{ tipo: 'previsto', data_embarque: '2026-09-01', data_desembarque: '2026-09-14' }],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_on, 0);
    assert.equal(calc.dias_dba, 0);
    assert.equal(calc.statusPorDia['2026-09-01'], 'ON*');
  });

  it('builds payroll rubricas from the same numbers', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [{ tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-16' }],
      [],
      SETEMBRO,
    );
    const rub = montarRubricasFolha(
      { matricula: '1', cpf: '000', nome: 'TESTE', cargo: 'OS', centro_custo: 'CC' },
      calc,
    );
    assert.equal(rub.rubricas.dias_embarcado, 14);
    assert.equal(rub.rubricas.dias_dobra, 2);
    const totais = somarTotaisFechamento([calc]);
    assert.equal(totais.totalON, 14);
    assert.equal(totais.totalDBA, 2);
    assert.ok(totais.colaboradoresComAlerta >= 1);
  });

  it('adjacent cycles (no rest) yield full FI plus rest after last embarque', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [
        { tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-14' },
        { tipo: 'normal', data_embarque: '2026-09-15', data_desembarque: '2026-09-28' },
      ],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_fi_deficit, 14);
    assert.equal(calc.dias_on, 28);
    assert.equal(calc.dias_folga, 2);
  });
});

describe('ymdFromDate', () => {
  it('formats local civil date', () => {
    assert.equal(ymdFromDate(d('2026-09-10')), '2026-09-10');
  });
});
