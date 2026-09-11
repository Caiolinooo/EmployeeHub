import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { interpolateTranslationParams } from './interpolate';
import { getTranslation } from './index';

describe('interpolateTranslationParams', () => {
  it('replaces single-brace {count} used by Man Schedule POB copy', () => {
    assert.equal(
      interpolateTranslationParams('Hoje: {count}P a bordo', { count: 2 }),
      'Hoje: 2P a bordo',
    );
  });

  it('replaces double-brace {{count}} without leaving leftover braces', () => {
    assert.equal(
      interpolateTranslationParams('Today: {{count}}P onboard', { count: 3 }),
      'Today: 3P onboard',
    );
  });

  it('returns the template unchanged when params are omitted', () => {
    assert.equal(interpolateTranslationParams('Hoje: {count}P a bordo'), 'Hoje: {count}P a bordo');
  });

  it('interpolates manSchedule.todayPob through getTranslation', () => {
    assert.equal(getTranslation('pt-BR', 'manSchedule.todayPob', '', { count: 2 }), 'Hoje: 2P a bordo');
    assert.equal(getTranslation('en-US', 'manSchedule.todayPob', '', { count: 2 }), 'Today: 2P onboard');
  });
});
