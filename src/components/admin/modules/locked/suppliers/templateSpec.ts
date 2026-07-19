/**
 * Suppliers — Invoice Template Spec (single source of truth)
 *
 * The constrained, structured description of a supplier's invoice layout —
 * the "invoice standard" extracted by AI from an uploaded example invoice (or
 * hand-tuned in the template editor). A deterministic renderer consumes this
 * spec; the AI never produces HTML, so an uploaded document cannot inject
 * markup — every free-text field is rendered as a plain text node.
 *
 * Pure TypeScript with no imports. The edge function shares this exact module
 * via the re-export in
 * src/supabase/functions/server/locked/supplier-template-spec.ts, so the AI
 * analyzer, persistence-time normalization and the client renderer/editor can
 * never drift apart.
 */

// ============================================================================
// Types
// ============================================================================

export type TemplateMargins = 'compact' | 'normal' | 'wide';
export type TemplateFontFamily = 'sans' | 'serif' | 'mono';
export type TemplateLogoPosition = 'top-left' | 'top-center' | 'top-right';
export type TemplateBlockPosition = 'left' | 'right';
export type TemplateAccentBar = 'none' | 'top' | 'left' | 'under-title';
export type TemplateTableStyle = 'lined' | 'striped' | 'boxed' | 'minimal';
export type TemplateTableHeaderStyle = 'filled' | 'underline' | 'plain';
export type TemplateColumnAlign = 'left' | 'center' | 'right';
export type TemplateTotalsPosition = 'right' | 'full-width';
export type TemplateMetaFieldKey = 'invoiceNumber' | 'invoiceDate' | 'dueDate' | 'reference';
export type TemplateColumnKey =
  | 'description'
  | 'quantity'
  | 'unitPrice'
  | 'vatAmount'
  | 'lineTotal';
export type TemplateCurrencyFormat = 'R1 234,56' | 'R 1,234.56' | 'ZAR 1 234.56';
export type TemplateDateFormat = 'yyyy/MM/dd' | 'dd MMM yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd';

export interface TemplateMetaField {
  key: TemplateMetaFieldKey;
  label: string;
}

export interface TemplateColumn {
  key: TemplateColumnKey;
  label: string;
  align: TemplateColumnAlign;
}

export interface InvoiceTemplateSpec {
  page: {
    size: 'A4';
    margins: TemplateMargins;
  };
  palette: {
    /** Dominant brand colour (headings, accents). */
    primary: string;
    /** Secondary accent colour. */
    accent: string;
    headerText: string;
    bodyText: string;
    tableHeaderBg: string;
    tableHeaderText: string;
  };
  typography: {
    fontFamily: TemplateFontFamily;
    baseSizePt: number;
    titleUppercase: boolean;
  };
  logo: {
    show: boolean;
    position: TemplateLogoPosition;
    heightPx: number;
  };
  header: {
    /** Document title exactly as printed on the example, e.g. "TAX INVOICE". */
    title: string;
    titlePosition: TemplateBlockPosition;
    supplierBlockPosition: TemplateBlockPosition;
    showSupplierAddress: boolean;
    showVatNumber: boolean;
    showRegNumber: boolean;
    accentBar: TemplateAccentBar;
  };
  metaBox: {
    position: TemplateBlockPosition;
    fields: TemplateMetaField[];
  };
  billedTo: {
    heading: string;
    showVatNumber: boolean;
    showAddress: boolean;
  };
  lineTable: {
    columns: TemplateColumn[];
    style: TemplateTableStyle;
    headerStyle: TemplateTableHeaderStyle;
  };
  totals: {
    position: TemplateTotalsPosition;
    subtotalLabel: string;
    vatLabel: string;
    totalLabel: string;
    emphasizeTotal: boolean;
  };
  footer: {
    bankingDetails: string;
    terms: string;
    thankYouLine: string;
  };
  formats: {
    currency: TemplateCurrencyFormat;
    dateFormat: TemplateDateFormat;
  };
}

// ============================================================================
// Default spec
// ============================================================================

