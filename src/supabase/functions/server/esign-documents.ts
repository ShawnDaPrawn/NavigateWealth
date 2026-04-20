/**
 * P3.4 — Multi-document envelope helpers
 *
 * Encapsulates the read / write / order operations for an envelope's
 * ordered document list and the send-time concatenation of those PDFs
 * into a single signing PDF.
 *
 * Design notes:
 *   - The legacy single-document field on `EsignEnvelope.document_id`
 *     is kept in sync with `documents[0]` so existing callers (the
 *     certificate renderer, the audit pipeline, the worker) continue
 *     to work without modification.
 *   - Per-document page manifests (P3.3) are honoured during
 *     concatenation so a sender can rotate / drop / reorder pages
 *     inside one document without affecting the others.
 *   - The page-map returned from concatenation is `{ document_id:
 *     { sourcePage: combinedPage } }` so field remapping is
 *     deterministic regardless of input order.
 */

import { PDFDocument, degrees, type PDFPage } from 'npm:pdf-lib@1.17.1';
import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { downloadDocument, uploadDocument, calculateHash } from './esign-storage.ts';
import { applyManifest, type PageManifest } from './esign-pdf-transform.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import type { EsignEnvelope, EsignEnvelopeDocumentRef, EsignField } from './esign-types.ts';

const log = createModuleLogger('esign-documents');

/**
 * Resolve the canonical, ordered document list for an envelope. Falls
 * back to a single-element array built from the legacy primary document
 * record so callers don't have to special-case "old envelopes".
 */
export async function getEnvelopeDocuments(
  envelope: EsignEnvelope,
): Promise<EsignEnvelopeDocumentRef[]> {
  const stored = (await kv.get(EsignKeys.envelopeDocuments(envelope.id))) as
    | EsignEnvelopeDocumentRef[]
    | null;
  if (Array.isArray(stored) && stored.length > 0) {
    return [...stored].sort((a, b) => a.order - b.order);
  }
  // Synthesise a single-document list from the legacy primary record so
  // multi-document code paths can treat every envelope uniformly.
  if (envelope.document_id) {
    const doc = (await kv.get(EsignKeys.PREFIX_DOCUMENT + envelope.document_id)) as
      | { id: string; original_filename: string; page_count: number; storage_path: string }
      | null;
    if (doc) {
      return [
        {
          document_id: doc.id,
          order: 0,
          display_name: doc.original_filename,
          original_filename: doc.original_filename,
          page_count: doc.page_count ?? 0,
          storage_path: doc.storage_path,
          added_at: envelope.created_at,
        },
      ];
    }
  }
  return [];
}

/**
 * Persist the ordered document list and keep `envelope.document_id`
 * pointing at `documents[0]` so legacy readers continue to work.
 */
export async function setEnvelopeDocuments(
  envelopeId: string,
  documents: EsignEnvelopeDocumentRef[],
): Promise<void> {
  const sorted = [...documents]
    .sort((a, b) => a.order - b.order)
    .map((d, idx) => ({ ...d, order: idx }));
  await kv.set(EsignKeys.envelopeDocuments(envelopeId), sorted);
  const envelope = (await kv.get(EsignKeys.envelope(envelopeId))) as EsignEnvelope | null;
  if (envelope && sorted.length > 0 && envelope.document_id !== sorted[0].document_id) {
    await kv.set(EsignKeys.envelope(envelopeId), {
      ...envelope,
      document_id: sorted[0].document_id,
      updated_at: new Date().toISOString(),
    });
  }
}

/**
 * Append a freshly-uploaded document to the envelope's ordered list.
 * Caller is responsible for first creating the document record under
 * `EsignKeys.PREFIX_DOCUMENT + documentId` (the standard upload route
 * already does this).
 */
export async function appendEnvelopeDocument(
  envelopeId: string,
  ref: Omit<EsignEnvelopeDocumentRef, 'order' | 'added_at'>,
  addedByUserId?: string,
): Promise<EsignEnvelopeDocumentRef[]> {
  const envelope = (await kv.get(EsignKeys.envelope(envelopeId))) as EsignEnvelope | null;
  if (!envelope) throw new Error(`Envelope ${envelopeId} not found`);
  const current = await getEnvelopeDocuments(envelope);
  const next: EsignEnvelopeDocumentRef[] = [
    ...current,
    {
      ...ref,
      order: current.length,
      added_at: new Date().toISOString(),
      added_by_user_id: addedByUserId,
    },
  ];
  await setEnvelopeDocuments(envelopeId, next);
  return next;
}

