/**
 * communication module — public API.
 *
 * Pure re-export barrel: the module component lives in CommunicationModule.tsx.
 * Everything other modules and outside code may use is named here, so the
 * module's internals stay private (see .dependency-cruiser.cjs).
 */

import { lazy } from 'react';
export { CommunicationModule } from './CommunicationModule';

// --- public API used by other modules and by code outside admin/modules ---
export { communicationApi } from './api';
export { CommunicationSkeleton } from './components/CommunicationSkeleton';
export type {
  AttachmentFile,
  Client,
  ClientGroup,
  CommunicationLog,
  SendMessageResponse,
} from './types';

/**
 * The module owns its own code-splitting boundary: its one consumer used to
 * React.lazy the deep path, which is what forced it past this barrel. Lazying
 * it here means that consumer makes an ordinary import of this barrel while
 * the chunk still loads on demand. Render it inside a <Suspense>.
 */
export const CustomGroupManager = lazy(() =>
  import('./components/CustomGroupManager').then((m) => ({ default: m.CustomGroupManager })),
);
