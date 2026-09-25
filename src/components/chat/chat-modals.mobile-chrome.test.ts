import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('767 media block (helpers #99)', () => {
  it('scopes close target and panel to max-width 767px', () => {
    const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
    assert.match(css, /@media \(max-width: 767px\)/);
    assert.match(css, /\[data-modal-close\]/);
    assert.match(css, /min-height: 44px/);
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
  });
});
