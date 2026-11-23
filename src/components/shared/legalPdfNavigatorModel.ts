/**
 * The Navigator legal PDF — everything about it that is not React.
 *
 * The downloadable PDF of a legal document is drawn in the public site's
 * restyle: a dark ink cover (the legal hub's hero) with the official reversed
 * logo, then pages set in the document page's own text rules (`.nwld-prose` in
 * src/site/styles/legal.css) scaled from 17px on screen to 10pt on paper.
 * Approved by the owner on 2026-11-23 from a mock-up of the Privacy Notice.
 *
 * Pagination is done here, by measuring real layout, because the earlier
 * paged.js preview clipped text: it measured pages before the web fonts had
 * arrived and nothing checked the result. The rules now:
 *
 * - a paragraph is never split across pages; it moves to the next page whole
 *   (only one taller than a whole page is split, between words);
 * - a list breaks only between items, wherever it starts;
 * - a heading never ends a page; it moves with what follows it;
 * - every page keeps a few pixels spare, so rounding at another zoom level
 *   cannot clip a last line;
 * - the layout component checks every page afterwards and lays the document
 *   out again if anything overflows (a font that arrived late, say); if a page
 *   still overflows, it reports an error and the legacy layout takes over.
 */
import { COMPANY } from '../../config/companyFacts';

/** Every page the Navigator renderer draws has this class. */
export const LEGAL_PDF_NAVIGATOR_PAGE_CLASS = 'nwlp-page';
export const LEGAL_PDF_NAVIGATOR_PAGE_SELECTOR = `.${LEGAL_PDF_NAVIGATOR_PAGE_CLASS}`;

/** Pixels each page keeps spare below its last block. */
export const LEGAL_PDF_PAGE_SLACK_PX = 3;

const PUBLIC_HOST = 'navigatewealth.co';

/** "08 April 2026", or null when the value is missing. Unparseable values pass through. */
export function formatLegalPdfDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Where the version in force lives, as printed on the cover. */
export function legalPdfPublicPath(slug: string | null | undefined): string {
  const clean = (slug || '').trim().replace(/^\/+|\/+$/g, '');
  return clean ? `${PUBLIC_HOST}/legal/${clean}` : `${PUBLIC_HOST}/legal`;
}

/**
 * The footer on every page, read from companyFacts so it cannot drift from the
 * rest of the site. The postal code is left off on purpose until the owner
 * confirms which one is right (0157 in companyFacts, 0178 in the documents).
 */
export function legalPdfFooterLines(): { lead: string; rest: string; address: string } {
  const { address } = COMPANY;
  return {
    lead: `${COMPANY.legalName} t/a ${COMPANY.tradingName}`,
    rest: `Authorised Financial Services Provider, FSP ${COMPANY.fspNumber} · Reg. ${COMPANY.registrationNumber}`,
    address: `${address.street}, ${address.park}, ${address.city} · ${PUBLIC_HOST}`,
  };
}

/** "4. Company status" → { number: '4', title: 'Company status' }. */
export function splitLegalHeading(text: string): { number: string; title: string } {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)*)[.)]?\s+(.+)$/);
  return match ? { number: match[1], title: match[2] } : { number: '', title: trimmed };
}

export type LegalPdfContentsEntry = { id: string; number: string; title: string };

/**
 * The cover's contents: the document's top-level headings, in order. Headings
 * without an id get one, so the page they land on can be looked up afterwards.
 */
export function collectLegalPdfContents(blocks: readonly Element[]): LegalPdfContentsEntry[] {
  const headings = blocks.filter((block) => /^H[1-3]$/.test(block.tagName));
  if (headings.length === 0) return [];
  const topLevel = Math.min(...headings.map((heading) => Number(heading.tagName[1])));
  return headings
    .filter((heading) => Number(heading.tagName[1]) === topLevel)
    .map((heading, index) => {
      if (!heading.id) heading.id = `nwlp-section-${index + 1}`;
      const { number, title } = splitLegalHeading(heading.textContent || '');
      return { id: heading.id, number, title };
    })
    .filter((entry) => entry.title);
}

/**
 * Does everything in `body` sit inside it, with the slack to spare?
 *
 * Measured from the last block's bottom edge, because scrollHeight never
 * reports less than the box and so cannot express a margin. Offsets ignore CSS
 * transforms, so a zoomed preview measures the same as an unzoomed one. A body
 * with no layout at all (a test DOM) is treated as fitting.
 */
export function legalPdfPageFits(body: HTMLElement): boolean {
  if (body.clientHeight === 0) return true;
  const last = body.lastElementChild as HTMLElement | null;
  if (!last) return true;
  const marginBottom = parseFloat(window.getComputedStyle(last).marginBottom) || 0;
  const bottom = last.offsetTop + last.offsetHeight + marginBottom;
  return (
    bottom <= body.clientHeight - LEGAL_PDF_PAGE_SLACK_PX &&
    body.scrollWidth <= body.clientWidth + 1
  );
}

const isHeading = (element: Element | null) => Boolean(element && /^H[1-6]$/.test(element.tagName));
const isList = (element: Element) => element.tagName === 'UL' || element.tagName === 'OL';

