import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeMediaUrl, toSafeMediaUrl } from './safe-media-url';

describe('toSafeMediaUrl', () => {
  it('allows blob: object URLs', () => {
    const blobUrl = 'blob:https://portal.groupabz.com/11111111-2222-3333-4444-555555555555';
    assert.equal(toSafeMediaUrl(blobUrl), blobUrl);
    assert.equal(isSafeMediaUrl(blobUrl), true);
  });

  it('allows https: URLs', () => {
    const httpsUrl = 'https://cdn.example.com/media/preview.png';
    assert.equal(toSafeMediaUrl(httpsUrl), httpsUrl);
    assert.equal(isSafeMediaUrl(httpsUrl), true);
  });

  it('allows relative paths', () => {
    assert.equal(toSafeMediaUrl('/uploads/preview.jpg'), '/uploads/preview.jpg');
    assert.equal(toSafeMediaUrl('./preview.jpg'), './preview.jpg');
    assert.equal(toSafeMediaUrl('../media/preview.jpg'), '../media/preview.jpg');
    assert.equal(toSafeMediaUrl('preview.jpg'), 'preview.jpg');
    assert.equal(isSafeMediaUrl('/uploads/preview.jpg'), true);
  });

  it('blocks javascript: URLs', () => {
    assert.equal(toSafeMediaUrl('javascript:alert(1)'), '');
    assert.equal(toSafeMediaUrl('JAVASCRIPT:alert(1)'), '');
    assert.equal(toSafeMediaUrl('  javascript:void(0)  '), '');
    assert.equal(isSafeMediaUrl('javascript:alert(1)'), false);
  });

  it('blocks entity-encoded javascript: URLs', () => {
    assert.equal(toSafeMediaUrl('javascript&#58;alert(1)'), '');
    assert.equal(toSafeMediaUrl('javascript&#x3a;alert(1)'), '');
    assert.equal(toSafeMediaUrl('javascript&#x3A;void(0)'), '');
    assert.equal(toSafeMediaUrl('javascript&colon;alert(1)'), '');
    assert.equal(toSafeMediaUrl('JAVASCRIPT&COLON;alert(1)'), '');
    assert.equal(isSafeMediaUrl('javascript&#58;alert(1)'), false);
  });

  it('blocks data:text/html', () => {
    const htmlPayload = 'data:text/html,<script>alert(1)</script>';
    assert.equal(toSafeMediaUrl(htmlPayload), '');
    assert.equal(isSafeMediaUrl(htmlPayload), false);
  });

  it('blocks data:image/png (not used by the current preview flow)', () => {
    const pngData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    assert.equal(toSafeMediaUrl(pngData), '');
    assert.equal(isSafeMediaUrl(pngData), false);
  });

  it('blocks http:, protocol-relative, empty, and non-string values', () => {
    assert.equal(toSafeMediaUrl('http://evil.example/x.png'), '');
    assert.equal(toSafeMediaUrl('//evil.example/x.png'), '');
    assert.equal(toSafeMediaUrl(''), '');
    assert.equal(toSafeMediaUrl('   '), '');
    assert.equal(toSafeMediaUrl(null), '');
    assert.equal(toSafeMediaUrl(undefined), '');
    assert.equal(isSafeMediaUrl('http://evil.example/x.png'), false);
  });
});
