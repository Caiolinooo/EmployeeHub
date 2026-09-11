/**
 * Locale templates use both `{name}` and `{{name}}`.
 * Always replace the double-brace form first so `{count}` cannot mangle `{{count}}`.
 */
export function interpolateTranslationParams(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return String(template);
  let result = String(template);
  for (const [key, raw] of Object.entries(params)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    const value = String(raw);
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}
