/**
 * MarkdownPreview — SECURITY-AUDIT S9 regression guard
 * =====================================================
 *
 * `parseMarkdown` entity-escapes its input, so raw `<script>` was never the
 * hole here. The link rule was: it captured `[text](url)` and interpolated the
 * URL straight into `href="…"`, and entity-escaping does not stop
 * `javascript:alert(1)` from being a working navigation target. The component
 * renders through `dangerouslySetInnerHTML`, so this is a real execution sink
 * reachable by anyone who can write a note.
 *
 * Run: npx vitest run src/components/admin/modules/notes/components/__tests__/MarkdownPreview.security.test.tsx
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { MarkdownPreview } from '../MarkdownPreview';

/** Returns the rendered anchor for a single markdown link, if one was emitted. */
function renderLink(markdown: string): HTMLAnchorElement | null {
  const { container } = render(<MarkdownPreview content={markdown} />);
  return container.querySelector('a');
}

describe('MarkdownPreview link scheme handling', () => {
  it('refuses a javascript: URI', () => {
    const anchor = renderLink('[click me](javascript:alert(1))');

    // Either no anchor at all, or one that certainly does not navigate to a script.
    expect(anchor?.getAttribute('href') ?? '').not.toContain('javascript:');
  });

  it('refuses javascript: however it is cased or padded', () => {
    // The historical bypass for a naive `startsWith('javascript:')` check.
    for (const payload of [
      '[a](JaVaScRiPt:alert(1))',
      '[a](  javascript:alert(1))',
      '[a](\tjavascript:alert(1))',
    ]) {
      const anchor = renderLink(payload);
      expect(anchor?.getAttribute('href')?.toLowerCase() ?? '').not.toContain('javascript:');
    }
  });

  it('refuses data: URIs, which navigate to attacker-authored HTML', () => {
    const anchor = renderLink('[a](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)');
    expect(anchor?.getAttribute('href') ?? '').not.toContain('data:');
  });

  it('still renders the label when a link is rejected, rather than losing content', () => {
    const { container } = render(
      <MarkdownPreview content="[important note](javascript:alert(1))" />,
    );
    expect(container.textContent).toContain('important note');
  });

  it('does not double-escape an ampersand in the query string', () => {
    // `processInline` escapes the whole line BEFORE the link regex runs, so the
    // captured URL already reads `&amp;`. Escaping it a second time produced
    // `&amp;amp;`, and the browser then navigated to a parameter literally named
    // `amp;b` — a silently wrong link rather than a blocked one.
    const anchor = renderLink('[site](https://example.com?a=1&b=2)');
    expect(anchor?.getAttribute('href')).toBe('https://example.com?a=1&b=2');
  });

  it('keeps ordinary links working', () => {
    expect(renderLink('[site](https://navigatewealth.co)')?.getAttribute('href')).toBe(
      'https://navigatewealth.co',
    );
    expect(renderLink('[mail](mailto:info@navigatewealth.co)')?.getAttribute('href')).toBe(
      'mailto:info@navigatewealth.co',
    );
    expect(renderLink('[internal](/admin/notes)')?.getAttribute('href')).toBe('/admin/notes');
  });
});

describe('MarkdownPreview markup handling', () => {
  it('does not execute raw tags embedded in note text', () => {
    const { container } = render(
      <MarkdownPreview content={'<script>alert(1)</script>\n<img src=x onerror=alert(1)>'} />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    // The text is preserved and shown to the author, just inert.
    expect(container.textContent).toContain('alert(1)');
  });

  it('strips an event handler attribute if any rule ever emits one', () => {
    // This is the DOMPurify backstop, not the parser: it guards the rule that
    // gets added later without an escape.
    const { container } = render(
      <MarkdownPreview content={'**bold** <b onclick="alert(1)">x</b>'} />,
    );
    expect(container.querySelector('[onclick]')).toBeNull();
  });
});
