import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const grid = readFileSync(join(dir, 'man-schedule-grid-classes.ts'), 'utf8');
const shell = readFileSync(join(dir, 'GtPageShell.tsx'), 'utf8');

test('schedule scrollport shrinks in flex and scrolls both axes', () => {
  assert.match(grid, /MAN_SCHEDULE_SCROLL_CLASS[\s\S]*min-w-0/);
  assert.match(grid, /MAN_SCHEDULE_SCROLL_CLASS[\s\S]*min-h-0/);
  assert.match(grid, /MAN_SCHEDULE_SCROLL_CLASS[\s\S]*overflow-x-scroll/);
  assert.match(grid, /MAN_SCHEDULE_SCROLL_CLASS[\s\S]*overflow-y-auto/);
});

test('top synced bar is a horizontal-only scrollport', () => {
  assert.match(grid, /MAN_SCHEDULE_TOP_SCROLL_CLASS[\s\S]*min-w-0/);
  assert.match(grid, /MAN_SCHEDULE_TOP_SCROLL_CLASS[\s\S]*overflow-x-scroll/);
  assert.match(grid, /MAN_SCHEDULE_TOP_SCROLL_CLASS[\s\S]*overflow-y-hidden/);
});

test('grid table can exceed the scrollport width', () => {
  assert.match(grid, /MAN_SCHEDULE_TABLE_CLASS[\s\S]*w-max/);
  assert.match(grid, /MAN_SCHEDULE_TABLE_CLASS[\s\S]*border-separate/);
});

test('GtPageShell chain allows horizontal overflow', () => {
  assert.match(shell, /GT_PAGE_SHELL_CLASS[\s\S]*min-w-0/);
  assert.match(shell, /GT_PAGE_SCROLLPORT_CLASS[\s\S]*min-w-0/);
  assert.match(shell, /GT_PAGE_SCROLLPORT_CLASS[\s\S]*overflow-auto/);
});
