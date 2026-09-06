/**
 * E-Signature PDF Analysis (Phase 3.1 + 3.2)
 * ============================================================================
 * Two upload-time analyses that propose where esign fields should live so
 * the sender doesn't start from a blank PDF:
 *
 *   3.1 AcroForm autodetection — read the PDF's existing AcroForm widgets
 *       (text inputs, checkboxes, signature fields) via pdf-lib and convert
 *       each into an `EsignField` candidate.
 *
 *   3.2 Smart Anchors — heuristic text scan. Parse the PDF's text streams
 *       and look for tokens like `Signature: __________`, `Initial here`,
 *       `Date: ____`, then propose a field positioned over the trailing
 *       underline / blank space.
 *
 * Both functions are PURE: they take a PDF byte buffer and return candidate
 * fields. The route layer decides whether to persist them. We deliberately
 * keep this module dependency-light (no KV, no HTTP) so it's trivially
 * unit-testable from Vitest.
 *
 * Coordinates: candidate fields use the **same coordinate system as
 * `EsignField`**: x/y are percentages (0–100 of page width / height, y
 * measured from the top of the page); width/height are **PDF points** —
 * that is what the burn-in path (`esign-pdf.service.ts`) and the signer
 * renderer (`FieldHighlight.tsx`) expect. (Historical note: an earlier
 * version emitted width/height as percentages too, which made accepted
 * candidates render and burn in at roughly a fifth of their real size.)
 *
 * Acceptance bar from the roadmap:
 *   "uploading a real FNA PDF results in ~80% of expected fields auto-placed;
 *    sender only adjusts."
 *
 * Best-effort by design — anchors and AcroForm widgets are *suggestions*,
 * never automatic mutations. Failures must NEVER block upload; callers must
 * wrap calls in try/catch and fall back to no candidates on error.
 * ============================================================================
 */

import { PDFArray, PDFDict, PDFDocument, PDFPage, PDFRef } from 'npm:pdf-lib@1.17.1';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const log = createModuleLogger('esign-pdf-analysis');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A field candidate — same shape the studio consumes when it pre-places
 * fields. `signer_id` is intentionally omitted; the sender picks the
 * recipient when they accept the suggestion.
 */
export interface FieldCandidate {
  /** Internal id so the studio can dedupe/track suggestions in state. */
  id: string;
  type: 'signature' | 'initials' | 'text' | 'date' | 'checkbox';
  /** 1-based page number to match the rest of the module. */
  page: number;
  /** Percentage coordinates (0–100). y measured from page top. */
  x: number;
  y: number;
  /** PDF points — same unit as `EsignField.width`/`height`. */
  width: number;
  height: number;
  required: boolean;
  /**
   * Source — used by the studio to badge candidates ("From PDF form" vs
   * "Smart anchor") and let the user accept/dismiss in bulk.
   */
  source: 'acroform' | 'anchor';
  /** Free-text label / hint extracted from the source widget or anchor. */
  label?: string;
  /** Anchor text that produced this candidate (for `anchor` source). */
  anchorText?: string;
  /**
   * CRM prefill token suggested by the anchor label (e.g. a "First name:"
   * label proposes `key:profile_first_name`). Mirrored into
   * `metadata.prefill.token` so accepting the candidate yields a field the
   * prefill resolver (`esign-prefill.ts`) fills from the client record —
   * the sender never types the client's own details.
   */
  prefill_token?: string;
  /** Optional carry-over metadata (e.g. validation hints from a widget name). */
  metadata?: Record<string, unknown>;
}

