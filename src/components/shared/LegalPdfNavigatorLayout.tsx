/**
 * LegalPdfNavigatorLayout — a legal document laid out as the Navigator PDF:
 * a dark ink cover with the official logo, facts and contents, then the text in
 * the website's own type. See legalPdfNavigatorModel.ts for the page rules.
 *
 * The pages are built straight into the DOM rather than through React, because
 * laying them out means measuring each block as it lands; React only owns the
 * host element. The result is a column of `.nwlp-page` elements, which the
 * existing export (exportPdfFromPreview) and print (printPdfPreview) take
 * exactly as they took paged.js pages.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { LegalPdfDocumentData } from './LegalDocumentPdf';
import { DEFAULT_LEGAL_PDF_CONFIG, getNormalizedLegalPdfDocument } from './legalPdfPrintDocument';
import type { LegalPdfRendererVersion } from './legalPdfRendererConfig';
import {
  LEGAL_PDF_NAVIGATOR_PAGE_CLASS,
  collectLegalPdfContents,
  formatLegalPdfDate,
  legalPdfCoverBackground,
  legalPdfFooterLines,
  legalPdfPageFits,
  legalPdfPublicPath,
  paginateLegalBlocks,
  type LegalPdfContentsEntry,
} from './legalPdfNavigatorModel';
import { LEGAL_PDF_NAVIGATOR_CSS, LEGAL_PDF_NAVIGATOR_FONT_LOADS } from './legalPdfNavigatorStyles';

export type LegalPdfNavigatorRenderState = {
  ready: boolean;
  error: string | null;
  activeRenderer: LegalPdfRendererVersion;
};

/** The approved reversed lockup (white wordmark) from public/brand-assets. */
const COVER_LOGO_SRC = '/brand-assets/navigate-wealth-reversed.svg';
/** How long to wait for the fonts before laying out anyway. */
const FONT_WAIT_MS = 6000;
/** Further layouts allowed if a check finds a page that overflows. */
const MAX_RELAYOUTS = 2;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = window.document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function waitForFonts() {
  const fonts = typeof window !== 'undefined' ? window.document.fonts : undefined;
  if (!fonts || typeof fonts.load !== 'function') return;
  try {
    await Promise.race([
      Promise.all(LEGAL_PDF_NAVIGATOR_FONT_LOADS.map((face) => fonts.load(face))).then(
        () => fonts.ready,
      ),
      new Promise((resolve) => window.setTimeout(resolve, FONT_WAIT_MS)),
    ]);
  } catch {
    // A face that fails to load falls back to the next in the stack; lay out anyway.
  }
}

/**
 * Top-level blocks of the document. Plain wrapper elements (a `<div>` or
 * `<section>` around a whole section) are opened up, so a long section can
 * still break between its paragraphs; loose text is put in a paragraph.
 */
function documentBlocks(html: string): HTMLElement[] {
  const template = window.document.createElement('template');
  template.innerHTML = html || '<p></p>';
  const blocks: HTMLElement[] = [];
  const keepWhole = (node: HTMLElement) =>
    node.classList.contains('legal-signatures') ||
    node.classList.contains('legal-pdf-signatures') ||
    node.classList.contains('legal-table-wrap');

  const visit = (nodes: NodeListOf<ChildNode> | ChildNode[]) => {
    Array.from(nodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) blocks.push(el('p', undefined, text));
        return;
      }
      if (!(node instanceof HTMLElement)) return;
      const tag = node.tagName;
      if ((tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE') && !keepWhole(node)) {
        if (node.classList.contains('legal-page-break')) {
          blocks.push(node);
          return;
        }
        visit(node.childNodes);
        return;
      }
      if (tag === 'HR') return;
      blocks.push(node);
    });
  };
  visit(template.content.childNodes);
  return blocks;
}

