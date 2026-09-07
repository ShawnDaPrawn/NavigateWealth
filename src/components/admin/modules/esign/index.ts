import { lazy } from 'react';
/**
 * esign module — public API.
 *
 * Pure re-export barrel: the module component lives in EsignModule.tsx.
 * Everything other modules and outside code may use is named here, so the
 * module's internals stay private (see .dependency-cruiser.cjs).
 *
 * Heavy wizard steps (DocumentUploadStep, RecipientsManager,
 * PrepareFormStudio) are deliberately NOT re-exported: consumers load them
 * through React.lazy so they stay in their own chunks, and routing a dynamic
 * import through this barrel would pull the whole module into that chunk.
 */

// Module entry point
// Lazy: the module entry pulls the PDF studio (pdf.js). Keeping it behind
// lazy() means a light consumer importing esignApi or a type from this barrel
// no longer drags pdf.js in — which is exactly what broke VerifyDocumentPage
// with "DOMMatrix is not defined". Render inside <Suspense>.
export const EsignModule = lazy(() =>
  import('./EsignModule').then((m) => ({ default: m.EsignModule })),
);

// API client
export { esignApi } from './api';

// React Query hooks and query-key factory
export {
  useEnvelopes,
  useAllEnvelopes,
  useClientEnvelopes,
  useEnvelope,
  useAuditTrail,
  useEnvelopeActions,
  esignKeys,
} from './hooks';

// Query tuning shared with consumers that prime the same cache
export { QUERY_GC_TIME, QUERY_STALE_TIME } from './constants';

// Presentational pieces reused by the client portal and the client e-sign tab
export { EmptyState } from './components/EmptyState';
export { EnvelopeManagementTableRow } from './components/EnvelopeManagementTableRow';
export { EnvelopeDetailsDialog } from './components/EnvelopeDetailsDialog';
export { EsignSkeleton } from './components/EsignSkeleton';

// Types
export type { EsignEnvelope, EnvelopeStatus, EsignField, SignerFormData } from './types';

// Heavy wizard steps — each keeps its own chunk; render inside <Suspense>.
export const DocumentUploadStep = lazy(() =>
  import('./components/DocumentUploadStep').then((m) => ({ default: m.DocumentUploadStep })),
);
export const RecipientsManager = lazy(() =>
  import('./components/RecipientsManager').then((m) => ({ default: m.RecipientsManager })),
);
export const PrepareFormStudio = lazy(() =>
  import('./components/PrepareFormStudio').then((m) => ({ default: m.PrepareFormStudio })),
);

/**
 * Warm this module's chunk before it is rendered.
 *
 * This barrel is imported eagerly by AdminDashboardPage (its component is
 * already lazy here, so wrapping it again would break the lazy contract), which
 * means the barrel is in the initial bundle but `EsignModule` is not.
 * `preloadAdminModule` calls this on navigation intent so the chunk downloads
 * while the pointer is on the sidebar item rather than after the click.
 *
 * `import()` caches, so calling this repeatedly costs nothing after the first.
 */
export const preloadEsignModule = () => import('./EsignModule');
