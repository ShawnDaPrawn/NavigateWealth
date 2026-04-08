export type LegalPdfQaFixture = {
  slug: string;
  label: string;
  scenario: string;
};

export type LegalPdfQaPageMetric = {
  pageNumber: number;
  fillRatio: number;
  gapMm: number;
  overflowMm: number;
  endsWithHeading: boolean;
};

export type LegalPdfQaAnalysis = {
  pageCount: number;
  maxGapMm: number;
  averageGapMm: number;
  maxOverflowMm: number;
  largeGapPages: number[];
  overflowPages: number[];
  headingTailPages: number[];
  metrics: LegalPdfQaPageMetric[];
  warnings: string[];
};

export const LEGAL_PDF_QA_FIXTURES: LegalPdfQaFixture[] = [
  {
    slug: 'legal-conditions',
    label: 'Legal Conditions & Disclosures',
    scenario: 'Clause-heavy disclosure baseline',
  },
  {
    slug: 'aml-policy',
    label: 'Anti-Money Laundering Policy',
    scenario: 'Long-form policy with dense clause sections',
  },
  {
    slug: 'privacy-notice',
    label: 'Privacy Notice',
    scenario: 'Privacy document with mixed section lengths',
  },
  {
    slug: 'popia-paia-manual',
    label: 'POPIA and PAIA Manual',
    scenario: 'Long regulatory manual with formal structure',
  },
  {
    slug: 'fais-disclosure',
    label: 'FAIS Disclosure',
    scenario: 'Regulatory disclosure layout with shorter sections',
  },
];

const LARGE_GAP_THRESHOLD_MM = 18;
const OVERFLOW_THRESHOLD_MM = 1;

function pxToMm(pixels: number): number {
  return (pixels * 25.4) / 96;
}

function roundMetric(value: number) {
  return Math.round(value * 10) / 10;
}

function isVisibleMetricNode(node: Element) {
  const element = node as HTMLElement;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.textContent?.trim();
}

function getMetricNodes(pageContent: HTMLElement) {
  return Array.from(pageContent.querySelectorAll(
    'h1, h2, h3, h4, p, ul, ol, blockquote, table, .legal-pdf-table-wrap, .legal-signatures, .legal-signature-line',
  )).filter(isVisibleMetricNode);
}

function endsPageWithHeading(metricNodes: Element[]) {
  const lastNode = metricNodes[metricNodes.length - 1] as HTMLElement | undefined;
  if (!lastNode) return false;
  return /^H[1-4]$/.test(lastNode.tagName);
}

export function analyzeLegalPagedPreview(container: HTMLElement): LegalPdfQaAnalysis {
  const pageNodes = Array.from(container.querySelectorAll<HTMLElement>('.pagedjs_page'));
  const metrics: LegalPdfQaPageMetric[] = [];

  pageNodes.forEach((pageNode, index) => {
    const pageContent = pageNode.querySelector<HTMLElement>('.pagedjs_page_content');
    if (!pageContent) {
      metrics.push({
        pageNumber: index + 1,
        fillRatio: 0,
        gapMm: 0,
        overflowMm: 0,
        endsWithHeading: false,
      });
      return;
    }

    const contentRect = pageContent.getBoundingClientRect();
    const metricNodes = getMetricNodes(pageContent);

    if (metricNodes.length === 0) {
      metrics.push({
        pageNumber: index + 1,
        fillRatio: 0,
        gapMm: roundMetric(pxToMm(contentRect.height)),
        overflowMm: 0,
        endsWithHeading: false,
      });
      return;
    }

    const bottoms = metricNodes.map((node) => (node as HTMLElement).getBoundingClientRect().bottom);
    const maxBottom = Math.max(...bottoms);
    const gapPx = Math.max(0, contentRect.bottom - maxBottom);
    const overflowPx = Math.max(0, maxBottom - contentRect.bottom);
    const usedHeight = Math.min(contentRect.height, Math.max(0, maxBottom - contentRect.top));

    metrics.push({
      pageNumber: index + 1,
      fillRatio: contentRect.height > 0 ? usedHeight / contentRect.height : 0,
      gapMm: roundMetric(pxToMm(gapPx)),
      overflowMm: roundMetric(pxToMm(overflowPx)),
      endsWithHeading: endsPageWithHeading(metricNodes),
    });
  });

  const nonTerminalMetrics = metrics.slice(0, Math.max(0, metrics.length - 1));
  const largeGapPages = nonTerminalMetrics
    .filter((metric) => metric.gapMm > LARGE_GAP_THRESHOLD_MM)
    .map((metric) => metric.pageNumber);
  const overflowPages = metrics
    .filter((metric) => metric.overflowMm > OVERFLOW_THRESHOLD_MM)
    .map((metric) => metric.pageNumber);
  const headingTailPages = nonTerminalMetrics
    .filter((metric) => metric.endsWithHeading)
    .map((metric) => metric.pageNumber);

  const warnings: string[] = [];
  if (largeGapPages.length > 0) {
    warnings.push(`Large bottom gaps detected on pages ${largeGapPages.join(', ')}.`);
  }
  if (overflowPages.length > 0) {
    warnings.push(`Content overflow detected on pages ${overflowPages.join(', ')}.`);
  }
  if (headingTailPages.length > 0) {
    warnings.push(`Page endings still strand headings on pages ${headingTailPages.join(', ')}.`);
  }

  return {
    pageCount: metrics.length,
    maxGapMm: roundMetric(Math.max(0, ...metrics.map((metric) => metric.gapMm))),
    averageGapMm: roundMetric(
      metrics.length > 0 ? metrics.reduce((sum, metric) => sum + metric.gapMm, 0) / metrics.length : 0,
    ),
    maxOverflowMm: roundMetric(Math.max(0, ...metrics.map((metric) => metric.overflowMm))),
    largeGapPages,
    overflowPages,
    headingTailPages,
    metrics,
    warnings,
  };
}
