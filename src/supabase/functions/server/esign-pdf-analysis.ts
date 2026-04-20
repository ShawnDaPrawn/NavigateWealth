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
 * Coordinates: candidate fields use the **same percentage coordinate
 * system** the rest of the e-sign module uses (0–100 of page width / height,
 * y measured from the top of the page). This matches `EsignField` and the
 * frontend studio.
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

import { PDFDocument } from 'npm:pdf-lib@1.17.1';
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
 * pdf-lib does not give us the page index of a widget directly, so we scan
 * each page's annotation array and match by widget reference.
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
    const acroField = (field as unknown as { acroField: { getWidgets: () => unknown[] } }).acroField;
    const fieldWidgets = (acroField?.getWidgets?.() ?? []) as Array<{
      Rect?: () => { asRectangle?: () => { x: number; y: number; width: number; height: number } } | undefined;
      P?: () => unknown;
      getRectangle?: () => { x: number; y: number; width: number; height: number };
    }>;

    for (const widget of fieldWidgets) {
      // Rect lookup — pdf-lib API surface here varies; try the documented
      // helper first then fall back to the dictionary entry.
      let rect: { x: number; y: number; width: number; height: number } | undefined;
      try {
        rect = widget.getRectangle?.();
      } catch { /* swallow */ }
      if (!rect) continue;

      // Match this widget to a page by inspecting page annotations.
      let pageIndex = -1;
      for (let i = 0; i < pages.length; i++) {
        const annots = pages[i].node.Annots();
        if (!annots) continue;
        const arr = annots.asArray?.() ?? [];
        // We can't easily check ref equality here without leaking pdf-lib
        // internals, so accept the first page whose annotations include a
        // widget at the same rect (cheap and sufficient).
        for (const annot of arr) {
          const obj = (annot as { lookupMaybe?: (k: unknown) => unknown }).lookupMaybe?.(undefined);
          if (!obj) continue;
          // Best-effort match: same rect within 1pt.
          const aRect = (obj as { Rect?: () => unknown }).Rect?.();
          if (!aRect) continue;
          const arr4 = (aRect as { asRectangle?: () => { x: number; y: number; width: number; height: number } }).asRectangle?.();
          if (!arr4) continue;
          if (
            Math.abs(arr4.x - rect.x) < 1 &&
            Math.abs(arr4.y - rect.y) < 1 &&
            Math.abs(arr4.width - rect.width) < 1
          ) {
            pageIndex = i;
            break;
          }
        }
        if (pageIndex >= 0) break;
      }

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
 * Convert PDF-space widget rects to the studio's percentage coordinate
 * system (0–100, y measured from the top of the page).
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

  return {
    id: `cand-acro-${widget.pageIndex}-${index}-${Date.now()}`,
    type: widget.type,
    page: widget.pageIndex + 1,
    x: clampPct((x1 / pageWidthPt) * 100),
    y: clampPct((yTopPt / pageHeightPt) * 100),
    width: clampPct((widthPt / pageWidthPt) * 100),
    height: clampPct((heightPt / pageHeightPt) * 100),
    required: true,
    source: 'acroform',
    label: widget.name || undefined,
    metadata: { acroformName: widget.name },
  };
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
    log.info(`AcroForm autodetect: ${candidates.length} candidate(s) from ${pages.length}-page PDF`);
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
const ANCHOR_PATTERNS: Array<{
  pattern: RegExp;
  type: FieldCandidate['type'];
  label: string;
}> = [
  // Signatures
  { pattern: /\bsign(ature)?\s*(of\s+\w+)?[:\-_]?\s*_{3,}/i, type: 'signature', label: 'Signature' },
  { pattern: /\bsigned\s+by[:\-_]?\s*_{3,}/i, type: 'signature', label: 'Signature' },
  { pattern: /\bsign\s+here\b/i, type: 'signature', label: 'Sign here' },
  { pattern: /\bx\s*_{5,}/i, type: 'signature', label: 'Signature (X line)' },

  // Initials
  { pattern: /\binitial(s)?\s*(here)?[:\-_]?\s*_{2,}/i, type: 'initials', label: 'Initials' },
  { pattern: /\binitial\s+here\b/i, type: 'initials', label: 'Initial here' },

  // Dates
  { pattern: /\bdate\s*(signed)?[:\-_]?\s*_{3,}/i, type: 'date', label: 'Date' },
  { pattern: /\bdated[:\-_]?\s*_{3,}/i, type: 'date', label: 'Date' },

  // Generic name / text fields with underline
  { pattern: /\b(full\s+)?name[:\-_]?\s*_{5,}/i, type: 'text', label: 'Name' },
  { pattern: /\bid\s+number[:\-_]?\s*_{5,}/i, type: 'text', label: 'ID number' },
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
  return await import('npm:pdfjs-dist@4.7.76/legacy/build/pdf.mjs') as any;
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
function groupItemsIntoLines(items: TextItem[], pageHeightPt: number): Array<{
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
    const text = bucket.map((b) => b.str).join('');
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
 * For an anchor match like `Signature: ____________`, place the candidate
 * field over the trailing underscore run rather than the whole line so the
 * sender doesn't get a field that overlaps the caption.
 */
function rectForAnchor(
  line: { text: string; rect: [number, number, number, number] },
  match: RegExpMatchArray,
): [number, number, number, number] {
  const [x1, y1, x2, y2] = line.rect;
  const lineWidth = x2 - x1;
  const lineHeight = y2 - y1;
  const matchStartFrac = (match.index ?? 0) / Math.max(line.text.length, 1);
  const matchEndFrac = ((match.index ?? 0) + match[0].length) / Math.max(line.text.length, 1);
  // Anchor field sits to the *right* of the caption, occupying the trailing
  // portion of the matched span. Clamp width to a sensible default if the
  // match has no underscore tail (e.g. "sign here").
  const caption = match[0].split(/[_\-:]/)[0] ?? '';
  const captionFrac = caption.length / Math.max(match[0].length, 1);
  const fieldStart = matchStartFrac + (matchEndFrac - matchStartFrac) * captionFrac;
  const startX = x1 + lineWidth * fieldStart;
  const endX = x1 + lineWidth * matchEndFrac;
  // Pad height slightly above and below the text baseline so signature
  // strokes don't get clipped on burn-in.
  return [startX, y1 - 2, endX, y2 + 4];
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
        for (const { pattern, type, label } of ANCHOR_PATTERNS) {
          const match = line.text.match(pattern);
          if (!match) continue;
          const [x1, y1, x2, y2] = rectForAnchor(line, match);
          // Convert PDF-space (origin bottom-left) → percentage with y from top.
          candidates.push({
            id: `cand-anchor-${pageNum}-${candidates.length}-${Date.now()}`,
            type,
            page: pageNum,
            x: clampPct((x1 / pageWidthPt) * 100),
            y: clampPct(((pageHeightPt - y2) / pageHeightPt) * 100),
            width: clampPct(((x2 - x1) / pageWidthPt) * 100),
            height: clampPct(((y2 - y1) / pageHeightPt) * 100),
            required: type === 'signature' || type === 'initials',
            source: 'anchor',
            label,
            anchorText: match[0],
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
