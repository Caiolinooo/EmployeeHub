import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('GlobalSearch mobile chrome', () => {
  it('header trigger is md:hidden and overlay has Esc + close', () => {
    const layout = readFileSync(new URL('./Layout/MainLayout.tsx', import.meta.url), 'utf8');
    const headerMobile = layout.slice(layout.indexOf('md:hidden flex items-center gap-2'));
    assert.match(headerMobile.slice(0, 500), /<GlobalSearch/);
    const src = readFileSync(new URL('./GlobalSearch.tsx', import.meta.url), 'utf8');
    assert.match(src, /useEscapeToClose/);
    assert.match(src, /ModalCloseButton/);
    assert.match(src, /max-width: 767px/);
    assert.match(src, /if \(!isNarrow767\) return/);
    assert.match(src, /triggerRef\.current\?\.focus/);
  });
});
