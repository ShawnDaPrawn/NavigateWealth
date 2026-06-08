import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEFAULT_LEGAL_PDF_RENDERER_VERSION,
  LEGAL_PDF_RENDERER_QUERY_PARAM,
  LEGAL_PDF_RENDERER_STORAGE_KEY,
  getStoredLegalPdfRendererOverride,
  setStoredLegalPdfRendererOverride,
  clearStoredLegalPdfRendererOverride,
  resolveLegalPdfRendererVersion,
} from '../legalPdfRendererConfig';

describe('legalPdfRendererConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('DEFAULT_LEGAL_PDF_RENDERER_VERSION is paged', () => {
    expect(DEFAULT_LEGAL_PDF_RENDERER_VERSION).toBe('paged');
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

  it('resolveLegalPdfRendererVersion returns legacy when pagedAvailable is false', () => {
    const result = resolveLegalPdfRendererVersion({ pagedAvailable: false });
    expect(result.effectiveVersion).toBe('legacy');
    expect(result.pagedAvailable).toBe(false);
  });

  it('resolveLegalPdfRendererVersion returns paged when pagedAvailable is true', () => {
    const result = resolveLegalPdfRendererVersion({ pagedAvailable: true });
    expect(result.effectiveVersion).toBe('paged');
    expect(result.defaultVersion).toBe('paged');
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
