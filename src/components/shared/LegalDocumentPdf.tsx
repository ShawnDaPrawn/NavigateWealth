import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BasePdfLayout, getPdfDimensions } from '../admin/modules/resources/templates/BasePdfLayout';
import { PdfTemplateViewer } from '../admin/modules/resources/PdfTemplateViewer';
import {
  resolveLegalPdfRendererVersion,
  type LegalPdfRendererResolution,
  type LegalPdfRendererVersion,
} from './legalPdfRendererConfig';
import {
  buildLegalPagedPrintSource,
  DEFAULT_LEGAL_PDF_CONFIG,
  getNormalizedLegalPdfDocument,
  LEGAL_PDF_CONTENT_CSS,
} from './legalPdfPrintDocument';

export type LegalPdfConfig = {
  pageSize: 'A4' | 'A3';
  orientation: 'portrait' | 'landscape';
};

export type LegalPdfTocItem = {
  id: string;
  title: string;
  level: number;
};

export type LegalPdfDocumentData = {
  title: string;
  description?: string | null;
  version: string;
  effectiveDate?: string | null;
  updatedAt?: string | null;
  sectionLabel?: string | null;
  html: string;
  toc?: LegalPdfTocItem[];
  pdfConfig?: LegalPdfConfig;
};

type PdfChunk = {
  key: string;
  html: string;
  units: number;
  forceBreakAfter?: boolean;
};

const PDF_MIN_LINES_ABOVE_FOOTER = 2;

function formatLongDate(value: string | null | undefined): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function estimateTextUnits(text: string, charsPerUnit = 260, minimum = 3): number {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return minimum;
  return Math.max(minimum, Math.ceil(normalized.length / charsPerUnit) * 3);
}

function getPageCapacity(config: LegalPdfConfig, isFirstPage: boolean): number {
  const base = config.pageSize === 'A3' ? 148 : 108;
  const orientationBonus = config.orientation === 'landscape' ? 14 : 0;
  return base + orientationBonus - (isFirstPage ? 18 : 0);
}

function outerHtml(node: Element): string {
  return node.outerHTML;
}

function buildFrontMatterChunks(document: LegalPdfDocumentData): PdfChunk[] {
  void document;
  return [];
}

function tableBodyRows(table: HTMLTableElement): HTMLTableRowElement[] {
  if (table.tBodies.length > 0) {
    return Array.from(table.tBodies[0].rows);
  }
  return Array.from(table.querySelectorAll('tr'));
}

function createTableChunks(table: HTMLTableElement, keyPrefix: string, config: LegalPdfConfig): PdfChunk[] {
  const rows = tableBodyRows(table);
  const headerHtml = table.tHead ? table.tHead.outerHTML : '';
  const rowsPerChunk = config.pageSize === 'A3' ? 12 : 8;

  if (rows.length <= rowsPerChunk) {
    const text = table.textContent || '';
    return [{
      key: `${keyPrefix}-table-0`,
      html: `<div class="legal-pdf-table-wrap">${table.outerHTML}</div>`,
      units: Math.min(32, 8 + Math.ceil(text.length / 200) + rows.length * 2),
    }];
  }

  const chunks: PdfChunk[] = [];
  for (let index = 0; index < rows.length; index += rowsPerChunk) {
    const bodyRows = rows
      .slice(index, index + rowsPerChunk)
      .map((row) => row.outerHTML)
      .join('');
    const segmentHtml = `
      <div class="legal-pdf-table-wrap">
        <table>
          ${headerHtml}
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    `;
    const segmentText = rows
      .slice(index, index + rowsPerChunk)
      .map((row) => row.textContent || '')
      .join(' ');

    chunks.push({
      key: `${keyPrefix}-table-${index}`,
      html: segmentHtml,
      units: Math.min(30, 8 + Math.ceil(segmentText.length / 180) + (Math.min(rowsPerChunk, rows.length - index) * 2)),
    });
  }

  return chunks;
}

