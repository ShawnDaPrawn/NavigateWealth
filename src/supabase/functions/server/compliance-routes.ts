/**
 * Compliance Module - Routes (Phase 5 decomposition).
 * Mounts 3 focused sub-routers extracted from the original 1,138-line file.
 */

import { Hono } from 'npm:hono';
import coreRoutes from './compliance-core-routes.ts';
import recordsRoutes from './compliance-records-routes.ts';
import governanceRoutes from './compliance-governance-routes.ts';

const app = new Hono();

app.route('/', coreRoutes);
app.route('/', recordsRoutes);
app.route('/', governanceRoutes);

export default app;
