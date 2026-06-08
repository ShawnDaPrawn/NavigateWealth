import { describe, expect, it } from 'vitest';
import {
  LEGAL_DOCUMENTS_REGISTRY,
  LEGAL_DOCUMENTS_BY_SLUG,
  LEGAL_SLUGS,
  LEGAL_MIGRATION_PRIORITY_SLUGS,
  LEGAL_SECTION_LABELS,
} from '../legal-documents-registry';

describe('legal-documents-registry', () => {
  it('LEGAL_DOCUMENTS_REGISTRY is a non-empty array', () => {
    expect(Array.isArray(LEGAL_DOCUMENTS_REGISTRY)).toBe(true);
    expect(LEGAL_DOCUMENTS_REGISTRY.length).toBeGreaterThan(0);
  });

  it('each entry has slug, name, section, and description', () => {
    LEGAL_DOCUMENTS_REGISTRY.forEach((doc) => {
      expect(typeof doc.slug).toBe('string');
      expect(doc.slug.length).toBeGreaterThan(0);
      expect(typeof doc.name).toBe('string');
      expect(typeof doc.section).toBe('string');
      expect(typeof doc.description).toBe('string');
    });
  });

  it('all slugs are unique', () => {
    const slugs = LEGAL_DOCUMENTS_REGISTRY.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('LEGAL_DOCUMENTS_BY_SLUG allows lookup by slug', () => {
    const entry = LEGAL_DOCUMENTS_BY_SLUG['privacy-notice'];
    expect(entry).toBeDefined();
    expect(entry.name).toBeTruthy();
  });

  it('LEGAL_DOCUMENTS_BY_SLUG contains all registry entries', () => {
    LEGAL_DOCUMENTS_REGISTRY.forEach((doc) => {
      expect(LEGAL_DOCUMENTS_BY_SLUG[doc.slug]).toBeDefined();
    });
  });

  it('LEGAL_SLUGS is an array of all slugs', () => {
    expect(Array.isArray(LEGAL_SLUGS)).toBe(true);
    expect(LEGAL_SLUGS.length).toBe(LEGAL_DOCUMENTS_REGISTRY.length);
    expect(LEGAL_SLUGS).toContain('fais-disclosure');
  });

  it('LEGAL_MIGRATION_PRIORITY_SLUGS contains only high-priority entries', () => {
    LEGAL_MIGRATION_PRIORITY_SLUGS.forEach((slug) => {
      expect(LEGAL_DOCUMENTS_BY_SLUG[slug].migrationPriority).toBe('high');
    });
  });

  it('LEGAL_SECTION_LABELS has labels for all four sections', () => {
    expect(LEGAL_SECTION_LABELS['legal-notices']).toBeTruthy();
    expect(LEGAL_SECTION_LABELS['privacy-data-protection']).toBeTruthy();
    expect(LEGAL_SECTION_LABELS['regulatory-disclosures']).toBeTruthy();
    expect(LEGAL_SECTION_LABELS['other']).toBeTruthy();
  });
});
