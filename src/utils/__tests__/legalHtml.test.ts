import { describe, expect, it } from 'vitest';
import {
  normalizeClipboardLegalHtml,
  normalizeLegalDocumentAnchors,
  normalizeLegalListStructure,
  sanitizeLegalDocumentHtml,
} from '../legalHtml';

describe('sanitizeLegalDocumentHtml', () => {
  it('strips dangerous tags but keeps safe content', () => {
    const out = sanitizeLegalDocumentHtml('<p>hi</p><script>alert(1)</script>');
    expect(out).toContain('<p>hi</p>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('alert');
  });

  it('forbids iframes while keeping surrounding markup', () => {
    const out = sanitizeLegalDocumentHtml('<iframe src="x"></iframe><p>ok</p>');
    expect(out).not.toContain('iframe');
    expect(out).toContain('ok');
  });

  it('falls back to an empty paragraph for empty input', () => {
    expect(sanitizeLegalDocumentHtml('')).toBe('<p></p>');
  });
});

describe('normalizeLegalListStructure', () => {
  it('converts consecutive bullet-prefixed paragraphs into a real list', () => {
    const out = normalizeLegalListStructure('<p>• one</p><p>• two</p>');
    expect(out).toContain('<ul>');
    expect(out).toContain('<li>');
    expect(out).toContain('one');
    expect(out).toContain('two');
    expect(out).not.toContain('•');
  });

  it('returns the fallback for empty input', () => {
    expect(normalizeLegalListStructure('')).toBe('<p></p>');
  });
});

describe('normalizeClipboardLegalHtml', () => {
  it('removes comments, mso noise, event handlers and meta/link nodes', () => {
    const dirty =
      '<!--c--><meta charset="utf-8"><p class="MsoNormal keep" style="mso-foo:1; color: red" onclick="evil()">Hi</p>';
    const out = normalizeClipboardLegalHtml(dirty);
    expect(out).toContain('Hi');
    expect(out).toContain('keep'); // non-mso class retained
    expect(out).toContain('color'); // valid style retained
    expect(out.toLowerCase()).not.toContain('mso');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('<!--');
    expect(out).not.toContain('<meta');
  });
});

describe('normalizeLegalDocumentAnchors', () => {
  it('assigns slugged ids to headings and builds a table of contents', () => {
    const { html, toc } = normalizeLegalDocumentAnchors(
      '<h1>Intro Section</h1><h2>The Details!</h2>',
    );
    expect(toc).toHaveLength(2);
    expect(toc[0]).toMatchObject({ id: 'intro-section', title: 'Intro Section', level: 1 });
    expect(toc[1]).toMatchObject({ id: 'the-details', level: 2 });
    expect(html).toContain('intro-section');
    expect(html).toContain('the-details');
  });

  it('deduplicates ids for headings with identical text', () => {
    const { toc } = normalizeLegalDocumentAnchors('<h2>Clause</h2><h2>Clause</h2>');
    expect(toc).toHaveLength(2);
    expect(toc[0].id).not.toBe(toc[1].id);
  });

  it('honours a preferred table of contents', () => {
    const { toc } = normalizeLegalDocumentAnchors('<h1>Anything</h1>', [
      { id: 'custom-id', title: 'Custom Title', level: 1 },
    ]);
    expect(toc[0].id).toBe('custom-id');
    expect(toc[0].title).toBe('Custom Title');
  });
});