export interface AnalysisResult {
  candidates: FieldCandidate[];
  /** Wall-clock duration in ms — surfaced to the route for observability. */
  durationMs: number;
  /** True if the analyzer ran without throwing. False on swallowed errors. */
  ok: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.1 — AcroForm autodetection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map an AcroForm widget's field type and (best-effort) field name to one of
 * our esign field types.
 *
 * pdf-lib doesn't expose a stable enum for field constructor names across
 * versions, so we sniff via constructor.name and field-name heuristics.
 */
function classifyAcroformField(field: {
  constructor: { name?: string };
  getName?: () => string;
}): FieldCandidate['type'] | null {
  const ctor = field.constructor?.name ?? '';
  const name = (field.getName?.() ?? '').toLowerCase();

  // pdf-lib widget classes: PDFSignature, PDFCheckBox, PDFTextField,
  // PDFRadioGroup, PDFDropdown, PDFOptionList. Signature comes through as
  // "PDFSignature" in field-acroform output.
  if (ctor === 'PDFSignature' || /signature|sign here|signed by/.test(name)) {
    return 'signature';
  }
  if (ctor === 'PDFCheckBox') return 'checkbox';
  if (ctor === 'PDFRadioGroup') return 'checkbox'; // closest mapping we support
  if (/initial/.test(name)) return 'initials';
  if (/date|dob|d\.o\.b/.test(name)) return 'date';
  if (ctor === 'PDFTextField' || ctor === 'PDFDropdown') return 'text';
  return null;
}

interface AcroformWidget {
  type: FieldCandidate['type'];
  pageIndex: number; // 0-based
  /** PDF-space rect: [x1, y1, x2, y2] with y measured from the bottom. */
  rect: [number, number, number, number];
  name: string;
}

/**
 * Walk every AcroForm field, then every widget annotation under each field,
 * and pull out the page index + rect for the studio to render.
 *
 * Page resolution mirrors pdf-lib's own `PDFForm.findWidgetPage`: a widget
 * normally carries a `/P` entry pointing at its page, and when it doesn't
 * (some authoring tools omit it) the page is the one whose `/Annots` array
 * references the widget. An earlier version tried to match widgets to pages
 * by rect through a lookup that never resolved, so every widget fell
 * through to the "assume page 1" fallback and a multi-page form had all of
 * its suggestions stacked on the first page.
 */
async function extractAcroformWidgets(buffer: Uint8Array): Promise<AcroformWidget[]> {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const form = pdf.getForm();
  const fields = form.getFields();
  if (fields.length === 0) return [];

  const pages = pdf.getPages();
  const widgets: AcroformWidget[] = [];

  for (const field of fields) {
    const type = classifyAcroformField(field);
    if (!type) continue;

    // pdf-lib exposes acroField widgets via the low-level API. Each field
    // can have multiple widgets (the same field rendered on multiple pages).
    const acroField = (field as unknown as { acroField: { getWidgets: () => unknown[] } })
      .acroField;
    const fieldWidgets = (acroField?.getWidgets?.() ?? []) as Array<{
      P?: () => PDFRef | undefined;
      dict?: PDFDict;
      getRectangle?: () => { x: number; y: number; width: number; height: number };
    }>;

    for (const widget of fieldWidgets) {
      let rect: { x: number; y: number; width: number; height: number } | undefined;
      try {
        rect = widget.getRectangle?.();
      } catch {
        /* swallow */
      }
      if (!rect) continue;

      let pageIndex = findWidgetPageIndex(pdf, pages, widget);

      // Last resort — assume page 1 so the candidate isn't lost. The sender
      // can drag it to the right page if needed.
      if (pageIndex < 0) pageIndex = 0;

      widgets.push({
        type,
        pageIndex,
        rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
        name: field.getName?.() ?? '',
      });
    }
  }

  return widgets;
}

/**
 * Resolve the 0-based page index a widget annotation lives on, or -1 when
 * it cannot be determined.
 *
 *   1. `/P` on the widget dict — the page reference, present on most
 *      widgets.
 *   2. The page whose `/Annots` array holds the widget's own reference
 *      (pdf-lib's `findPageForAnnotationRef`).
 *   3. The page whose `/Annots` array resolves to the same dict object —
 *      covers widgets that were merged into the field dict and so have no
 *      reference of their own.
 */
function findWidgetPageIndex(
  pdf: PDFDocument,
  pages: PDFPage[],
  widget: { P?: () => PDFRef | undefined; dict?: PDFDict },
): number {
  try {
    const pageRef = widget.P?.();
    if (pageRef) {
      const byRef = pages.findIndex((p) => p.ref === pageRef);
      if (byRef >= 0) return byRef;
    }
  } catch {
    /* fall through to the annotation scan */
  }

  const dict = widget.dict;
  if (!dict) return -1;

  try {
    const widgetRef = pdf.context.getObjectRef(dict);
    if (widgetRef) {
      const page = pdf.findPageForAnnotationRef(widgetRef);
      if (page) {
        const idx = pages.findIndex((p) => p.ref === page.ref);
        if (idx >= 0) return idx;
      }
    }
  } catch {
    /* fall through to the dict-identity scan */
  }

  for (let i = 0; i < pages.length; i++) {
    let annots: PDFArray | undefined;
    try {
      annots = pages[i].node.Annots();
    } catch {
      continue;
    }
    if (!annots) continue;
    const entries = annots.asArray();
    for (const entry of entries) {
      const resolved = entry instanceof PDFRef ? pdf.context.lookup(entry) : entry;
      if (resolved === dict) return i;
    }
  }

  return -1;
}

/**
 * Convert PDF-space widget rects to the field coordinate system:
 * x/y as percentages (0–100, y from the top of the page), width/height in
 * PDF points.
 */
function widgetToCandidate(
  widget: AcroformWidget,
  pageWidthPt: number,
  pageHeightPt: number,
  index: number,
): FieldCandidate {
  const [x1, y1, x2, y2] = widget.rect;
  const widthPt = x2 - x1;
  const heightPt = y2 - y1;

  // PDF y is bottom-up; flip so 0 = top of page.
  const yTopPt = pageHeightPt - y2;
  const min = MIN_FIELD_SIZE_PT[widget.type];

  return {
    id: `cand-acro-${widget.pageIndex}-${index}-${Date.now()}`,
    type: widget.type,
    page: widget.pageIndex + 1,
    x: clampPct((x1 / pageWidthPt) * 100),
    y: clampPct((yTopPt / pageHeightPt) * 100),
    // Minimum-size expansion must never push the field past the page: cap
    // width at the space right of the widget, height at the space below
    // its top edge (never shrinking a widget's real size).
    width: roundPt(Math.min(Math.max(widthPt, min.width), Math.max(pageWidthPt - x1 - 2, widthPt))),
    height: roundPt(Math.min(Math.max(heightPt, min.height), Math.max(y2, heightPt))),
    required: true,
    source: 'acroform',
    label: widget.name || undefined,
    metadata: { acroformName: widget.name },
  };
}

/**
 * Smallest usable size per field type, in PDF points. Anchors matched on a
 * bare caption ("Sign here") have no underline run to measure, and some
 * AcroForm widgets carry degenerate rects — without a floor those become
 * zero-width fields the sender cannot even grab.
 */
const MIN_FIELD_SIZE_PT: Record<FieldCandidate['type'], { width: number; height: number }> = {
  signature: { width: 150, height: 40 },
  initials: { width: 60, height: 30 },
  text: { width: 140, height: 24 },
  date: { width: 90, height: 24 },
  checkbox: { width: 18, height: 18 },
};

function roundPt(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Number(v.toFixed(2));
}

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return Number(v.toFixed(3));
}