function buildContentChunks(html: string, config: LegalPdfConfig): PdfChunk[] {
  if (typeof window === 'undefined') {
    return [{
      key: 'content-fallback',
      html,
      units: 40,
    }];
  }

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(html || '<p></p>', 'text/html');
  const nodes = Array.from(doc.body.childNodes);
  const chunks: PdfChunk[] = [];

  nodes.forEach((node, index) => {
    if (node.nodeType === window.Node.TEXT_NODE) {
      const text = node.textContent?.trim() || '';
      if (!text) return;
      chunks.push({
        key: `text-${index}`,
        html: `<p>${text}</p>`,
        units: estimateTextUnits(text),
      });
      return;
    }

    if (!(node instanceof window.HTMLElement)) {
      return;
    }

    const tag = node.tagName.toLowerCase();
    const classNames = Array.from(node.classList);
    const text = node.textContent || '';

    if (classNames.includes('legal-page-break') || tag === 'hr') {
      chunks.push({
        key: `page-break-${index}`,
        html: '<div class="legal-pdf-page-break"></div>',
        units: 1,
        forceBreakAfter: true,
      });
      return;
    }

    if (tag === 'table') {
      chunks.push(...createTableChunks(node as HTMLTableElement, `node-${index}`, config));
      return;
    }

    if (classNames.includes('legal-signatures') || classNames.includes('legal-pdf-signatures')) {
      chunks.push({
        key: `signature-${index}`,
        html: outerHtml(node),
        units: 16,
      });
      return;
    }

    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      chunks.push({
        key: `heading-${index}`,
        html: outerHtml(node),
        units: tag === 'h1' ? 8 : tag === 'h2' ? 6 : 5,
      });
      return;
    }

    if (tag === 'p') {
      const paragraphSegments = splitParagraphNode(node);
      paragraphSegments.forEach((segmentHtml, segmentIndex) => {
        chunks.push({
          key: `paragraph-${index}-${segmentIndex}`,
          html: segmentHtml,
          units: estimateTextUnits(textFromHtml(segmentHtml), 240, 2),
        });
      });
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(node.querySelectorAll('li'));
      const listText = items.map((item) => item.textContent || '').join(' ');
      chunks.push({
        key: `list-${index}`,
        html: outerHtml(node),
        units: Math.max(6, Math.ceil(listText.length / 220) * 3 + items.length),
      });
      return;
    }

    if (tag === 'blockquote') {
      chunks.push({
        key: `quote-${index}`,
        html: outerHtml(node),
        units: Math.max(7, Math.ceil(text.length / 200) * 3),
      });
      return;
    }

    chunks.push({
      key: `block-${index}`,
      html: outerHtml(node),
      units: estimateTextUnits(text, 240, tag === 'p' ? 3 : 5),
    });
  });

  return chunks.length > 0
    ? chunks
    : [{
        key: 'empty-document',
        html: '<p></p>',
        units: 3,
      }];
}

function deriveTocFromHtml(html: string): LegalPdfTocItem[] {
  if (typeof window === 'undefined') return [];

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(html || '<p></p>', 'text/html');

  return Array.from(doc.body.querySelectorAll('h1, h2, h3'))
    .map((heading, index) => ({
      id: heading.id || `section-${index + 1}`,
      title: heading.textContent?.trim() || `Section ${index + 1}`,
      level: heading.tagName.toLowerCase() === 'h1' ? 1 : heading.tagName.toLowerCase() === 'h2' ? 2 : 3,
    }))
    .filter((item) => item.title);
}

function textFromHtml(html: string): string {
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const container = window.document.createElement('div');
  container.innerHTML = html;
  return container.textContent?.replace(/\s+/g, ' ').trim() || '';
}

