import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('DeleteCourseModal mobile chrome', () => {
  it('has Esc, mobile-only X, 44px actions and restores opener focus', () => {
    const src = readFileSync(new URL('./DeleteCourseModal.tsx', import.meta.url), 'utf8');
    assert.match(src, /useEscapeToClose/);
    assert.match(src, /ModalCloseButton/);
    assert.match(src, /mobileOnly/);
    assert.match(src, /mountOnlyWhenMobile/);
    assert.match(src, /useRestoreFocus\(isOpen\)/);
    assert.match(src, /max-md:min-h-11/);
    assert.match(src, /useEscapeToClose\(isOpen, onClose\)/);
  });
});
