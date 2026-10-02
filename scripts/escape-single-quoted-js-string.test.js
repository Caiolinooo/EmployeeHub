'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { escapeSingleQuotedJsString } = require('./escape-single-quoted-js-string');

describe('escapeSingleQuotedJsString', () => {
  it('leaves normal strings unchanged', () => {
    assert.equal(escapeSingleQuotedJsString('hello'), 'hello');
    assert.equal(escapeSingleQuotedJsString('Painel ABZ'), 'Painel ABZ');
  });

  it('escapes every single quote with /g', () => {
    assert.equal(escapeSingleQuotedJsString("it's"), "it\\'s");
    assert.equal(escapeSingleQuotedJsString("a'b'c"), "a\\'b\\'c");
  });

  it('escapes backslashes before quotes so a trailing slash cannot break out', () => {
    assert.equal(escapeSingleQuotedJsString('\\'), '\\\\');
    assert.equal(escapeSingleQuotedJsString("\\'"), "\\\\\\'");
  });

  it('escapes line terminators that can break out of a single-quoted literal', () => {
    assert.equal(escapeSingleQuotedJsString('a\nb'), 'a\\nb');
    assert.equal(escapeSingleQuotedJsString('a\rb'), 'a\\rb');
    assert.equal(escapeSingleQuotedJsString('a\u2028b'), 'a\\u2028b');
    assert.equal(escapeSingleQuotedJsString('a\u2029b'), 'a\\u2029b');
  });
});
