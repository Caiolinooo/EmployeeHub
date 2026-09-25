import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { newTrackingSessionId, TRACKING_SESSION_ID_LENGTH } from './session-id';

describe('newTrackingSessionId', () => {
  it('returns lowercase base36 of the historical length', () => {
    const id = newTrackingSessionId();
    assert.equal(id.length, TRACKING_SESSION_ID_LENGTH);
    assert.match(id, /^[0-9a-z]+$/);
  });

  it('does not collide in a small sample', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(newTrackingSessionId());
    assert.equal(seen.size, 40);
  });
});
