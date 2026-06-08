import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  navigateWealthPdfDocumentTitle,
  escapeHtmlText,
  sanitizeWindowsFileName,
  navigateWealthPdfSaveFileName,
  withNavigateWealthPrintTitle,
} from '../pdfPrintTitle';

describe('navigateWealthPdfDocumentTitle', () => {
  it('appends title to Navigate Wealth prefix', () => {
    expect(navigateWealthPdfDocumentTitle('Risk Report')).toBe('Navigate Wealth - Risk Report');
  });

  it('uses Document as default when title is empty', () => {
    expect(navigateWealthPdfDocumentTitle('')).toBe('Navigate Wealth - Document');
    expect(navigateWealthPdfDocumentTitle(null)).toBe('Navigate Wealth - Document');
    expect(navigateWealthPdfDocumentTitle(undefined)).toBe('Navigate Wealth - Document');
  });

  it('trims whitespace from title', () => {
    expect(navigateWealthPdfDocumentTitle('  Plan  ')).toBe('Navigate Wealth - Plan');
  });
});

describe('escapeHtmlText', () => {
  it('escapes ampersand, angle brackets and quotes', () => {
    expect(escapeHtmlText('a & b')).toBe('a &amp; b');
    expect(escapeHtmlText('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtmlText('"value"')).toBe('&quot;value&quot;');
  });

  it('leaves clean text unchanged', () => {
    expect(escapeHtmlText('Hello World')).toBe('Hello World');
  });

  it('handles multiple special chars in one string', () => {
    expect(escapeHtmlText('<a href="x&y">test</a>')).toBe(
      '&lt;a href=&quot;x&amp;y&quot;&gt;test&lt;/a&gt;',
    );
  });
});

describe('sanitizeWindowsFileName', () => {
  it('strips illegal Windows characters', () => {
    expect(sanitizeWindowsFileName('file/name')).toBe('file-name');
    expect(sanitizeWindowsFileName('file:name')).toBe('file-name');
    expect(sanitizeWindowsFileName('file*name')).toBe('file-name');
    expect(sanitizeWindowsFileName('file?name')).toBe('file-name');
    expect(sanitizeWindowsFileName('file<name>')).toBe('file-name-');
    expect(sanitizeWindowsFileName('file|name')).toBe('file-name');
  });

  it('returns Document for empty/whitespace input', () => {
    expect(sanitizeWindowsFileName('')).toBe('Document');
    expect(sanitizeWindowsFileName('   ')).toBe('Document');
  });

  it('strips leading dots', () => {
    expect(sanitizeWindowsFileName('..hidden')).toBe('hidden');
  });

  it('keeps spaces and normal chars', () => {
    expect(sanitizeWindowsFileName('My Report 2026')).toBe('My Report 2026');
  });
});

describe('navigateWealthPdfSaveFileName', () => {
  it('returns .pdf extension with Navigate Wealth prefix', () => {
    expect(navigateWealthPdfSaveFileName('Client Report')).toBe(
      'Navigate Wealth - Client Report.pdf',
    );
  });

  it('falls back to Document for empty title', () => {
    expect(navigateWealthPdfSaveFileName(null)).toBe('Navigate Wealth - Document.pdf');
  });
});

describe('withNavigateWealthPrintTitle', () => {
  const originalTitle = document.title;
  const mockSetTimeout = vi.fn();

  beforeEach(() => {
    mockSetTimeout.mockClear();
    vi.stubGlobal('setTimeout', mockSetTimeout);
    document.title = originalTitle;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.title = originalTitle;
  });

  it('sets document.title during print and calls printFn', () => {
    const printFn = vi.fn();
    withNavigateWealthPrintTitle('Test Doc', printFn);

    expect(document.title).toBe('Navigate Wealth - Test Doc');
    expect(printFn).toHaveBeenCalledOnce();
    expect(mockSetTimeout).toHaveBeenCalled();
  });

  it('schedules title restore with default 1000ms delay', () => {
    const printFn = vi.fn();
    withNavigateWealthPrintTitle('Doc', printFn);
    const [restoreFn, delay] = mockSetTimeout.mock.calls[0];
    expect(delay).toBe(1000);
    restoreFn();
    expect(document.title).toBe(originalTitle);
  });

  it('uses custom restoreAfterMs', () => {
    const printFn = vi.fn();
    withNavigateWealthPrintTitle('Doc', printFn, 500);
    const [, delay] = mockSetTimeout.mock.calls[0];
    expect(delay).toBe(500);
  });
});
