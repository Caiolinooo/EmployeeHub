import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aplicarStatusEscalaHoje,
  civilTodayYmd,
  countPobOnCivilDay,
  dayCodeForCivilDay,
  hasAsteriskScheduleCode,
  isEmbarcadoPobDayCode,
  isRotacaoPrevista,
  parseGtDashboardKpi,
  pickEventForCivilDay,
  resolverStatusEscalaHoje,
  scheduleDisplayCode,
  statusEmbarqueFromDayCode,
  type EscalaEventoDia,
} from './embarque-status';

describe('isEmbarcadoPobDayCode', () => {
  it('counts exact ON only', () => {
    assert.equal(isEmbarcadoPobDayCode('ON'), true);
    assert.equal(isEmbarcadoPobDayCode('on'), true);
    assert.equal(isEmbarcadoPobDayCode(' ON '), true);
  });

  it('rejects asterisk and other Man Schedule codes', () => {
    assert.equal(isEmbarcadoPobDayCode('ON*'), false);
    assert.equal(isEmbarcadoPobDayCode('*'), false);
    assert.equal(isEmbarcadoPobDayCode('STB'), false);
    assert.equal(isEmbarcadoPobDayCode('DBA'), false);
    assert.equal(isEmbarcadoPobDayCode('UTR'), false);
    assert.equal(isEmbarcadoPobDayCode('DHC'), false);
    assert.equal(isEmbarcadoPobDayCode('FI'), false);
    assert.equal(isEmbarcadoPobDayCode('OFF-C'), false);
    assert.equal(isEmbarcadoPobDayCode('-'), false);
    assert.equal(isEmbarcadoPobDayCode(''), false);
  });
});

describe('hasAsteriskScheduleCode', () => {
  it('detects ON* and bare *', () => {
    assert.equal(hasAsteriskScheduleCode('ON*'), true);
    assert.equal(hasAsteriskScheduleCode('*'), true);
    assert.equal(hasAsteriskScheduleCode('ON'), false);
  });
});

describe('scheduleDisplayCode / previsto', () => {
  it('maps previsto and the LGP marker to ON*', () => {
    assert.equal(scheduleDisplayCode('previsto'), 'ON*');
    assert.equal(scheduleDisplayCode('normal', 'GT_EMBARQUE=previsto | RTPE: Programado'), 'ON*');
    assert.equal(isRotacaoPrevista('normal', 'GT_EMBARQUE=previsto'), true);
    assert.equal(isRotacaoPrevista('normal', 'GT_EMBARQUE=real'), false);
    assert.equal(scheduleDisplayCode('normal', 'GT_EMBARQUE=real'), 'ON');
  });
});

describe('parseGtDashboardKpi', () => {
  it('accepts known KPI keys only', () => {
    assert.equal(parseGtDashboardKpi('embarcados'), 'embarcados');
    assert.equal(parseGtDashboardKpi('docs_vencidos'), 'docs_vencidos');
    assert.equal(parseGtDashboardKpi('nope'), '');
    assert.equal(parseGtDashboardKpi(null), '');
  });
});

describe('pickEventForCivilDay', () => {
  const hoje = '2026-09-01';
  const events: EscalaEventoDia[] = [
    {
      id: 'prev',
      tipo: 'previsto',
      data_embarque: '2026-08-28',
      data_desembarque: '2026-09-10',
      observacoes: 'GT_EMBARQUE=previsto',
    },
    {
      id: 'on',
      tipo: 'normal',
      data_embarque: '2026-09-01',
      data_desembarque: '2026-09-20',
      observacoes: 'GT_EMBARQUE=real',
    },
  ];

  it('prefers the rotation that starts today over a covering previsto', () => {
    const picked = pickEventForCivilDay(events, hoje);
    assert.equal(picked?.id, 'on');
    assert.equal(dayCodeForCivilDay(events, hoje), 'ON');
    assert.equal(isEmbarcadoPobDayCode(dayCodeForCivilDay(events, hoje)), true);
  });

  it('returns ON* when only a predicted rotation covers the day', () => {
    const onlyPrev = events.filter((e) => e.id === 'prev');
    assert.equal(dayCodeForCivilDay(onlyPrev, '2026-08-30'), 'ON*');
    assert.equal(isEmbarcadoPobDayCode(dayCodeForCivilDay(onlyPrev, '2026-08-30')), false);
  });
});

