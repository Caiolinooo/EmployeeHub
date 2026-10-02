'use strict';

/**
 * Escape a value for a single-quoted JavaScript string literal.
 * Backslashes first, then quotes, then line terminators
 * (CodeQL js/incomplete-sanitization).
 * Strings without those characters stay identical to a quote-only replace.
 */
function escapeSingleQuotedJsString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

module.exports = { escapeSingleQuotedJsString };
