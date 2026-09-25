import React from 'react';
import { sanitizeChatHref } from '../../lib/ia/chat-href';

export { sanitizeChatHref } from '../../lib/ia/chat-href';

/**
 * Lightweight markdown for IA chat bubbles (Assistant MessageBubble + Companion FAB).
 * No raw HTML — only React text nodes + allowlisted tags. Safe from XSS.
 *
 * Supported blocks: fenced code, GFM tables (| col |), blockquotes (>), headings
 * (#…####), bullet/numbered lists (incl. `- **Title**: description` rows with
 * hanging indent) and paragraphs. Inline: **bold**, *italic*, `code`, safe links.
 */

function processInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return (
        <strong key={i} className="font-semibold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`'))
      return (
        <code key={i} className="bg-gray-100 text-pink-600 px-1 rounded text-[0.85em] font-mono break-all">
          {part.slice(1, -1)}
        </code>
      );
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const safeHref = sanitizeChatHref(href);
      if (safeHref) {
        const external = safeHref.startsWith('http://') || safeHref.startsWith('https://');
        return (
          <a
            key={i}
            href={safeHref}
            className="text-blue-600 underline underline-offset-2 hover:text-blue-800 break-all"
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {label}
          </a>
        );
      }
      return <span key={i}>{label}</span>;
    }
    return part;
  });
}

// ---------------------------------------------------------------------------
// Block-level parsing
// ---------------------------------------------------------------------------

type TableAlign = 'left' | 'center' | 'right';

interface ListItem {
  text: string;
  level: number;
  index: number;
}

type Block =
  | { type: 'table'; header: string[]; aligns: TableAlign[]; rows: string[][] }
  | { type: 'quote'; lines: string[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'list'; ordered: boolean; items: ListItem[] }
  | { type: 'hr' }
  | { type: 'paragraph'; lines: string[] };

const BULLET_RE = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED_RE = /^(\s*)(\d{1,3})[.)]\s+(.*)$/;
const HEADING_RE = /^(#{1,4})\s+(.*)$/;
const HR_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE_RE = /^\s*>/;

/** Split a GFM table row into trimmed cells, honoring `\|` escapes. */
function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && s[i + 1] === '|') {
      cur += '|';
      i++;
      continue;
    }
    if (ch === '|') {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/** GFM delimiter row: `| --- | :---: | ---: |` (2+ dashes per cell). */
function isTableSeparatorRow(line: string): boolean {
  const t = line.trim();
  if (!t.includes('-')) return false;
  const cells = splitTableRow(t);
  return cells.length > 0 && cells.every(c => /^:?-{2,}:?$/.test(c));
}

function parseAlign(cell: string): TableAlign {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  return 'left';
}

function listLevel(indent: string): number {
  return Math.min(3, Math.floor(indent.replace(/\t/g, '  ').length / 2));
}

function parseBlocks(segment: string): Block[] {
  const lines = segment.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3 | 4,
        text: heading[2].trim(),
      });
      i++;
      continue;
    }

    if (HR_RE.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'quote', lines: quoteLines });
      continue;
    }

    // GFM table: a line containing '|' followed by a delimiter row
    if (line.includes('|') && i + 1 < lines.length && isTableSeparatorRow(lines[i + 1])) {
      const header = splitTableRow(line);
      const aligns = splitTableRow(lines[i + 1]).map(parseAlign);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        const cells = splitTableRow(lines[i]);
        while (cells.length < header.length) cells.push('');
        rows.push(cells.slice(0, Math.max(header.length, cells.length)));
        i++;
      }
      blocks.push({ type: 'table', header, aligns, rows });
      continue;
    }

    const bullet = line.match(BULLET_RE);
    const ordered = bullet ? null : line.match(ORDERED_RE);
    if (bullet || ordered) {
      const isOrdered = !!ordered;
      const items: ListItem[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) break;
        const b = l.match(BULLET_RE);
        const o = b ? null : l.match(ORDERED_RE);
        if (isOrdered ? !o : !b) break;
        if (isOrdered && o) {
          items.push({ text: o[3], level: listLevel(o[1]), index: parseInt(o[2], 10) });
        } else if (b) {
          items.push({ text: b[2], level: listLevel(b[1]), index: 0 });
        }
        i++;
      }
      blocks.push({ type: 'list', ordered: isOrdered, items });
      continue;
    }

    // Paragraph: consecutive plain lines (soft breaks preserved as <br/>)
    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) break;
      if (HEADING_RE.test(l) || QUOTE_RE.test(l) || HR_RE.test(l)) break;
      if (BULLET_RE.test(l) || ORDERED_RE.test(l)) break;
      if (l.includes('|') && i + 1 < lines.length && isTableSeparatorRow(lines[i + 1])) break;
      paragraphLines.push(l);
      i++;
    }
    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', lines: paragraphLines });
    } else {
      i++; // safety net — never stall the parser
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Block-level rendering
// ---------------------------------------------------------------------------

const TABLE_ALIGN_CLASS: Record<TableAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const HEADING_TAG = { 1: 'h3', 2: 'h4', 3: 'h5', 4: 'h6' } as const;
const HEADING_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: 'text-[1.2em] font-bold text-gray-900 mt-3 mb-1 first:mt-0',
  2: 'text-[1.1em] font-bold text-gray-900 mt-2.5 mb-1 first:mt-0',
  3: 'text-[1em] font-semibold text-gray-900 mt-2 mb-0.5 first:mt-0',
  4: 'text-[0.95em] font-semibold text-gray-800 mt-1.5 mb-0.5 first:mt-0',
};

