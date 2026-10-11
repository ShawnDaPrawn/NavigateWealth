/**
 * Shell entry — what the admin frame needs from this module before the
 * module itself is opened. Keep it to light, side-effect-free re-exports: see
 * the "Shell entries" note in
 * `src/components/admin/moduleLoaders.ts`.
 */
export { PersonnelSkeleton } from './components/PersonnelSkeleton';
export { useCurrentUserPermissions } from './hooks/usePermissions';
export { personnelApi } from './api';
