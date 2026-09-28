import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('767 media block (helpers #99)', () => {
  it('scopes close target and panel to max-width 767px', () => {
    const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
    assert.match(css, /@media \(max-width: 767px\)/);
    assert.match(css, /\[data-modal-close\]/);
    assert.match(css, /min-height: 44px/);
    assert.match(css, /\[data-modal-panel\]/);
    assert.match(css, /max-height: 100dvh/);
  });

  it('keeps only modal-close/panel selectors inside max-width 767px', () => {
    const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
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

describe('NewsPostEditorFullScreen mobile chrome', () => {
  it('desktop classes stay portal; mobile-only truncate/gap/X', () => {
    const src = readFileSync(new URL('./NewsPostEditorFullScreen.tsx', import.meta.url), 'utf8');
    assert.match(src, /ModalCloseButton/);
    assert.match(src, /mobileOnly/);
    assert.match(src, /useEscapeToClose/);
    assert.match(src, /data-modal-panel/);
    assert.match(src, /max-md:max-h-\[calc\(100dvh-56px\)\]/);
    assert.match(src, /text-gray-500 hover:text-gray-700 max-md:hidden/);
    assert.match(src, /text-lg font-semibold max-md:min-w-0 max-md:truncate/);
    assert.match(src, /justify-between max-md:gap-3/);
    assert.match(src, /text-sm text-gray-600 max-md:shrink-0/);
    assert.doesNotMatch(src, /hidden md:inline/);
    assert.doesNotMatch(src, /justify-between gap-3/);
    assert.doesNotMatch(src, /font-semibold min-w-0 truncate/);
  });

  it('NewsPostEditor actions, inputs and tabs are 44px on mobile', () => {
    const src = readFileSync(new URL('./NewsPostEditor.tsx', import.meta.url), 'utf8');
    assert.match(src, /max-md:min-h-11/);
    assert.match(src, /max-md:flex-col/);
    assert.match(src, /max-md:overflow-x-auto max-md:no-scrollbar/);
    assert.match(src, /max-md:px-3 max-md:min-h-11 max-md:shrink-0 max-md:whitespace-nowrap/);
    assert.match(src, /removeTag\(tag\)[\s\S]*max-md:min-h-11 max-md:min-w-11/);
    assert.match(src, /addTag[\s\S]*max-md:min-h-11 max-md:min-w-11/);
    assert.match(src, /tituloDoPost[\s\S]{0,200}max-md:min-h-11|max-md:min-h-11[\s\S]{0,200}tituloDoPost/);
  });
});