function splitParagraphNode(node: HTMLElement): string[] {
  if (typeof window === 'undefined' || !node.querySelector('br')) {
    return [outerHtml(node)];
  }

  const lineHtmlSegments: string[] = [];
  const lineScratch = window.document.createElement('div');

  const flushLine = () => {
    const inner = lineScratch.innerHTML.trim();
    const text = lineScratch.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (!inner || !text) {
      lineScratch.innerHTML = '';
      return;
    }
    lineHtmlSegments.push(inner);
    lineScratch.innerHTML = '';
  };

  Array.from(node.childNodes).forEach((child) => {
    if (child.nodeType === window.Node.ELEMENT_NODE && (child as HTMLElement).tagName === 'BR') {
      flushLine();
      return;
    }

    lineScratch.appendChild(child.cloneNode(true));
  });

  flushLine();

  if (lineHtmlSegments.length <= 1) {
    return [outerHtml(node)];
  }

  const groupedSegments: string[][] = [];
  let currentGroup: string[] = [];
  let currentChars = 0;
  const maxLinesPerChunk = 4;
  const maxCharsPerChunk = 360;

  lineHtmlSegments.forEach((lineHtml) => {
    const lineChars = textFromHtml(lineHtml).length;
    const wouldOverflow = currentGroup.length > 0
      && (currentGroup.length >= maxLinesPerChunk || currentChars + lineChars > maxCharsPerChunk);

    if (wouldOverflow) {
      groupedSegments.push(currentGroup);
      currentGroup = [];
      currentChars = 0;
    }

    currentGroup.push(lineHtml);
    currentChars += lineChars;
  });

  if (currentGroup.length > 0) {
    groupedSegments.push(currentGroup);
  }

  return groupedSegments.map((group, index) => {
    const paragraph = node.cloneNode(false) as HTMLElement;
    paragraph.classList.add('legal-pdf-paragraph-fragment');
    if (index === groupedSegments.length - 1) {
      paragraph.classList.add('last-fragment');
    }
    paragraph.innerHTML = group.join('<br>');
    return paragraph.outerHTML;
  });
}

function getListMarkerText(list: HTMLElement, item: HTMLElement, index: number): string {
  if (list.tagName === 'UL') {
    return list.closest('li') ? '\u25E6' : '\u2022';
  }

  const dataItemNumber = item.getAttribute('data-item-num');
  const parsedDataItemNumber = dataItemNumber ? Number.parseInt(dataItemNumber, 10) : Number.NaN;
  if (Number.isFinite(parsedDataItemNumber)) {
    return `${parsedDataItemNumber}.`;
  }

  const parsedStart = Number.parseInt(list.getAttribute('start') || '1', 10);
  const start = Number.isFinite(parsedStart) ? parsedStart : 1;
  return `${start + index}.`;
}

function applyPagedListMarkers(root: HTMLElement) {
  root
    .querySelectorAll<HTMLElement>('.pagedjs_page .legal-pdf-body ul, .pagedjs_page .legal-pdf-body ol')
    .forEach((list) => {
      list.style.setProperty('list-style', 'none', 'important');
      list.style.setProperty('padding-left', '0', 'important');
      list.style.setProperty('margin', '0 0 2.8mm', 'important');

      const directItems = Array.from(list.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement && child.tagName === 'LI',
      );

      directItems.forEach((item, index) => {
        item.querySelector(':scope > .legal-pdf-list-marker')?.remove();

        const marker = window.document.createElement('span');
        marker.className = 'legal-pdf-list-marker';
        marker.setAttribute('aria-hidden', 'true');
        marker.textContent = getListMarkerText(list, item, index);
        item.insertBefore(marker, item.firstChild);

        item.style.setProperty('display', 'block', 'important');
        item.style.setProperty('position', 'relative', 'important');
        item.style.setProperty('padding-left', '5.2mm', 'important');
        item.style.setProperty('margin-bottom', '1.1mm', 'important');

        marker.style.setProperty('position', 'absolute', 'important');
        marker.style.setProperty('left', '0', 'important');
        marker.style.setProperty('top', '0', 'important');
        marker.style.setProperty('width', '3.8mm', 'important');
        marker.style.setProperty('text-align', 'right', 'important');
        marker.style.setProperty('color', '#4b5563', 'important');
        marker.style.setProperty('font-size', '9px', 'important');
        marker.style.setProperty('line-height', '1.5', 'important');
      });
    });
}

