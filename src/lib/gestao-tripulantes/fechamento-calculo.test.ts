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

// Regra do dono (2026-09): o dia do DESEMBARQUE é o 1º dia de folga.
// Janela a bordo = [data_embarque, data_desembarque - 1]; janela de folga
// nasce no próprio data_desembarque. Por isso um ciclo "14 dias embarcado"
// registra desembarque no 15º dia civil (ex.: embarque 09-01, desembarque 09-15).
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
      [{ tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-15' }],
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
    // Regra do dono: véspera do desembarque é o último dia ON e o dia do
    // desembarque é o 1º dia de folga.
    assert.equal(calc.statusPorDia['2026-09-14'], 'ON');
    assert.equal(calc.statusPorDia['2026-09-15'], 'FOLGA');
  });

  it('14 days aboard + 2 extra = 14 ON + 2 DBA', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [{ tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-17' }],
      [],
      SETEMBRO,
    );
    // A bordo 09-01..09-16 (16 dias): 14 ON + 2 DBA; desembarque 09-17 é folga.
    assert.equal(calc.dias_on, 14);
    assert.equal(calc.dias_dba, 2);
    assert.equal(calc.dias_folga, 14);
    assert.equal(calc.embarques[0].dias_totais, 16);
    assert.equal(calc.embarques[0].soma_ok, true);
    assert.equal(calc.embarques[0].escala_ok, false);
    assert.ok(calc.checagens.alertas.some((a) => a.includes('DBA')));
  });

  it('returns early: rest 7 of 14 yields FI deficit 7', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [
        { tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-15' },
        { tipo: 'normal', data_embarque: '2026-09-22', data_desembarque: '2026-10-06' },
      ],
      [],
      SETEMBRO,
    );
    // Janela de folga 09-15..09-21 (7 dias, do desembarque até a véspera do
    // reembarque); os 7 dias de escala que a janela curta nem alcançou a ter
    // viram FI no período.
    assert.equal(calc.dias_on, 14 + 9);
    assert.equal(calc.dias_folga, 7);
    assert.equal(calc.dias_fi_deficit, 7);
    assert.equal(calc.dias_fi, 7);
    assert.equal(calc.embarques[0].dias_folga_real, 7);
    assert.equal(calc.embarques[0].dias_fi_deficit, 7);
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
      [{ tipo: 'normal', data_embarque: '2026-09-01', data_prevista_desembarque: '2026-09-15' }],
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
        { tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-21' },
        { tipo: 'normal', data_embarque: '2026-09-22', data_desembarque: '2026-10-01' },
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
      [{ tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-10-01' }],
      [],
      SETEMBRO,
    );
    // A bordo 09-01..09-30 (30 dias): 28 ON + 2 DBA; desembarque 01/out é folga.
    assert.equal(calc.dias_on, 28);
    assert.equal(calc.dias_dba, 2);
    assert.equal(calc.embarques[0].dias_totais, 30);
    assert.equal(calc.embarques[0].soma_ok, true);
  });

  it('clips overflow DBA to the period (cycle starts previous month)', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [{ tipo: 'normal', data_embarque: '2026-08-20', data_desembarque: '2026-09-06' }],
      [],
      SETEMBRO,
    );
    // A bordo 20/ago–05/set = 14 ON + 3 DBA (03–05/set); desembarque 06/set
    // já é folga (janela 06–19/set inteira no período).
    assert.equal(calc.dias_on, 2);
    assert.equal(calc.dias_dba, 3);
    assert.equal(calc.embarques[0].dias_totais, 17);
    assert.equal(calc.dias_folga, 14);
  });

  it('STB in the rest window counts as STB not FOLGA', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [
        { tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-15' },
        { tipo: 'stb', data_embarque: '2026-09-16', data_desembarque: '2026-09-19' },
      ],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_on, 14);
    assert.equal(calc.dias_stb, 4);
    // Janela 09-15..09-28: desembarque (15) folga + 20–28 folga = 10.
    assert.equal(calc.dias_folga, 10);
  });

  it('explicit FI days plus deficit do not double-count', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [
        { tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-15' },
        { tipo: 'fi', data_embarque: '2026-09-16', data_desembarque: '2026-09-17' },
        { tipo: 'normal', data_embarque: '2026-09-22', data_desembarque: '2026-10-06' },
      ],
      [],
      SETEMBRO,
    );
    // Janela 09-15..09-21 (7 dias): FI explícito 16–17 pinta FI; déficit de
    // escala = fantasma 14 − 7 = 7; dias_fi = 7 (não 9 — FI explícito já está
    // dentro do déficit).
    assert.equal(calc.dias_fi_evento, 2);
    assert.equal(calc.dias_fi_deficit, 7);
    assert.equal(calc.dias_fi, 7);
  });

  it('FER from afastamento wins over ON', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [{ tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-15' }],
      [{ tipo_afastamento: 'ferias', data_inicio: '2026-09-11', data_fim: '2026-09-13' }],
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
        { tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-15' },
        { tipo: 'dba', data_embarque: '2026-09-16', data_desembarque: '2026-09-17' },
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
      [{ tipo: 'previsto', data_embarque: '2026-09-01', data_desembarque: '2026-09-15' }],
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
      [{ tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-17' }],
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

  it('adjacent cycles: desembarque day is folga even with next-day re-embark', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [
        { tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-15' },
        { tipo: 'normal', data_embarque: '2026-09-16', data_desembarque: '2026-09-30' },
      ],
      [],
      SETEMBRO,
    );
    // Ciclo 1: desembarque 15/set = único dia de folga antes do reembarque
    // (16/set); fantasma 14 − 1 = 13 vira FI deste período. ON = 14 + 14
    // (16–29/set). Ciclo 2 (último): desembarque 30/set pinta folga.
    assert.equal(calc.dias_fi_deficit, 13);
    assert.equal(calc.dias_on, 28);
    assert.equal(calc.dias_folga, 2);
    assert.equal(calc.statusPorDia['2026-09-15'], 'FOLGA');
  });

  it('embarque e desembarque no mesmo dia: 0 ON e o dia é folga', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [
        { tipo: 'normal', data_embarque: '2026-09-15', data_desembarque: '2026-09-15' },
        { tipo: 'normal', data_embarque: '2026-09-20', data_desembarque: '2026-10-03' },
      ],
      [],
      SETEMBRO,
    );
    // Mesmo dia = nunca a bordo; desembarque (o próprio dia) é folga 1 da
    // janela 15–19/set (5 dias). Fantasma 14 − 5 = 9 de FI.
    assert.equal(calc.dias_on, 11);
    assert.equal(calc.dias_folga, 5);
    assert.equal(calc.dias_fi_deficit, 9);
    assert.equal(calc.statusPorDia['2026-09-15'], 'FOLGA');
  });
});

describe('DBA explícito não é ciclo de rotação', () => {
  it('DBA entre dois ciclos: reduz folga realizada e gera FI 5 (não 19)', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [
        { tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-15' },
        { tipo: 'dba', data_embarque: '2026-09-16', data_desembarque: '2026-09-17' },
        { tipo: 'normal', data_embarque: '2026-09-26', data_desembarque: '2026-10-09' },
      ],
      [],
      SETEMBRO,
    );
    // Janela 15–25/set (11 dias): folga real = 11 − 2 DBA = 9; déficit =
    // (11 − 9) + fantasma (14 − 11 = 3) = 5. ON = 01–14 + 26–30/set.
    assert.equal(calc.dias_dba, 2);
    assert.equal(calc.dias_fi, 5);
    assert.equal(calc.dias_fi_deficit, 5);
    assert.equal(calc.dias_folga, 9);
    assert.equal(calc.dias_on, 14 + 5);
    assert.equal(calc.statusPorDia['2026-09-15'], 'FOLGA');
    assert.equal(calc.statusPorDia['2026-09-16'], 'DBA');
    assert.equal(calc.statusPorDia['2026-09-18'], 'FOLGA');
    // DBA não entra como ciclo NxN: só os dois embarques normais.
    assert.equal(calc.embarques.length, 2);
    assert.ok(calc.embarques.every((e) => e.data_inicio !== '2026-09-16'));
    assert.equal(calc.embarques[0].dias_folga_real, 9);
    assert.equal(calc.embarques[0].dias_fi_deficit, 5);
    assert.ok(calc.embarques[0].alertas.some((a) => a.includes('5 FI')));
  });

  it('DBA sem embarque posterior: folga em andamento, sem FI, FOLGA não pinta sobre DBA', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [
        { tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-15' },
        { tipo: 'dba', data_embarque: '2026-09-16', data_desembarque: '2026-09-17' },
      ],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_fi, 0);
    assert.equal(calc.dias_fi_deficit, 0);
    assert.equal(calc.dias_dba, 2);
    // Janela 15–28/set (14 dias): 15 desembarque folga + 18–28 folga = 12;
    // 16–17 continuam DBA.
    assert.equal(calc.dias_folga, 12);
    assert.equal(calc.statusPorDia['2026-09-15'], 'FOLGA');
    assert.equal(calc.statusPorDia['2026-09-16'], 'DBA');
    assert.equal(calc.statusPorDia['2026-09-17'], 'DBA');
    assert.equal(calc.statusPorDia['2026-09-18'], 'FOLGA');
    assert.equal(calc.embarques.length, 1);
    assert.equal(calc.embarques[0].dias_fi_deficit, 0);
  });

  it('DBA explícita isolada: sem ciclo, sem FI e sem janela de folga fantasma', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [{ tipo: 'dba', data_embarque: '2026-09-16', data_desembarque: '2026-09-17' }],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_dba, 2);
    assert.equal(calc.dias_fi, 0);
    assert.equal(calc.dias_fi_deficit, 0);
    assert.equal(calc.dias_folga, 0);
    assert.equal(calc.embarques.length, 0);
    assert.equal(calc.statusPorDia['2026-09-16'], 'DBA');
    assert.equal(calc.statusPorDia['2026-09-17'], 'DBA');
    assert.equal(calc.statusPorDia['2026-09-18'], undefined);
    assert.equal(calc.statusPorDia['2026-09-30'], undefined);
  });

  it('DBA fora do período: janela cross-month vira pendência do próximo período (modelo recortado)', () => {
    // Ciclo 15–28/set (a bordo); desembarque 29/set = folga dia 1; próximo
    // embarque 10/out; DBA explícito 01–02/out (FORA do período setembro).
    // Modelo recortado (R1/R4): a janela 29/set–09/out é cortada em 30/set —
    // setembro computa 29–30/set (2 dias de folga, déficit 0 no período);
    // 01–02/out de DBA viram PENDÊNCIA (2 dias de folga faltante + 3 dias de
    // escala que a janela de 11d nem alcançou a ter = 5 FI pendentes).
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [
        { tipo: 'normal', data_embarque: '2026-09-15', data_desembarque: '2026-09-29' },
        { tipo: 'dba', data_embarque: '2026-10-01', data_desembarque: '2026-10-02' },
        { tipo: 'normal', data_embarque: '2026-10-10', data_desembarque: '2026-10-23' },
      ],
      [],
      SETEMBRO,
    );
    assert.equal(calc.embarques.length, 1);
    assert.equal(calc.embarques[0].dias_folga_real, 9); // 11 dias − 2 DBA (janela inteira, informativo)
    assert.equal(calc.dias_fi_deficit, 0);
    assert.equal(calc.dias_fi, 0);
    assert.equal(calc.dias_folga, 2); // 29–30/set (29 = dia do desembarque)
    assert.equal(calc.dias_dba, 0); // DBA de outubro não entra no mês
    assert.deepEqual(calc.pendenciasProximoPeriodo, {
      fiDeficit: 5,
      dbaDias: ['2026-10-01', '2026-10-02'],
      folgaAberta: false,
      proximoEmbarque: '2026-10-10',
    });
  });

  it('janela de folga totalmente dentro do período: resultado idêntico ao modelo anterior', () => {
    // 01–14/set embarque (desembarque 15/set); folga 15–28/set (14d = escala);
    // próximo 29/set.
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [
        { tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-15' },
        { tipo: 'normal', data_embarque: '2026-09-29', data_desembarque: '2026-10-12' },
      ],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_on, 14 + 2); // 01–14 + 29–30/set
    assert.equal(calc.dias_folga, 14);
    assert.equal(calc.dias_fi_deficit, 0);
    assert.equal(calc.dias_fi, 0);
    assert.equal(calc.embarques[0].escala_ok, true);
    assert.deepEqual(calc.pendenciasProximoPeriodo, { fiDeficit: 0, dbaDias: [], folgaAberta: false });
  });

  it('janela cruzando data_fim: déficit do período exclui DBA externo e a soma entre períodos é aditiva', () => {
    // Janela 29/set–09/out (11d, do desembarque à véspera do reembarque),
    // escala 14x14. Sem DBA: recorte puro — 2 dias em setembro, 9 em outubro.
    // A janela de 11d < escala 14d: os 3 dias "fantasma" ficam pendentes para
    // outubro, onde a janela termina.
    const eventos = [
      { tipo: 'normal', data_embarque: '2026-09-15', data_desembarque: '2026-09-29' },
      { tipo: 'normal', data_embarque: '2026-10-10', data_desembarque: '2026-10-23' },
    ];
    const semDbaSet = calcularFechamentoColaborador(ESCALA_14, eventos, [], SETEMBRO);
    assert.equal(semDbaSet.dias_fi_deficit, 0);
    assert.equal(semDbaSet.pendenciasProximoPeriodo.fiDeficit, 3);

    // Com DBA 01–03/out (além de data_fim): setembro NÃO debita o DBA externo;
    // os 3 dias viram pendência (folga faltante) junto com os 3 fantasma.
    const comDba = [
      ...eventos,
      { tipo: 'dba', data_embarque: '2026-10-01', data_desembarque: '2026-10-03' },
    ];
    const setDba = calcularFechamentoColaborador(ESCALA_14, comDba, [], SETEMBRO);
    assert.equal(setDba.dias_fi_deficit, 0);
    assert.equal(setDba.dias_fi, 0);
    assert.equal(setDba.pendenciasProximoPeriodo.fiDeficit, 6); // 3 DBA + 3 fantasma
    assert.deepEqual(setDba.pendenciasProximoPeriodo.dbaDias, ['2026-10-01', '2026-10-02', '2026-10-03']);

    // Outubro computa a fatia dele: esperado 9 (01–09/out) − 3 DBA = 3 FI,
    // + 3 fantasma = 6 FI. Aditividade: setembro 0 + outubro 6.
    const outubro = { dataInicio: d('2026-10-01'), dataFim: d('2026-10-31') };
    const outDba = calcularFechamentoColaborador(ESCALA_14, comDba, [], outubro);
    assert.equal(outDba.dias_fi_deficit, 6);
    assert.equal(outDba.dias_fi, 6);
    assert.equal(outDba.pendenciasProximoPeriodo.fiDeficit, 0);
  });

  it('folga aberta sem próximo embarque: pendência informativa, sem FI', () => {
    const calc = calcularFechamentoColaborador(
      ESCALA_14,
      [{ tipo: 'normal', data_embarque: '2026-09-01', data_desembarque: '2026-09-15' }],
      [],
      SETEMBRO,
    );
    assert.equal(calc.dias_fi, 0);
    assert.equal(calc.dias_fi_deficit, 0);
    // Janela 15–28/set: desembarque (15) + 13 dias = 14 de folga.
    assert.equal(calc.dias_folga, 14);
    assert.deepEqual(calc.pendenciasProximoPeriodo, {
      fiDeficit: 0,
      dbaDias: [],
      folgaAberta: true,
    });
  });
});

describe('ymdFromDate', () => {
  it('formats local civil date', () => {
    assert.equal(ymdFromDate(d('2026-09-10')), '2026-09-10');
  });
});
