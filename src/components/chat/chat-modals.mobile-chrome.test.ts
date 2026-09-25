import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('767 media block (helpers #99)', () => {
  it('scopes close target and panel to max-width 767px', () => {
    const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
    assert.match(css, /@media \(max-width: 767px\)/);
    assert.match(css, /\[data-modal-close\]/);
    assert.match(css, /min-height: 44px/);
    assert.match(css, /\[data-modal-panel\]/);
    assert.match(css, /max-height: 100dvh/);
  });

  it('keeps only modal-close/panel selectors inside max-width 767px', () => {
    const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
    const marker = '@media (max-width: 767px)';
    const mediaIdx = css.indexOf(marker);
    assert.ok(mediaIdx >= 0);
    const inside = css.slice(mediaIdx);
    const drop = [
      '[data-gt-kpi-cards]',
      '[data-portal-main]',
      '[data-fab-companion]',
      '[data-fab-help]',
      '[data-fab-companion-panel]',
      '[data-fab-companion-action]',
    ];
    for (const sel of drop) {
      assert.equal(inside.includes(sel), false, `${sel} no media desta PR`);
    }
    assert.equal((css.match(/@media \(max-width: 767px\)/g) || []).length, 1);
  });

  it('StartDM overlay stacking matches portal (blur on same fixed layer)', () => {
    const src = readFileSync(new URL('./StartDMModal.tsx', import.meta.url), 'utf8');
    assert.match(src, /fixed inset-0 z-50 flex items-center justify-center bg-black\/60 backdrop-blur-sm max-md:p-4/);
    assert.doesNotMatch(src, /absolute inset-0[\s\S]*backdrop-blur-sm/);
  });

  it('ChatSettings overlay stacking matches portal (blur on same fixed layer)', () => {
    const src = readFileSync(new URL('./ChatSettingsModal.tsx', import.meta.url), 'utf8');
    assert.match(src, /fixed inset-0 z-50 flex items-center justify-center bg-black\/60 backdrop-blur-sm max-md:p-4/);
    assert.doesNotMatch(src, /absolute inset-0[\s\S]*backdrop-blur-sm/);
    assert.doesNotMatch(src, /md:inline-flex/);
  });

  it('CreateChannel overlay stacking matches portal (blur on same fixed layer)', () => {
    const src = readFileSync(new URL('./CreateChannelModal.tsx', import.meta.url), 'utf8');
    assert.match(src, /fixed inset-0 z-50 flex items-center justify-center bg-black\/60 backdrop-blur-sm max-md:p-4/);
    assert.doesNotMatch(src, /absolute inset-0[\s\S]*backdrop-blur-sm/);
    assert.doesNotMatch(src, /md:inline-flex/);
  });

  it('CreateServer H3 flex is mobile-only', () => {
    const src = readFileSync(new URL('./CreateServerModal.tsx', import.meta.url), 'utf8');
    assert.match(src, /max-md:flex-1 max-md:min-w-0/);
    assert.doesNotMatch(src, /h3 className="[^"]*\bflex-1\b(?![^"]*max-md)/);
  });
});

describe('Chat create/settings + IA overlays', () => {
  const files = [
    new URL('./CreateServerModal.tsx', import.meta.url),
    new URL('./CreateChannelModal.tsx', import.meta.url),
    new URL('./ChatSettingsModal.tsx', import.meta.url),
    new URL('./ServerSettingsModal.tsx', import.meta.url),
    new URL('./StartDMModal.tsx', import.meta.url),
    new URL('../IA/ExchangeIntegrationModal.tsx', import.meta.url),
    new URL('../IA/VoiceAssistantModal.tsx', import.meta.url),
  ];

  for (const file of files) {
    it(`${file.pathname.split('/').slice(-2).join('/')} has X, Esc and panel`, () => {
      const src = readFileSync(file, 'utf8');
      assert.match(src, /ModalCloseButton/);
      assert.match(src, /useEscapeToClose/);
      assert.match(src, /data-modal-panel/);
      assert.match(src, /mobileOnly/);
    });
  }

  it('ChatWindow mobile sidebar has X and Esc', () => {
    const src = readFileSync(new URL('../IA/ChatWindow.tsx', import.meta.url), 'utf8');
    assert.match(src, /ModalCloseButton/);
    assert.match(src, /Escape/);
    assert.match(src, /data-modal-panel/);
    assert.match(src, /max-width: 1023px/);
    assert.match(src, /mq\.addEventListener\('change'/);
    assert.match(src, /if \(mq\.matches\) window\.addEventListener\('keydown'/);
  });
});