function applyPagedLegalTypography(root: HTMLElement) {
  const headingStyles: Record<string, Record<string, string>> = {
    H1: {
      fontSize: '11.2px',
      lineHeight: '1.25',
      fontWeight: '800',
      margin: '0 0 2.6mm',
      padding: '0 0 1.2mm',
    },
    H2: {
      fontSize: '10.7px',
      lineHeight: '1.25',
      fontWeight: '800',
      margin: '5.2mm 0 1.9mm',
      padding: '0 0 1.2mm',
    },
    H3: {
      fontSize: '10px',
      lineHeight: '1.35',
      fontWeight: '700',
      margin: '3.6mm 0 1.4mm',
    },
    H4: {
      fontSize: '9.5px',
      lineHeight: '1.35',
      fontWeight: '700',
      margin: '2.6mm 0 1.1mm',
    },
  };

  root
    .querySelectorAll<HTMLElement>('.pagedjs_page .legal-pdf-body h1, .pagedjs_page .legal-pdf-body h2, .pagedjs_page .legal-pdf-body h3, .pagedjs_page .legal-pdf-body h4')
    .forEach((heading) => {
      const styles = headingStyles[heading.tagName];
      if (!styles) return;

      Object.entries(styles).forEach(([property, value]) => {
        heading.style.setProperty(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), value, 'important');
      });
      heading.style.setProperty('color', '#111827', 'important');
      heading.style.setProperty('letter-spacing', '0', 'important');
    });

  root.querySelectorAll<HTMLElement>('.pagedjs_page .legal-pdf-body hr').forEach((rule) => {
    rule.style.setProperty('border', '0', 'important');
    rule.style.setProperty('border-top', '1px solid #e5e7eb', 'important');
    rule.style.setProperty('margin', '6mm 0', 'important');
  });

  applyPagedListMarkers(root);

  root.querySelectorAll<HTMLElement>('.pagedjs_page .legal-pdf-body li > ul').forEach((list) => {
    list.style.setProperty('margin-top', '1.1mm', 'important');
    list.style.setProperty('margin-bottom', '1.1mm', 'important');
  });
}

function mmToPx(value: number): number {
  return value * (96 / 25.4);
}

function getBodyHeightCapPx(config: LegalPdfConfig, isFirstPage: boolean): number {
  const { heightMm } = getPdfDimensions(config.pageSize, config.orientation);
  const topPaddingMm = isFirstPage ? 5 : 12.5;
  const footerReserveMm = 23;
  const firstPageChromeMm = isFirstPage ? 43.5 : 0;
  const safetyMm = isFirstPage ? 3.5 : 3;

  return mmToPx(heightMm - topPaddingMm - footerReserveMm - firstPageChromeMm - safetyMm);
}

function measureChunkHeights(chunks: PdfChunk[], config: LegalPdfConfig): number[] | null {
  if (typeof window === 'undefined' || !window.document?.body) {
    return null;
  }

  const { widthMm } = getPdfDimensions(config.pageSize, config.orientation);
  const contentWidthPx = mmToPx(widthMm - 10 - 10);
  const host = window.document.createElement('div');

  host.setAttribute('aria-hidden', 'true');
  host.style.position = 'absolute';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.width = `${contentWidthPx}px`;
  host.style.visibility = 'hidden';
  host.style.pointerEvents = 'none';
  host.className = 'legal-pdf-measure-host';
  host.innerHTML = `<style>${LEGAL_PDF_CONTENT_CSS}</style>`;

  const body = window.document.createElement('div');
  body.className = 'legal-pdf-body';
  host.appendChild(body);
  window.document.body.appendChild(host);

  try {
    return chunks.map((chunk) => {
      const section = window.document.createElement('section');
      section.className = `legal-pdf-block ${chunk.html.includes('<table') ? '' : 'allow-split'}`.trim();
      section.innerHTML = chunk.html;
      body.appendChild(section);
      const measured = Math.ceil(section.getBoundingClientRect().height);
      body.removeChild(section);
      return measured;
    });
  } finally {
    window.document.body.removeChild(host);
  }
}

