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

// Module entry point — lazy, and defined in the shell entry so the admin frame
// can render it without importing this barrel. See ./shell.ts.
export { EsignModule } from './shell';

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

// Standardised wizard chrome. Shared with the client drawer's E-Sign tab so
// the send-for-signature flow is laid out identically wherever it is started.
// Light enough to export eagerly: a header, a stepper and buttons.
export { EsignWizardShell, EsignWizardSection, ExitWizardDialog } from './components/wizard';
export { hasUnsavedWizardWork, canSaveWizardDraft } from './components/wizard';
export type { EsignWizardStepId } from './components/wizard';
export { documentStepBlocker } from './components/documentStepModel';
export type { DocumentUploadValue } from './components/documentStepModel';

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
export const RecipientsStepView = lazy(() =>
  import('./components/RecipientsStepView').then((m) => ({ default: m.RecipientsStepView })),
);
export const PrepareFormStudio = lazy(() =>
  import('./components/PrepareFormStudio').then((m) => ({ default: m.PrepareFormStudio })),
);

/**
 * Warm this module's chunk before it is rendered.
 *
 * `preloadAdminModule` calls this on navigation intent so the chunk downloads
 * while the pointer is on the sidebar item rather than after the click.
 *
 * `import()` caches, so calling this repeatedly costs nothing after the first.
 */
export const preloadEsignModule = () => import('./EsignModule');
