import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { GET, HEAD } from '../../app/api/mobile/preview-disabled/route';
import { stripMobilePrefix } from './device-surface';

const require = createRequire(import.meta.url);
const { productionMobilePreviewRewrites, MOBILE_PREVIEW_DISABLED_PATH } = require('./preview-block.js');

describe('mobile preview production 404', () => {
  it('rewrite points /m/preview to the 404 handler', () => {
    assert.deepEqual(productionMobilePreviewRewrites(), [
      { source: '/m/preview', destination: MOBILE_PREVIEW_DISABLED_PATH },
    ]);
    assert.equal(MOBILE_PREVIEW_DISABLED_PATH, '/api/mobile/preview-disabled');
  });

  it('next.config.js applies the rewrite in production', () => {
    const cfg = readFileSync(new URL('../../../next.config.js', import.meta.url), 'utf8');
    assert.match(cfg, /productionMobilePreviewRewrites/);
    assert.match(cfg, /NODE_ENV === 'production'/);
  });

  it('GET and HEAD return HTTP 404', () => {
    assert.equal(GET().status, 404);
    assert.equal(HEAD().status, 404);
  });
});

describe('mobile unimplemented fallback', () => {
  it('strips /m for the desktop equivalent', () => {
    assert.equal(stripMobilePrefix('/m/rota-inexistente'), '/rota-inexistente');
    assert.equal(stripMobilePrefix('/m/ferias'), '/ferias');
  });
});