/**
 * Public entry point for AcroForm autodetection.
 *
 * Returns an empty list (with `ok: false`) if the PDF is encrypted, the
 * form is empty, or pdf-lib throws — never rejects the upload.
 */
export async function detectAcroformFields(buffer: Uint8Array): Promise<AnalysisResult> {
  const start = Date.now();
  try {
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = pdf.getPages();
    const widgets = await extractAcroformWidgets(buffer);
    const candidates: FieldCandidate[] = widgets.map((w, i) => {
      const page = pages[w.pageIndex] ?? pages[0];
      const { width, height } = page.getSize();
      return widgetToCandidate(w, width, height, i);
    });
    log.info(
      `AcroForm autodetect: ${candidates.length} candidate(s) from ${pages.length}-page PDF`,
    );
    return { candidates, durationMs: Date.now() - start, ok: true };
  } catch (err) {
    log.warn(`AcroForm autodetect failed (non-fatal): ${getErrMsg(err)}`);
    return { candidates: [], durationMs: Date.now() - start, ok: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.2 — Smart Anchors (text-scan heuristics)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Anchor patterns we recognise.
 *
 * Each entry:
 *   - `pattern` — case-insensitive regex matched against per-line text.
 *   - `type`    — esign field type to propose.
 *   - `label`   — human label for the candidate badge in the studio.
 *
 * Patterns are deliberately conservative — false positives cost the sender
 * more time than false negatives because they have to delete bad
 * suggestions individually. We err on the side of fewer, higher-confidence
 * hits and let the sender place anything we miss manually.
 */
export const ANCHOR_PATTERNS: Array<{
  pattern: RegExp;
  type: FieldCandidate['type'];
  label: string;
  /**
   * CRM prefill token to bind when this anchor matches — the accepted field
   * arrives already wired to the client record (see `esign-prefill.ts`).
   * Tokens must come from the closed `PrefillToken` list.
   */
  prefillToken?: string;
}> = [
  // Signatures
  {
    pattern: /\bsign(ature)?\s*(of\s+\w+)?[:\-_]?\s*_{3,}/i,
    type: 'signature',
    label: 'Signature',
  },
  { pattern: /\bsigned\s+by[:\-_]?\s*_{3,}/i, type: 'signature', label: 'Signature' },
  { pattern: /\bsign\s+here\b/i, type: 'signature', label: 'Sign here' },
  { pattern: /\bx\s*_{5,}/i, type: 'signature', label: 'Signature (X line)' },

  // Initials
  { pattern: /\binitial(s)?\s*(here)?[:\-_]?\s*_{2,}/i, type: 'initials', label: 'Initials' },
  { pattern: /\binitial\s+here\b/i, type: 'initials', label: 'Initial here' },

  // Dates
  { pattern: /\bdate\s*(signed)?[:\-_]?\s*_{3,}/i, type: 'date', label: 'Date' },
  { pattern: /\bdated[:\-_]?\s*_{3,}/i, type: 'date', label: 'Date' },

  // ── Identity labels → prefill-bound text fields ────────────────────────
  // A caption like `First name:` proposes a text field placed after the
  // caption AND bound to the matching client token, so the value fills
  // itself at send-time. Ordering matters: more specific labels must sit
  // above generic ones (`first name` before `name`) because the first
  // matching pattern per line wins. Labels are accepted with a trailing
  // colon/dash OR an underscore run — a bare word in prose never matches.
  {
    pattern: /\bfirst\s+names?\s*(?:[:-]\s*_{0,}|_{3,})/i,
    type: 'text',
    label: 'First name',
    prefillToken: 'key:profile_first_name',
  },
  {
    pattern: /\b(?:surname|last\s+name)\s*(?:[:-]\s*_{0,}|_{3,})/i,
    type: 'text',
    label: 'Last name',
    prefillToken: 'key:profile_last_name',
  },
  {
    pattern: /\b(?:full\s+)?names?\s*(?:[:-]\s*_{0,}|_{5,})/i,
    type: 'text',
    label: 'Name',
    prefillToken: 'client.name',
  },
  {
    pattern: /\be-?mail(?:\s+address)?\s*(?:[:-]\s*_{0,}|_{3,})/i,
    type: 'text',
    label: 'Email',
    prefillToken: 'client.email',
  },
  {
    pattern:
      /\b(?:cell(?:phone)?|mobile|phone|contact)\s*(?:number|no\.?)?\s*(?:[:-]\s*_{0,}|_{3,})/i,
    type: 'text',
    label: 'Phone',
    prefillToken: 'client.phone',
  },
  {
    pattern: /\b(?:id|identity)\s+(?:number|no\.?)\s*(?:[:-]\s*_{0,}|_{3,})/i,
    type: 'text',
    label: 'ID number',
    prefillToken: 'client.id_number',
  },
  {
    pattern: /\b(?:income\s+)?tax\s+(?:number|no\.?|reference)\s*(?:[:-]\s*_{0,}|_{3,})/i,
    type: 'text',
    label: 'Tax number',
    prefillToken: 'client.tax_number',
  },
  {
    pattern: /\b(?:date\s+of\s+birth|d\.?o\.?b\.?)\s*(?:[:-]\s*_{0,}|_{3,})/i,
    type: 'text',
    label: 'Date of birth',
    prefillToken: 'client.date_of_birth',
  },
  {
    pattern: /\b(?:residential|physical|postal|street)?\s*address\s*(?:[:-]\s*_{0,}|_{3,})/i,
    type: 'text',
    label: 'Address',
    prefillToken: 'client.address',
  },
  {
    pattern: /\bmarital\s+status\s*(?:[:-]\s*_{0,}|_{3,})/i,
    type: 'text',
    label: 'Marital status',
    prefillToken: 'client.marital_status',
  },
];

/**
 * One token with positional metadata pulled from `pdfjs` text content.
 * We use pdfjs (not pdf-lib) for text because pdf-lib does not expose the
 * text content stream in a structured way.
 */
interface TextItem {
  str: string;
  /** Page-space transform: [a, b, c, d, e, f]; e/f are translation. */
  transform: [number, number, number, number, number, number];
  width: number;
  height: number;
}

/**
 * Lazy-loaded pdfjs reference. We dynamic-import to keep edge cold-start
 * lean — anchor scanning is opt-in via the `runAnchorScan` flag and won't
 * be exercised on most uploads.
 *
 * pdfjs ships a Deno-friendly entry that we can pull from the CDN; the
 * ESM version is published as `pdfjs-dist` on JSR/npm.
 */
async function loadPdfJs(): Promise<unknown> {
  // Dynamic CDN import keeps the bundle out of cold paths and avoids
  // top-level pdfjs initialisation in environments without a worker.
  // deno-lint-ignore no-explicit-any
  return (await import('npm:pdfjs-dist@4.7.76/legacy/build/pdf.mjs')) as any;
}

interface PdfJsPageProxy {
  getTextContent: () => Promise<{ items: TextItem[] }>;
  getViewport: (opts: { scale: number }) => { width: number; height: number };
}

interface PdfJsDocProxy {
  numPages: number;
  getPage: (n: number) => Promise<PdfJsPageProxy>;
}

/**
 * Group text items into visual lines by Y position (bucket-sort within a
 * 4pt tolerance). pdfjs gives us tokens individually; we need lines so
 * regexes can match phrases like `Signature: ____`.
 */
function groupItemsIntoLines(
  items: TextItem[],
  pageHeightPt: number,
): Array<{
  text: string;
  /** [x1, y1, x2, y2] in PDF-space (origin bottom-left). */
  rect: [number, number, number, number];
}> {
  const buckets = new Map<number, TextItem[]>();
  for (const item of items) {
    const [, , , , , ty] = item.transform;
    const key = Math.round(ty / 4) * 4; // 4pt buckets
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(item);
  }

  const lines: Array<{ text: string; rect: [number, number, number, number] }> = [];
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => a.transform[4] - b.transform[4]);
    // Join with a space wherever the PDF leaves a visible horizontal gap.
    // pdfjs hands back a caption like "First name" as two items and does not
    // always emit the space between them; concatenating blind produced
    // "Firstname", which no `\s+` caption pattern can match — so those blanks
    // lost their label (and their prefill token) and fell through to the
    // generic rule below.
    let text = '';
    let prevEnd: number | null = null;
    for (const item of bucket) {
      const startX = item.transform[4];
      const gap = prevEnd === null ? 0 : startX - prevEnd;
      if (
        prevEnd !== null &&
        gap > Math.max(1, (item.height || 10) * 0.2) &&
        !text.endsWith(' ') &&
        !item.str.startsWith(' ')
      ) {
        text += ' ';
      }
      text += item.str;
      prevEnd = startX + (item.width ?? 0);
    }
    if (!text.trim()) continue;
    const xs = bucket.map((b) => b.transform[4]);
    const x1 = Math.min(...xs);
    const last = bucket[bucket.length - 1];
    const x2 = (last.transform[4] ?? 0) + (last.width ?? 0);
    const y = bucket[0].transform[5];
    const h = bucket[0].height || 10;
    lines.push({ text, rect: [x1, y, x2, y + h] });
    void pageHeightPt;
  }
  return lines;
}

/**
 * The slice of `RegExpMatchArray` the geometry helper actually reads. The
 * generic blank rule below synthesises these rather than running a regex per
 * candidate, so the helper takes the narrow shape instead of a full match.
 */
export interface AnchorMatch {
  0: string;
  index?: number;
}

/** One proposed field found on a single line of text. */
export interface LineAnchor {
  match: AnchorMatch;
  type: FieldCandidate['type'];
  label: string;
  prefillToken?: string;
  /** Span claimed in the line text, so passes don't propose the same blank twice. */
  start: number;
  end: number;
}

/**
 * An underscore run this long with no caption in front of it is a decorative
 * rule (a page divider, a signature baseline drawn across the sheet), not a
 * blank waiting to be filled.
 */
const DECORATIVE_RUN_CHARS = 60;

/**
 * Label a generic blank from the words immediately before it.
 *
 * Only the text after the previous blank on the same line counts, so
 * `Name: ____ Surname: ____` labels the second field "Surname" rather than
 * dragging the first caption along with it.
 */
function captionBefore(lineText: string, blankStart: number): string {
  const previousBlankEnd = lineText.lastIndexOf('_', blankStart - 1);
  const before = lineText.slice(previousBlankEnd + 1, blankStart);
  // Trailing separators belong to the caption's punctuation, not its text.
  const caption = before.replace(/[\s:\-–]+$/, '').trim();
  if (!caption) return '';
  // A caption sits at the END of the preceding text — anything earlier is
  // the sentence or section heading it was printed under.
  const words = caption.split(/\s+/).slice(-5).join(' ');
  return words.length > 40 ? words.slice(words.length - 40).trim() : words;
}

/**
 * Find every field a single line of text proposes.
 *
 * Two passes, because the specific patterns carry meaning the generic rule
 * cannot infer — a signature block, or a caption bound to a CRM prefill token:
 *
 *   1. `ANCHOR_PATTERNS`, specific-first, every occurrence on the line. A
 *      later match is dropped when its span overlaps one already claimed
 *      ("First name:" also matches the generic "Name" pattern).
 *   2. Every blank the first pass left, as a plain text field labelled from
 *      the caption in front of it.
 *
 * Pass 2 is what makes the scan useful on a real form. The patterns in pass 1
 * only know ten identity captions, so a document full of ordinary blanks
 * ("Occupation: ____", "Policy number: ____") used to come back with nothing
 * but its signature and date lines.
 *
 * Exported for unit tests.
 */
export function findLineAnchors(lineText: string): LineAnchor[] {
  const claimed: Array<[number, number]> = [];
  const anchors: LineAnchor[] = [];

  for (const { pattern, type, label, prefillToken } of ANCHOR_PATTERNS) {
    const global = new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
    );
    for (const m of lineText.matchAll(global)) {
      const start = m.index ?? 0;
      let text = m[0];
      let end = start + text.length;
      // Swallow a trailing blank the pattern itself did not take (caption-only
      // patterns like "Sign here" stop at the caption), so pass 2 does not
      // propose a second field over the very same underscores.
      const tail = /^\s*_{3,}/.exec(lineText.slice(end));
      if (tail) {
        text += tail[0];
        end += tail[0].length;
      }
      if (claimed.some(([s, e]) => start < e && end > s)) continue;
      claimed.push([start, end]);
      anchors.push({ match: { 0: text, index: start }, type, label, prefillToken, start, end });
    }
  }

  // A fillable blank: three or more underscores in a row.
  for (const m of lineText.matchAll(/_{3,}/g)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (claimed.some(([s, e]) => start < e && end > s)) continue;
    const label = captionBefore(lineText, start);
    if (!label && m[0].length >= DECORATIVE_RUN_CHARS) continue;
    claimed.push([start, end]);
    anchors.push({
      match: { 0: m[0], index: start },
      type: 'text',
      label: label || 'Text field',
      start,
      end,
    });
  }

  return anchors.sort((a, b) => a.start - b.start);
}

