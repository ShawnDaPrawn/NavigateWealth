/**
 * Medical FNA React Query Hooks
 * Export barrel for all hooks
 *
 * Client keys are not read here: every FNA takes them through the shared
 * review prefill (form-prefill/useFormPrefill).
 */

export { useMedicalFNAMutations, MEDICAL_FNA_QUERY_KEYS } from './useMedicalFNAMutations';
