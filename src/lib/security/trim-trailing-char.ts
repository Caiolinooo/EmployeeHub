/** Linear trim of a trailing character. Avoids polynomial `/X+$/` on untrusted input. */
export function trimTrailingChar(value: string, ch: string): string {
  const code = ch.charCodeAt(0);
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === code) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}
