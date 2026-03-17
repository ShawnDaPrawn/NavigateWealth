/**
 * E-Signature Hooks Index
 * Navigate Wealth Admin Dashboard
 * 
 * Barrel export for all E-Signature React hooks.
 */

// React Query hooks (NEW - recommended)
export {
  // Query hooks
  useAllEnvelopes,
  useClientEnvelopes,
  useEnvelope,
  useAuditTrail,
  useEnvelopes,
  esignKeys,
} from './useEnvelopesQuery';

export {
  // Mutation hooks
  useUploadDocument,
  useSaveFields,
  useSendInvites,
  useVoidEnvelope,
  useSaveAsTemplate,
  useSendOTP,
  useSubmitSignature,
  useRejectSigning,
} from './useEnvelopeMutations';

// Legacy hooks (kept for backward compatibility)
export { useEnvelopes as useEnvelopesLegacy } from './useEnvelopes';
export { useEnvelopeActions } from './useEnvelopeActions';
