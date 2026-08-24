/**
 * ****************************************************************************
 * NAVIGATE WEALTH ADMIN SERVER - ENTRY POINT
 * ****************************************************************************
 *
 * VERSION: 4.1.0
 * BUILD_STRATEGY: Lazy Dynamic Imports
 *
 * This file is deliberately tiny. Its ONLY module-scope side effects are the
 * console override (which must run before anything can write to stdout) and
 * the `Deno.serve` call itself; everything else — CORS, the request-id
 * middleware, the root error handler, the health probes and the 77 lazy route
 * mounts — is built by `createApp()` in `create-app.ts`, where it can be
 * tested without starting a server (roadmap §5.4 / finding A18).
 *
 * All route modules are lazily loaded via dynamic import() on first request.
 * This keeps the boot payload minimal and avoids deployment bundle size limits.
 * Only this file, the app factory, the mount registrars, and the lazy-router
 * helper are loaded at startup.
 *
 * Security posture (Guidelines §12.4) — enforced in `create-app.ts`:
 *   - CORS origin is locked down to NW_ALLOWED_ORIGINS (comma-separated).
 *     If the env var is unset, startup logs a warning and reflects browser
 *     origins so production cannot be bricked by missing configuration.
 *   - Health endpoints are the ONLY routes that can be reached without a
 *     bearer token; every other sub-router applies `requireAuth` (or a stricter
 *     equivalent) at sub-router scope.
 *   - Every response carries an `x-request-id` header (Phase 1 §22).
 * ****************************************************************************
 */

// MUST stay first: redirects console.log/info to stderr before any other
// module can write to stdout and corrupt an HTTP response body.
import './console-override.ts';

import { createApp } from './create-app.ts';

Deno.serve(createApp().fetch);
