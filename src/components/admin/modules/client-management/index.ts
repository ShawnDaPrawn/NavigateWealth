/**
 * client-management module — public API.
 *
 * Pure re-export barrel: the module component lives in ClientManagementModule.tsx.
 * Everything other modules and outside code may use is named here, so the
 * module's internals stay private (see .dependency-cruiser.cjs).
 */
export { ClientManagementModule } from './ClientManagementModule';

// --- public API used by other modules and by code outside admin/modules ---
export { clientApi } from './api';
export { ClientManagementSkeleton } from './components/ClientManagementSkeleton';
export { ClientOverviewTab } from './components/ClientOverviewTab';
export { useMaintenanceCronProcessor } from './hooks/useMaintenanceCronProcessor';
export { fetchClientList } from './hooks/useClientList';
export { normalizeClientProfileKv } from './normalizeClientProfileKv';
export type { ApiUser, Client } from './types';
