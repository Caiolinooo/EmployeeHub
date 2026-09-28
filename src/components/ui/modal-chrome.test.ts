import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('modal chrome mobile-only', () => {
  it('globals.css scopes close target and panel to max-width 767px', () => {
    const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
    assert.match(css, /@media \(max-width: 767px\)/);
    assert.match(css, /\[data-modal-close\]/);
    assert.match(css, /min-height: 44px/);
    assert.match(css, /\[data-modal-panel\]/);
    assert.match(css, /max-height: 100dvh/);
  });

  it('globals.css keeps mobile-only data selectors inside max-width 767px', () => {
    const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
    const marker = '@media (max-width: 767px)';
    const mediaIdx = css.indexOf(marker);
    assert.ok(mediaIdx >= 0);
    const outside = css.slice(0, mediaIdx);
    const inside = css.slice(mediaIdx);
    const selectors = [
      '[data-modal-close]',
      '[data-modal-panel]',
      '[data-gt-kpi-cards]',
      '[data-portal-main]',
      'button[data-fab-companion]',
      'button[data-fab-help]',
      '[data-fab-companion-panel]',
      '[data-fab-companion-action]',
    ];
    for (const sel of selectors) {
      assert.equal(outside.includes(sel), false, `${sel} fora do media`);
      assert.ok(inside.includes(sel), `${sel} ausente no media`);
    }
    assert.equal((css.match(/@media \(max-width: 767px\)/g) || []).length, 1);
  });

  it('ModalCloseButton exposes data-modal-close, optional md:hidden and 44px mobile', () => {
    const src = readFileSync(new URL('./ModalCloseButton.tsx', import.meta.url), 'utf8');
    assert.match(src, /data-modal-close/);
    assert.match(src, /mobileOnly/);
    assert.match(src, /md:hidden/);
    assert.match(src, /mountOnlyWhenMobile/);
    assert.match(src, /max-md:h-11/);
    assert.match(src, /aria-label/);
  });
});

describe('GT mobile scrollports', () => {
  it('keeps desktop flex-1 and adds max-lg min-height', () => {
    const shell = readFileSync(new URL('../gestao-tripulantes/GtPageShell.tsx', import.meta.url), 'utf8');
    assert.match(shell, /max-lg:min-h-\[50vh\]/);
    assert.match(shell, /GT_PAGE_TABLIST_CLASS/);
    const grid = readFileSync(
      new URL('../gestao-tripulantes/man-schedule-grid-classes.ts', import.meta.url),
      'utf8',
    );
    assert.match(grid, /max-lg:min-h-\[50vh\]/);
  });

  it('scopes page tab nowrap/shrink to max-lg so desktop matches portal', () => {
    const shell = readFileSync(new URL('../gestao-tripulantes/GtPageShell.tsx', import.meta.url), 'utf8');
    assert.match(shell, /max-lg:flex-nowrap/);
    assert.match(shell, /max-lg:shrink-0 max-lg:whitespace-nowrap/);
    assert.match(shell, /max-lg:touch-scroll/);
    assert.doesNotMatch(shell, /export const GT_PAGE_TABNAV_CLASS = 'flex flex-nowrap/);
    assert.doesNotMatch(
      shell,
      /transition-all shrink-0 whitespace-nowrap max-md:min-h-11/,
    );
  });

  it('keeps collaborator tab overflow split mobile-only (desktop = portal inner overflow)', () => {
    const layout = readFileSync(
      new URL('../gestao-tripulantes/collaborator-modal-layout.ts', import.meta.url),
      'utf8',
    );
    assert.match(
      layout,
      /TABLIST_SHELL_CLASS =\n  'collaborator-modal-tablist-shell relative z-20 shrink-0 border-b border-gray-200 bg-gray-50\/80 max-lg:min-w-0 max-lg:overflow-x-auto/,
    );
    assert.match(
      layout,
      /flex flex-nowrap overflow-x-auto overscroll-contain no-scrollbar max-lg:min-w-max/,
    );
    const modal = readFileSync(
      new URL('../gestao-tripulantes/CollaboratorModal.tsx', import.meta.url),
      'utf8',
    );
    assert.match(modal, /ref=\{tablistRef\}/);
    assert.match(modal, /role="tablist"/);
    const tablistBlock = modal.slice(
      modal.indexOf('role="tablist"') - 80,
      modal.indexOf('role="tablist"') + 40,
    );
    assert.match(tablistBlock, /ref=\{tablistRef\}/);
  });

  it('schedule toolbar keeps portal flex-wrap on desktop and nowrap only max-lg', () => {
    const src = readFileSync(
      new URL('../gestao-tripulantes/GTManScheduleTab.tsx', import.meta.url),
      'utf8',
    );
    assert.match(src, /flex items-end gap-2\.5 w-full flex-wrap max-lg:flex-nowrap/);
    assert.doesNotMatch(src, /(?<!max-)lg:flex-nowrap/);
  });
});

describe('modals without visible X now expose mobile close', () => {
  it('ConfirmationModal mounts X only on mobile (no desktop display:none)', () => {
    const src = readFileSync(new URL('./ConfirmationModal.tsx', import.meta.url), 'utf8');
    assert.match(src, /ModalCloseButton/);
    assert.match(src, /mountOnlyWhenMobile/);
    assert.doesNotMatch(src, /mobileOnly/);
    assert.match(src, /useEscapeToClose/);
    assert.match(src, /data-modal-panel/);
  });

  it('LanguageDialog renders accessible close on mobile', () => {
    const src = readFileSync(new URL('../LanguageDialog.tsx', import.meta.url), 'utf8');
    assert.match(src, /ModalCloseButton/);
    assert.match(src, /mobileOnly/);
    assert.match(src, /useEscapeToClose/);
    assert.match(src, /data-modal-panel/);
  });

  it('SetPasswordModal keeps no X (gate obrigatório) and scrolls in 100dvh', () => {
    const src = readFileSync(new URL('../Auth/SetPasswordModal.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /ModalCloseButton/);
    assert.match(src, /impedir que o usuário feche/);
    assert.match(src, /data-modal-panel/);
    assert.doesNotMatch(src, /useEscapeToClose/);
  });

  it('AddShortcut, Desligamento, ConfirmarExclusao, Fechamento and CompleteProfile close on Esc', () => {
    const files = [
      '../dashboard/AddShortcutModal.tsx',
      '../gestao-tripulantes/DesligamentoModal.tsx',
      '../gestao-tripulantes/ConfirmarExclusaoMarcacaoModal.tsx',
      '../gestao-tripulantes/ModalAprovacaoFechamento.tsx',
      '../Profile/CompleteProfilePrompt.tsx',
    ];
    for (const file of files) {
      const src = readFileSync(new URL(file, import.meta.url), 'utf8');
      assert.match(src, /useEscapeToClose/, file);
    }
  });

  it('GT schedule mounts from ?tab=schedule without a click', () => {
    const src = readFileSync(
      new URL('../../app/department/gestao-tripulantes/page.tsx', import.meta.url),
      'utf8',
    );
    assert.match(src, /useState\(\(\) => searchParams\?\.get\('tab'\) === 'schedule'\)/);
    assert.match(src, /tab === 'schedule'/);
    assert.match(src, /setScheduleMounted\(true\)/);
  });
});
