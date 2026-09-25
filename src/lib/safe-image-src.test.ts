import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSafeImageSrc, safeImageSrc } from './safe-image-src';

describe('isSafeImageSrc', () => {
  it('allows https and relative paths', () => {
    assert.equal(isSafeImageSrc('https://cdn.example.com/logo.png'), true);
    assert.equal(isSafeImageSrc('/images/LC1_Azul.png'), true);
    assert.equal(isSafeImageSrc('/uploads/logo.svg'), true);
  });

  it('allows blob previews and data:image', () => {
    assert.equal(isSafeImageSrc('blob:https://portal.groupabz.com/abc-123'), true);
    assert.equal(isSafeImageSrc('data:image/png;base64,iVBORw0KGgo='), true);
  });

  it('blocks javascript, data html, and protocol-relative', () => {
    assert.equal(isSafeImageSrc('javascript:alert(1)'), false);
    assert.equal(isSafeImageSrc('JAVASCRIPT:alert(1)'), false);
    assert.equal(isSafeImageSrc('data:text/html,<script>alert(1)</script>'), false);
    assert.equal(isSafeImageSrc('//evil.com/logo.png'), false);
    assert.equal(isSafeImageSrc('http://insecure.example/logo.png'), false);
    assert.equal(isSafeImageSrc('vbscript:msgbox(1)'), false);
  });

  it('blocks scheme tricks: case, space, tab, newline, vbscript, data svg', () => {
    assert.equal(isSafeImageSrc('  JAVASCRIPT:alert(1)'), false);
    assert.equal(isSafeImageSrc('\tjavascript:alert(1)'), false);
    assert.equal(isSafeImageSrc('\njavascript:alert(1)'), false);
    assert.equal(isSafeImageSrc('java\tscript:alert(1)'), false);
    assert.equal(isSafeImageSrc('java\nscript:alert(1)'), false);
    assert.equal(isSafeImageSrc('  vbscript:msgbox(1)'), false);
    assert.equal(isSafeImageSrc('\tvbscript:msgbox(1)'), false);
    assert.equal(isSafeImageSrc('data:image/svg+xml,<svg></svg>'), false);
    assert.equal(isSafeImageSrc('DATA:IMAGE/SVG+XML;base64,PHN2Zz4='), false);
    assert.equal(isSafeImageSrc('data:text/html;base64,PHNjcmlwdD4='), false);
  });
});

describe('safeImageSrc', () => {
  it('falls back when unsafe', () => {
    assert.equal(safeImageSrc('javascript:alert(1)'), '/images/LC1_Azul.png');
    assert.equal(safeImageSrc(null), '/images/LC1_Azul.png');
    assert.equal(safeImageSrc('https://ok.example/a.png'), 'https://ok.example/a.png');
  });
});
