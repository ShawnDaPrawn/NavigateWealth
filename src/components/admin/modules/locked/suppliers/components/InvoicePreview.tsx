/**
 * InvoicePreview — the deterministic invoice renderer.
 *
 * Takes a template spec + invoice data and renders A4 page(s) that reproduce
 * the supplier's invoice standard. All spec-driven free text is rendered as
 * plain React text nodes (never HTML), which is what makes AI-extracted specs
 * safe to render.
 *
 * Every colour is an inline hex style from the spec: the export pipeline
 * rasterizes via html2canvas, which cannot parse the oklch() colours Tailwind
 * v4 emits, so the page deliberately uses no Tailwind classes.
 *
 * Markup contract with exportPdfFromPreview (resources/PdfTemplateViewer):
 * container carries data-pdf-export-root="true", each page uses .pdf-page.
 */

import type { CSSProperties } from 'react';
import type { InvoiceTemplateSpec, TemplateColumn } from '../templateSpec';
import type { InvoiceLineItem, InvoicePreviewData, Supplier } from '../types';
import {
  computeInvoiceTotals,
  formatTemplateCurrency,
  formatTemplateDate,
  lineNet,
  lineTotal,
  lineVat,
} from '../invoiceMath';

export type { InvoicePreviewData };

/** A4 at 96dpi. */
const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1123;

const MARGIN_PX = { compact: 28, normal: 44, wide: 64 } as const;

const FONT_STACKS = {
  sans: "'Helvetica Neue', Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', monospace",
} as const;

/** Line-item rows on the first page (header + billed-to eat space) vs continuation pages. */
const FIRST_PAGE_ROWS = 14;
const NEXT_PAGE_ROWS = 26;

interface InvoicePreviewProps {
  spec: InvoiceTemplateSpec;
  supplier: Supplier;
  data: InvoicePreviewData;
  logoUrl?: string | null;
  /** Shrinks the rendered page for inline display; export always uses 1. */
  scale?: number;
}

function chunkRows(lineItems: InvoiceLineItem[]): InvoiceLineItem[][] {
  if (lineItems.length <= FIRST_PAGE_ROWS) return [lineItems];
  const pages: InvoiceLineItem[][] = [lineItems.slice(0, FIRST_PAGE_ROWS)];
  for (let i = FIRST_PAGE_ROWS; i < lineItems.length; i += NEXT_PAGE_ROWS) {
    pages.push(lineItems.slice(i, i + NEXT_PAGE_ROWS));
  }
  return pages;
}

function cellValue(
  column: TemplateColumn,
  line: InvoiceLineItem,
  spec: InvoiceTemplateSpec,
): string {
  switch (column.key) {
    case 'description':
      return line.description || '—';
    case 'quantity':
      return String(line.quantity);
    case 'unitPrice':
      return formatTemplateCurrency(line.unitPrice, spec.formats.currency);
    case 'vatAmount':
      return formatTemplateCurrency(lineVat(line), spec.formats.currency);
    case 'lineTotal':
      // When VAT has its own column the amount column shows the net; otherwise gross.
      return formatTemplateCurrency(
        spec.lineTable.columns.some((c) => c.key === 'vatAmount') ? lineNet(line) : lineTotal(line),
        spec.formats.currency,
      );
  }
}

