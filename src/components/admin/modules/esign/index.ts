/**
 * esign module — public API.
 *
 * Pure re-export barrel: the module component lives in EsignModule.tsx.
 * Everything other modules and outside code may use is named here, so the
 * module's internals stay private (see .dependency-cruiser.cjs).
 */
export { EsignModule } from './EsignModule';
export { useEnvelopes } from './hooks';
