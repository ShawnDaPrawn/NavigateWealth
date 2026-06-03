/**
 * Integration portal-automation routes — thin orchestrator (Phase 5 decomposition).
 * Mounts 3 focused sub-routers extracted from the original 1,923-line file.
 */

import { Hono } from 'npm:hono';
import flowRoutes from './integrations-portal-flow-routes.ts';
import jobsRoutes from './integrations-portal-jobs-routes.ts';
import workerRoutes from './integrations-portal-worker-routes.ts';

const portalRoutes = new Hono();

portalRoutes.route('/', flowRoutes);
portalRoutes.route('/', jobsRoutes);
portalRoutes.route('/', workerRoutes);

export default portalRoutes;
