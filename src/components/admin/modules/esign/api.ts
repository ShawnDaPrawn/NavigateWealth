// ============================================================================
// E-SIGNATURE API
// Client-side API for E-Signature module using shared API client
// ============================================================================

import { envelopeApi } from './api/envelopeApi';
import { signingApi } from './api/signingApi';
import { complianceApi } from './api/complianceApi';
import { opsApi } from './api/opsApi';
import { templatesApi } from './api/templatesApi';
import { notificationsApi } from './api/notificationsApi';
import { pagesApi } from './api/pagesApi';

/**
 * The e-sign API surface, spread from its per-concern slices. This aggregate
 * IS the interface: forty-odd call sites import `esignApi` from this module.
 */
export const esignApi = {
  ...envelopeApi,
  ...signingApi,
  ...complianceApi,
  ...opsApi,
  ...templatesApi,
  ...notificationsApi,
  ...pagesApi,
};

/**
 * P3.4 — Document reference returned by the multi-document API. The
 * `url` is a presigned URL valid for one hour.
 */
export interface EnvelopeDocumentRef {
  document_id: string;
  order: number;
  display_name: string;
  original_filename: string;
  page_count: number;
  storage_path: string;
  added_at: string;
  added_by_user_id?: string;
  url?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// P3.3 — Page manifest payload type. Mirrors `PageManifest` on the server.
// ─────────────────────────────────────────────────────────────────────────────

export interface PageManifestPayload {
  version: 1;
  pages: Array<{
    sourcePage: number;
    rotation: 0 | 90 | 180 | 270;
  }>;
  note?: string;
}
