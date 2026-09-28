import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function fabClassNameTemplate(src: string) {
  const start = src.indexOf('data-fab-help');
  assert.ok(start >= 0, 'data-fab-help ausente');
  const chunk = src.slice(start);
  const match = chunk.match(/className=\{`([\s\S]*?)`\}/);
  assert.ok(match, 'className template do FAB ausente');
  return match[1];
}

function renderFabClass(template: string, isOpen: boolean) {
  return new Function('isOpen', `return \`${template}\`;`)(isOpen) as string;
}

function assertCleanClass(className: string, label: string) {
  assert.equal(className.includes("'"), false, `${label} tem aspas simples: ${className}`);
  assert.equal(className.includes('`'), false, `${label} tem crase: ${className}`);
  assert.equal(className.includes('${'), false, `${label} tem '\${': ${className}`);
  assert.equal(/\? /.test(className), false, `${label} tem '? ' solto: ${className}`);
  assert.equal(/: /.test(className), false, `${label} tem ': ' solto: ${className}`);
}

describe('HelpWidget FAB className', () => {
  const src = readFileSync(new URL('./HelpWidget.tsx', import.meta.url), 'utf8');
  const template = fabClassNameTemplate(src);

  it('does not close ${isOpen} before the ternary', () => {
    assert.doesNotMatch(src, /\$\{isOpen\}/);
    assert.match(src, /\$\{isOpen\s*\n\s*\? 'hidden md:flex/);
  });

  it('open FAB class is hidden on mobile and has no leftover ternary text', () => {
    const open = renderFabClass(template, true);
    assertCleanClass(open, 'open');
    assert.match(open, /\bhidden\b/);
    assert.match(open, /\bmd:flex\b/);
    assert.match(open, /bg-gray-600/);
    assert.doesNotMatch(open, /from-blue-600/);
  });

  it('closed FAB class keeps the portal gradient', () => {
    const closed = renderFabClass(template, false);
    assertCleanClass(closed, 'closed');
    assert.match(closed, /from-blue-600/);
    assert.match(closed, /to-blue-700/);
    assert.match(closed, /\bflex\b/);
    assert.doesNotMatch(closed, /\bhidden\b/);
  });
});
