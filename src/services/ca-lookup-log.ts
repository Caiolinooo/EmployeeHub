/** Constant format strings so CA numbers never enter console.* first-arg (CodeQL #116). */

export const CA_LOOKUP_ERROR_FORMAT = '[CA Lookup] Error looking up CA %s:';

export function logCaLookupError(
  caNumber: string,
  error: unknown,
  write: typeof console.error = console.error,
): void {
  write(CA_LOOKUP_ERROR_FORMAT, caNumber, error);
}
