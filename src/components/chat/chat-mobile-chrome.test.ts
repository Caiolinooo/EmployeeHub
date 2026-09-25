import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = [
  './CreateServerModal.tsx',
  './CreateChannelModal.tsx',
  './ServerSettingsModal.tsx',
  './StartDMModal.tsx',
  './ChatSettingsModal.tsx',
];

describe('chat overlay chrome', () => {
  it('Esc + ModalCloseButton on create/settings/dm', () => {
    for (const file of files) {
      const src = readFileSync(new URL(file, import.meta.url), 'utf8');
      assert.match(src, /useEscapeToClose/, file);
      assert.match(src, /ModalCloseButton/, file);
    }
  });
});
