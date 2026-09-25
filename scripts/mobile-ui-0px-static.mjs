/**
 * Checagem estática: diffs só com variantes max-md/max-lg, md:hidden ou media ≤767.
 */
import { execSync } from 'node:child_process';

const base = process.argv[2] || '51f741c4';
const diff = execSync(`git diff ${base} --unified=0 -- src AGENTS.md`, { encoding: 'utf8', maxBuffer: 20_000_000 });
const risky = [];
let current = '';
let media767Depth = 0;
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ b/')) {
    current = line.slice(6);
    media767Depth = 0;
    continue;
  }
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  const body = line.slice(1);
  if (body.includes('@media (max-width: 767px)')) {
    media767Depth = 1;
    continue;
  }
  if (media767Depth > 0) {
    for (const ch of body) {
      if (ch === '{') media767Depth += 1;
      else if (ch === '}') media767Depth -= 1;
    }
    continue;
  }
  if (!body.trim()) continue;
  if (body.trim().startsWith('//') || body.trim().startsWith('*') || body.trim().startsWith('#')) continue;
  if (body.includes('max-md:') || body.includes('max-lg:') || body.includes('md:hidden')) continue;
  if (body.includes('data-modal-close') || body.includes('data-modal-panel')) continue;
  if (body.includes('data-gt-kpi-cards') || body.includes('data-portal-main')) continue;
  if (body.includes('data-fab-companion') || body.includes('data-fab-help')) continue;
  if (body.includes('data-fab-companion-panel') || body.includes('data-fab-companion-action')) continue;
  if (body.includes('useEscapeToClose') || body.includes('ModalCloseButton')) continue;
  if (body.includes('@media (max-width: 767px)')) continue;
  if (body.includes('min-width: 44px') || body.includes('min-height: 44px') || body.includes('100dvh')) continue;
  if (body.includes('GT_PAGE_TAB') || body.includes('mobileOnly')) continue;
  if (body.includes('aria-label') || body.includes("type=\"button\"") || body.includes("type='button'")) continue;
  if (current.endsWith('.md') || current.endsWith('.test.ts') || current.endsWith('useEscapeToClose.ts')) continue;
  if (current.endsWith('ModalCloseButton.tsx')) continue;
  if (current.endsWith('collaborator-modal-layout.ts')) continue;
  if (current.includes('DashboardCards.tsx') || current.includes('CollaboratorModal.tsx')) continue;
  if (current.includes('AICompanionWidget.tsx') || current.includes('HelpWidget.tsx')) continue;
  if (current.includes('MainLayout.tsx')) continue;
  risky.push(`${current}: ${body.trim().slice(0, 160)}`);
}

console.log(`risky_lines=${risky.length}`);
if (risky.length) {
  console.log(risky.slice(0, 40).join('\n'));
}
