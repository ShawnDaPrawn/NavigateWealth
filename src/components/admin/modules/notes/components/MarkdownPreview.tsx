/**
 * MarkdownPreview — Lightweight markdown renderer for notes
 *
 * Renders plain text with basic markdown-like formatting:
 *   - **bold**, *italic*, ~~strikethrough~~
 *   - # headings (h1–h3)
 *   - - bullet lists, 1. ordered lists
 *   - `inline code`, ```code blocks```
 *   - > blockquotes
 *   - --- horizontal rules
 *   - [links](url)
 *   - - [ ] / - [x] checklists
 *
 * Uses a pure-JS parser to avoid external markdown library dependencies.
 *
 * §7 — Presentation only
 */

import DOMPurify from 'dompurify';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

/**
 * Escape HTML entities for safety
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Schemes permitted in a `[text](url)` link target.
 *
 * SECURITY (SECURITY-AUDIT S9): `escapeHtml` above neutralises raw tags, so the
 * only way markup reached the DOM here was the link rule — it dropped the
 * captured URL straight into `href="…"`, and `javascript:alert(1)` is not
 * blocked by entity-escaping. Anything not on this list renders as an inert
 * anchor instead. `data:` is deliberately absent: `data:text/html` is a
 * navigation-based script vector in the same way.
 */
const SAFE_URL_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

function sanitizeUrl(rawUrl: string): string | null {
  const url = rawUrl.trim();

  // Relative and anchor targets never carry a scheme, so they are safe and are
  // the common case for internal note links.
  if (url.startsWith('/') || url.startsWith('#')) return url;

  try {
    // A base is required so protocol-relative and relative inputs parse rather
    // than throw; only the resulting protocol is consulted.
    const parsed = new URL(url, 'https://navigatewealth.co');
    return SAFE_URL_SCHEMES.includes(parsed.protocol) ? url : null;
  } catch {
    return null;
  }
}

/**
 * Process inline formatting (bold, italic, code, links, strikethrough, checklist)
 */
function processInline(text: string): string {
  let result = escapeHtml(text);

  // Inline code (must be before bold/italic to avoid conflicts)
  result = result.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 rounded bg-gray-100 text-pink-600 text-[0.85em] font-mono">$1</code>',
  );

  // Bold + italic
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Strikethrough
  result = result.replace(/~~(.+?)~~/g, '<del class="text-gray-400">$1</del>');

  // Links [text](url) — the URL is scheme-checked, never interpolated blindly.
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, url: string) => {
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) {
      // Render the label as plain text rather than dropping the content, so a
      // rejected link is visible to the author instead of silently vanishing.
      return label;
    }
    // NOT re-escaped: `processInline` ran `escapeHtml` over the whole line
    // before this regex matched, so `safeUrl` is ALREADY entity-encoded.
    // Escaping again turned `&` into `&amp;amp;`, and a link like
    // `[s](https://x.com?a=1&b=2)` then navigated to a parameter named
    // `amp;b`. The first escape is what keeps quotes out of the attribute.
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-700">${label}</a>`;
  });

  // Checklist items
  result = result.replace(
    /^- \[x\] (.+)/gm,
    '<span class="flex items-center gap-2"><span class="inline-flex items-center justify-center w-4 h-4 rounded border border-green-400 bg-green-100 text-green-600 text-[10px]">✓</span><span class="line-through text-gray-400">$1</span></span>',
  );
  result = result.replace(
    /^- \[ \] (.+)/gm,
    '<span class="flex items-center gap-2"><span class="inline-flex items-center justify-center w-4 h-4 rounded border border-gray-300 bg-white"></span><span>$1</span></span>',
  );

  return result;
}

/**
 * Parse markdown text into HTML blocks
 */
function parseMarkdown(content: string): string {
  if (!content.trim()) return '<p class="text-gray-400 italic">Nothing to preview</p>';

  const lines = content.split('\n');
  const htmlParts: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' = 'ul';

  const closeList = () => {
    if (inList) {
      htmlParts.push(`</${listType}>`);
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        htmlParts.push(
          `<pre class="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm font-mono my-2"><code>${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`,
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        closeList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
      closeList();
      htmlParts.push('<hr class="border-gray-200 my-4" />');
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      closeList();
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const text = processInline(headingMatch[2]);
      const sizes: Record<number, string> = {
        1: 'text-xl font-bold text-gray-900 mt-4 mb-2',
        2: 'text-lg font-semibold text-gray-900 mt-3 mb-1.5',
        3: 'text-base font-semibold text-gray-800 mt-2 mb-1',
      };
      htmlParts.push(`<h${level} class="${sizes[level]}">${text}</h${level}>`);
      continue;
    }

    // Blockquote
    const quoteMatch = line.match(/^>\s?(.*)/);
    if (quoteMatch) {
      closeList();
      htmlParts.push(
        `<blockquote class="border-l-3 border-purple-300 pl-4 py-1 text-gray-600 italic my-2">${processInline(quoteMatch[1])}</blockquote>`,
      );
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[-*]\s+(.+)/);
    if (ulMatch && !line.match(/^- \[[ x]\]/)) {
      if (!inList || listType !== 'ul') {
        closeList();
        htmlParts.push('<ul class="list-disc list-inside space-y-1 my-2 text-gray-700">');
        inList = true;
        listType = 'ul';
      }
      htmlParts.push(`<li>${processInline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        closeList();
        htmlParts.push('<ol class="list-decimal list-inside space-y-1 my-2 text-gray-700">');
        inList = true;
        listType = 'ol';
      }
      htmlParts.push(`<li>${processInline(olMatch[1])}</li>`);
      continue;
    }

    // Checklist items (already handled by processInline, but need to close lists first)
    if (line.match(/^- \[[ x]\]/)) {
      closeList();
      htmlParts.push(`<div class="my-0.5">${processInline(line)}</div>`);
      continue;
    }

    // Regular paragraph
    closeList();
    htmlParts.push(`<p class="text-gray-700 leading-relaxed my-1.5">${processInline(line)}</p>`);
  }

  closeList();

  // Close unclosed code block
  if (inCodeBlock && codeBlockContent.length > 0) {
    htmlParts.push(
      `<pre class="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm font-mono my-2"><code>${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`,
    );
  }

  return htmlParts.join('\n');
}

export function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  // Defence in depth: `parseMarkdown` escapes its inputs and scheme-checks link
  // targets, but it is a hand-rolled parser with a dozen regex rules, and this
  // output goes to `dangerouslySetInnerHTML`. DOMPurify is the backstop for the
  // rule that gets added later without an escape.
  const html = DOMPurify.sanitize(parseMarkdown(content));

  return (
    <div className={`markdown-preview ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