/** Breathing room between a field's right edge and the next caption. */
const FIELD_GUTTER_PT = 4;

/**
 * Approximate the x of a character index within a line, by its position in
 * the line's own text. Same assumption `rectForAnchor` makes.
 */
function xForCharIndex(
  line: { text: string; rect: [number, number, number, number] },
  index: number,
): number {
  const [x1, , x2] = line.rect;
  return x1 + (x2 - x1) * (index / Math.max(line.text.length, 1));
}

/**
 * For an anchor match like `Signature: ____________`, place the candidate
 * field over the trailing underscore run rather than the whole line so the
 * sender doesn't get a field that overlaps the caption.
 *
 * Exported for unit tests.
 */
export function rectForAnchor(
  line: { text: string; rect: [number, number, number, number] },
  match: AnchorMatch,
  type: FieldCandidate['type'],
  pageWidthPt: number,
): [number, number, number, number] {
  const [x1, y1, x2, y2] = line.rect;
  const lineWidth = x2 - x1;
  const matchStartFrac = (match.index ?? 0) / Math.max(line.text.length, 1);
  const matchEndFrac = ((match.index ?? 0) + match[0].length) / Math.max(line.text.length, 1);
  // Anchor field sits to the *right* of the caption, occupying the trailing
  // portion of the matched span. The caption is the match with its trailing
  // separator (colon/dash) and underscore run stripped — splitting on the
  // first '-' would wrongly cut hyphenated captions like "E-mail" down to
  // "E" and start the field over the caption itself.
  const caption = match[0].replace(/\s*[-:]?\s*_*\s*$/, '');
  const captionFrac = caption.length / Math.max(match[0].length, 1);
  const fieldStart = matchStartFrac + (matchEndFrac - matchStartFrac) * captionFrac;
  const startX = x1 + lineWidth * fieldStart;
  let endX = x1 + lineWidth * matchEndFrac;
  // A caption-only match ("Sign here", "First name:") has no underscore
  // tail to measure, which used to produce a zero-width field. Extend to
  // the type's minimum width, clamped to the page edge — the caller must
  // take this rect's width verbatim (re-applying the minimum after the
  // clamp would push the field off the page again).
  const min = MIN_FIELD_SIZE_PT[type];
  if (endX - startX < min.width) {
    endX = Math.min(startX + min.width, pageWidthPt - 4);
  }
  // Pad height slightly above and below the text baseline so signature
  // strokes don't get clipped on burn-in, and grow short lines DOWNWARD to
  // the type's minimum height. In PDF space (origin bottom-left) growing
  // downward means lowering the bottom edge; clamp at the page bottom.
  const top = y2 + 4;
  let bottom = y1 - 2;
  if (top - bottom < min.height) {
    bottom = Math.max(top - min.height, 0);
  }
  return [startX, bottom, endX, top];
}

