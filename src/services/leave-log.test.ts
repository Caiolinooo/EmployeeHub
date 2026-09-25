import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LEAVE_ERROR_FORMAT, leaveConsoleError } from './leave-log';

describe('leaveConsoleError', () => {
  it('uses a constant format string and passes user text as %s args', () => {
    const calls: unknown[][] = [];
    const orig = console.error;
    console.error = (...args: unknown[]) => {
      calls.push(args);
    };
    try {
      leaveConsoleError(LEAVE_ERROR_FORMAT.fetchConfig, '%s%s%s', { code: 'x' });
      leaveConsoleError(LEAVE_ERROR_FORMAT.updateConfig, '%s%s%s', { code: 'u' });
      leaveConsoleError(LEAVE_ERROR_FORMAT.createConfig, '%s%s%s', { code: 'c' });
      leaveConsoleError(LEAVE_ERROR_FORMAT.fetchUserRequests, '%s%s%s', { code: 'f' });
      leaveConsoleError(LEAVE_ERROR_FORMAT.updateStatus, '%s%s%s', 'APPROVED', { code: 'y' });
    } finally {
      console.error = orig;
    }
    assert.equal(calls.length, 5);
    assert.equal(calls[0][0], LEAVE_ERROR_FORMAT.fetchConfig);
    assert.equal(calls[1][0], LEAVE_ERROR_FORMAT.updateConfig);
    assert.equal(calls[2][0], LEAVE_ERROR_FORMAT.createConfig);
    assert.equal(calls[3][0], LEAVE_ERROR_FORMAT.fetchUserRequests);
    assert.equal(calls[4][0], LEAVE_ERROR_FORMAT.updateStatus);
    assert.equal(calls[0][1], '%s%s%s');
    assert.equal(calls[1][1], '%s%s%s');
    assert.equal(calls[2][1], '%s%s%s');
    assert.equal(calls[3][1], '%s%s%s');
    assert.equal(calls[4][1], '%s%s%s');
    assert.equal(calls[4][2], 'APPROVED');
    for (const format of Object.values(LEAVE_ERROR_FORMAT)) {
      assert.equal(format.includes('${'), false);
      assert.ok(format.includes('%s'));
    }
  });
});
