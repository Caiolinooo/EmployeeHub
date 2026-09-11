/**
 * Unit checks for calendar similarity dedupe.
 * Run: npx tsx scripts/test-calendar-event-dedupe.ts
 */
import assert from 'node:assert/strict';
import {
  calendarEventStartKey,
  dedupeSimilarCalendarEvents,
  locationsCompatible,
  normalizeCalendarText,
  titlesAreSimilar,
} from '../src/lib/calendar-event-dedupe';

function check(name: string, fn: () => void) {
  fn();
  console.log(`ok  ${name}`);
}

check('normalize strips accents, case, punctuation and copy suffix', () => {
  assert.equal(
    normalizeCalendarText('Reunião QHSE (cópia)'),
    normalizeCalendarText('reuniao qhse'),
  );
  assert.equal(normalizeCalendarText('Stand-up Daily'), 'stand up daily');
});

check('titles similar: accents and punctuation, not distinct meetings', () => {
  assert.equal(titlesAreSimilar('Reunião QHSE', 'Reuniao QHSE'), true);
  assert.equal(titlesAreSimilar('Stand-up Daily', 'Standup Daily'), true);
  assert.equal(titlesAreSimilar('Daily Stand-up', 'Weekly Stand-up'), false);
  assert.equal(titlesAreSimilar('Reunião 1', 'Reunião 2'), false);
  assert.equal(titlesAreSimilar('RH', 'RI'), false);
});

check('start key: same minute merges, different minute stays', () => {
  assert.equal(
    calendarEventStartKey('2026-09-01T13:00:00.000Z'),
    calendarEventStartKey('2026-09-01T13:00:41.000Z'),
  );
  assert.notEqual(
    calendarEventStartKey('2026-09-01T13:00:00.000Z'),
    calendarEventStartKey('2026-09-01T14:00:00.000Z'),
  );
  assert.equal(
    calendarEventStartKey('2026-09-07', true),
    calendarEventStartKey('2026-09-07T00:00:00.000Z', true),
  );
});

check('locations: empty is compatible; distinct rooms are not', () => {
  assert.equal(locationsCompatible(undefined, 'Sala 1'), true);
  assert.equal(locationsCompatible('Sala 1', 'sala 1'), true);
  assert.equal(locationsCompatible('Sala 1', 'Sala 2'), false);
});

check('dedupe keeps richer record and hides duplicates', () => {
  const { events, hidden } = dedupeSimilarCalendarEvents([
    {
      id: 'thin',
      summary: 'Reuniao de alinhamento',
      start: '2026-09-01T10:00:00.000Z',
      location: '',
    },
    {
      id: 'rich',
      summary: 'Reunião de alinhamento',
      start: '2026-09-01T10:00:22.000Z',
      location: 'Auditório A',
      description: 'Pauta completa do trimestre',
      url: 'https://calendar.example/event',
      attendees: [{ email: 'a@groupabz.com', name: 'Ana' }],
    },
    {
      id: 'later',
      summary: 'Reunião de alinhamento',
      start: '2026-09-01T15:00:00.000Z',
      location: 'Auditório A',
    },
    {
      id: 'other-room',
      summary: 'Reunião de alinhamento',
      start: '2026-09-01T10:00:00.000Z',
      location: 'Sala B',
    },
  ]);

  assert.equal(events.length, 3);
  assert.equal(hidden, 1);
  const kept = events.find((e) => e.start.startsWith('2026-09-01T10:00') && e.location === 'Auditório A');
  assert.ok(kept);
  assert.equal(kept?.id, 'rich');
  assert.equal(kept?.description, 'Pauta completa do trimestre');
  assert.equal(kept?.url, 'https://calendar.example/event');
  assert.equal(kept?.attendees?.length, 1);
});

check('all-day holiday vs timed company event stay separate', () => {
  const { events, hidden } = dedupeSimilarCalendarEvents([
    { name: 'Independência do Brasil', start: '2026-09-07', allDay: true },
    { summary: 'Independência do Brasil', start: '2026-09-07T14:00:00.000Z', allDay: false },
  ]);
  assert.equal(events.length, 2);
  assert.equal(hidden, 0);
});

check('all-day ICS + holiday with similar title merge', () => {
  const { events, hidden } = dedupeSimilarCalendarEvents([
    { name: 'Consciência Negra', start: '2026-11-20', allDay: true, description: 'Feriado Nacional' },
    { name: 'Consciencia Negra', start: '2026-11-20', allDay: true, type: 'MUNICIPAL' },
  ]);
  assert.equal(events.length, 1);
  assert.equal(hidden, 1);
  assert.equal(events[0].description, 'Feriado Nacional');
});

check('idempotent', () => {
  const input = [
    { summary: 'Kick-off Projeto Alpha', start: '2026-09-10T09:00:00.000Z', location: 'Teams' },
    { summary: 'Kickoff Projeto Alpha', start: '2026-09-10T09:00:00.000Z', location: 'Teams' },
  ];
  const first = dedupeSimilarCalendarEvents(input);
  const second = dedupeSimilarCalendarEvents(first.events);
  assert.equal(first.events.length, 1);
  assert.equal(second.events.length, 1);
  assert.equal(second.hidden, 0);
});

console.log('\nAll calendar dedupe checks passed.');
