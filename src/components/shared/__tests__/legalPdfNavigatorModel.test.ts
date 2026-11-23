import { describe, expect, it } from 'vitest';
import { COMPANY } from '../../../config/companyFacts';
import {
  LEGAL_PDF_NAVIGATOR_PAGE_SELECTOR,
  collectLegalPdfContents,
  formatLegalPdfDate,
  legalPdfCoverBackground,
  legalPdfFooterLines,
  legalPdfPageFits,
  legalPdfPublicPath,
  paginateLegalBlocks,
  splitLegalHeading,
} from '../legalPdfNavigatorModel';
import { legalPdfPageSelector } from '../legalPdfRendererConfig';

function blocksFrom(html: string): HTMLElement[] {
  const template = document.createElement('template');
  template.innerHTML = html;
  return Array.from(template.content.children) as HTMLElement[];
}

/**
 * Pages that hold `capacity` units: a paragraph or heading is one unit, each
 * list item one unit, and a block marked data-units="n" is n.
 */
function pager(capacity: number) {
  const bodies: HTMLElement[] = [];
  const units = (element: Element): number => {
    if (element.tagName === 'UL' || element.tagName === 'OL') return element.children.length;
    return Number((element as HTMLElement).dataset.units || 1);
  };
  return {
    bodies,
    newPage: () => {
      const body = document.createElement('div');
      bodies.push(body);
      return body;
    },
    fits: (body: HTMLElement) =>
      Array.from(body.children).reduce((sum, child) => sum + units(child), 0) <= capacity,
  };
}

const texts = (body: HTMLElement) => Array.from(body.children).map((child) => child.textContent);

