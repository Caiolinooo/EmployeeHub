import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('modal chrome mobile-only', () => {
  it('globals.css scopes close target and panel to max-width 767px', () => {
    const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
    assert.match(css, /@media \(max-width: 767px\)/);
    assert.match(css, /\[data-modal-close\]/);
    assert.match(css, /min-height: 44px/);
    assert.match(css, /\[data-modal-panel\]/);
    assert.match(css, /max-height: 100dvh/);
  });

  it('globals.css keeps mobile-only data selectors inside max-width 767px', () => {
    const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
    const marker = '@media (max-width: 767px)';
    const mediaIdx = css.indexOf(marker);
    assert.ok(mediaIdx >= 0);
    const outside = css.slice(0, mediaIdx);
    const inside = css.slice(mediaIdx);
    const selectors = [
      '[data-modal-close]',
      '[data-modal-panel]',
      '[data-gt-kpi-cards]',
      '[data-portal-main]',
      '[data-fab-companion]',
      '[data-fab-help]',
      '[data-fab-companion-panel]',
      '[data-fab-companion-action]',
    ];
    for (const sel of selectors) {
      assert.equal(outside.includes(sel), false, `${sel} fora do media`);
      assert.ok(inside.includes(sel), `${sel} ausente no media`);
    }
    assert.equal((css.match(/@media \(max-width: 767px\)/g) || []).length, 1);
  });

  it('ModalCloseButton exposes data-modal-close and optional md:hidden', () => {
    const src = readFileSync(new URL('./ModalCloseButton.tsx', import.meta.url), 'utf8');
    assert.match(src, /data-modal-close/);
    assert.match(src, /mobileOnly/);
    assert.match(src, /md:hidden/);
    assert.match(src, /aria-label/);
  });
});

describe('GT mobile scrollports', () => {
  it('keeps desktop flex-1 and adds max-lg min-height', () => {
    const shell = readFileSync(new URL('../gestao-tripulantes/GtPageShell.tsx', import.meta.url), 'utf8');
    assert.match(shell, /max-lg:min-h-\[50vh\]/);
    assert.match(shell, /GT_PAGE_TABLIST_CLASS/);
    const grid = readFileSync(
      new URL('../gestao-tripulantes/man-schedule-grid-classes.ts', import.meta.url),
      'utf8',
    );
    assert.match(grid, /max-lg:min-h-\[50vh\]/);
  });
});

describe('modals without visible X now expose mobile close', () => {
  it('ConfirmationModal renders ModalCloseButton mobileOnly', () => {
    const src = readFileSync(new URL('./ConfirmationModal.tsx', import.meta.url), 'utf8');
    assert.match(src, /ModalCloseButton/);
    assert.match(src, /mobileOnly/);
    assert.match(src, /useEscapeToClose/);
    assert.match(src, /data-modal-panel/);
  });

  it('LanguageDialog renders accessible close on mobile', () => {
    const src = readFileSync(new URL('../LanguageDialog.tsx', import.meta.url), 'utf8');
    assert.match(src, /ModalCloseButton/);
    assert.match(src, /mobileOnly/);
    assert.match(src, /useEscapeToClose/);
    assert.match(src, /data-modal-panel/);
  });

  it('SetPasswordModal keeps no X (gate obrigatório) and scrolls in 100dvh', () => {
    const src = readFileSync(new URL('../Auth/SetPasswordModal.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /ModalCloseButton/);
    assert.match(src, /impedir que o usuário feche/);
    assert.match(src, /data-modal-panel/);
  });
});
