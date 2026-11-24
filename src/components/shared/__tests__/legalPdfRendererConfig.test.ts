import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEFAULT_LEGAL_PDF_RENDERER_VERSION,
  LEGAL_PDF_RENDERER_QUERY_PARAM,
  LEGAL_PDF_RENDERER_STORAGE_KEY,
  getStoredLegalPdfRendererOverride,
  setStoredLegalPdfRendererOverride,
  clearStoredLegalPdfRendererOverride,
  legalPdfPageSelector,
  legalPdfRendererLaysOutAsync,
  resolveLegalPdfRendererVersion,
} from '../legalPdfRendererConfig';

describe('legalPdfRendererConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('DEFAULT_LEGAL_PDF_RENDERER_VERSION is the Navigator layout', () => {
    expect(DEFAULT_LEGAL_PDF_RENDERER_VERSION).toBe('navigator');
  });

  it('LEGAL_PDF_RENDERER_QUERY_PARAM and STORAGE_KEY are non-empty strings', () => {
    expect(typeof LEGAL_PDF_RENDERER_QUERY_PARAM).toBe('string');
    expect(LEGAL_PDF_RENDERER_QUERY_PARAM.length).toBeGreaterThan(0);
    expect(typeof LEGAL_PDF_RENDERER_STORAGE_KEY).toBe('string');
  });

  it('getStoredLegalPdfRendererOverride returns null when nothing stored', () => {
    expect(getStoredLegalPdfRendererOverride()).toBeNull();
  });

  it('setStoredLegalPdfRendererOverride stores the version', () => {
    setStoredLegalPdfRendererOverride('legacy');
    expect(getStoredLegalPdfRendererOverride()).toBe('legacy');
  });

  it('setStoredLegalPdfRendererOverride stores paged version', () => {
    setStoredLegalPdfRendererOverride('paged');
    expect(getStoredLegalPdfRendererOverride()).toBe('paged');
  });

  it('clearStoredLegalPdfRendererOverride removes the stored value', () => {
    setStoredLegalPdfRendererOverride('legacy');
    clearStoredLegalPdfRendererOverride();
    expect(getStoredLegalPdfRendererOverride()).toBeNull();
  });

  it('resolveLegalPdfRendererVersion keeps the default when paged.js is unavailable', () => {
    const result = resolveLegalPdfRendererVersion({ pagedAvailable: false });
    expect(result.effectiveVersion).toBe('navigator');
    expect(result.pagedAvailable).toBe(false);
  });

  it('resolveLegalPdfRendererVersion uses the Navigator layout by default', () => {
    const result = resolveLegalPdfRendererVersion({ pagedAvailable: true });
    expect(result.effectiveVersion).toBe('navigator');
    expect(result.defaultVersion).toBe('navigator');
  });

  it('resolveLegalPdfRendererVersion still reaches paged.js as a rollback', () => {
    setStoredLegalPdfRendererOverride('paged');
    expect(resolveLegalPdfRendererVersion({ pagedAvailable: true }).effectiveVersion).toBe('paged');
    expect(resolveLegalPdfRendererVersion({ pagedAvailable: false }).effectiveVersion).toBe(
      'legacy',
    );
  });

  it('resolveLegalPdfRendererVersion reads the query parameter', () => {
    window.history.replaceState(null, '', `/?${LEGAL_PDF_RENDERER_QUERY_PARAM}=legacy`);
    const result = resolveLegalPdfRendererVersion({ pagedAvailable: true });
    window.history.replaceState(null, '', '/');
    expect(result.effectiveVersion).toBe('legacy');
    expect(result.source).toBe('query');
  });

  it("legalPdfPageSelector names each layout's page", () => {
    expect(legalPdfPageSelector('navigator')).toBe('.nwlp-page');
    expect(legalPdfPageSelector('paged')).toBe('.pagedjs_page');
    expect(legalPdfPageSelector('legacy')).toBe('.pdf-page');
  });

  it('legalPdfRendererLaysOutAsync is false only for the legacy layout', () => {
    expect(legalPdfRendererLaysOutAsync('navigator')).toBe(true);
    expect(legalPdfRendererLaysOutAsync('paged')).toBe(true);
    expect(legalPdfRendererLaysOutAsync('legacy')).toBe(false);
  });

  it('resolveLegalPdfRendererVersion uses storage override', () => {
    setStoredLegalPdfRendererOverride('legacy');
    const result = resolveLegalPdfRendererVersion({ pagedAvailable: true });
    expect(result.effectiveVersion).toBe('legacy');
    expect(result.source).toBe('storage');
  });

  it('resolveLegalPdfRendererVersion defaults to default source when nothing overrides', () => {
    const result = resolveLegalPdfRendererVersion({ pagedAvailable: true });
    expect(result.source).toBe('default');
  });
});