function paginateChunks(chunks: PdfChunk[], config: LegalPdfConfig): PdfChunk[][] {
  const measuredHeights = measureChunkHeights(chunks, config);

  if (measuredHeights) {
    const pages: PdfChunk[][] = [];
    let currentPage: PdfChunk[] = [];
    let currentHeight = 0;

    const pushPage = () => {
      if (currentPage.length === 0) return;
      pages.push(currentPage);
      currentPage = [];
      currentHeight = 0;
    };

    chunks.forEach((chunk, index) => {
      const pageCap = getBodyHeightCapPx(config, pages.length === 0);
      const measuredHeight = measuredHeights[index] || 0;

      if (currentPage.length > 0 && currentHeight + measuredHeight > pageCap) {
        pushPage();
      }

      currentPage.push(chunk);
      currentHeight += measuredHeight;

      if (chunk.forceBreakAfter) {
        pushPage();
      }
    });

    pushPage();

    return pages.length > 0 ? pages : [[{
      key: 'blank-page',
      html: '<p></p>',
      units: 1,
    }]];
  }

  const pages: PdfChunk[][] = [];
  let currentPage: PdfChunk[] = [];
  let currentUnits = 0;

  const pushPage = () => {
    if (currentPage.length === 0) return;
    pages.push(currentPage);
    currentPage = [];
    currentUnits = 0;
  };

  chunks.forEach((chunk, index) => {
    const capacity = getPageCapacity(config, pages.length === 0);
    const minimumFollowUnits = Math.max(1, Math.ceil((PDF_MIN_LINES_ABOVE_FOOTER * 3) / 2));

    if (
      currentPage.length > 0
      && currentUnits + Math.max(chunk.units, minimumFollowUnits) > capacity
    ) {
      pushPage();
    }

    currentPage.push(chunk);
    currentUnits += chunk.units;

    if (chunk.forceBreakAfter) {
      pushPage();
    }
  });

  pushPage();

  return pages.length > 0 ? pages : [[{
    key: 'blank-page',
    html: '<p></p>',
    units: 1,
  }]];
}

function renderPage(chunks: PdfChunk[], pageIndex: number) {
  return (
    <div className="legal-pdf-body" key={`legal-pdf-page-${pageIndex}`}>
      {chunks.map((chunk) => (
        <section
          key={chunk.key}
          className={`legal-pdf-block ${chunk.html.includes('<table') ? '' : 'allow-split'}`}
          dangerouslySetInnerHTML={{ __html: chunk.html }}
        />
      ))}
    </div>
  );
}

export function LegacyLegalDocumentPdfLayout({ document }: { document: LegalPdfDocumentData }) {
  const pdfConfig = document.pdfConfig || DEFAULT_LEGAL_PDF_CONFIG;
  const normalizedDocument = useMemo(
    () => getNormalizedLegalPdfDocument({
      ...document,
      toc: document.toc && document.toc.length > 0 ? document.toc : deriveTocFromHtml(document.html || '<p></p>'),
    }),
    [document],
  );

  const pages = useMemo(() => {
    const chunks = [
      ...buildFrontMatterChunks({
        ...document,
        toc: normalizedDocument.toc,
      }),
      ...buildContentChunks(normalizedDocument.html, pdfConfig),
    ];
    return paginateChunks(chunks, pdfConfig).map((pageChunks, pageIndex) => renderPage(pageChunks, pageIndex));
  }, [document, normalizedDocument, pdfConfig]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LEGAL_PDF_CONTENT_CSS }} />
      <BasePdfLayout
        pages={pages}
        docTitle={document.title}
        issueDate={formatLongDate(document.updatedAt || document.effectiveDate)}
        pageSize={pdfConfig.pageSize}
        orientation={pdfConfig.orientation}
      />
    </>
  );
}

function PagedLegalDocumentPdfLayout({
  document,
  onRenderStateChange,
}: {
  document: LegalPdfDocumentData;
  onRenderStateChange?: (state: {
    ready: boolean;
    error: string | null;
    activeRenderer: LegalPdfRendererVersion;
  }) => void;
}) {
  const previewHostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pagedSource = useMemo(
    () => buildLegalPagedPrintSource(document),
    [document],
  );

  useEffect(() => {
    let cancelled = false;

    async function renderPagedPreview() {
      if (!previewHostRef.current || typeof window === 'undefined') {
        return;
      }

      setStatus('loading');
      setErrorMessage(null);
      onRenderStateChange?.({ ready: false, error: null, activeRenderer: 'paged' });
      previewHostRef.current.innerHTML = '';

      try {
        const { Previewer } = await import('pagedjs');

        if (cancelled || !previewHostRef.current) {
          return;
        }

        const template = window.document.createElement('template');
        template.innerHTML = pagedSource.markup.trim();

        const previewer = new Previewer();
        await previewer.preview(
          template.content.cloneNode(true) as DocumentFragment,
          [{ [`${window.location.href}#legal-paged-inline`]: pagedSource.styles }],
          previewHostRef.current,
        );

        applyPagedLegalTypography(previewHostRef.current);

        if (cancelled) {
          return;
        }

        setStatus('ready');
        onRenderStateChange?.({ ready: true, error: null, activeRenderer: 'paged' });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Paged preview could not be prepared';
        setStatus('error');
        setErrorMessage(message);
        onRenderStateChange?.({ ready: true, error: message, activeRenderer: 'legacy' });
      }
    }

    void renderPagedPreview();

    return () => {
      cancelled = true;
      onRenderStateChange?.({ ready: false, error: null, activeRenderer: 'paged' });
      if (previewHostRef.current) {
        previewHostRef.current.innerHTML = '';
      }
    };
  }, [onRenderStateChange, pagedSource]);

  if (status === 'error') {
    return (
      <>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Paged preview fell back to the legacy renderer in this session.
          {errorMessage ? ` ${errorMessage}` : ''}
        </div>
        <LegacyLegalDocumentPdfLayout document={document} />
      </>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pagedSource.styles }} />
      <div className="legal-paged-preview-root relative" data-pdf-export-root="true">
        {status === 'loading' && (
          <div className="absolute inset-0 z-10 flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-sm text-slate-600 backdrop-blur-[1px]">
            Building paged legal preview...
          </div>
        )}
        <div
          ref={previewHostRef}
          className={status === 'loading' ? 'min-h-[240px] opacity-0' : ''}
          data-legal-pdf-renderer="paged"
        />
      </div>
    </>
  );
}

