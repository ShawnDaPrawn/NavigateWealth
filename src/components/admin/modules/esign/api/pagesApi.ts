/**
 * The page-transformation manifest.
 *
 * One slice of what used to be the single 1,300-line `esignApi` object. The
 * aggregate in `../api.ts` spreads every slice back together, so consumers
 * keep calling `esignApi.method(...)` unchanged.
 */
import { api } from '../../../../../utils/api/client';
import type { EnvelopeDocumentRef, PageManifestPayload } from '../api';

export const pagesApi = {
  // ==================== P3.3 — PAGE MANIFEST ====================

  /**
   * Fetch the current page-transformation manifest for an envelope. Returns
   * `null` when the sender hasn't customised page order (i.e. the original
   * PDF is the source of truth).
   */
  async getPageManifest(envelopeId: string): Promise<{ manifest: PageManifestPayload | null }> {
    return api.get(`/esign/envelopes/${envelopeId}/manifest`);
  },

  /** Save / replace the page manifest. Server validates source-page bounds. */
  async savePageManifest(
    envelopeId: string,
    manifest: PageManifestPayload,
  ): Promise<{ success: boolean; manifest: PageManifestPayload }> {
    return api.put(`/esign/envelopes/${envelopeId}/manifest`, { manifest });
  },

  /** Discard the manifest — signer will see the original PDF unchanged. */
  async clearPageManifest(envelopeId: string): Promise<{ success: boolean }> {
    return api.delete(`/esign/envelopes/${envelopeId}/manifest`);
  },

  /**
   * Render a transient preview of the manifest applied to the source PDF.
   * Returns a short-lived signed URL plus a pageMap so the studio can
   * remap field placements visually.
   */
  async materializePagePreview(
    envelopeId: string,
    manifest?: PageManifestPayload,
  ): Promise<{ url: string; pageCount: number; pageMap: Record<number, number | null> }> {
    return api.post(
      `/esign/envelopes/${envelopeId}/materialize-preview`,
      manifest ? { manifest } : {},
    );
  },

  // ─────────────────────────────────────────────────────────────────────────
  // P3.4 — Multi-document envelope operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetch the ordered list of documents for an envelope. Each document
   * carries a presigned URL so the studio can render it without an
   * extra round-trip.
   */
  async listEnvelopeDocuments(envelopeId: string): Promise<{ documents: EnvelopeDocumentRef[] }> {
    return api.get(`/esign/envelopes/${envelopeId}/documents`);
  },

  /**
   * Append a new document to an existing draft envelope. Uses fetch
   * directly because we need multipart/form-data; the shared `api`
   * client only supports JSON bodies.
   */
  async addEnvelopeDocument(
    envelopeId: string,
    file: File,
    options?: { displayName?: string; idempotencyKey?: string },
  ): Promise<{
    documents: EnvelopeDocumentRef[];
    added: { document_id: string; page_count: number };
  }> {
    const fd = new FormData();
    fd.append('file', file);
    if (options?.displayName) fd.append('display_name', options.displayName);
    return api.post<{
      documents: EnvelopeDocumentRef[];
      added: { document_id: string; page_count: number };
    }>(
      `/esign/envelopes/${envelopeId}/documents`,
      fd,
      options?.idempotencyKey
        ? { headers: { 'Idempotency-Key': options.idempotencyKey } }
        : undefined,
    );
  },

  /**
   * Remove a document from a draft envelope. Refuses to remove the
   * last document.
   */
  async removeEnvelopeDocument(
    envelopeId: string,
    documentId: string,
  ): Promise<{ documents: EnvelopeDocumentRef[] }> {
    return api.delete(`/esign/envelopes/${envelopeId}/documents/${documentId}`);
  },

  /**
   * Reorder the envelope's documents. `order` is the desired list of
   * document_ids; missing ids are appended at the end so a stale
   * client cannot accidentally drop documents.
   */
  async reorderEnvelopeDocuments(
    envelopeId: string,
    order: string[],
  ): Promise<{ documents: EnvelopeDocumentRef[] }> {
    return api.put(`/esign/envelopes/${envelopeId}/documents/order`, { order });
  },
};
