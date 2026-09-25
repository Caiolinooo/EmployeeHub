'use strict';

/**
 * Escape a value for a single-quoted JavaScript string literal.
 * Backslashes first, then quotes (CodeQL js/incomplete-sanitization).
 * Strings without `\` or `'` stay identical to a quote-only replace.
 */
function escapeSingleQuotedJsString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

module.exports = { escapeSingleQuotedJsString };