describe('statusEmbarqueFromDayCode', () => {
  it('maps Man Schedule cells to list badges', () => {
    assert.equal(statusEmbarqueFromDayCode('ON', 'folga'), 'embarcado');
    assert.equal(statusEmbarqueFromDayCode('STB', 'folga'), 'standby');
    assert.equal(statusEmbarqueFromDayCode('OFF', 'embarcado'), 'folga');
    assert.equal(statusEmbarqueFromDayCode('OFF-C', 'embarcado'), 'folga');
    assert.equal(statusEmbarqueFromDayCode('FI', 'embarcado'), 'folga');
    assert.equal(statusEmbarqueFromDayCode('FER', 'embarcado'), 'afastado');
    assert.equal(statusEmbarqueFromDayCode('AFAST', 'folga'), 'afastado');
    assert.equal(statusEmbarqueFromDayCode('TRE', 'folga'), 'treinamento');
    assert.equal(statusEmbarqueFromDayCode('DBA', 'folga'), 'embarcado');
  });

  it('keeps stored status when the cell is empty or previsto (ON*)', () => {
    assert.equal(statusEmbarqueFromDayCode('', 'folga'), 'folga');
    assert.equal(statusEmbarqueFromDayCode('ON*', 'folga'), 'folga');
    assert.equal(statusEmbarqueFromDayCode('*', 'standby'), 'standby');
    assert.equal(statusEmbarqueFromDayCode('UTR', 'desembarcado'), 'treinamento');
  });
});

describe('resolverStatusEscalaHoje / aplicarStatusEscalaHoje', () => {
  it('overrides stale folga when today is exact ON (Anderson case)', () => {
    const events: EscalaEventoDia[] = [
      {
        id: 'on-hoje',
        tipo: 'normal',
        data_embarque: '2026-09-01',
        data_desembarque: '2026-09-14',
        observacoes: 'GT_EMBARQUE=real',
      },
    ];
    const live = resolverStatusEscalaHoje(events, '2026-09-01', 'folga');
    assert.equal(live.dayCode, 'ON');
    assert.equal(live.status, 'embarcado');
    assert.equal(isEmbarcadoPobDayCode(live.dayCode), true);

    const overlaid = aplicarStatusEscalaHoje(
      [{ id: '670', status_embarque: 'folga', standby: false, nome: 'Anderson' }],
      new Map([['670', live]]),
    );
    assert.equal(overlaid[0].status_embarque, 'embarcado');
    assert.equal(overlaid[0].standby, false);
    assert.equal(overlaid[0].escala_codigo_hoje, 'ON');
  });

  it('does not count POB for DBA even though the badge is embarcado', () => {
    const events: EscalaEventoDia[] = [
      { id: 'dba', tipo: 'dba', data_embarque: '2026-09-01', data_desembarque: '2026-09-02' },
    ];
    const live = resolverStatusEscalaHoje(events, '2026-09-01', 'folga');
    assert.equal(live.dayCode, 'DBA');
    assert.equal(live.status, 'embarcado');
    assert.equal(isEmbarcadoPobDayCode(live.dayCode), false);
  });
});

describe('countPobOnCivilDay', () => {
  it('counts exact ON on the civil day and ignores ON* / STB', () => {
    const members = [
      {
        rotations: [
          { id: 'a', type: 'normal', start: '2026-09-01', end: '2026-09-14', observacoes: 'GT_EMBARQUE=real' },
        ],
      },
      {
        rotations: [
          { id: 'b', type: 'previsto', start: '2026-08-20', end: '2026-09-10', observacoes: 'GT_EMBARQUE=previsto' },
        ],
      },
      {
        rotations: [{ id: 'c', type: 'stb', start: '2026-08-01', end: '2026-09-30' }],
      },
    ];
    assert.equal(countPobOnCivilDay(members, '2026-09-01'), 1);
    assert.equal(countPobOnCivilDay(members, '2026-08-25'), 0);
  });

  it('formats civil today as YYYY-MM-DD in local time', () => {
    assert.equal(civilTodayYmd(new Date(2026, 8, 1, 23, 30, 0)), '2026-09-01');
  });

  it('manual ON beats MIO OFF-C starting the same day (POB pick)', () => {
    const events = [
      { id: 'offc-mio', tipo: 'offc', data_embarque: '2026-10-17', data_desembarque: '2026-10-31', origem: 'mio' },
      { id: 'on-local', tipo: 'normal', data_embarque: '2026-10-17', data_desembarque: '2026-10-31', origem: 'local' },
    ];
    assert.equal(dayCodeForCivilDay(events, '2026-10-20'), 'ON');
  });

  it('FER/AFAST dominate the day pick even over a manual ON overlap', () => {
    const events = [
      { id: 'fer', tipo: 'ferias', data_embarque: '2026-10-17', data_desembarque: '2026-10-31' },
      { id: 'on-local', tipo: 'normal', data_embarque: '2026-10-17', data_desembarque: '2026-10-31', origem: 'local' },
    ];
    assert.equal(dayCodeForCivilDay(events, '2026-10-20'), 'FER');
  });
});