/**
 * Remove a document from an envelope. Refuses to remove the last one
 * because every envelope must have at least one document. Fields
 * scoped to the removed document are dropped at send-time by the
 * materialiser, but we also prune them eagerly here so the studio's
 * field-count badge stays accurate.
 */
export async function removeEnvelopeDocument(
  envelopeId: string,
  documentId: string,
): Promise<EsignEnvelopeDocumentRef[]> {
  const envelope = (await kv.get(EsignKeys.envelope(envelopeId))) as EsignEnvelope | null;
  if (!envelope) throw new Error(`Envelope ${envelopeId} not found`);
  const current = await getEnvelopeDocuments(envelope);
  if (current.length <= 1) {
    throw new Error('Cannot remove the last document from an envelope');
  }
  const next = current.filter((d) => d.document_id !== documentId);
  await setEnvelopeDocuments(envelopeId, next);
  // Drop fields anchored to the removed document so the studio doesn't
  // show ghost placements.
  const fields = ((await kv.get(EsignKeys.envelopeFields(envelopeId))) as EsignField[] | null) ?? [];
  const filtered = fields.filter((f) => (f.document_id ?? envelope.document_id) !== documentId);
  if (filtered.length !== fields.length) {
    await kv.set(EsignKeys.envelopeFields(envelopeId), filtered);
  }
  // Best-effort manifest cleanup (ok if it didn't exist).
  try {
    await kv.del(EsignKeys.envelopeDocumentManifest(envelopeId, documentId));
  } catch {
    /* noop */
  }
  return next;
}

/**
 * Reorder the envelope's documents. Caller passes the desired ordering
 * as an array of document_ids. Unknown / missing ids are ignored so
 * stale clients can't accidentally drop documents.
 */
export async function reorderEnvelopeDocuments(
  envelopeId: string,
  orderedDocumentIds: string[],
): Promise<EsignEnvelopeDocumentRef[]> {
  const envelope = (await kv.get(EsignKeys.envelope(envelopeId))) as EsignEnvelope | null;
  if (!envelope) throw new Error(`Envelope ${envelopeId} not found`);
  const current = await getEnvelopeDocuments(envelope);
  const byId = new Map(current.map((d) => [d.document_id, d]));
  const next: EsignEnvelopeDocumentRef[] = [];
  for (const id of orderedDocumentIds) {
    const doc = byId.get(id);
    if (doc) {
      next.push({ ...doc, order: next.length });
      byId.delete(id);
    }
  }
  // Preserve any docs the caller forgot at the end so we never lose data.
  for (const leftover of byId.values()) {
    next.push({ ...leftover, order: next.length });
  }
  await setEnvelopeDocuments(envelopeId, next);
  return next;
}

export interface ConcatenationResult {
  pdfBuffer: Uint8Array;
  totalPageCount: number;
  /**
   * `pageMap[document_id][sourcePage] = combinedPage` — used to
   * remap field placements onto the concatenated PDF before sending.
   * sourcePage is **post-manifest**, i.e. it is the page number the
   * sender saw in the studio after applying any reorder/delete.
   */
  pageMap: Record<string, Record<number, number>>;
  perDocumentPageCounts: Record<string, number>;
}

/**
 * Concatenate every document in the envelope (in `documents[].order`)
 * into a single PDF, applying any per-document page manifest along the
 * way. Returns both the merged PDF buffer and the page-mapping needed
 * to remap fields.
 */
