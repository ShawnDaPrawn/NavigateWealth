/**
 * The redesigned legal document page, reached the way production reaches it:
 * LegalDocumentPage with the design switch on lazy-loads
 * NavigatorLegalDocumentPage. Covers what the redesign must not lose (the
 * same request to the same public route with no bearer, the document's own
 * text and anchors, its dates and version, the way back to its section, the
 * live SEO tags, the loading, unavailable and failed states, the PDF export
 * and print with the live settings) and what it adds (one H1, the board's
 * contents list and its jump, the related documents, back to top).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { useEffect } from 'react';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));
// The PDF pages come from paged.js; these tests are about the page around them.
vi.mock('../../components/shared/LegalDocumentPdf', () => ({
  LegalDocumentPdfLayout: ({
    onPagedRendererStateChange,
  }: {
    onPagedRendererStateChange?: (state: unknown) => void;
  }) => {
    useEffect(() => {
      onPagedRendererStateChange?.({ ready: true, error: null, activeRenderer: 'paged' });
    }, [onPagedRendererStateChange]);
    return <div className="pagedjs_page">page</div>;
  },
}));
vi.mock('../../components/shared/pdf', () => ({
  BASE_PDF_CSS: 'base-css',
  exportPdfFromPreview: vi.fn(async () => undefined),
  printPdfPreview: vi.fn(() => true),
  resolvePdfExportPages: vi.fn(() => []),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { LegalDocumentPage } = await import('../../components/pages/LegalDocumentPage');
const { createWebPageSchema } = await import('../../components/seo/SEO');
const { siteAbsoluteUrl } = await import('@/utils/siteOrigin');
const pdf = await import('../../components/shared/pdf');
const { toast } = await import('sonner');

const URL_PREFIX = 'https://proj.supabase.co/functions/v1/make-server-91ed8379/resources/legal/';

const PAIA = {
  available: true,
  slug: 'paia-manual',
  document: {
    id: 'v1',
    title: 'PAIA Manual',
    description: 'Manual in terms of the Promotion of Access to Information Act.',
    blocks: [],
    version: '1.2',
    updatedAt: '2026-05-06T10:00:00Z',
    effectiveDate: '2026-05-07',
    section: 'other',
    toc: [
      { id: 'introduction', title: '1. Introduction', level: 1 },
      { id: 'officer', title: '1.1 Information Officer', level: 2 },
      { id: 'purpose', title: '2. Purpose', level: 1 },
    ],
    contentHtml:
      '<h1 id="introduction">1. Introduction</h1><p>Intro.</p><h2 id="officer">1.1 Information Officer</h2><ul><li><p>Point one.</p></li></ul><hr class="my-8"><h1 id="purpose">2. Purpose</h1><p>Purpose <a href="mailto:info@navigatewealth.co">info@navigatewealth.co</a>.</p>',
    renderMode: 'versioned_document',
    pdfConfig: { pageSize: 'A4', orientation: 'portrait' },
  },
};

const NO_CONTENTS = {
  available: true,
  slug: 'website-disclaimer',
  document: {
    ...PAIA.document,
    title: 'Website Disclaimer',
    section: 'legal-notices',
    toc: [],
    contentHtml: '<p>Lede paragraph.</p><p>Second paragraph.</p>',
  },
};

const BLOCKS = {
  available: true,
  slug: 'cookie-policy',
  document: {
    ...PAIA.document,
    title: 'Cookie Policy',
    section: 'privacy-data-protection',
    toc: [],
    contentHtml: null,
    renderMode: 'legacy_resource',
    effectiveDate: null,
    blocks: [
      { id: 'a', type: 'section_header', data: { number: '1.', title: 'Scope' } },
      { id: 'b', type: 'text', data: { content: '<p>Text.</p>' } },
      {
        id: 'c',
        type: 'table',
        data: {
          hasColumnHeaders: true,
          columnHeaders: ['Name', 'Purpose'],
          rows: [{ cells: [{ value: 'session' }, { value: 'Keeps you signed in' }] }],
        },
      },
    ],
  },
};

type Reply = { status?: number; body?: unknown; hang?: boolean };

function stubFetch(reply: Reply) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (reply.hang) return new Promise(() => undefined);
      const status = reply.status ?? 200;
      return { ok: status < 400, status, json: async () => reply.body };
    }),
  );
}

function renderPage(slug = 'paia-manual') {
  return render(
    <MemoryRouter initialEntries={[`/legal/${slug}`]}>
      <Routes>
        <Route path="/legal/:slug" element={<LegalDocumentPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function renderLoaded(slug = 'paia-manual', body: unknown = PAIA) {
  stubFetch({ body });
  renderPage(slug);
  await screen.findByRole('article');
}

let scrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrollTo = vi.fn();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 0;
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(pdf.exportPdfFromPreview).mockClear();
  vi.mocked(pdf.printPdfPreview).mockClear();
  vi.mocked(toast.error).mockClear();
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator legal document page', () => {
  it('asks the live public route for the document, with no bearer', async () => {
    await renderLoaded();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${URL_PREFIX}paia-manual`);
    // A public route: no anon key posing as a credential.
    expect(init).toBeUndefined();
  });

  it('has one H1, the document title, and shows its own H1s as H2s', async () => {
    await renderLoaded();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s.map((h) => h.textContent)).toEqual(['PAIA Manual']);
    const article = screen.getByRole('article', { name: 'PAIA Manual' });
    expect(
      within(article)
        .getAllByRole('heading')
        .map((h) => `${h.tagName} ${h.id} ${h.textContent}`),
    ).toEqual([
      'H2 introduction 1. Introduction',
      'H2 officer 1.1 Information Officer',
      'H2 purpose 2. Purpose',
    ]);
    // The text is the document's, word for word.
    expect(article.textContent).toBe(
      '1. IntroductionIntro.1.1 Information OfficerPoint one.2. PurposePurpose info@navigatewealth.co.',
    );
  });

  it("emits the live page's SEO tags and WebPage data", async () => {
    await renderLoaded();
    const title = 'PAIA Manual | Navigate Wealth Legal';
    const description = 'Manual in terms of the Promotion of Access to Information Act.';
    const canonical = siteAbsoluteUrl('/legal/paia-manual');
    await waitFor(() => expect(document.getElementById('seo-structured-data')).not.toBeNull());
    expect(document.title).toBe(title);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonical);
    expect(JSON.parse(document.getElementById('seo-structured-data')!.textContent!)).toEqual(
      createWebPageSchema(title, description, canonical),
    );
  });

  it('shows the dates, version and section as the live page formats them', async () => {
    await renderLoaded();
    const facts = [...document.querySelectorAll('dd')].map((d) => d.textContent);
    expect(facts).toEqual(['07 May 2026', '06 May 2026', 'Version 1.2']);
    expect(screen.getByText('Other Legal Information', { selector: '.nwld-chip' })).toBeTruthy();
    const details = screen.getByText('Reading details').parentElement as HTMLElement;
    expect(within(details).getByText('1.2')).toBeTruthy();
    expect(within(details).getByText('07 May 2026')).toBeTruthy();
  });

  it('links back to its section of the hub and to the other documents', async () => {
    await renderLoaded();
    expect(screen.getByRole('link', { name: 'Back to legal hub' }).getAttribute('href')).toBe(
      '/legal?section=other',
    );
    expect(screen.getByRole('link', { name: 'All legal documents' }).getAttribute('href')).toBe(
      '/legal',
    );
    expect(screen.getByRole('heading', { name: 'More in Other Legal Information' })).toBeTruthy();
    const related = screen.getByRole('region', { name: 'Related documents' });
    const cards = within(related)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
      .filter((href) => href?.startsWith('/legal/'));
    expect(cards).toEqual([
      '/legal/disclaimers',
      '/legal/cis-disclaimer',
      '/legal/third-party-services',
      '/legal/intellectual-property',
    ]);
    expect(screen.getByRole('link', { name: 'Email us' }).getAttribute('href')).toBe(
      'mailto:info@navigatewealth.co',
    );
    expect(screen.getByRole('link', { name: 'Contact us' }).getAttribute('href')).toBe('/contact');
  });

  it('lists the contents and jumps to a section clear of the header', async () => {
    // Every heading below the fold, as on arrival at the top of the page.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 1000,
    } as DOMRect);
    await renderLoaded();
    const nav = screen.getAllByRole('navigation', { name: 'On this page' })[0];
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['1. Introduction', '#introduction'],
      ['1.1 Information Officer', '#officer'],
      ['2. Purpose', '#purpose'],
    ]);
    // Level 1 and 2 entries sit flush; nothing here is a subsection.
    expect(links.every((a) => !a.className.includes('nwld-toc-sub'))).toBe(true);
    expect(links[0].getAttribute('aria-current')).toBe('location');

    const heading = document.getElementById('purpose') as HTMLElement;
    heading.getBoundingClientRect = () => ({ top: 500 }) as DOMRect;
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 1000 });
    const replace = vi.spyOn(window.history, 'replaceState');
    fireEvent.click(links[2]);
    expect(scrollTo).toHaveBeenCalledWith({ top: 1404, behavior: 'smooth' });
    expect(replace).toHaveBeenCalledWith(null, '', '#purpose');
    expect(links[2].getAttribute('aria-current')).toBe('location');
  });

  it('folds the contents above the text on smaller screens, and folds it after a jump', async () => {
    await renderLoaded();
    const toggle = screen.getByRole('button', { name: /On this page/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(within(toggle).getByText('3 sections')).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const folded = document.getElementById(toggle.getAttribute('aria-controls')!) as HTMLElement;
    fireEvent.click(within(folded).getByRole('link', { name: '2. Purpose' }));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('leaves the contents out for a document without sections', async () => {
    await renderLoaded('website-disclaimer', NO_CONTENTS);
    expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull();
    expect(screen.queryByRole('button', { name: /On this page/ })).toBeNull();
    expect(screen.getByText('Reading details')).toBeTruthy();
  });

  it('renders a block-built document, table included', async () => {
    await renderLoaded('cookie-policy', BLOCKS);
    const article = screen.getByRole('article', { name: 'Cookie Policy' });
    expect(within(article).getByRole('heading', { level: 2 }).id).toBe('1-scope');
    expect(within(article).getByRole('table')).toBeTruthy();
    expect(within(article).getByRole('columnheader', { name: 'Purpose' })).toBeTruthy();
    expect(within(article).getByRole('cell', { name: 'Keeps you signed in' })).toBeTruthy();
    expect([...document.querySelectorAll('dd')][0].textContent).toBe('Not set');
  });

  it('says it is loading while the document is on its way', async () => {
    stubFetch({ hang: true });
    renderPage();
    expect((await screen.findByRole('status')).textContent).toBe('Loading legal document…');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('PAIA Manual');
  });

  it('says a document is not available yet, and links back to its section', async () => {
    stubFetch({ body: { available: false, slug: 'paia-manual' } });
    renderPage();
    await screen.findByRole('heading', { name: 'Legal document unavailable' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('This legal document is not available yet.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to legal hub' }).getAttribute('href')).toBe(
      '/legal?section=other',
    );
    expect(document.title).toBe('Legal Document | Navigate Wealth');
  });

  it('links an unknown document back to the hub', async () => {
    stubFetch({ body: { available: false, slug: 'nothing-here' } });
    renderPage('nothing-here');
    await screen.findByRole('heading', { name: 'Legal document unavailable' });
    expect(screen.getByRole('link', { name: 'Back to legal hub' }).getAttribute('href')).toBe(
      '/legal',
    );
  });

  it('reports a failed request with the live wording', async () => {
    stubFetch({ status: 500 });
    renderPage();
    await screen.findByRole('heading', { name: 'Legal document unavailable' });
    expect(screen.getByText('Failed to fetch document (500)')).toBeTruthy();
  });

  it('offers a way back to the top once the reader is well into the document', async () => {
    await renderLoaded();
    expect(screen.queryByRole('button', { name: 'Back to top' })).toBeNull();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 2000 });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('previews the PDF and downloads and prints it with the live settings', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'PAIA Manual' })).toBeTruthy();
    expect(within(dialog).getByText('A4 · Portrait · Version 1.2')).toBeTruthy();
    expect(
      within(dialog).getByRole('region', { name: 'PAIA Manual, document pages' }),
    ).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(pdf.exportPdfFromPreview).toHaveBeenCalledTimes(1));
    expect(vi.mocked(pdf.exportPdfFromPreview).mock.calls[0][0]).toMatchObject({
      title: 'PAIA Manual',
      pageSize: 'A4',
      orientation: 'portrait',
      pageSelector: '.pagedjs_page',
      imageFormat: 'JPEG',
      dpi: 250,
    });
    const notice = await within(dialog).findByText('PDF downloaded');
    expect(notice.closest('[role="status"]')).not.toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Print' }));
    expect(vi.mocked(pdf.printPdfPreview).mock.calls[0][0]).toMatchObject({
      title: 'PAIA Manual',
      pageSize: 'A4',
      orientation: 'portrait',
      pageSelector: '.pagedjs_page',
      layoutCss: 'base-css',
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close preview' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('reports a failed download and a blocked print window with the live wording', async () => {
    vi.mocked(pdf.exportPdfFromPreview).mockRejectedValueOnce(new Error('canvas'));
    vi.mocked(pdf.printPdfPreview).mockReturnValueOnce(false);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('PDF download failed: canvas'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Print' }));
    expect(toast.error).toHaveBeenCalledWith('The print view could not be opened.', {
      description: 'If your browser blocks pop-ups, allow them for this site and try again.',
    });
  });
});
