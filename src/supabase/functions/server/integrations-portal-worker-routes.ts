/**
 * Portal worker API — the composition root. The route slices live in:
 *   integrations-portal-worker-brain-routes.ts     (claim job, runtime, brain loop)
 *   integrations-portal-worker-item-routes.ts      (work items + documents)
 *   integrations-portal-worker-lifecycle-routes.ts (status, live view, OTP, discovery, staging)
 * Slices are mounted in the original registration order.
 */
import { Hono } from 'npm:hono';
import brainRoutes from './integrations-portal-worker-brain-routes.ts';
import itemRoutes from './integrations-portal-worker-item-routes.ts';
import lifecycleRoutes from './integrations-portal-worker-lifecycle-routes.ts';

const app = new Hono();

app.route('/', brainRoutes);
app.route('/', itemRoutes);
app.route('/', lifecycleRoutes);

export default app;
