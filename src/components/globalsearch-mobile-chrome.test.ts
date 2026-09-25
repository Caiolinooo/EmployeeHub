import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('GlobalSearch mobile chrome', () => {
  it('header trigger is md:hidden and overlay has Esc + close', () => {
    const layout = readFileSync(new URL('./Layout/MainLayout.tsx', import.meta.url), 'utf8');
    assert.match(layout, /md:hidden[\s\S]{0,80}<GlobalSearch/);
    const src = readFileSync(new URL('./GlobalSearch.tsx', import.meta.url), 'utf8');
    assert.match(src, /useEscapeToClose/);
    assert.match(src, /ModalCloseButton/);
  });
});
