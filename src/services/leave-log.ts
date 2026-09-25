/**
 * Constant format strings for leaveService console.error.
 * Never pass user-controlled text as the first argument to console/util.format.
 */
export const LEAVE_ERROR_FORMAT = {
  /** CodeQL #117 — getLeaveConfigForSector */
  fetchConfig: 'Error fetching leave config for sector %s:',
  /** CodeQL #119 — upsertLeaveSectorConfig update */
  updateConfig: 'Error updating leave config for sector %s:',
  /** CodeQL #118 — upsertLeaveSectorConfig create */
  createConfig: 'Error creating leave config for sector %s:',
  /** CodeQL #120 — getUserLeaveRequests */
  fetchUserRequests: 'Error fetching leave requests for user %s:',
  /** CodeQL #121 — updateLeaveRequestStatus */
  updateStatus: 'Error updating leave request %s to %s:',
} as const;

export function leaveConsoleError(format: string, ...args: unknown[]): void {
  console.error(format, ...args);
}
