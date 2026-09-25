/**
 * Same language as `/<[^>]*>/g` → '' without a polynomial character-class star.
 * Unclosed `<...` (no `>`) stays in the output.
 */
export function htmlToPlainText(html: string): string {
  let out = '';
  let i = 0;
  while (i < html.length) {
    const open = html.indexOf('<', i);
    if (open === -1) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, open);
    const close = html.indexOf('>', open + 1);
    if (close === -1) {
      out += html.slice(open);
      break;
    }
    i = close + 1;
  }
  return out;
}
