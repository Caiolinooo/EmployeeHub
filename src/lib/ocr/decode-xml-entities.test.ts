import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeXmlEntities } from './decode-xml-entities';

describe('decodeXmlEntities', () => {
  it('decodes simple entities', () => {
    assert.equal(decodeXmlEntities('&lt;'), '<');
    assert.equal(decodeXmlEntities('&gt;'), '>');
    assert.equal(decodeXmlEntities('&quot;'), '"');
    assert.equal(decodeXmlEntities("it&apos;s"), "it's");
    assert.equal(decodeXmlEntities('A &amp; B'), 'A & B');
    assert.equal(decodeXmlEntities('x &gt; y'), 'x > y');
  });

  it('decodes &amp; last (no double unescape)', () => {
    assert.equal(decodeXmlEntities('&amp;lt;'), '&lt;');
    assert.equal(decodeXmlEntities('&amp;quot;'), '&quot;');
    assert.equal(decodeXmlEntities('&amp;amp;'), '&amp;');
    assert.equal(decodeXmlEntities('&amp;gt;'), '&gt;');
    assert.equal(decodeXmlEntities('&amp;apos;'), '&apos;');
  });
});
