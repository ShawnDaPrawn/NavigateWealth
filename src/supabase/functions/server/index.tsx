/**
 * ****************************************************************************
 * NAVIGATE WEALTH ADMIN SERVER - ENTRY POINT
 * ****************************************************************************
 *
 * VERSION: 4.1.0
 * BUILD_STRATEGY: Lazy Dynamic Imports
 *
 * All route modules are lazily loaded via dynamic import() on first request.
 * This keeps the boot payload minimal and avoids deployment bundle size limits.
 * Only this file, the mount registrars, and the lazy-router helper are loaded
 * at startup.
 *
 * Security posture (Guidelines §12.4):
 *   - CORS origin is locked down to NW_ALLOWED_ORIGINS (comma-separated).
 *     If the env var is unset, startup logs a warning and reflects browser
 *     origins so production cannot be bricked by missing configuration.
 *   - Health endpoints are the ONLY routes that can be reached without a
 *     bearer token; every other sub-router applies `requireAuth` (or a stricter
 *     equivalent) at sub-router scope.
 *   - Every response carries an `x-request-id` header (Phase 1 §22).
 * ****************************************************************************
 */

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import './console-override.ts';

import { mountCoreRoutes } from './mount-core.ts';
import { mountFnaRoutes } from './mount-fna.ts';
import { mountModuleRoutes } from './mount-modules.ts';

const app = new Hono();

// ── CORS ──────────────────────────────────────────────────────────────────
// Allow-list from environment (Guidelines §12.4 / Phase 0.3).
// Set `NW_ALLOWED_ORIGINS` in Supabase as a comma-separated list, e.g.
//   NW_ALLOWED_ORIGINS="https://www.navigatewealth.co,https://navigatewealth.co"
//
// IMPORTANT — fail-OPEN fallback (deliberately):
//   When `NW_ALLOWED_ORIGINS` is unset we reflect any origin and log a
//   prominent warning every boot. CORS is defence-in-depth — every
//   non-health route still requires a valid bearer token (`requireAuth`),
//   so a permissive CORS default cannot by itself leak data. Failing
//   closed on CORS would silently break every browser client (the
//   incident captured on 2026-04-18 — dashboard "Network error" + super-
//   admin lockout). Operators MUST set the env var before relying on the
//   strict allow-list as a security boundary.
const rawAllowedOrigins = Deno.env.get('NW_ALLOWED_ORIGINS');
const allowedOrigins: string[] | null = rawAllowedOrigins
  ? rawAllowedOrigins.split(',').map(s => s.trim()).filter(Boolean)
  : null;

if (!allowedOrigins) {
  console.warn(
    '[CORS] NW_ALLOWED_ORIGINS is not set — falling back to permissive ' +
    'origin reflection. Set NW_ALLOWED_ORIGINS to lock this down ' +
    '(see Guidelines §12.4).',
  );
}

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return null;
    if (!allowedOrigins) return origin; // permissive fallback (see above)
    return allowedOrigins.includes(origin) ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-client-info', 'apikey', 'x-request-id'],
  exposeHeaders: ['x-request-id'],
  credentials: false,
  maxAge: 86400,
}));

// ── Request-ID middleware (Guidelines §22 — Observability) ────────────────
app.use('*', async (c, next) => {
  const incoming = c.req.header('x-request-id');
  const requestId = incoming && /^[A-Za-z0-9_\-]{8,64}$/.test(incoming)
    ? incoming
    : crypto.randomUUID();
  c.set('requestId', requestId);
  await next();
  c.header('x-request-id', requestId);
});

// ── Health checks (unauthenticated) ───────────────────────────────────────
// Only these two endpoints are reachable without a bearer token.
app.get('/make-server-91ed8379', (c) => c.json({
  status: 'ok',
  version: '4.1.0',
  requestId: c.get('requestId'),
}));

// Liveness probe — static, never touches downstream services.
app.get('/make-server-91ed8379/health', (c) => c.json({
  status: 'healthy',
  version: '4.1.0',
  requestId: c.get('requestId'),
}));

// Readiness probe — confirms the KV store is reachable so traffic can be served
// (Guidelines §22 — Observability / Phase 1.5).
app.get('/make-server-91ed8379/health/ready', async (c) => {
  try {
    const kv = await import('./kv_store.tsx');
    // Trivial round-trip: read a sentinel key (returns null if missing — that's fine).
    await kv.get('__readiness_probe__');
    return c.json({
      status: 'ready',
      version: '4.1.0',
      requestId: c.get('requestId'),
      checks: { kv: 'ok' },
    });
  } catch (error) {
    return c.json({
      status: 'unready',
      version: '4.1.0',
      requestId: c.get('requestId'),
      checks: { kv: 'fail' },
      error: error instanceof Error ? error.message : 'unknown',
    }, 503);
  }
});

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