/**
 * Puts as much of a paragraph taller than a page as fits into the empty
 * `body`, breaking between words, and returns the rest as a new paragraph.
 * Only a paragraph of plain text is split; one holding links or emphasis, or
 * one where not even a few words fit, returns null.
 */
function splitParagraphToFit(
  paragraph: HTMLElement,
  body: HTMLElement,
  fits: (body: HTMLElement) => boolean,
): HTMLElement | null {
  if (paragraph.children.length > 0) return null;
  const words = (paragraph.textContent || '').split(/\s+/).filter(Boolean);
  const head = paragraph.cloneNode(false) as HTMLElement;
  body.appendChild(head);
  let low = 0;
  let high = words.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    head.textContent = words.slice(0, middle).join(' ');
    if (fits(body)) low = middle;
    else high = middle - 1;
  }
  if (low < 3) {
    body.removeChild(head);
    return null;
  }
  head.textContent = words.slice(0, low).join(' ');
  const rest = paragraph.cloneNode(false) as HTMLElement;
  rest.textContent = words.slice(low).join(' ');
  return rest;
}

/**
 * Pours blocks into pages. `newPage` makes a page and returns the element the
 * blocks go into; `fits` says whether that element still holds everything.
 * Returns the page bodies in order.
 */
export function paginateLegalBlocks(
  blocks: readonly HTMLElement[],
  newPage: () => HTMLElement,
  fits: (body: HTMLElement) => boolean = legalPdfPageFits,
): HTMLElement[] {
  const bodies: HTMLElement[] = [];
  let body = newPage();
  bodies.push(body);
  const breakPage = () => {
    body = newPage();
    bodies.push(body);
  };
  const queue = [...blocks];

  while (queue.length > 0) {
    const block = queue.shift() as HTMLElement;
    // An editor's page break starts a new page, unless this one is still empty.
    if (block.classList.contains('legal-page-break')) {
      if (body.children.length > 0) breakPage();
      continue;
    }
    body.appendChild(block);
    if (fits(body)) continue;
    body.removeChild(block);

    // Lists split between items wherever they start, an empty page included:
    // a list taller than a page has to break somewhere.
    if (isList(block) && block.children.length > 1) {
      const part = block.cloneNode(false) as HTMLElement;
      body.appendChild(part);
      const items = Array.from(block.children) as HTMLElement[];
      let placed = 0;
      for (const item of items) {
        part.appendChild(item);
        if (!fits(body)) {
          part.removeChild(item);
          break;
        }
        placed += 1;
      }
      if (placed > 0) {
        const rest = block.cloneNode(false) as HTMLElement;
        if (block.tagName === 'OL') {
          const start = Number.parseInt(block.getAttribute('start') || '1', 10) || 1;
          rest.setAttribute('start', String(start + placed));
        }
        items.slice(placed).forEach((item) => rest.appendChild(item));
        queue.unshift(rest);
        breakPage();
        continue;
      }
      body.removeChild(part);
      items.forEach((item) => block.appendChild(item));
    }

    // Nothing else fits on an empty page either: the block is taller than a
    // whole page. A plain paragraph is split between words, as the only place
    // left to break it; anything else goes on a page of its own, where the
    // layout's final check reports the overflow rather than clip it quietly.
    if (body.children.length === 0) {
      const rest = block.tagName === 'P' ? splitParagraphToFit(block, body, fits) : null;
      if (rest) {
        queue.unshift(rest);
      } else {
        body.appendChild(block);
      }
      breakPage();
      continue;
    }

    // Keep a heading with what follows it.
    const carried: HTMLElement[] = [];
    while (body.children.length > 1 && isHeading(body.lastElementChild)) {
      carried.unshift(body.removeChild(body.lastElementChild as HTMLElement));
    }
    queue.unshift(...carried, block);
    breakPage();
  }

  return bodies;
}

/**
 * The cover band's background: the legal hub's ink gradient, a violet glow in
 * the top corner and the site's faint grid fading out from it. Drawn as an SVG
 * image rather than CSS because the PDF export (html2canvas) cannot draw CSS
 * masks, and an image renders the same on screen, in print and in the file.
 */
export function legalPdfCoverBackground(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="393" viewBox="0 0 794 393" preserveAspectRatio="none">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1626"/><stop offset=".6" stop-color="#12203a"/><stop offset="1" stop-color="#0d1626"/></linearGradient>
<radialGradient id="v" cx="794" cy="0" r="340" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#6d28d9" stop-opacity=".42"/><stop offset=".7" stop-color="#6d28d9" stop-opacity="0"/></radialGradient>
<pattern id="p" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#ffffff" stroke-opacity=".045" stroke-width="1"/></pattern>
<radialGradient id="f" cx="675" cy="59" r="420" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/><stop offset=".75" stop-color="#fff" stop-opacity="0"/></radialGradient>
<mask id="m"><rect width="794" height="393" fill="url(#f)"/></mask>
</defs>
<rect width="794" height="393" fill="url(#g)"/>
<rect width="794" height="393" fill="url(#v)"/>
<rect width="794" height="393" fill="url(#p)" mask="url(#m)"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
