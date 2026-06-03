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

const router = new Hono();

router.route('/', superAdmin);
router.route('/', userAdmin);
router.route('/', profileCrud);
router.route('/', documents);
router.route('/', status);

export default router;
