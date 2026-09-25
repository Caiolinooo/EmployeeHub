import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('767 media block (helpers #99)', () => {
  it('scopes close target and panel to max-width 767px', () => {
    const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
    assert.match(css, /@media \(max-width: 767px\)/);
    assert.match(css, /\[data-modal-close\]/);
    assert.match(css, /min-height: 44px/);
  });
});

describe('Academy editor mobile chrome', () => {
  it('DeleteCourseModal has X, Esc and tap-outside', () => {
    const src = readFileSync(new URL('./DeleteCourseModal.tsx', import.meta.url), 'utf8');
    assert.match(src, /ModalCloseButton/);
    assert.match(src, /mobileOnly/);
    assert.match(src, /useEscapeToClose/);
    assert.match(src, /data-modal-panel/);
    assert.match(src, /onClick=\{onClose\}/);
  });

  it('editor list stacks header and enlarges actions on mobile', () => {
    const src = readFileSync(new URL('../../app/academy/editor/page.tsx', import.meta.url), 'utf8');
    assert.match(src, /max-md:flex-col/);
    assert.match(src, /max-md:min-h-11/);
    assert.match(src, /max-md:text-xl/);
  });
});