/**
 * Public entry point for Smart Anchors. Best-effort, non-blocking — same
 * contract as `detectAcroformFields`.
 */
export async function detectSmartAnchors(buffer: Uint8Array): Promise<AnalysisResult> {
  const start = Date.now();
  try {
    // deno-lint-ignore no-explicit-any
    const pdfjs: any = await loadPdfJs();
    const loadingTask = pdfjs.getDocument({ data: buffer, isEvalSupported: false });
    const doc: PdfJsDocProxy = await loadingTask.promise;

    const candidates: FieldCandidate[] = [];

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const pageWidthPt = viewport.width;
      const pageHeightPt = viewport.height;

      const content = await page.getTextContent();
      const lines = groupItemsIntoLines(content.items, pageHeightPt);

      for (const line of lines) {
        const anchors = findLineAnchors(line.text);
        const rects = anchors.map((a) => rectForAnchor(line, a.match, a.type, pageWidthPt));
        // A field must not run into the next blank on the same line. The type
        // minimum in `rectForAnchor` is a floor for a lone blank, not licence
        // to cover the caption that follows: on "Name: ____ Surname: ____"
        // both blanks are shorter than the 140pt text minimum, so without this
        // the first suggestion lands on top of the second.
        for (let i = 0; i < rects.length - 1; i++) {
          const nextStartX = xForCharIndex(line, anchors[i + 1].start);
          const limit = nextStartX - FIELD_GUTTER_PT;
          if (rects[i][2] > limit) rects[i][2] = Math.max(limit, rects[i][0] + 1);
        }

        for (const [index, { match, type, label, prefillToken }] of anchors.entries()) {
          const [x1, y1, x2, y2] = rects[index];
          // Convert PDF-space (origin bottom-left) → x/y percentage with y
          // from top; width/height stay in PDF points, taken verbatim from
          // the rect — rectForAnchor already applied the type minimums with
          // page-edge clamping.
          candidates.push({
            id: `cand-anchor-${pageNum}-${candidates.length}-${Date.now()}`,
            type,
            page: pageNum,
            x: clampPct((x1 / pageWidthPt) * 100),
            y: clampPct(((pageHeightPt - y2) / pageHeightPt) * 100),
            width: roundPt(x2 - x1),
            height: roundPt(y2 - y1),
            required: type === 'signature' || type === 'initials',
            source: 'anchor',
            label,
            anchorText: match[0],
            ...(prefillToken
              ? {
                  prefill_token: prefillToken,
                  metadata: { prefill: { token: prefillToken } },
                }
              : {}),
          });
        }
      }
    }

    log.info(`Smart Anchors: ${candidates.length} candidate(s) from ${doc.numPages}-page PDF`);
    return { candidates, durationMs: Date.now() - start, ok: true };
  } catch (err) {
    log.warn(`Smart Anchors failed (non-fatal): ${getErrMsg(err)}`);
    return { candidates: [], durationMs: Date.now() - start, ok: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined entry point + dedupe
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run both analyses, merge candidates, and dedupe near-duplicates so the
 * sender doesn't see the same field surfaced twice (once via AcroForm,
 * once via the underline anchor next to the widget).
 */
export async function analyzeUploadedPdf(buffer: Uint8Array): Promise<AnalysisResult> {
  const start = Date.now();
  const [acro, anchors] = await Promise.all([
    detectAcroformFields(buffer),
    detectSmartAnchors(buffer),
  ]);
  // AcroForm fields win when both sources hit the same area — they carry
  // semantic intent (the PDF author tagged it as a signature) whereas
  // anchors are purely visual.
  const merged: FieldCandidate[] = [...acro.candidates];
  for (const a of anchors.candidates) {
    const dupe = merged.some(
      (m) =>
        m.page === a.page &&
        m.type === a.type &&
        Math.abs(m.x - a.x) < 4 &&
        Math.abs(m.y - a.y) < 3,
    );
    if (!dupe) merged.push(a);
  }
  return {
    candidates: merged,
    durationMs: Date.now() - start,
    ok: acro.ok || anchors.ok,
  };
}
