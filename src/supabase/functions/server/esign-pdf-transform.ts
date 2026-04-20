/**
 * E-Signature PDF Transformation Manifest (Phase 3.3)
 * ============================================================================
 * The studio lets a sender reorder, delete, and rotate pages of an uploaded
 * PDF *before* sending. We don't mutate the original — that would break the
 * legal chain-of-custody (the original document hash is the basis for the
 * envelope's audit trail).
 *
 * Instead, we persist a **transformation manifest** alongside the envelope
 * that describes the desired output:
 *
 *   manifest = {
 *     version: 1,
 *     pages: [
 *       { sourcePage: 3, rotation: 0   },   // first page of new doc
 *       { sourcePage: 1, rotation: 90  },   // second page, rotated CW
 *       { sourcePage: 5, rotation: 180 },
 *       // page 2 and 4 of the original are deleted
 *     ],
 *   }
 *
 * Materialisation happens once, server-side, when the envelope is sent for
 * signature: we apply the manifest to the original PDF, hash the output,
 * and store the materialised PDF as the *signing* document (the original
 * remains in storage for audit).
 *
 * Field placements are remapped from the *new* page-numbering. We refuse to
 * materialise a manifest that orphans a placed field unless the sender has
 * explicitly acknowledged the deletion (handled in the route layer).
 * ============================================================================
 */

import { PDFDocument, degrees } from 'npm:pdf-lib@1.17.1';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const log = createModuleLogger('esign-pdf-transform');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RotationDegrees = 0 | 90 | 180 | 270;

export interface ManifestPage {
  /** 1-based index into the original PDF's page list. */
  sourcePage: number;
  /** Clockwise rotation applied to the page on output. */
  rotation: RotationDegrees;
}

export interface PageManifest {
  /** Schema version — bump when the shape changes. */
  version: 1;
  /** Ordered list of pages in the output document. */
  pages: ManifestPage[];
  /** Optional human-readable note shown in the audit log. */
  note?: string;
}

/**
 * Result of applying a manifest. `pageMap[oldPage]` returns the new 1-based
 * page index (or `null` if the page was deleted) so callers can remap field
 * placements.
 */
export interface ApplyManifestResult {
  pdfBuffer: Uint8Array;
  pageCount: number;
  /** old-page (1-based) → new-page (1-based) | null if deleted. */
  pageMap: Record<number, number | null>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reject obviously broken manifests up front so we don't open the source
 * PDF for nothing. Returns `null` if valid, or an error string for the
 * route to return to the client.
 */
export function validateManifest(
  manifest: unknown,
  sourcePageCount: number,
): string | null {
  if (!manifest || typeof manifest !== 'object') return 'Manifest must be an object';
  const m = manifest as Partial<PageManifest>;
  if (m.version !== 1) return `Unsupported manifest version: ${m.version}`;
  if (!Array.isArray(m.pages)) return 'Manifest.pages must be an array';
  if (m.pages.length === 0) return 'Manifest.pages must contain at least one page';
  if (m.pages.length > 1000) return 'Manifest.pages exceeds 1000-page limit';

  const seen = new Set<number>();
  for (let i = 0; i < m.pages.length; i++) {
    const p = m.pages[i];
    if (!p || typeof p !== 'object') return `pages[${i}] must be an object`;
    if (!Number.isInteger(p.sourcePage) || p.sourcePage < 1 || p.sourcePage > sourcePageCount) {
      return `pages[${i}].sourcePage must be 1..${sourcePageCount} (got ${p.sourcePage})`;
    }
    if (![0, 90, 180, 270].includes(p.rotation as number)) {
      return `pages[${i}].rotation must be 0, 90, 180, or 270`;
    }
    // Allow duplicates (a page can appear more than once — useful for
    // appending a copy of the cover page) but warn on more than 5 dupes.
    if (seen.has(p.sourcePage)) {
      log.warn(`Manifest re-uses source page ${p.sourcePage} at index ${i}`);
    }
    seen.add(p.sourcePage);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Application
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a new PDF by copying the source pages in the order described by
 * the manifest, rotating each as specified.
 *
 * The first occurrence of each original page wins the `pageMap` entry —
 * subsequent duplicates get the same mapping so field-placement remap is
 * deterministic.
 */
export async function applyManifest(
  sourcePdf: Uint8Array,
  manifest: PageManifest,
): Promise<ApplyManifestResult> {
  try {
    const src = await PDFDocument.load(sourcePdf, { ignoreEncryption: true });
    const totalSrcPages = src.getPageCount();

    const validationErr = validateManifest(manifest, totalSrcPages);
    if (validationErr) throw new Error(validationErr);

    const out = await PDFDocument.create();
    const pageMap: Record<number, number | null> = {};

    // Initialise every original page as deleted; flip to a real index
    // when we encounter it in the manifest.
    for (let p = 1; p <= totalSrcPages; p++) pageMap[p] = null;

    // pdf-lib's copyPages accepts a 0-based array, but we feed pages
    // one-by-one so duplicate indices stay stable.
    for (let i = 0; i < manifest.pages.length; i++) {
      const { sourcePage, rotation } = manifest.pages[i];
      const [copied] = await out.copyPages(src, [sourcePage - 1]);
      // Apply *additional* rotation on top of any existing page rotation
      // so a page already rotated 90° in the original ends up at the
      // expected absolute orientation.
      if (rotation !== 0) {
        const existing = copied.getRotation().angle;
        copied.setRotation(degrees((existing + rotation) % 360));
      }
      out.addPage(copied);
      // Only map the *first* occurrence so field remap is stable.
      if (pageMap[sourcePage] === null) pageMap[sourcePage] = i + 1;
    }

    const pdfBuffer = await out.save();
    log.info(
      `Materialised manifest: ${totalSrcPages} → ${manifest.pages.length} pages (${pdfBuffer.byteLength} bytes)`,
    );
    return { pdfBuffer, pageCount: manifest.pages.length, pageMap };
  } catch (err) {
    log.error('Failed to apply page manifest:', err);
    throw new Error(`Failed to apply page manifest: ${getErrMsg(err)}`);
  }
}

/**
 * Build the identity manifest for a PDF — every page in original order at
 * 0° rotation. Useful as a starting point for the studio editor.
 */
export function identityManifest(pageCount: number): PageManifest {
  const pages: ManifestPage[] = [];
  for (let p = 1; p <= pageCount; p++) {
    pages.push({ sourcePage: p, rotation: 0 });
  }
  return { version: 1, pages };
}

/**
 * Remap a placed field's `page` to its new index after a manifest is
 * applied. Returns `null` if the source page was deleted (caller decides
 * whether to drop the field or surface a warning).
 */
export function remapFieldPage(
  field: { page: number },
  pageMap: ApplyManifestResult['pageMap'],
): number | null {
  return pageMap[field.page] ?? null;
}
