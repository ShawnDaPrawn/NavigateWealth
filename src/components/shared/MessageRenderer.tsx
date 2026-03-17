/**
 * MessageRenderer — Shared AI Chat Markdown Renderer
 *
 * Renders AI assistant messages with proper markdown support:
 *   - Unordered lists  (- item, * item, + item)
 *   - Ordered lists    (1. item, 2. item)
 *   - Headings         (## H2, ### H3, #### H4)
 *   - Bold             (**text** or __text__)
 *   - Inline code      (`code`)
 *   - JSON blocks      → rendered as a table when array-of-objects, else <pre><code>
 *   - Plain text       → preserves line breaks
 *
 * Used by: WillChatInterface, Advice Engine chat.
 * The .markdown-content wrapper class (globals.css) provides base list styles.
 */

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface MessageRendererProps {
  content: string;
  role?: 'user' | 'assistant';
}

// ── Inline formatting (bold, inline code) ─────────────────────────────────────

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Combined regex: **bold**, __bold__, or `code`
  const inlineRegex = /(\*\*|__)(.+?)\1|`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let counter = 0;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      // Bold (**…** or __…__)
      parts.push(
        <strong key={`${keyPrefix}-b${counter++}`} className="font-semibold">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // Inline code
      parts.push(
        <code
          key={`${keyPrefix}-c${counter++}`}
          className="bg-slate-100 rounded px-1 py-0.5 text-[0.8em] font-mono"
        >
          {match[3]}
        </code>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

// ── JSON table helpers ────────────────────────────────────────────────────────

function isValidJSON(str: string): boolean {
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
}

function shouldRenderAsTable(data: unknown): boolean {
  if (Array.isArray(data)) {
    return data.length > 0 && typeof data[0] === 'object' && data[0] !== null;
  }
  return typeof data === 'object' && data !== null && Object.keys(data as object).length > 0;
}

function renderTable(data: unknown, isUser: boolean, key: string): React.ReactNode {
  const borderCls = isUser ? 'border-purple-400 bg-white/95' : 'border-gray-300 bg-white';
  const headerCls = isUser ? 'bg-purple-100' : 'bg-gray-100';
  const rowCls = isUser ? 'hover:bg-purple-50' : 'hover:bg-gray-50';

  if (Array.isArray(data)) {
    if (data.length === 0) return <p key={key} className="text-sm italic text-gray-500">Empty data set</p>;
    const firstItem = data[0];
    if (typeof firstItem !== 'object' || firstItem === null) {
      return <p key={key} className="text-sm italic text-gray-500">Cannot render as table</p>;
    }
    const headers = Object.keys(firstItem as Record<string, unknown>);
    return (
      <div key={key} className={`my-3 overflow-x-auto rounded-lg border ${borderCls}`}>
        <Table>
          <TableHeader>
            <TableRow className={headerCls}>
              {headers.map((h, i) => <TableHead key={i} className="text-gray-900">{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data as Record<string, unknown>[]).map((row, ri) => (
              <TableRow key={ri} className={rowCls}>
                {headers.map((h, ci) => (
                  <TableCell key={ci} className="text-gray-900">
                    {typeof row[h] === 'object' ? JSON.stringify(row[h]) : String(row[h] ?? '-')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Single object → key-value
  const entries = Object.entries(data as Record<string, unknown>);
  return (
    <div key={key} className={`my-3 overflow-x-auto rounded-lg border ${borderCls}`}>
      <Table>
        <TableHeader>
          <TableRow className={headerCls}>
            <TableHead className="text-gray-900">Property</TableHead>
            <TableHead className="text-gray-900">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([k, v], i) => (
            <TableRow key={i} className={rowCls}>
              <TableCell className="font-medium text-gray-900">{k}</TableCell>
              <TableCell className="text-gray-900">
                {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v ?? '-')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Markdown block renderer ────────────────────────────────────────────────────

type LineType =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'ul_item'; text: string }
  | { type: 'ol_item'; number: number; text: string }
  | { type: 'blank' }
  | { type: 'text'; text: string };

function classifyLine(line: string): LineType {
  // Headings
  const h4 = line.match(/^#{4}\s+(.+)/);
  if (h4) return { type: 'heading', level: 4, text: h4[1] };
  const h3 = line.match(/^#{3}\s+(.+)/);
  if (h3) return { type: 'heading', level: 3, text: h3[1] };
  const h2 = line.match(/^#{2}\s+(.+)/);
  if (h2) return { type: 'heading', level: 2, text: h2[1] };
  const h1 = line.match(/^#{1}\s+(.+)/);
  if (h1) return { type: 'heading', level: 1, text: h1[1] };

  // Ordered list item: `1. `, `2. `, etc.
  const olMatch = line.match(/^(\d+)\.\s+(.+)/);
  if (olMatch) return { type: 'ol_item', number: parseInt(olMatch[1], 10), text: olMatch[2] };

  // Unordered list item: `- `, `* `, `+ `
  const ulMatch = line.match(/^[-*+]\s+(.+)/);
  if (ulMatch) return { type: 'ul_item', text: ulMatch[1] };

  // Blank
  if (line.trim() === '') return { type: 'blank' };

  return { type: 'text', text: line };
}

/**
 * Render a block of plain markdown text (no JSON) into React elements.
 * Groups consecutive list items into <ul>/<ol> blocks.
 */
function renderMarkdownLines(text: string, keyPrefix: string, isUser: boolean): React.ReactNode[] {
  const lines = text.split('\n');
  const classified = lines.map(classifyLine);
  const elements: React.ReactNode[] = [];
  let i = 0;
  let elemIdx = 0;

  while (i < classified.length) {
    const cl = classified[i];

    if (cl.type === 'ul_item') {
      // Collect consecutive ul items
      const items: string[] = [];
      while (i < classified.length && classified[i].type === 'ul_item') {
        items.push((classified[i] as { type: 'ul_item'; text: string }).text);
        i++;
      }
      elements.push(
        <ul key={`${keyPrefix}-ul${elemIdx++}`} className="list-disc pl-5 my-1 space-y-0.5">
          {items.map((item, ii) => (
            <li key={ii} className="leading-relaxed">
              {renderInline(item, `${keyPrefix}-ul${elemIdx}-${ii}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (cl.type === 'ol_item') {
      // Collect consecutive ol items
      const items: string[] = [];
      while (i < classified.length && classified[i].type === 'ol_item') {
        items.push((classified[i] as { type: 'ol_item'; number: number; text: string }).text);
        i++;
      }
      elements.push(
        <ol key={`${keyPrefix}-ol${elemIdx++}`} className="list-decimal pl-5 my-1 space-y-0.5">
          {items.map((item, ii) => (
            <li key={ii} className="leading-relaxed">
              {renderInline(item, `${keyPrefix}-ol${elemIdx}-${ii}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (cl.type === 'heading') {
      const cls = 'font-semibold mt-3 mb-1 ' + (
        cl.level === 1 ? 'text-base' :
        cl.level === 2 ? 'text-sm' :
        'text-sm text-gray-700'
      );
      const Tag = cl.level === 1 ? 'p' : 'p'; // Avoid h1-h4 to prevent global CSS override
      elements.push(
        <Tag key={`${keyPrefix}-h${elemIdx++}`} className={cls}>
          {renderInline(cl.text, `${keyPrefix}-hd${elemIdx}`)}
        </Tag>
      );
      i++;
      continue;
    }

    if (cl.type === 'blank') {
      // Accumulate blanks as a small spacer
      let blankCount = 0;
      while (i < classified.length && classified[i].type === 'blank') { blankCount++; i++; }
      if (blankCount > 0) {
        elements.push(<br key={`${keyPrefix}-br${elemIdx++}`} />);
      }
      continue;
    }

    // Plain text line
    elements.push(
      <span key={`${keyPrefix}-t${elemIdx++}`} className="block leading-relaxed">
        {renderInline(cl.text, `${keyPrefix}-inline${elemIdx}`)}
      </span>
    );
    i++;
  }

  return elements;
}

// ── Main parser: splits on JSON blocks, renders the rest as markdown ──────────

function parseContent(text: string, isUser: boolean): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let currentText = '';
  let bracketCount = 0;
  let currentJSON = '';
  let inJSON = false;
  let elementKey = 0;

  const flushText = () => {
    if (currentText.trim() || currentText.includes('\n')) {
      elements.push(
        <div key={`txt-${elementKey++}`}>
          {renderMarkdownLines(currentText, `mk-${elementKey}`, isUser)}
        </div>
      );
      currentText = '';
    }
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if ((char === '{' || char === '[') && !inJSON) {
      // Might be start of JSON — flush accumulated text first
      flushText();
      inJSON = true;
      currentJSON += char;
      bracketCount++;
    } else if ((char === '{' || char === '[') && inJSON) {
      currentJSON += char;
      bracketCount++;
    } else if ((char === '}' || char === ']') && inJSON) {
      currentJSON += char;
      bracketCount--;

      if (bracketCount === 0) {
        if (isValidJSON(currentJSON)) {
          try {
            const parsed = JSON.parse(currentJSON);
            if (shouldRenderAsTable(parsed)) {
              elements.push(renderTable(parsed, isUser, `tbl-${elementKey++}`));
            } else {
              const preClass = isUser
                ? 'my-2 p-3 rounded-lg overflow-x-auto text-xs bg-purple-900/90 text-purple-50'
                : 'my-2 p-3 rounded-lg overflow-x-auto text-xs bg-gray-800 text-gray-100';
              elements.push(
                <pre key={`json-${elementKey++}`} className={preClass}>
                  <code>{JSON.stringify(parsed, null, 2)}</code>
                </pre>
              );
            }
          } catch {
            currentText += currentJSON;
          }
        } else {
          currentText += currentJSON;
        }
        currentJSON = '';
        inJSON = false;
      }
    } else if (inJSON) {
      currentJSON += char;
    } else {
      currentText += char;
    }
  }

  // Flush any remaining text or incomplete JSON
  if (currentJSON) currentText += currentJSON;
  if (currentText) flushText();

  return elements.length > 0 ? elements : [<span key="empty">{text}</span>];
}

// ── Export ────────────────────────────────────────────────────────────────────

export function MessageRenderer({ content, role = 'assistant' }: MessageRendererProps) {
  const isUser = role === 'user';
  return (
    <div className="message-content text-sm">
      {parseContent(content, isUser)}
    </div>
  );
}