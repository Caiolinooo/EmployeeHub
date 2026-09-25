import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { hasCronOrSetupSecret, unauthorizedDebugResponse } from './public-debug-guard';

function requestWith(headers: Record<string, string>): NextRequest {
  return new NextRequest('https://portal.groupabz.com/api/test', { headers });
}

describe('public-debug-guard', () => {
  it('rejects when CRON_SECRET is unset', () => {
    const previous = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      assert.equal(hasCronOrSetupSecret(requestWith({ authorization: 'Bearer anything' })), false);
    } finally {
      if (previous === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = previous;
      }
    }
  });

  it('accepts Bearer or x-cron-secret matching CRON_SECRET', () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'test-cron-secret';
    try {
      assert.equal(hasCronOrSetupSecret(requestWith({ authorization: 'Bearer test-cron-secret' })), true);
      assert.equal(hasCronOrSetupSecret(requestWith({ 'x-cron-secret': 'test-cron-secret' })), true);
      assert.equal(hasCronOrSetupSecret(requestWith({ authorization: 'Bearer wrong' })), false);
    } finally {
      if (previous === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = previous;
      }
    }
  });

  it('returns 401 JSON without leaking details', async () => {
    const response = unauthorizedDebugResponse();
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.deepEqual(body, { error: 'Não autorizado' });
  });
});
