import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { htmlToPlainText, stripHtmlComments, stripHtmlTags } from './html-text';

describe('stripHtmlTags', () => {
  it('strips a simple tag', () => {
    assert.equal(stripHtmlTags('<b>ok</b>'), 'ok');
  });

  it('loops until nested split tags are gone', () => {
    assert.equal(stripHtmlTags('<scr<script>ipt>alert(1)</script>'), 'alert(1)');
    assert.equal(stripHtmlTags('<scr<script>ipt>'), '');
  });

  it('does not leave a live script tag from <scr<script>ipt>', () => {
    const out = stripHtmlTags('<scr<script>ipt>evil()</scr</script>ipt>');
    assert.equal(out.includes('<script'), false);
    assert.equal(out.includes('<scr'), false);
  });
});

describe('stripHtmlComments', () => {
  it('strips comments and nested leftovers', () => {
    assert.equal(stripHtmlComments('a<!-- x -->b'), 'ab');
    const nested = stripHtmlComments('a<!-- <!-- inner --> leftover -->b');
    assert.equal(nested.includes('<!--'), false);
    assert.equal(nested.includes('-->'), false);
    assert.ok(nested.startsWith('a'));
    assert.ok(nested.endsWith('b'));
  });
});

describe('htmlToPlainText', () => {
  it('returns cell text without tags', () => {
    assert.equal(htmlToPlainText('<td><b>123.456.789-00</b></td>'), '123.456.789-00');
  });
});
