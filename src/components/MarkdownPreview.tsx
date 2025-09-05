'use client';

import React from 'react';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

// Utilitário simples para validar URLs
const isSafeUrl = (url: string) => {
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
};

// Renderização de markdown básica e segura (sem HTML embutido)
// Suporte: títulos (#), parágrafos, listas com '-', blocos de código ``` e inline `code`,
// negrito **texto**, itálico *texto*, links [texto](url)
const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Array<{ type: string; content: any }> = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Código cercado ```
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      // pular linha de fechamento ``` se existir
      if (i < lines.length && lines[i].trim().startsWith('```')) i++;
      blocks.push({ type: 'code', content: codeLines.join('\n') });
      continue;
    }

    // HR --- *** ___
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: 'hr', content: null });
      i++;
      continue;
    }

    // Imagem em linha inteira ![alt](url)
    const imgMatch = line.trim().match(/^!\[([^\]]*)\]\(([^\)]+)\)$/);
    if (imgMatch) {
      const alt = imgMatch[1];
      const url = imgMatch[2];
      if (isSafeUrl(url)) {
        blocks.push({ type: 'image', content: { alt, url } });
      }
      i++;
      continue;
    }

    // Citações >
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', content: quoteLines.join('\n') });
      continue;
    }

    // Tabela simples (linha com | seguida de separador de cabeçalho)
    if (line.includes('|') && i + 1 < lines.length && /^\s*[:\-\|\s]+$/.test(lines[i + 1])) {
      const rows: string[][] = [];
      // Header
      const headers = line.split('|').map(s => s.trim()).filter(Boolean);
      i += 2; // pular separador
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(lines[i].split('|').map(s => s.trim()).filter(Boolean));
        i++;
      }
      blocks.push({ type: 'table', content: { headers, rows } });
      continue;
    }

    // Lista com '- '
    if (line.trim().startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push({ type: 'list', content: items });
      continue;
    }

    // Títulos
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push({ type: `h${level}`, content: headingMatch[2] });
      i++;
      continue;
    }

    // Parágrafo (agrupar linhas até linha em branco)
    if (line.trim() !== '') {
      const para: string[] = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== '') {
        para.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'p', content: para.join('\n') });
      continue;
    }

    // Linha em branco
    i++;
  }

  // Inline parser: **bold**, *italic*, `code`, [text](url)
  const renderInline = (text: string, keyPrefix: string) => {
    const elements: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    const pushText = (t: string) => {
      if (!t) return;
      elements.push(<span key={`${keyPrefix}-t${key++}`}>{t}</span>);
    };

    // Processar sequencialmente usando regex global simples
    const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^\)]+\))/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(remaining)) !== null) {
      const start = match.index;
      const end = pattern.lastIndex;
      pushText(remaining.slice(lastIndex, start));
      const token = match[0];

      if (token.startsWith('**')) {
        elements.push(
          <strong key={`${keyPrefix}-b${key++}`}>{token.slice(2, -2)}</strong>
        );
      } else if (token.startsWith('*')) {
        elements.push(
          <em key={`${keyPrefix}-i${key++}`}>{token.slice(1, -1)}</em>
        );
      } else if (token.startsWith('`')) {
        elements.push(
          <code key={`${keyPrefix}-c${key++}`} className="px-1 py-0.5 bg-gray-100 rounded text-sm">
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('[')) {
        const linkMatch = token.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
        if (linkMatch) {
          const [_, label, url] = linkMatch;
          if (isSafeUrl(url)) {
            elements.push(
              <a
                key={`${keyPrefix}-a${key++}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {label}
              </a>
            );
          } else {
            pushText(label);
          }
        }
      }

      lastIndex = end;
    }

    pushText(remaining.slice(lastIndex));
    return elements;
  };

  const renderBlock = (block: { type: string; content: any }, index: number) => {
    switch (block.type) {
      case 'code':
        return (
          <pre key={index} className="my-3 p-3 bg-gray-100 rounded overflow-x-auto text-sm">
            <code>{String(block.content)}</code>
          </pre>
        );
      case 'list':
        return (
          <ul key={index} className="list-disc ml-6 my-2">
            {block.content.map((item: string, i: number) => (
              <li key={i}>{renderInline(item, `li-${index}-${i}`)}</li>
            ))}
          </ul>
        );
      case 'blockquote':
        return (
          <blockquote key={index} className="my-3 pl-4 border-l-4 border-gray-300 text-gray-700 italic">
            {renderInline(String(block.content), `q-${index}`)}
          </blockquote>
        );
      case 'image':
        return (
          <div key={index} className="my-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={block.content.url} alt={block.content.alt || ''} className="max-w-full h-auto rounded" loading="lazy" decoding="async" />
          </div>
        );
      case 'table':
        return (
          <div key={index} className="overflow-x-auto my-3">
            <table className="min-w-full text-sm border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {block.content.headers.map((h: string, i: number) => (
                    <th key={i} className="px-3 py-2 text-left border-b border-gray-200">{renderInline(h, `th-${index}-${i}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.content.rows.map((r: string[], ri: number) => (
                  <tr key={ri} className="odd:bg-white even:bg-gray-50">
                    {r.map((c: string, ci: number) => (
                      <td key={ci} className="px-3 py-2 border-b border-gray-100">{renderInline(c, `td-${index}-${ri}-${ci}`)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'hr':
        return (<hr key={index} className="my-4 border-gray-200" />);
      case 'p':
        return (
          <p key={index} className="my-2 leading-relaxed">
            {renderInline(String(block.content), `p-${index}`).reduce((acc: any[], node, idx) => {
              // Inserir <br/> para quebras de linha dentro do par e1grafo
              if (typeof node === 'string' && node.includes('\n')) {
                const parts = (node as string).split('\n');
                parts.forEach((part, i) => {
                  acc.push(<span key={`p-${index}-t-${idx}-${i}`}>{part}</span>);
                  if (i < parts.length - 1) acc.push(<br key={`p-${index}-br-${idx}-${i}`} />);
                });
              } else {
                acc.push(node);
              }
              return acc;
            }, [])}
          </p>
        );
      default:
        if (block.type.startsWith('h')) {
          const level = Math.min(6, Math.max(1, parseInt(block.type.slice(1), 10)));
          const Tag = (`h${level}` as unknown) as keyof JSX.IntrinsicElements;
          const sizes = ['text-2xl','text-xl','text-lg','text-base','text-base','text-base'];
          return (
            <Tag key={index} className={`${sizes[level-1]} font-semibold my-3 text-gray-800`}>
              {renderInline(String(block.content), `h-${index}`)}
            </Tag>
          );
        }
        return null;
    }
  };

  return (
    <div className={className}>
      {blocks.map((b, idx) => renderBlock(b, idx))}
    </div>
  );
};

export default MarkdownPreview;