export const DEFAULT_TEMPLATE_SPEC: InvoiceTemplateSpec = {
  page: { size: 'A4', margins: 'normal' },
  palette: {
    primary: '#1f2937',
    accent: '#2563eb',
    headerText: '#111827',
    bodyText: '#1f2937',
    tableHeaderBg: '#1f2937',
    tableHeaderText: '#ffffff',
  },
  typography: { fontFamily: 'sans', baseSizePt: 10, titleUppercase: true },
  logo: { show: true, position: 'top-left', heightPx: 64 },
  header: {
    title: 'TAX INVOICE',
    titlePosition: 'right',
    supplierBlockPosition: 'left',
    showSupplierAddress: true,
    showVatNumber: true,
    showRegNumber: true,
    accentBar: 'none',
  },
  metaBox: {
    position: 'right',
    fields: [
      { key: 'invoiceNumber', label: 'Invoice No' },
      { key: 'invoiceDate', label: 'Date' },
      { key: 'dueDate', label: 'Due Date' },
    ],
  },
  billedTo: { heading: 'BILL TO', showVatNumber: true, showAddress: true },
  lineTable: {
    columns: [
      { key: 'description', label: 'Description', align: 'left' },
      { key: 'quantity', label: 'Qty', align: 'right' },
      { key: 'unitPrice', label: 'Unit Price', align: 'right' },
      { key: 'vatAmount', label: 'VAT', align: 'right' },
      { key: 'lineTotal', label: 'Amount', align: 'right' },
    ],
    style: 'lined',
    headerStyle: 'filled',
  },
  totals: {
    position: 'right',
    subtotalLabel: 'Subtotal',
    vatLabel: 'VAT @ 15%',
    totalLabel: 'Total Due',
    emphasizeTotal: true,
  },
  footer: { bankingDetails: '', terms: '', thankYouLine: '' },
  formats: { currency: 'R1 234,56', dateFormat: 'yyyy/MM/dd' },
};

// ============================================================================
// Normalization
// ============================================================================

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function hex(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_RE.test(value.trim())
    ? value.trim().toLowerCase()
    : fallback;
}

function text(value: unknown, fallback: string, maxLength = 400): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const META_KEYS: readonly TemplateMetaFieldKey[] = [
  'invoiceNumber',
  'invoiceDate',
  'dueDate',
  'reference',
];
const COLUMN_KEYS: readonly TemplateColumnKey[] = [
  'description',
  'quantity',
  'unitPrice',
  'vatAmount',
  'lineTotal',
];
const ALIGNS: readonly TemplateColumnAlign[] = ['left', 'center', 'right'];

function normalizeMetaFields(value: unknown): TemplateMetaField[] {
  const fallback = DEFAULT_TEMPLATE_SPEC.metaBox.fields;
  if (!Array.isArray(value)) return fallback.map((f) => ({ ...f }));
  const seen = new Set<TemplateMetaFieldKey>();
  const fields: TemplateMetaField[] = [];
  for (const raw of value) {
    const row = (raw ?? {}) as Record<string, unknown>;
    if (!META_KEYS.includes(row.key as TemplateMetaFieldKey)) continue;
    const key = row.key as TemplateMetaFieldKey;
    if (seen.has(key)) continue;
    seen.add(key);
    const defaultLabel = fallback.find((f) => f.key === key)?.label ?? key;
    fields.push({ key, label: text(row.label, defaultLabel, 60) });
  }
  // An invoice without a number or date is not usable — restore the essentials.
  if (!seen.has('invoiceNumber')) fields.unshift({ key: 'invoiceNumber', label: 'Invoice No' });
  if (!seen.has('invoiceDate')) fields.push({ key: 'invoiceDate', label: 'Date' });
  return fields;
}

function normalizeColumns(value: unknown): TemplateColumn[] {
  const fallback = DEFAULT_TEMPLATE_SPEC.lineTable.columns;
  const columns: TemplateColumn[] = [];
  const seen = new Set<TemplateColumnKey>();
  if (Array.isArray(value)) {
    for (const raw of value) {
      const row = (raw ?? {}) as Record<string, unknown>;
      if (!COLUMN_KEYS.includes(row.key as TemplateColumnKey)) continue;
      const key = row.key as TemplateColumnKey;
      if (seen.has(key)) continue;
      seen.add(key);
      const defaults = fallback.find((f) => f.key === key)!;
      columns.push({
        key,
        label: text(row.label, defaults.label, 40),
        align: pick(row.align, ALIGNS, defaults.align),
      });
    }
  }
  if (columns.length === 0) return fallback.map((c) => ({ ...c }));
  // A line table must at least describe and total each row.
  if (!seen.has('description'))
    columns.unshift({ key: 'description', label: 'Description', align: 'left' });
  if (!seen.has('lineTotal')) columns.push({ key: 'lineTotal', label: 'Amount', align: 'right' });
  return columns;
}

/**
 * Coerce an untrusted (AI-produced or hand-edited) spec into a valid,
 * renderable one. Unknown enum values, malformed colours and out-of-range
 * numbers fall back to the defaults — a bad analysis can never persist an
 * unrenderable template.
 */