function resolveActiveLegalPdfRenderer(): LegalPdfRendererResolution {
  return resolveLegalPdfRendererVersion({
    pagedAvailable: true,
  });
}

export function LegalDocumentPdfLayout({
  document,
  rendererVersion,
  onPagedRendererStateChange,
}: {
  document: LegalPdfDocumentData;
  rendererVersion?: LegalPdfRendererVersion;
  onPagedRendererStateChange?: (state: {
    ready: boolean;
    error: string | null;
    activeRenderer: LegalPdfRendererVersion;
  }) => void;
}) {
  const resolution = rendererVersion
    ? {
        defaultVersion: 'legacy' as const,
        requestedVersion: rendererVersion,
        effectiveVersion: rendererVersion,
        source: 'default' as const,
        pagedAvailable: true,
      }
    : resolveActiveLegalPdfRenderer();

  if (resolution.effectiveVersion === 'paged') {
    return (
      <PagedLegalDocumentPdfLayout
        document={document}
        onRenderStateChange={onPagedRendererStateChange}
      />
    );
  }

  return <LegacyLegalDocumentPdfLayout document={document} />;
}

export function LegalDocumentPdfDialog({
  open,
  onOpenChange,
  document,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: LegalPdfDocumentData | null;
}) {
  const rendererResolution = resolveActiveLegalPdfRenderer();
  const [pagedRenderState, setPagedRenderState] = useState<{
    ready: boolean;
    error: string | null;
    activeRenderer: LegalPdfRendererVersion;
  }>({
    ready: rendererResolution.effectiveVersion !== 'paged',
    error: null,
    activeRenderer: rendererResolution.effectiveVersion,
  });

  useEffect(() => {
    setPagedRenderState({
      ready: rendererResolution.effectiveVersion !== 'paged',
      error: null,
      activeRenderer: rendererResolution.effectiveVersion,
    });
  }, [document, rendererResolution.effectiveVersion]);

  if (!document) return null;

  const pdfConfig = document.pdfConfig || DEFAULT_LEGAL_PDF_CONFIG;
  const activePageSelector = pagedRenderState.activeRenderer === 'paged' ? '.pagedjs_page' : '.pdf-page';

  return (
    <PdfTemplateViewer
      open={open}
      onOpenChange={onOpenChange}
      title={document.title}
      pageSize={pdfConfig.pageSize}
      orientation={pdfConfig.orientation}
      renderPdfFromPreview
      primaryActionLabel="Download PDF"
      pageSelector={activePageSelector}
      pdfExportReady={rendererResolution.effectiveVersion === 'paged' ? pagedRenderState.ready : true}
      pdfPreparingLabel={pagedRenderState.error ? 'Falling back to legacy preview...' : 'Preparing paged preview...'}
    >
      <LegalDocumentPdfLayout
        document={document}
        rendererVersion={rendererResolution.effectiveVersion}
        onPagedRendererStateChange={setPagedRenderState}
      />
    </PdfTemplateViewer>
  );
}
