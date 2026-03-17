/**
 * ****************************************************************************
 * NAVIGATE WEALTH ADMIN SERVER - ENTRY POINT
 * ****************************************************************************
 * 
 * VERSION: 4.0.0
 * TIMESTAMP: 2026-02-21
 * BUILD_STRATEGY: Lazy Dynamic Imports
 * 
 * All route modules are lazily loaded via dynamic import() on first request.
 * This keeps the boot payload minimal and avoids deployment bundle size limits.
 * Only this file, the mount registrars, and the lazy-router helper are loaded
 * at startup — no route handlers, services, or heavy dependencies (pdf-lib,
 * xlsx, etc.) are touched until a request actually hits that module's path.
 * 
 * ****************************************************************************
 */

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import './console-override.ts';

// Route Mounters (lightweight — only register lazy handlers, no static imports)
import { mountCoreRoutes } from './mount-core.ts';
import { mountFnaRoutes } from './mount-fna.ts';
import { mountModuleRoutes } from './mount-modules.ts';

const app = new Hono();

app.use('*', cors({
  // WORKAROUND: Figma Make platform requires open CORS (origin: '*') because
  // the frontend URL is dynamically generated and varies per deployment.
  // In a standalone production deployment, this MUST be restricted to known
  // frontend domains to prevent cross-origin API abuse.
  // Proper fix: Use an environment variable (e.g. ALLOWED_ORIGINS) and parse
  // it into an array of permitted origins.
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-client-info', 'apikey'],
}));

// Health Checks (always available, no lazy loading)
app.get('/make-server-91ed8379', (c) => c.json({ status: 'ok', version: '4.0.0' }));
app.get('/make-server-91ed8379/health', (c) => c.json({ status: 'healthy', version: '4.0.0' }));

// Mount all route groups — these are now synchronous, lightweight calls
// that only register app.all() proxy handlers (no module code is loaded yet)
try {
  mountCoreRoutes(app);
} catch (error: unknown) {
  console.error('[BOOT] Failed to register core routes:', error instanceof Error ? error.message : error);
}

try {
  mountFnaRoutes(app);
} catch (error: unknown) {
  console.error('[BOOT] Failed to register FNA routes:', error instanceof Error ? error.message : error);
}

try {
  mountModuleRoutes(app);
} catch (error: unknown) {
  console.error('[BOOT] Failed to register module routes:', error instanceof Error ? error.message : error);
}

Deno.serve(app.fetch);