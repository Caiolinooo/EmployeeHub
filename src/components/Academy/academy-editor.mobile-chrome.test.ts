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
    const outside = css.slice(0, mediaIdx);
    const inside = css.slice(mediaIdx);
    const keep = ['[data-modal-close]', '[data-modal-panel]'];
    const drop = [
      '[data-gt-kpi-cards]',
      '[data-portal-main]',
      '[data-fab-companion]',
      '[data-fab-help]',
      '[data-fab-companion-panel]',
      '[data-fab-companion-action]',
    ];
    for (const sel of keep) {
      assert.equal(outside.includes(sel), false, `${sel} fora do media`);
      assert.ok(inside.includes(sel), `${sel} ausente no media`);
    }
    for (const sel of drop) {
      assert.equal(inside.includes(sel), false, `${sel} no media desta PR`);
    }
    assert.equal((css.match(/@media \(max-width: 767px\)/g) || []).length, 1);
  });
});

describe('Academy editor mobile chrome', () => {
  it('DeleteCourseModal has X, Esc, tap-outside and focus restore', () => {
    const src = readFileSync(new URL('./DeleteCourseModal.tsx', import.meta.url), 'utf8');
    assert.match(src, /ModalCloseButton/);
    assert.match(src, /mobileOnly/);
    assert.match(src, /useEscapeToClose/);
    assert.match(src, /data-modal-panel/);
    assert.match(src, /onClick=\{onClose\}/);
    assert.match(src, /useRestoreFocus\(isOpen\)/);
    assert.match(src, /max-md:min-h-11/);
  });

  it('editor list stacks header and enlarges actions on mobile', () => {
    const src = readFileSync(new URL('../../app/academy/editor/page.tsx', import.meta.url), 'utf8');
    assert.match(src, /max-md:flex-col/);
    assert.match(src, /max-md:min-h-11/);
    assert.match(src, /max-md:text-xl/);
    assert.match(src, /data-academy-delete-trigger/);
  });

  it('ModuleEditor icon actions are 44px only on mobile', () => {
    const src = readFileSync(new URL('./ModuleEditor.tsx', import.meta.url), 'utf8');
    const hits = src.match(/max-md:min-h-11 max-md:min-w-11/g) || [];
    assert.equal(hits.length, 4, `esperava 4 ícones 44px mobile, veio ${hits.length}`);
    assert.match(src, /title="Mover para cima"/);
    assert.match(src, /title="Mover para baixo"/);
    assert.match(src, /title="Editar módulo"/);
    assert.match(src, /title="Excluir módulo"/);
  });

  it('QuizEditor form actions are 44px only on mobile', () => {
    const src = readFileSync(new URL('./QuizEditor.tsx', import.meta.url), 'utf8');
    assert.match(src, /removeOption\(idx\)[\s\S]*max-md:min-h-11 max-md:min-w-11/);
    assert.match(src, /Adicionar Opção/);
    assert.match(src, /addOption[\s\S]*max-md:min-h-11/);
    assert.match(src, /Criar Questão/);
    assert.match(src, /max-md:min-h-11 bg-blue-600/);
  });
});
