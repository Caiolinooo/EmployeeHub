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
  });
});

describe('NewsPostEditorFullScreen mobile chrome', () => {
  it('has visible mobile X, Esc and scrollable stack', () => {
    const src = readFileSync(new URL('./NewsPostEditorFullScreen.tsx', import.meta.url), 'utf8');
    assert.match(src, /ModalCloseButton/);
    assert.match(src, /mobileOnly/);
    assert.match(src, /useEscapeToClose/);
    assert.match(src, /data-modal-panel/);
    assert.match(src, /max-md:max-h-\[calc\(100dvh-56px\)\]/);
    assert.match(src, /hidden md:inline/);
  });

  it('NewsPostEditor actions are 44px on mobile', () => {
    const src = readFileSync(new URL('./NewsPostEditor.tsx', import.meta.url), 'utf8');
    assert.match(src, /max-md:min-h-11/);
    assert.match(src, /max-md:flex-col/);
  });
});
