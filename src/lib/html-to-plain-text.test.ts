import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { htmlToPlainText } from './html-to-plain-text';

function assertFast(fn: () => void, limitMs = 100): void {
  const t0 = performance.now();
  fn();
  const dt = performance.now() - t0;
  assert.ok(dt < limitMs, `pathological input took ${dt.toFixed(1)}ms (limit ${limitMs}ms)`);
}

describe('htmlToPlainText characterization', () => {
  it('matches /<[^>]*>/g on notification-like HTML', () => {
    assert.equal(htmlToPlainText('<p>Hello <b>world</b></p>'), 'Hello world');
    assert.equal(htmlToPlainText('plain'), 'plain');
    assert.equal(htmlToPlainText('hello < incomplete'), 'hello < incomplete');
    assert.equal(htmlToPlainText('<<foo>'), '');
    assert.equal(htmlToPlainText('<div class="x">a</div>'), 'a');
    assert.equal(htmlToPlainText('a<br/>b'), 'ab');
  });

  it('strips 50k unclosed <aaa... in under 100ms', () => {
    const pathological = `<${'a'.repeat(50_000)}`;
    assertFast(() => {
      assert.equal(htmlToPlainText(pathological), pathological);
    });
  });
});
