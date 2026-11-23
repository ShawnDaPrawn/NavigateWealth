import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { LegalPdfNavigatorLayout } from '../LegalPdfNavigatorLayout';
import type { LegalPdfDocumentData } from '../LegalDocumentPdf';

const DOCUMENT: LegalPdfDocumentData = {
  title: 'Privacy Notice',
  description: 'How Navigate Wealth collects, uses, and protects personal information.',
  version: '1.1',
  effectiveDate: '2026-04-08',
  updatedAt: '2026-04-08T19:03:49.268Z',
  sectionLabel: 'Privacy & Data Protection',
  slug: 'privacy-notice',
  html: [
    '<h2 id="1-introduction">1. Introduction</h2><p>This Notice applies.</p>',
    '<div class="legal-section"><h2 id="2-purpose">2. Purpose</h2>',
    '<ul><li><p>clarify the framework;</p></li><li><p>explain the process.</p></li></ul></div>',
  ].join(''),
};

async function renderReady() {
  const onRenderStateChange = vi.fn();
  const view = render(
    <LegalPdfNavigatorLayout document={DOCUMENT} onRenderStateChange={onRenderStateChange} />,
  );
  await waitFor(() =>
    expect(onRenderStateChange).toHaveBeenLastCalledWith({
      ready: true,
      error: null,
      activeRenderer: 'navigator',
    }),
  );
  return { ...view, onRenderStateChange };
}

describe('LegalPdfNavigatorLayout', () => {
  it('reports not ready, then ready, on the navigator renderer', async () => {
    const { onRenderStateChange } = await renderReady();
    expect(onRenderStateChange.mock.calls[0][0]).toEqual({
      ready: false,
      error: null,
      activeRenderer: 'navigator',
    });
  });

  it('draws a cover with the official reversed logo, the facts and the contents', async () => {
    const { container } = await renderReady();
    const cover = container.querySelector('.nwlp-page.nwlp-cover') as HTMLElement;
    expect(cover).not.toBeNull();
    expect(cover.querySelector('.nwlp-logo')?.getAttribute('src')).toBe(
      '/brand-assets/navigate-wealth-reversed.svg',
    );
    expect(cover.querySelector('.nwlp-title')?.textContent).toBe('Privacy Notice');
    expect(cover.querySelector('.nwlp-facts')?.textContent).toContain('08 April 2026');
    expect(cover.querySelector('.nwlp-band-cat')?.textContent).toContain(
      'Privacy & Data Protection',
    );
    expect(cover.querySelector('.nwlp-note')?.textContent).toContain(
      'navigatewealth.co/legal/privacy-notice',
    );
    const entries = Array.from(cover.querySelectorAll('.nwlp-contents li')).map(
      (li) => li.textContent,
    );
    expect(entries).toEqual(['1.Introduction2', '2.Purpose2']);
  });

  it('keeps the logo off every page after the cover', async () => {
    const { container } = await renderReady();
    const pages = Array.from(container.querySelectorAll('.nwlp-page:not(.nwlp-cover)'));
    expect(pages.length).toBeGreaterThan(0);
    pages.forEach((page) => {
      expect(page.querySelector('img')).toBeNull();
      expect(page.querySelector('.nwlp-run-title')?.textContent).toBe('Privacy Notice');
    });
  });

  it('opens up section wrappers, numbers every page and ends the document', async () => {
    const { container } = await renderReady();
    const pages = Array.from(container.querySelectorAll('.nwlp-page'));
    const body = container.querySelector('.nwlp-body') as HTMLElement;
    expect(body.querySelector('.legal-section')).toBeNull();
    expect(body.querySelectorAll('h2')).toHaveLength(2);
    expect(pages.at(-1)?.querySelector('.nwlp-folio')?.textContent).toBe(
      `Page ${pages.length} of ${pages.length}`,
    );
    expect(body.querySelector('.nwlp-end')?.textContent).toContain(
      'Privacy Notice, version 1.1, effective 08 April 2026.',
    );
  });

  it('is an export root the PDF download and print can find', async () => {
    const { container } = await renderReady();
    const root = container.querySelector('[data-pdf-export-root="true"]');
    expect(root?.getAttribute('data-legal-pdf-renderer')).toBe('navigator');
    expect(root?.classList.contains('nwlp-measuring')).toBe(false);
    expect(container.querySelector('style')?.textContent).toContain('NWLP Newsreader');
  });
});