function sizeClasses(document: LegalPdfDocumentData): string {
  const config = document.pdfConfig || DEFAULT_LEGAL_PDF_CONFIG;
  return [
    LEGAL_PDF_NAVIGATOR_PAGE_CLASS,
    config.pageSize === 'A3' ? 'nwlp-a3' : '',
    config.orientation === 'landscape' ? 'nwlp-landscape' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function footer(): HTMLElement {
  const lines = legalPdfFooterLines();
  const foot = el('div', 'nwlp-foot');
  const left = el('div');
  left.append(el('b', undefined, lines.lead), ` · ${lines.rest}`, el('br'), lines.address);
  foot.append(left, el('div', 'nwlp-folio'));
  return foot;
}

type CoverParts = { page: HTMLElement; total: HTMLElement; pageNumbers: Map<string, HTMLElement> };

function buildCover(
  document: LegalPdfDocumentData,
  contents: LegalPdfContentsEntry[],
  pageClasses: string,
): CoverParts {
  const effective = formatLegalPdfDate(document.effectiveDate);
  const issued = formatLegalPdfDate(document.updatedAt || document.effectiveDate);
  const page = el('article', `${pageClasses} nwlp-cover`);

  const band = el('div', 'nwlp-band');
  const background = el('img', 'nwlp-band-bg');
  background.src = legalPdfCoverBackground();
  background.alt = '';
  const top = el('div', 'nwlp-band-top');
  const logo = el('img', 'nwlp-logo');
  logo.src = COVER_LOGO_SRC;
  logo.alt = 'Navigate Wealth';
  const category = el('div', 'nwlp-band-cat', 'Legal');
  category.append(el('b', undefined, document.sectionLabel || 'Legal document'));
  top.append(logo, category);
  const heading = el('div');
  heading.append(
    el('div', 'nwlp-kicker', 'Legal document'),
    el('h1', 'nwlp-title', document.title),
  );
  if (document.description) heading.append(el('p', 'nwlp-desc', document.description));
  band.append(background, top, heading);

  const facts = el('dl', 'nwlp-facts');
  const total = el('dd', undefined, '–');
  const fact = (label: string, value: HTMLElement | string) => {
    const cell = el('div', 'nwlp-fact');
    cell.append(
      el('dt', undefined, label),
      typeof value === 'string' ? el('dd', undefined, value) : value,
    );
    facts.append(cell);
  };
  fact('Version', document.version || '–');
  fact('Effective', effective || 'Not set');
  fact('Sections', String(contents.length));
  fact('Pages', total);

  page.append(band, facts);

  const pageNumbers = new Map<string, HTMLElement>();
  if (contents.length > 0) {
    const card = el('div', 'nwlp-contents');
    const head = el('div', 'nwlp-contents-head');
    head.append(
      el('b', undefined, 'Contents'),
      el('span', undefined, `${contents.length} sections · page`),
    );
    const list = el('ol');
    contents.forEach((entry) => {
      const item = el('li');
      const pageNumber = el('span', 'nwlp-p', '–');
      pageNumbers.set(entry.id, pageNumber);
      item.append(
        el('span', 'nwlp-n', entry.number ? `${entry.number}.` : ''),
        el('span', 'nwlp-t', entry.title),
        pageNumber,
      );
      list.append(item);
    });
    card.append(head, list);
    page.append(card);
  }

  const note = el('div', 'nwlp-note');
  const noteText = el('div');
  const notePara = el(
    'p',
    undefined,
    'Navigate Wealth updates its legal documents from time to time. Check you have the latest at ',
  );
  notePara.append(el('span', 'nwlp-url', legalPdfPublicPath(document.slug)), '.');
  noteText.append(el('b', undefined, 'The online version is the one in force'), notePara);
  const stamp = el('div', 'nwlp-stamp', 'Issued');
  stamp.append(el('br'), el('b', undefined, issued || '–'));
  note.append(noteText, stamp);
  page.append(note, footer());

  return { page, total, pageNumbers };
}

/** Lays the document out into `host`. Returns false if any page overflows. */
function layoutDocument(host: HTMLElement, document: LegalPdfDocumentData): boolean {
  host.replaceChildren();
  const normalized = getNormalizedLegalPdfDocument(document);
  const blocks = documentBlocks(normalized.html);
  const contents = collectLegalPdfContents(blocks);
  const pageClasses = sizeClasses(document);
  const effective = formatLegalPdfDate(document.effectiveDate);

  const cover = buildCover(document, contents, pageClasses);
  host.append(cover.page);

  const end = el('div', 'nwlp-end');
  end.append(
    el('b', undefined, 'End of document.'),
    ` ${document.title}, version ${document.version}${effective ? `, effective ${effective}` : ''}.`,
  );
  blocks.push(end);

  const runMeta = `Version ${document.version}${effective ? ` · Effective ${effective}` : ''}`;
  const pages: HTMLElement[] = [cover.page];
  paginateLegalBlocks(blocks, () => {
    const page = el('article', pageClasses);
    const run = el('div', 'nwlp-run');
    run.append(el('div', 'nwlp-run-title', document.title), el('div', 'nwlp-run-meta', runMeta));
    const body = el('div', 'nwlp-body');
    page.append(run, body, footer());
    host.append(page);
    pages.push(page);
    return body;
  });

  pages.forEach((page, index) => {
    const folio = page.querySelector('.nwlp-folio');
    if (folio) folio.textContent = `Page ${index + 1} of ${pages.length}`;
  });
  cover.total.textContent = String(pages.length);
  cover.pageNumbers.forEach((target, id) => {
    const heading = Array.from(host.querySelectorAll('[id]')).find((node) => node.id === id);
    const index = heading ? pages.findIndex((page) => page.contains(heading)) : -1;
    target.textContent = index >= 0 ? String(index + 1) : '–';
  });

  const bodiesFit = Array.from(host.querySelectorAll<HTMLElement>('.nwlp-body')).every((body) =>
    legalPdfPageFits(body),
  );
  const coverFits =
    cover.page.clientHeight === 0 || cover.page.scrollHeight <= cover.page.clientHeight + 1;
  return bodiesFit && coverFits;
}

export function LegalPdfNavigatorLayout({
  document,
  onRenderStateChange,
}: {
  document: LegalPdfDocumentData;
  onRenderStateChange?: (state: LegalPdfNavigatorRenderState) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onStateRef = useRef(onRenderStateChange);
  onStateRef.current = onRenderStateChange;
  const style = useMemo(() => ({ __html: LEGAL_PDF_NAVIGATOR_CSS }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let cancelled = false;
    let relayoutTimer: number | null = null;
    const report = (state: LegalPdfNavigatorRenderState) => {
      if (!cancelled) onStateRef.current?.(state);
    };

    const layout = () => {
      let fits = layoutDocument(host, document);
      for (let attempt = 0; !fits && attempt < MAX_RELAYOUTS; attempt += 1) {
        fits = layoutDocument(host, document);
      }
      if (!fits) console.warn('[LegalPdfNavigatorLayout] A page still overflows after relayout.');
    };

    // A face that arrives after the first layout changes every measurement:
    // check the pages again and lay out afresh if any no longer fits.
    const onFontsLoaded = () => {
      if (relayoutTimer !== null) window.clearTimeout(relayoutTimer);
      relayoutTimer = window.setTimeout(() => {
        if (cancelled) return;
        const overflowing = Array.from(host.querySelectorAll<HTMLElement>('.nwlp-body')).some(
          (body) => !legalPdfPageFits(body),
        );
        if (overflowing) layout();
      }, 120);
    };

    report({ ready: false, error: null, activeRenderer: 'navigator' });
    host.classList.add('nwlp-measuring');

    void (async () => {
      try {
        await waitForFonts();
        if (cancelled) return;
        layout();
        host.classList.remove('nwlp-measuring');
        window.document.fonts?.addEventListener?.('loadingdone', onFontsLoaded);
        report({ ready: true, error: null, activeRenderer: 'navigator' });
      } catch (error) {
        if (cancelled) return;
        console.error('[LegalPdfNavigatorLayout] Layout failed:', error);
        host.classList.remove('nwlp-measuring');
        report({
          ready: true,
          error: error instanceof Error ? error.message : 'The PDF pages could not be laid out.',
          activeRenderer: 'legacy',
        });
      }
    })();

    return () => {
      cancelled = true;
      if (relayoutTimer !== null) window.clearTimeout(relayoutTimer);
      window.document.fonts?.removeEventListener?.('loadingdone', onFontsLoaded);
      host.replaceChildren();
    };
  }, [document]);

  return (
    <>
      <style dangerouslySetInnerHTML={style} />
      <div
        ref={hostRef}
        className="nwlp"
        data-pdf-export-root="true"
        data-legal-pdf-renderer="navigator"
      />
    </>
  );
}
