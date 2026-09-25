import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('DeleteCourseModal mobile chrome', () => {
  it('has Esc and mobile-only X', () => {
    const src = readFileSync(new URL('./DeleteCourseModal.tsx', import.meta.url), 'utf8');
    assert.match(src, /useEscapeToClose/);
    assert.match(src, /ModalCloseButton/);
    assert.match(src, /mobileOnly/);
  });
});