export function normalizeTemplateSpec(input: unknown): InvoiceTemplateSpec {
  const raw = (input ?? {}) as Record<string, any>;
  const d = DEFAULT_TEMPLATE_SPEC;
  return {
    page: {
      size: 'A4',
      margins: pick(raw.page?.margins, ['compact', 'normal', 'wide'] as const, d.page.margins),
    },
    palette: {
      primary: hex(raw.palette?.primary, d.palette.primary),
      accent: hex(raw.palette?.accent, d.palette.accent),
      headerText: hex(raw.palette?.headerText, d.palette.headerText),
      bodyText: hex(raw.palette?.bodyText, d.palette.bodyText),
      tableHeaderBg: hex(raw.palette?.tableHeaderBg, d.palette.tableHeaderBg),
      tableHeaderText: hex(raw.palette?.tableHeaderText, d.palette.tableHeaderText),
    },
    typography: {
      fontFamily: pick(
        raw.typography?.fontFamily,
        ['sans', 'serif', 'mono'] as const,
        d.typography.fontFamily,
      ),
      baseSizePt: clampNumber(raw.typography?.baseSizePt, 7, 14, d.typography.baseSizePt),
      titleUppercase: bool(raw.typography?.titleUppercase, d.typography.titleUppercase),
    },
    logo: {
      show: bool(raw.logo?.show, d.logo.show),
      position: pick(
        raw.logo?.position,
        ['top-left', 'top-center', 'top-right'] as const,
        d.logo.position,
      ),
      heightPx: clampNumber(raw.logo?.heightPx, 24, 160, d.logo.heightPx),
    },
    header: {
      title: text(raw.header?.title, d.header.title, 60),
      titlePosition: pick(
        raw.header?.titlePosition,
        ['left', 'right'] as const,
        d.header.titlePosition,
      ),
      supplierBlockPosition: pick(
        raw.header?.supplierBlockPosition,
        ['left', 'right'] as const,
        d.header.supplierBlockPosition,
      ),
      showSupplierAddress: bool(raw.header?.showSupplierAddress, d.header.showSupplierAddress),
      showVatNumber: bool(raw.header?.showVatNumber, d.header.showVatNumber),
      showRegNumber: bool(raw.header?.showRegNumber, d.header.showRegNumber),
      accentBar: pick(
        raw.header?.accentBar,
        ['none', 'top', 'left', 'under-title'] as const,
        d.header.accentBar,
      ),
    },
    metaBox: {
      position: pick(raw.metaBox?.position, ['left', 'right'] as const, d.metaBox.position),
      fields: normalizeMetaFields(raw.metaBox?.fields),
    },
    billedTo: {
      heading: text(raw.billedTo?.heading, d.billedTo.heading, 60),
      showVatNumber: bool(raw.billedTo?.showVatNumber, d.billedTo.showVatNumber),
      showAddress: bool(raw.billedTo?.showAddress, d.billedTo.showAddress),
    },
    lineTable: {
      columns: normalizeColumns(raw.lineTable?.columns),
      style: pick(
        raw.lineTable?.style,
        ['lined', 'striped', 'boxed', 'minimal'] as const,
        d.lineTable.style,
      ),
      headerStyle: pick(
        raw.lineTable?.headerStyle,
        ['filled', 'underline', 'plain'] as const,
        d.lineTable.headerStyle,
      ),
    },
    totals: {
      position: pick(raw.totals?.position, ['right', 'full-width'] as const, d.totals.position),
      subtotalLabel: text(raw.totals?.subtotalLabel, d.totals.subtotalLabel, 40),
      vatLabel: text(raw.totals?.vatLabel, d.totals.vatLabel, 40),
      totalLabel: text(raw.totals?.totalLabel, d.totals.totalLabel, 40),
      emphasizeTotal: bool(raw.totals?.emphasizeTotal, d.totals.emphasizeTotal),
    },
    footer: {
      bankingDetails: text(raw.footer?.bankingDetails, '', 600),
      terms: text(raw.footer?.terms, '', 600),
      thankYouLine: text(raw.footer?.thankYouLine, '', 200),
    },
    formats: {
      currency: pick(
        raw.formats?.currency,
        ['R1 234,56', 'R 1,234.56', 'ZAR 1 234.56'] as const,
        d.formats.currency,
      ),
      dateFormat: pick(
        raw.formats?.dateFormat,
        ['yyyy/MM/dd', 'dd MMM yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd'] as const,
        d.formats.dateFormat,
      ),
    },
  };
}
