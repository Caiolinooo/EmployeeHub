const MAX_STRIP_PASSES = 32;

function replaceUntilStable(input: string, pattern: RegExp): string {
  let current = String(input ?? '');
  for (let i = 0; i < MAX_STRIP_PASSES; i += 1) {
    const next = current.replace(pattern, '');
    if (next === current) return current;
    current = next;
  }
  return current;
}

/** Strip HTML comments, looping until stable (nested / overlapping comments). */
export function stripHtmlComments(html: string): string {
  const stripped = replaceUntilStable(html, /<!--[\s\S]*?-->/g);
  return stripped.replace(/<!--[\s\S]*/g, '').replace(/-->/g, '');
}

/**
 * Strip HTML tags from the inside out so `<scr<script>ipt>` becomes empty
 * instead of reconstructing `<script>` after one pass.
 */
export function stripHtmlTags(html: string): string {
  let current = replaceUntilStable(String(html ?? ''), /<[^<>]*>/g);
  current = current.replace(/<[^<>]*$/g, '');
  return current;
}

export function htmlToPlainText(html: string): string {
  return stripHtmlTags(stripHtmlComments(html)).trim();
}
