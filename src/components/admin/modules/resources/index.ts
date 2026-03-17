/**
 * Resources Module - Public API
 *
 * Explicit named exports only — wildcard re-exports have been removed to
 * prevent the lazy-loaded chunk from pulling in unnecessary code.
 */

// Main Component
export { ResourcesModule } from './ResourcesModule';

// Types (re-export only the public-facing types)
export type { FormDefinition, ResourceCategory, BuilderBlock } from './types';

// Hooks
export { useResources } from './hooks/useResources';

// Components consumed by other modules
export { UniversalKeyManager } from './UniversalKeyManager';

// Legal Documents Registry (consumed by public-facing pages)
export { LEGAL_DOCUMENTS, LEGAL_DOCUMENTS_BY_SLUG, LEGAL_SLUGS, LEGAL_SECTION_LABELS } from './legal-constants';
export type { LegalDocumentEntry } from './legal-constants';
