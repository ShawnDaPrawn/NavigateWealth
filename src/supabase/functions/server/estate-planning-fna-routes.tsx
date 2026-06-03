/**
 * Estate Planning FNA Routes — thin orchestrator (Phase 5 decomposition).
 * Mounts 3 focused sub-routers extracted from the original 1,269-line file.
 */

import { Hono } from 'npm:hono';
import sessionRoutes from './estate-planning-fna-session-routes.ts';
import willRoutes from './estate-planning-fna-will-routes.ts';
import docsRoutes from './estate-planning-fna-docs-routes.ts';

const estatePlanningRoutes = new Hono();

estatePlanningRoutes.route('/', sessionRoutes);
estatePlanningRoutes.route('/', willRoutes);
estatePlanningRoutes.route('/', docsRoutes);

export default estatePlanningRoutes;
