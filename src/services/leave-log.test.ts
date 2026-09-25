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
      leaveConsoleError(LEAVE_ERROR_FORMAT.updateStatus, '%s%s%s', 'APPROVED', { code: 'y' });
    } finally {
      console.error = orig;
    }
    assert.equal(calls.length, 2);
    assert.equal(calls[0][0], 'Error fetching leave config for sector %s:');
    assert.equal(calls[0][1], '%s%s%s');
    assert.equal(calls[1][0], 'Error updating leave request %s to %s:');
    assert.equal(calls[1][1], '%s%s%s');
    assert.equal(calls[1][2], 'APPROVED');
    assert.equal(LEAVE_ERROR_FORMAT.fetchConfig.includes('${'), false);
  });
});
