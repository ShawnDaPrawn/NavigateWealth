import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

// The PDF preview pulls in paged.js; it is not what these tests are about.
vi.mock('../../shared/LegalDocumentPdfDialog', () => ({
  LegalDocumentPdfDialog: () => null,
}));

import { LegalDocumentPage } from '../LegalDocumentPage';

const DOCUMENT_RESPONSE = {
  available: true,
  slug: 'paia-manual',
  document: {
    id: 'v1',
    title: 'PAIA Manual',
    description: 'Manual in terms of the Promotion of Access to Information Act.',
    blocks: [],
    version: '1.2',
    updatedAt: '2026-05-07T10:00:00Z',
    effectiveDate: '2026-05-07',
    section: 'other',
    toc: [
      { id: 'introduction', title: '1. Introduction', level: 1 },
      { id: 'purpose', title: '2. Purpose', level: 1 },
    ],
    contentHtml:
      '<h1 id="introduction">1. Introduction</h1><p>Intro.</p><h1 id="purpose">2. Purpose</h1><p>Purpose.</p>',
    renderMode: 'versioned_document',
    pdfConfig: { pageSize: 'A4', orientation: 'portrait' },
  },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/legal/paia-manual']}>
      <Routes>
        <Route path="/legal/:slug" element={<LegalDocumentPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

let scrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => DOCUMENT_RESPONSE })),
  );
  scrollTo = vi.fn();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});

describe('LegalDocumentPage on small screens', () => {
  it('offers the contents at the top, folded, with the section count', async () => {
    renderPage();

    const summary = await screen.findByText('On this page', { selector: 'summary span' });
    const details = summary.closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(within(details).getByText('2 sections')).toBeTruthy();
    expect(within(details).getByRole('link', { name: '2. Purpose' })).toBeTruthy();
  });

  it('folds the contents and scrolls the section clear of the phone header', async () => {
    renderPage();

    const summary = await screen.findByText('On this page', { selector: 'summary span' });
    const details = summary.closest('details') as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event('toggle'));

    const heading = document.getElementById('purpose') as HTMLElement;
    heading.getBoundingClientRect = () => ({ top: 500 }) as DOMRect;
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 1000 });

    fireEvent.click(within(details).getByRole('link', { name: '2. Purpose' }));

    await waitFor(() => expect(details.open).toBe(false));
    // No matchMedia in jsdom, so this is the phone path: 1000 + 500 - 80.
    expect(scrollTo).toHaveBeenCalledWith({ top: 1420, behavior: 'smooth' });
  });

  it('shows the version plainly rather than the reader mode', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'PAIA Manual' });
    const versionTerm = screen.getByText('Version', { selector: 'dt span' });
    expect(versionTerm.className).toContain('sm:hidden');
    expect(screen.getByText('1.2', { selector: 'dd span' }).className).toContain('sm:hidden');
  });

  it('offers a way back to the top once the reader is well into the document', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'PAIA Manual' });

    // Hidden elements have no accessible name, so find it by its label.
    const backToTop = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Back to top"]',
    ) as HTMLButtonElement;
    expect(backToTop.tabIndex).toBe(-1);
    expect(backToTop.getAttribute('aria-hidden')).toBe('true');

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 2000 });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(backToTop.getAttribute('aria-hidden')).toBe('false');
    expect(screen.getByRole('button', { name: 'Back to top' })).toBe(backToTop);

    fireEvent.click(backToTop);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
