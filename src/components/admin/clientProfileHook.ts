/**
 * Single seam for the client-management module's useClientProfile hook
 * outside the module: ClientProfileViewerFull and its extracted cards take
 * the hook and its derived type from here, so only this file couples to the
 * module's internals (no-outsider-admin-internals).
 */
import { useClientProfile } from './modules/client-management/hooks/useClientProfile';

export { useClientProfile };

export type ClientProfileHook = ReturnType<typeof useClientProfile>;
