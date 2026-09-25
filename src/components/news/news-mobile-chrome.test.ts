import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('NewsPostEditorFullScreen mobile chrome', () => {
  it('has Esc, panel and mobile-only X', () => {
    const src = readFileSync(new URL('./NewsPostEditorFullScreen.tsx', import.meta.url), 'utf8');
    assert.match(src, /useEscapeToClose/);
    assert.match(src, /data-modal-panel/);
    assert.match(src, /ModalCloseButton/);
    assert.match(src, /mobileOnly/);
    assert.match(src, /max-md:hidden/);
    assert.doesNotMatch(src, /hidden md:inline/);
  });
});