const NEST_CLASS = ['ml-0', 'ml-4', 'ml-7', 'ml-10'];

function renderTable(block: Extract<Block, { type: 'table' }>, key: number): React.ReactNode {
  return (
    <div key={key} className="my-2 max-w-full overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="w-full border-collapse text-[0.92em] leading-snug">
        <thead>
          <tr className="bg-gray-100/80">
            {block.header.map((cell, hi) => (
              <th
                key={hi}
                scope="col"
                className={`px-3 py-1.5 font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap ${TABLE_ALIGN_CLASS[block.aligns[hi] || 'left']}`}
              >
                {processInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 1 ? 'bg-gray-50/70' : 'bg-white'}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-3 py-1.5 align-top border-t border-gray-100 text-gray-700 break-words ${TABLE_ALIGN_CLASS[block.aligns[ci] || 'left']}`}
                >
                  {processInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderQuote(block: Extract<Block, { type: 'quote' }>, key: number): React.ReactNode {
  return (
    <blockquote
      key={key}
      className="my-2 rounded-r-lg border-l-4 border-blue-300 bg-blue-50/60 px-3 py-2 text-gray-700 not-italic"
    >
      {block.lines.map((l, li) =>
        l.trim() ? (
          <p key={li} className="my-0.5 first:mt-0 last:mb-0 break-words">
            {processInline(l)}
          </p>
        ) : (
          <div key={li} className="h-1.5" />
        ),
      )}
    </blockquote>
  );
}

function renderList(block: Extract<Block, { type: 'list' }>, key: number): React.ReactNode {
  if (block.ordered) {
    return (
      <ol key={key} className="my-1.5 space-y-1">
        {block.items.map((item, ii) => (
          <li key={ii} className={`flex items-baseline gap-1.5 ${NEST_CLASS[item.level]}`}>
            <span className="shrink-0 tabular-nums font-medium text-gray-500">{item.index}.</span>
            <span className="min-w-0 flex-1 break-words leading-relaxed">{processInline(item.text)}</span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ul key={key} className="my-1.5 space-y-1">
      {block.items.map((item, ii) => (
        <li key={ii} className={`flex items-start gap-2 ${NEST_CLASS[item.level]}`}>
          <span aria-hidden className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-gray-400" />
          <span className="min-w-0 flex-1 break-words leading-relaxed">{processInline(item.text)}</span>
        </li>
      ))}
    </ul>
  );
}

function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.type) {
    case 'table':
      return renderTable(block, key);
    case 'quote':
      return renderQuote(block, key);
    case 'heading': {
      const Tag = HEADING_TAG[block.level];
      return (
        <Tag key={key} className={HEADING_CLASS[block.level]}>
          {processInline(block.text)}
        </Tag>
      );
    }
    case 'list':
      return renderList(block, key);
    case 'hr':
      return <hr key={key} className="my-2.5 border-gray-200" />;
    case 'paragraph':
      return (
        <p key={key} className="my-1 first:mt-0 last:mb-0 leading-relaxed break-words">
          {block.lines.map((l, li) => (
            <React.Fragment key={li}>
              {li > 0 && <br />}
              {processInline(l)}
            </React.Fragment>
          ))}
        </p>
      );
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

/**
 * Lightweight markdown for IA chat bubbles (same approach as MessageBubble).
 * No raw HTML — only React text nodes + allowlisted tags. Safe from XSS.
 */
export function renderChatMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const code = part.slice(3, -3);
      const nl = code.indexOf('\n');
      const content = nl > 0 ? code.slice(nl + 1) : code;
      return (
        <pre
          key={i}
          className="bg-gray-900 text-gray-100 rounded-lg p-2.5 my-1.5 overflow-x-auto text-[0.85em]"
        >
          <code>{content}</code>
        </pre>
      );
    }
    return <React.Fragment key={i}>{parseBlocks(part).map(renderBlock)}</React.Fragment>;
  });
}

export function stripReasoningBlocks(text: string): string {
  if (!text) return '';
  let cleaned = text;
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
  cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
  cleaned = cleaned.replace(/<thought>[\s\S]*$/gi, '');
  cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '');
  cleaned = cleaned.replace(/<reasoning>[\s\S]*$/gi, '');
  cleaned = cleaned.replace(/<\/?thought>/gi, '');
  cleaned = cleaned.replace(/<\/?think>/gi, '');
  cleaned = cleaned.replace(/<\/?reasoning>/gi, '');
  return cleaned.trim();
}
