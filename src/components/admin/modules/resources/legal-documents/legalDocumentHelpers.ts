/**
 * Pure helpers for the legal-document workspace: dates, versions, HTML stats and draft governance.
 *
 * Split out of `LegalDocumentsManager.tsx` (1,556 lines), which held the whole
 * workspace — helpers, badges, lists, the draft editor and the shell — in one
 * file. Each piece was already a self-contained function with its own props;
 * this only changes which file it lives in.
 */
import type { LegalDocumentDetailResponse, LegalDocumentVersionResponse } from '../types';

export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export function incrementVersion(versionNumber?: string | null): string {
  if (!versionNumber) return '1.0';
  const match = versionNumber.match(/^(\d+)\.(\d+)$/);
  if (!match) return versionNumber;
  return `${match[1]}.${Number(match[2]) + 1}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildLegacyHtml(
  version: LegalDocumentVersionResponse | null | undefined,
  fallbackTitle: string,
): string {
  const blockHtml = (version?.blocks || [])
    .map((block) => {
      if (block.type === 'text') {
        const content = typeof block.data?.content === 'string' ? block.data.content : '';
        return content;
      }

      if (block.type === 'section_header') {
        const title = typeof block.data?.title === 'string' ? block.data.title : fallbackTitle;
        const number =
          typeof block.data?.number === 'string' && block.data.number.trim()
            ? `${block.data.number.trim()} `
            : '';
        return `<h2>${escapeHtml(`${number}${title}`.trim())}</h2>`;
      }

      return '';
    })
    .filter(Boolean)
    .join('');

  return blockHtml.trim() || `<h1>${escapeHtml(fallbackTitle)}</h1><p></p>`;
}

export function buildDraftSeed(detail: LegalDocumentDetailResponse) {
  const currentDraft = detail.currentDraftVersion;
  const currentPublished = detail.currentPublishedVersion;

  return {
    versionNumber:
      currentDraft?.versionNumber || incrementVersion(currentPublished?.versionNumber || '1.0'),
    effectiveDate: toDateInputValue(currentDraft?.effectiveDate),
    changeSummary: currentDraft?.changeSummary || '',
    sourceHtml:
      currentDraft?.sourceHtml ||
      currentPublished?.sourceHtml ||
      buildLegacyHtml(currentPublished, detail.definition.title),
    pdfConfig: currentDraft?.pdfConfig ||
      currentPublished?.pdfConfig || {
        pageSize: 'A4' as const,
        orientation: 'portrait' as const,
      },
  };
}

export function getHtmlStats(sourceHtml: string) {
  if (typeof window === 'undefined') {
    return { wordCount: 0, headingCount: 0 };
  }

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(sourceHtml || '<p></p>', 'text/html');
  const text = doc.body.textContent?.replace(/\s+/g, ' ').trim() || '';

  return {
    wordCount: text ? text.split(/\s+/).length : 0,
    headingCount: doc.querySelectorAll('h1, h2, h3').length,
  };
}

export function getDraftGovernance(
  sourceHtml: string,
  effectiveDate: string,
  changeSummary: string,
  pageSize: 'A4' | 'A3',
  orientation: 'portrait' | 'landscape',
) {
  if (typeof window === 'undefined') {
    return {
      blockers: [] as string[],
      warnings: [] as string[],
      tables: 0,
      longParagraphs: 0,
      manualBreaks: 0,
    };
  }

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(sourceHtml || '<p></p>', 'text/html');
  const headings = doc.querySelectorAll('h1, h2, h3').length;
  const tables = doc.querySelectorAll('table').length;
  const manualBreaks = doc.querySelectorAll('.legal-page-break').length;
  const longParagraphs = Array.from(doc.querySelectorAll('p')).filter(
    (paragraph) => (paragraph.textContent || '').replace(/\s+/g, ' ').trim().length > 900,
  ).length;

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!effectiveDate) {
    blockers.push('Set an effective date before publishing.');
  }

  if (!changeSummary.trim() || changeSummary.trim().length < 12) {
    blockers.push('Add a meaningful change summary before publishing.');
  }

  if (headings === 0) {
    warnings.push(
      'No headings detected. The document can still publish, but the web TOC and PDF structure will be weaker.',
    );
  }

  if (tables > 0) {
    warnings.push(
      `${tables} table${tables === 1 ? '' : 's'} detected. Check the PDF preview for clean breaks and repeated headers.`,
    );
  }

  if (longParagraphs > 0) {
    warnings.push(
      `${longParagraphs} very long paragraph${longParagraphs === 1 ? '' : 's'} detected. Splitting clauses can improve readability and page breaks.`,
    );
  }

  if (manualBreaks === 0 && (doc.body.textContent || '').trim().split(/\s+/).length > 2200) {
    warnings.push(
      'This is a long document with no manual page breaks. Review the PDF preview closely before publishing.',
    );
  }

  if (pageSize === 'A3') {
    warnings.push(
      'A3 is unusual for legal documents. Use it only when the layout genuinely needs the extra width.',
    );
  }

  if (orientation === 'landscape') {
    warnings.push(
      'Landscape layout is harder to read for most legal documents. Confirm it is intentional.',
    );
  }

  return { blockers, warnings, tables, longParagraphs, manualBreaks };
}

export function getMigrationState(detail: LegalDocumentDetailResponse) {
  if (detail.definition.renderMode === 'versioned_document') {
    return 'migrated';
  }

  if (detail.currentDraftVersion?.contentFormat === 'normalized_rich_text') {
    return 'draft-ready';
  }

  return 'legacy-only';
}
