/**
 * Decode XML/HTML entities. `&amp;` last so `&amp;lt;` stays `&lt;`
 * (CodeQL js/double-escaping).
 */
export function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
