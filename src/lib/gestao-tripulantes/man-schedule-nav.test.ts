import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { adjacentColumnIndex } from './man-schedule-nav';
import {
  buildScheduleColumns,
  civilReferenceMonth,
  clampReferenceMonth,
  focusColumnIndex,
  formatReferenceMonthLabel,
  indexOfCivilDay,
  indexOfReferenceMonth,
  parseReferenceMonthKey,
  realtimeJanelaForReferenceMonth,
  referenceMonthKey,
  shiftReferenceMonth,
} from './man-schedule-reference-month';

describe('adjacentColumnIndex', () => {
  it('moves one column and clamps at the ends', () => {
    assert.equal(adjacentColumnIndex(4, 1, 10), 5);
    assert.equal(adjacentColumnIndex(4, -1, 10), 3);
    assert.equal(adjacentColumnIndex(0, -1, 10), 0);
    assert.equal(adjacentColumnIndex(9, 1, 10), 9);
    assert.equal(adjacentColumnIndex(0, 1, 0), 0);
  });
});

describe('reference month navigation', () => {
  it('shifts across year boundaries and clamps to 1990–2100', () => {
    assert.deepEqual(shiftReferenceMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
    assert.deepEqual(shiftReferenceMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
    assert.deepEqual(shiftReferenceMonth({ year: 1990, month: 1 }, -1), { year: 1990, month: 1 });
    assert.deepEqual(shiftReferenceMonth({ year: 2100, month: 12 }, 1), { year: 2100, month: 12 });
    assert.deepEqual(clampReferenceMonth({ year: 1800, month: 6 }), { year: 1990, month: 1 });
  });

  it('round-trips YYYY-MM keys and reads the civil month of a given date', () => {
    assert.equal(referenceMonthKey({ year: 2026, month: 9 }), '2026-09');
    assert.deepEqual(parseReferenceMonthKey('2026-09'), { year: 2026, month: 9 });
    assert.equal(parseReferenceMonthKey('2026-13'), null);
    assert.deepEqual(civilReferenceMonth(new Date(2026, 8, 2)), { year: 2026, month: 9 });
  });

  it('formats the month label in pt-BR and en-US', () => {
    assert.equal(formatReferenceMonthLabel({ year: 2026, month: 9 }, 'pt-BR'), 'Setembro 2026');
    assert.equal(formatReferenceMonthLabel({ year: 2026, month: 9 }, 'en-US'), 'September 2026');
  });
});

describe('buildScheduleColumns anchored on a reference month', () => {
  it('covers a future month with no rotations in week viewport', () => {
    const columns = buildScheduleColumns({
      viewport: 'week',
      referenceMonth: { year: 2027, month: 3 },
      rotationDates: [],
      filterStart: null,
      filterEnd: null,
    });

    assert.ok(columns.length >= 12);
    assert.ok(indexOfCivilDay(columns, '2027-03-01', 'week') >= 0);
    assert.ok(indexOfCivilDay(columns, '2027-03-31', 'week') >= 0);
    assert.equal(indexOfCivilDay(columns, '2026-09-02', 'week'), -1);
  });

  it('day viewport without filters is only the reference month, even with distant rotations', () => {
    const columns = buildScheduleColumns({
      viewport: 'day',
      referenceMonth: { year: 2026, month: 9 },
      rotationDates: [new Date(2020, 0, 1), new Date(2028, 11, 31)],
      filterStart: null,
      filterEnd: null,
    });

    assert.equal(columns.length, 30);
    assert.equal(columns[0].date.getFullYear(), 2026);
    assert.equal(columns[0].date.getMonth(), 8);
    assert.equal(columns[0].date.getDate(), 1);
    assert.equal(columns[29].date.getDate(), 30);
  });

  it('week viewport unions existing rotations with the reference month', () => {
    const columns = buildScheduleColumns({
      viewport: 'week',
      referenceMonth: { year: 2026, month: 9 },
      rotationDates: [new Date(2026, 0, 15)],
      filterStart: null,
      filterEnd: null,
    });

    assert.ok(indexOfCivilDay(columns, '2026-01-15', 'week') >= 0);
    assert.ok(indexOfCivilDay(columns, '2026-09-15', 'week') >= 0);
  });

  it('focuses today in the current month and the first overlapping column in a future month', () => {
    const current = buildScheduleColumns({
      viewport: 'week',
      referenceMonth: { year: 2026, month: 9 },
      rotationDates: [],
      filterStart: null,
      filterEnd: null,
    });
    const todayIdx = indexOfCivilDay(current, '2026-09-02', 'week');
    assert.ok(todayIdx >= 0);
    assert.equal(
      focusColumnIndex(current, { year: 2026, month: 9 }, 'week', '2026-09-02'),
      todayIdx,
    );

    const future = buildScheduleColumns({
      viewport: 'week',
      referenceMonth: { year: 2027, month: 3 },
      rotationDates: [],
      filterStart: null,
      filterEnd: null,
    });
    const monthIdx = indexOfReferenceMonth(future, { year: 2027, month: 3 }, 'week');
    assert.ok(monthIdx >= 0);
    assert.equal(
      focusColumnIndex(future, { year: 2027, month: 3 }, 'week', '2026-09-02'),
      monthIdx,
    );
  });
});

describe('realtimeJanelaForReferenceMonth', () => {
  const now = new Date(2026, 8, 2);

  it('keeps the default 90d window for the current month', () => {
    assert.equal(realtimeJanelaForReferenceMonth({ year: 2026, month: 9 }, now), '90d');
  });

  it('widens the fetch window for a distant future month', () => {
    assert.equal(realtimeJanelaForReferenceMonth({ year: 2027, month: 3 }, now), '180d');
    assert.equal(realtimeJanelaForReferenceMonth({ year: 2028, month: 6 }, now), 'all');
  });
});