export function InvoicePreview({ spec, supplier, data, logoUrl, scale = 1 }: InvoicePreviewProps) {
  const margin = MARGIN_PX[spec.page.margins];
  const fontFamily = FONT_STACKS[spec.typography.fontFamily];
  const baseSizePx = spec.typography.baseSizePt * (96 / 72);
  const totals = computeInvoiceTotals(data.lineItems);
  const pages = chunkRows(data.lineItems);

  const pageStyle: CSSProperties = {
    width: PAGE_WIDTH_PX,
    height: PAGE_HEIGHT_PX,
    background: '#ffffff',
    color: spec.palette.bodyText,
    fontFamily,
    fontSize: baseSizePx,
    lineHeight: 1.45,
    padding: margin,
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    borderTop: spec.header.accentBar === 'top' ? `6px solid ${spec.palette.accent}` : undefined,
    borderLeft: spec.header.accentBar === 'left' ? `6px solid ${spec.palette.accent}` : undefined,
  };

  const metaValues: Record<string, string> = {
    invoiceNumber: data.invoiceNumber,
    invoiceDate: formatTemplateDate(data.invoiceDate, spec.formats.dateFormat),
    dueDate: formatTemplateDate(data.dueDate, spec.formats.dateFormat),
    reference: data.reference ?? '—',
  };

  const title = spec.typography.titleUppercase
    ? spec.header.title.toUpperCase()
    : spec.header.title;

  const logoBlock =
    spec.logo.show && logoUrl ? (
      <img
        src={logoUrl}
        alt={`${supplier.name} logo`}
        crossOrigin="anonymous"
        style={{
          height: spec.logo.heightPx,
          maxWidth: 260,
          objectFit: 'contain',
          display: 'block',
        }}
      />
    ) : null;

  const supplierBlock = (
    <div style={{ textAlign: spec.header.supplierBlockPosition === 'right' ? 'right' : 'left' }}>
      <div style={{ fontWeight: 700, fontSize: baseSizePx * 1.15, color: spec.palette.headerText }}>
        {supplier.name}
      </div>
      {spec.header.showRegNumber && supplier.registrationNumber ? (
        <div>Reg No: {supplier.registrationNumber}</div>
      ) : null}
      {spec.header.showVatNumber && supplier.vatNumber ? (
        <div>VAT No: {supplier.vatNumber}</div>
      ) : null}
      {spec.header.showSupplierAddress && supplier.registeredAddress ? (
        <div style={{ whiteSpace: 'pre-line' }}>{supplier.registeredAddress}</div>
      ) : null}
      {supplier.contactNumber ? <div>Tel: {supplier.contactNumber}</div> : null}
    </div>
  );

  const titleBlock = (
    <div style={{ textAlign: spec.header.titlePosition === 'right' ? 'right' : 'left' }}>
      <div
        style={{
          fontSize: baseSizePx * 2,
          fontWeight: 700,
          color: spec.palette.primary,
          letterSpacing: spec.typography.titleUppercase ? 1.5 : 0,
        }}
      >
        {title}
      </div>
      {spec.header.accentBar === 'under-title' ? (
        <div
          style={{
            height: 4,
            width: 120,
            background: spec.palette.accent,
            marginTop: 6,
            marginLeft: spec.header.titlePosition === 'right' ? 'auto' : 0,
          }}
        />
      ) : null}
    </div>
  );

  const metaBox = (
    <table
      style={{
        borderCollapse: 'collapse',
        marginLeft: spec.metaBox.position === 'right' ? 'auto' : 0,
      }}
    >
      <tbody>
        {spec.metaBox.fields.map((field) => (
          <tr key={field.key}>
            <td style={{ fontWeight: 700, paddingRight: 12, color: spec.palette.headerText }}>
              {field.label}
            </td>
            <td style={{ textAlign: 'right' }}>{metaValues[field.key] ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const billedToBlock = (
    <div>
      <div
        style={{
          fontWeight: 700,
          color: spec.palette.primary,
          marginBottom: 4,
          fontSize: baseSizePx * 0.95,
        }}
      >
        {spec.billedTo.heading}
      </div>
      <div style={{ fontWeight: 600 }}>{data.billedToName || '—'}</div>
      {spec.billedTo.showVatNumber && data.billedToVatNumber ? (
        <div>VAT No: {data.billedToVatNumber}</div>
      ) : null}
      {spec.billedTo.showAddress && data.billedToAddress ? (
        <div style={{ whiteSpace: 'pre-line' }}>{data.billedToAddress}</div>
      ) : null}
    </div>
  );

  const tableBorder =
    spec.lineTable.style === 'boxed'
      ? `1px solid ${spec.palette.primary}`
      : spec.lineTable.style === 'lined'
        ? `1px solid #d1d5db`
        : 'none';

  const headerCellStyle: CSSProperties = {
    padding: '7px 8px',
    fontWeight: 700,
    ...(spec.lineTable.headerStyle === 'filled'
      ? { background: spec.palette.tableHeaderBg, color: spec.palette.tableHeaderText }
      : spec.lineTable.headerStyle === 'underline'
        ? { borderBottom: `2px solid ${spec.palette.primary}`, color: spec.palette.headerText }
        : { color: spec.palette.headerText }),
  };

  const renderTable = (rows: InvoiceLineItem[]) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
      <thead>
        <tr>
          {spec.lineTable.columns.map((column) => (
            <th
              key={column.key}
              style={{
                ...headerCellStyle,
                textAlign: column.align,
                border: spec.lineTable.style === 'boxed' ? tableBorder : undefined,
              }}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((line, index) => (
          <tr
            key={index}
            style={{
              background:
                spec.lineTable.style === 'striped' && index % 2 === 1 ? '#f3f4f6' : undefined,
            }}
          >
            {spec.lineTable.columns.map((column) => (
              <td
                key={column.key}
                style={{
                  padding: '6px 8px',
                  textAlign: column.align,
                  border: spec.lineTable.style === 'boxed' ? tableBorder : undefined,
                  borderBottom: spec.lineTable.style === 'lined' ? '1px solid #e5e7eb' : undefined,
                }}
              >
                {cellValue(column, line, spec)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const totalsRows: Array<{ label: string; value: string; emphasize?: boolean }> = [
    {
      label: spec.totals.subtotalLabel,
      value: formatTemplateCurrency(totals.subtotal, spec.formats.currency),
    },
    {
      label: spec.totals.vatLabel,
      value: formatTemplateCurrency(totals.vatAmount, spec.formats.currency),
    },
    {
      label: spec.totals.totalLabel,
      value: formatTemplateCurrency(totals.total, spec.formats.currency),
      emphasize: spec.totals.emphasizeTotal,
    },
  ];

  const totalsBlock = (
    <div
      style={{
        marginTop: 14,
        display: 'flex',
        justifyContent: spec.totals.position === 'right' ? 'flex-end' : 'stretch',
      }}
    >
      <table
        style={{
          borderCollapse: 'collapse',
          width: spec.totals.position === 'full-width' ? '100%' : 300,
        }}
      >
        <tbody>
          {totalsRows.map((row) => (
            <tr key={row.label}>
              <td
                style={{
                  padding: '5px 8px',
                  fontWeight: row.emphasize ? 700 : 600,
                  color: row.emphasize ? spec.palette.primary : spec.palette.headerText,
                  borderTop: row.emphasize ? `2px solid ${spec.palette.primary}` : undefined,
                  fontSize: row.emphasize ? baseSizePx * 1.15 : undefined,
                }}
              >
                {row.label}
              </td>
              <td
                style={{
                  padding: '5px 8px',
                  textAlign: 'right',
                  fontWeight: row.emphasize ? 700 : 400,
                  color: row.emphasize ? spec.palette.primary : undefined,
                  borderTop: row.emphasize ? `2px solid ${spec.palette.primary}` : undefined,
                  fontSize: row.emphasize ? baseSizePx * 1.15 : undefined,
                }}
              >
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const footerBlock =
    spec.footer.bankingDetails || spec.footer.terms || spec.footer.thankYouLine || data.notes ? (
      <div
        style={{
          marginTop: 'auto',
          paddingTop: 14,
          borderTop: `1px solid ${spec.palette.accent}`,
          fontSize: baseSizePx * 0.9,
        }}
      >
        {data.notes ? (
          <div style={{ whiteSpace: 'pre-line', marginBottom: 8 }}>{data.notes}</div>
        ) : null}
        {spec.footer.bankingDetails ? (
          <div style={{ whiteSpace: 'pre-line', marginBottom: 6 }}>
            {spec.footer.bankingDetails}
          </div>
        ) : null}
        {spec.footer.terms ? (
          <div style={{ whiteSpace: 'pre-line', marginBottom: 6 }}>{spec.footer.terms}</div>
        ) : null}
        {spec.footer.thankYouLine ? (
          <div style={{ fontWeight: 600, color: spec.palette.primary }}>
            {spec.footer.thankYouLine}
          </div>
        ) : null}
      </div>
    ) : null;

  const logoLeft = spec.logo.position === 'top-left';
  const logoCenter = spec.logo.position === 'top-center';

  return (
    <div data-pdf-export-root="true" style={{ display: 'inline-block' }}>
      <div
        style={{
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top left',
          width: PAGE_WIDTH_PX * scale,
          height: pages.length * (PAGE_HEIGHT_PX + 16) * scale,
        }}
      >
        {pages.map((rows, pageIndex) => {
          const isFirst = pageIndex === 0;
          const isLast = pageIndex === pages.length - 1;
          return (
            <div
              key={pageIndex}
              className="pdf-page"
              style={{ ...pageStyle, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
            >
              {isFirst ? (
                <>
                  {logoCenter && logoBlock ? (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                      {logoBlock}
                    </div>
                  ) : null}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 24,
                      flexDirection:
                        spec.header.supplierBlockPosition === 'right' ? 'row-reverse' : 'row',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                      {logoLeft && logoBlock}
                      {supplierBlock}
                      {!logoLeft && !logoCenter && logoBlock}
                    </div>
                    {titleBlock}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 24,
                      marginTop: 22,
                      flexDirection: spec.metaBox.position === 'left' ? 'row-reverse' : 'row',
                    }}
                  >
                    {billedToBlock}
                    {metaBox}
                  </div>
                </>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: spec.palette.headerText,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{supplier.name}</div>
                  <div>
                    {title} {data.invoiceNumber} — page {pageIndex + 1} of {pages.length}
                  </div>
                </div>
              )}

              {renderTable(rows)}

              {isLast ? (
                <>
                  {totalsBlock}
                  {footerBlock}
                </>
              ) : (
                <div style={{ marginTop: 10, fontStyle: 'italic', fontSize: baseSizePx * 0.9 }}>
                  Continued on page {pageIndex + 2}…
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