export async function concatenateEnvelopeDocuments(
  envelopeId: string,
  documents: EsignEnvelopeDocumentRef[],
): Promise<ConcatenationResult> {
  if (documents.length === 0) {
    throw new Error('Cannot concatenate an empty document list');
  }
  const merged = await PDFDocument.create();
  const pageMap: Record<string, Record<number, number>> = {};
  const perDocumentPageCounts: Record<string, number> = {};
  let combinedPageCursor = 0;

  for (const doc of documents) {
    const sourceBuffer = await downloadDocument(doc.storage_path);
    if (!sourceBuffer) {
      log.warn(`Skipping document ${doc.document_id}: download failed`);
      continue;
    }
    let bufferToUse = sourceBuffer;
    // Apply per-document manifest (rotate/reorder/delete) if present.
    const manifest = (await kv.get(
      EsignKeys.envelopeDocumentManifest(envelopeId, doc.document_id),
    )) as PageManifest | null;
    if (manifest) {
      try {
        const result = await applyManifest(sourceBuffer, manifest);
        bufferToUse = result.pdfBuffer;
      } catch (err) {
        log.warn(
          `Manifest application failed for doc ${doc.document_id} (using original): ${getErrMsg(err)}`,
        );
      }
    }
    let src: PDFDocument;
    try {
      src = await PDFDocument.load(bufferToUse, { ignoreEncryption: true });
    } catch (err) {
      log.warn(`pdf-lib failed to load doc ${doc.document_id}: ${getErrMsg(err)}`);
      continue;
    }
    const pageIndices = src.getPageIndices();
    const copied = await merged.copyPages(src, pageIndices);
    const docMap: Record<number, number> = {};
    copied.forEach((page: PDFPage, idx: number) => {
      // Strip any source-document rotation; a manifest-applied source
      // already baked rotation in, and pdf-lib preserves rotation
      // metadata on copy which would compound for the second time.
      page.setRotation(degrees(0));
      merged.addPage(page);
      const sourcePageNumber = idx + 1;
      combinedPageCursor += 1;
      docMap[sourcePageNumber] = combinedPageCursor;
    });
    pageMap[doc.document_id] = docMap;
    perDocumentPageCounts[doc.document_id] = copied.length;
  }

  const pdfBuffer = await merged.save();
  return {
    pdfBuffer,
    totalPageCount: merged.getPageCount(),
    pageMap,
    perDocumentPageCounts,
  };
}

/**
 * Materialise the concatenated PDF, write it to storage at a fixed
 * `materialised/{envelopeId}/signing.pdf` path, and update the legacy
 * primary document record so existing readers see the new combined
 * file. Returns the page-mapping for field remapping.
 */
export async function materialiseEnvelope(
  envelopeId: string,
): Promise<ConcatenationResult & { storagePath: string }> {
  const envelope = (await kv.get(EsignKeys.envelope(envelopeId))) as EsignEnvelope | null;
  if (!envelope) throw new Error(`Envelope ${envelopeId} not found`);
  const documents = await getEnvelopeDocuments(envelope);
  const result = await concatenateEnvelopeDocuments(envelopeId, documents);
  const storagePath = `materialised/${envelopeId}/signing.pdf`;
  await uploadDocument(
    envelope.firm_id ?? 'standalone',
    envelope.document_id,
    result.pdfBuffer,
    storagePath,
    'application/pdf',
  );
  // Mirror the merged result onto the primary document record so the
  // certificate renderer, signer fetch path and worker continue to work.
  const primary = (await kv.get(EsignKeys.PREFIX_DOCUMENT + envelope.document_id)) as
    | { storage_path: string; original_storage_path?: string; page_count: number; hash?: string }
    | null;
  if (primary) {
    await kv.set(EsignKeys.PREFIX_DOCUMENT + envelope.document_id, {
      ...primary,
      original_storage_path: primary.original_storage_path ?? primary.storage_path,
      storage_path: storagePath,
      page_count: result.totalPageCount,
      hash: await calculateHash(result.pdfBuffer),
      materialised_at: new Date().toISOString(),
    });
  }
  return { ...result, storagePath };
}

/**
 * Remap a list of fields onto the materialised PDF using a
 * concatenation page-map. Fields whose document/page no longer exist
 * (e.g. their page was dropped via manifest) are returned in the
 * `dropped` array so callers can audit them.
 */
export function remapFieldsForConcatenation(
  fields: EsignField[],
  pageMap: ConcatenationResult['pageMap'],
  primaryDocumentId: string,
): { remapped: EsignField[]; dropped: EsignField[] } {
  const remapped: EsignField[] = [];
  const dropped: EsignField[] = [];
  for (const f of fields) {
    const docId = f.document_id ?? primaryDocumentId;
    const docMap = pageMap[docId];
    if (!docMap) {
      dropped.push(f);
      continue;
    }
    const newPage = docMap[f.page];
    if (newPage == null) {
      dropped.push(f);
      continue;
    }
    remapped.push({ ...f, page: newPage });
  }
  return { remapped, dropped };
}
