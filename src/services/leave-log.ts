/**
 * Constant format strings for leaveService console.error.
 * Never pass user-controlled text as the first argument to console/util.format.
 */
export const LEAVE_ERROR_FORMAT = {
  fetchConfig: 'Error fetching leave config for sector %s:',
  updateConfig: 'Error updating leave config for sector %s:',
  createConfig: 'Error creating leave config for sector %s:',
  fetchUserRequests: 'Error fetching leave requests for user %s:',
  updateStatus: 'Error updating leave request %s to %s:',
} as const;

export function leaveConsoleError(format: string, ...args: unknown[]): void {
  console.error(format, ...args);
}
