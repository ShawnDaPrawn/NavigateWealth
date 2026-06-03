/**
 * Advice Engine Module - Routes (Phase 5 decomposition).
 * Mounts 2 focused sub-routers extracted from the original 1,210-line file.
 */

import { Hono } from 'npm:hono';
import fnaRoutes from './advice-engine-fna-routes.ts';
import roaRoutes from './advice-engine-roa-routes.ts';

const app = new Hono();

app.route('/', fnaRoutes);
app.route('/', roaRoutes);

export default app;
