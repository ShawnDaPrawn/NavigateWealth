/**
 * Profile Routes — thin orchestrator
 * Mounts focused sub-routers for each domain.
 */

import { Hono } from 'npm:hono';
import superAdmin from './client-management-super-admin-routes.ts';
import userAdmin from './client-management-user-admin-routes.ts';
import profileCrud from './client-management-profile-crud-routes.ts';
import documents from './client-management-documents-routes.ts';
import status from './client-management-status-routes.ts';

// NOTE: a blanket `requireAuth` cannot be applied at this parent yet — the
// client self-service frontend (profileService.ts) still calls
// /profile/personal-info with the PUBLIC anon key rather than the user's
// session token, so gating here would break profile loading. Closing this
// hole requires the frontend auth-token migration (see SECURITY-AUDIT §9).
// In the meantime, defence-in-depth is applied at the handler level:
//  - profile writes strip privileged fields for non-admins (profile-crud)
//  - user-admin routes self-gate with requireAdmin (api-client callers).
const router = new Hono();

router.route('/', superAdmin);
router.route('/', userAdmin);
router.route('/', profileCrud);
router.route('/', documents);
router.route('/', status);

export default router;
