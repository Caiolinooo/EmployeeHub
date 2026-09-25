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
});
