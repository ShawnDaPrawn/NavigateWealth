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
export { EsignModule } from './EsignModule';

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
