import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('767 media block (helpers #99)', () => {
  it('scopes close target and panel to max-width 767px', () => {
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
    assert.match(css, /@media \(max-width: 767px\)/);
    assert.match(css, /\[data-modal-close\]/);
    assert.match(css, /min-height: 44px/);
    assert.match(css, /\[data-modal-panel\]/);
    assert.match(css, /max-height: 100dvh/);
  });

  it('keeps only modal-close/panel selectors inside max-width 767px', () => {
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
    const marker = '@media (max-width: 767px)';
    const mediaIdx = css.indexOf(marker);
    assert.ok(mediaIdx >= 0);
    const outside = css.slice(0, mediaIdx);
    const inside = css.slice(mediaIdx);
    const keep = ['[data-modal-close]', '[data-modal-panel]'];
    const drop = [
      '[data-gt-kpi-cards]',
      '[data-portal-main]',
      '[data-fab-companion]',
      '[data-fab-help]',
      '[data-fab-companion-panel]',
      '[data-fab-companion-action]',
    ];
    for (const sel of keep) {
      assert.equal(outside.includes(sel), false, `${sel} fora do media`);
      assert.ok(inside.includes(sel), `${sel} ausente no media`);
    }
    for (const sel of drop) {
      assert.equal(inside.includes(sel), false, `${sel} no media desta PR`);
    }
    assert.equal((css.match(/@media \(max-width: 767px\)/g) || []).length, 1);
  });
});

describe('GlobalSearch mobile chrome', () => {
  it('exposes 44px X, Esc, tap-outside and mobile targets', () => {
    const src = readFileSync(new URL('./GlobalSearch.tsx', import.meta.url), 'utf8');
    assert.match(src, /ModalCloseButton/);
    assert.match(src, /useEscapeToClose/);
    assert.match(src, /data-modal-panel/);
    assert.match(src, /onClick=\{close\}/);
    assert.match(src, /max-md:min-h-11/);
    assert.doesNotMatch(src, /XMarkIcon/);
    assert.match(src, /max-width: 767px/);
    assert.match(src, /if \(!isNarrow767\) return/);
    assert.match(src, /triggerRef\.current\?\.focus/);
    assert.match(src, /data-global-search-trigger/);
  });
});
