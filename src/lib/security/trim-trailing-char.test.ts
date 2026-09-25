import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { trimTrailingChar } from './trim-trailing-char';

describe('trimTrailingChar', () => {
  it('is linear on ~100k trailing markers and on slashes then a non-slash', () => {
    const started = Date.now();
    assert.equal(trimTrailingChar(`https://api.openai.com/v1${'/'.repeat(100_000)}`, '/'), 'https://api.openai.com/v1');
    assert.equal(trimTrailingChar(`a${'/'.repeat(100_000)}`, '/'), 'a');
    const slashesThenX = `${'/'.repeat(100_000)}x`;
    assert.equal(trimTrailingChar(slashesThenX, '/'), slashesThenX);
    assert.equal(trimTrailingChar(`host${'.'.repeat(100_000)}`, '.'), 'host');
    const dotsThenX = `${'.'.repeat(100_000)}x`;
    assert.equal(trimTrailingChar(dotsThenX, '.'), dotsThenX);
    assert.ok(Date.now() - started < 250);
  });
});
