/**
 * Compliance Module - Routes (Phase 5 decomposition).
 * Mounts 3 focused sub-routers extracted from the original 1,138-line file.
 *
 * EVERY route is admin-only, reads included. The reads used to be
 * `requireAuth`, which any self-registered client passes, and they return the
 * firm's registers whole: every client's AML/FICA screening and risk rating,
 * complaints (one of which a client could also edit), statutory returns,
 * POPIA consents, PAIA requests and new-business records. Every caller is in
 * the admin panel (src/components/admin), which only admin and super_admin
 * can open. If a client-facing compliance action is ever needed — lodging a
 * complaint, say — give it its own route that scopes to the caller rather
 * than loosening one of these.
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