describe('legal PDF dates, addresses and footer', () => {
  it('formats dates the way the website does', () => {
    expect(formatLegalPdfDate('2026-04-08')).toBe('08 April 2026');
    expect(formatLegalPdfDate(null)).toBeNull();
    expect(formatLegalPdfDate('soon')).toBe('soon');
  });

  it('points to the document on the website', () => {
    expect(legalPdfPublicPath('privacy-notice')).toBe('navigatewealth.co/legal/privacy-notice');
    expect(legalPdfPublicPath('/paia-manual/')).toBe('navigatewealth.co/legal/paia-manual');
    expect(legalPdfPublicPath(null)).toBe('navigatewealth.co/legal');
  });

  it('builds the footer from companyFacts and leaves the postal code off', () => {
    const lines = legalPdfFooterLines();
    expect(lines.lead).toBe(`${COMPANY.legalName} t/a ${COMPANY.tradingName}`);
    expect(lines.rest).toContain(`FSP ${COMPANY.fspNumber}`);
    expect(lines.rest).toContain(COMPANY.registrationNumber);
    expect(lines.address).toContain(COMPANY.address.street);
    expect(lines.address).not.toContain(COMPANY.address.postalCode);
  });

  it('draws the cover background as an image the export can render', () => {
    expect(legalPdfCoverBackground()).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it('uses the page selector the dialogs look for', () => {
    expect(legalPdfPageSelector('navigator')).toBe(LEGAL_PDF_NAVIGATOR_PAGE_SELECTOR);
  });
});

describe('legal PDF headings and contents', () => {
  it('splits a clause number from its title', () => {
    expect(splitLegalHeading('4. Company status')).toEqual({
      number: '4',
      title: 'Company status',
    });
    expect(splitLegalHeading('12.3 Records')).toEqual({ number: '12.3', title: 'Records' });
    expect(splitLegalHeading('Definitions')).toEqual({ number: '', title: 'Definitions' });
  });

  it('lists the top-level headings and gives any without an id one', () => {
    const blocks = blocksFrom('<h2 id="one">1. One</h2><p>x</p><h3>1.1 Sub</h3><h2>2. Two</h2>');
    const contents = collectLegalPdfContents(blocks);
    expect(contents).toEqual([
      { id: 'one', number: '1', title: 'One' },
      { id: 'nwlp-section-2', number: '2', title: 'Two' },
    ]);
    expect(blocks[3].id).toBe('nwlp-section-2');
  });
});

describe('paginateLegalBlocks', () => {
  it('never splits a paragraph: one that does not fit moves to the next page whole', () => {
    const { bodies, newPage, fits } = pager(3);
    paginateLegalBlocks(
      blocksFrom('<p>a</p><p>b</p><p data-units="2">long</p><p>c</p>'),
      newPage,
      fits,
    );
    expect(bodies.map(texts)).toEqual([
      ['a', 'b'],
      ['long', 'c'],
    ]);
  });

  it('never ends a page with a heading', () => {
    const { bodies, newPage, fits } = pager(3);
    paginateLegalBlocks(
      blocksFrom('<p>a</p><p>b</p><h2>Next</h2><p data-units="2">body</p>'),
      newPage,
      fits,
    );
    expect(bodies.map(texts)).toEqual([
      ['a', 'b'],
      ['Next', 'body'],
    ]);
  });

  it('breaks a list between items and carries an ordered list number on', () => {
    const { bodies, newPage, fits } = pager(3);
    paginateLegalBlocks(
      blocksFrom('<p>intro</p><ol><li>one</li><li>two</li><li>three</li><li>four</li></ol>'),
      newPage,
      fits,
    );
    expect(bodies).toHaveLength(2);
    expect(bodies[0].querySelectorAll('li')).toHaveLength(2);
    const rest = bodies[1].querySelector('ol') as HTMLOListElement;
    expect(Array.from(rest.children).map((li) => li.textContent)).toEqual(['three', 'four']);
    expect(rest.getAttribute('start')).toBe('3');
  });

  it('keeps breaking a list taller than a page, however many pages it takes', () => {
    const { bodies, newPage, fits } = pager(3);
    paginateLegalBlocks(
      blocksFrom(
        `<p>intro</p><ul>${['1', '2', '3', '4', '5', '6', '7'].map((n) => `<li>${n}</li>`).join('')}</ul>`,
      ),
      newPage,
      fits,
    );
    expect(bodies.map((body) => body.textContent)).toEqual(['intro12', '345', '67']);
    bodies.forEach((body) => expect(fits(body)).toBe(true));
  });

  it('breaks a list that starts on an empty page', () => {
    const { bodies, newPage, fits } = pager(2);
    paginateLegalBlocks(blocksFrom('<ul><li>a</li><li>b</li><li>c</li></ul>'), newPage, fits);
    expect(bodies.map((body) => body.textContent)).toEqual(['ab', 'c']);
  });

  it('splits a plain paragraph taller than a whole page between words', () => {
    const bodies: HTMLElement[] = [];
    const words = (body: HTMLElement) => (body.textContent || '').split(/\s+/).filter(Boolean);
    const longText = Array.from({ length: 25 }, (_, index) => `w${index + 1}`).join(' ');
    paginateLegalBlocks(
      blocksFrom(`<p>${longText}</p>`),
      () => {
        const body = document.createElement('div');
        bodies.push(body);
        return body;
      },
      (body) => words(body).length <= 10,
    );
    const filled = bodies.filter((body) => body.children.length > 0);
    expect(filled.map((body) => words(body).length)).toEqual([10, 10, 5]);
    expect(filled.map((body) => body.textContent).join(' ')).toBe(longText);
  });

  it("starts a new page at an editor's page break, but not on an empty page", () => {
    const { bodies, newPage, fits } = pager(10);
    paginateLegalBlocks(
      blocksFrom(
        '<div class="legal-page-break"></div><p>a</p><div class="legal-page-break"></div><p>b</p>',
      ),
      newPage,
      fits,
    );
    expect(bodies.map(texts)).toEqual([['a'], ['b']]);
  });

  it('gives a block taller than a page a page of its own instead of looping', () => {
    const { bodies, newPage, fits } = pager(2);
    paginateLegalBlocks(blocksFrom('<p>a</p><p data-units="5">huge</p><p>b</p>'), newPage, fits);
    expect(bodies.map(texts).filter((page) => page.length > 0)).toEqual([['a'], ['huge'], ['b']]);
  });
});

describe('legalPdfPageFits', () => {
  it('treats a body with no layout (a test DOM) as fitting', () => {
    const body = document.createElement('div');
    body.appendChild(document.createElement('p'));
    expect(legalPdfPageFits(body)).toBe(true);
  });

  it('keeps a few pixels spare below the last block', () => {
    const body = document.createElement('div');
    const last = document.createElement('p');
    body.appendChild(last);
    Object.defineProperty(body, 'clientHeight', { value: 100 });
    Object.defineProperty(body, 'clientWidth', { value: 500 });
    Object.defineProperty(body, 'scrollWidth', { value: 500 });
    Object.defineProperty(last, 'offsetTop', { value: 80 });
    Object.defineProperty(last, 'offsetHeight', { value: 16, configurable: true });
    expect(legalPdfPageFits(body)).toBe(true);
    Object.defineProperty(last, 'offsetHeight', { value: 19 });
    expect(legalPdfPageFits(body)).toBe(false);
  });
});
