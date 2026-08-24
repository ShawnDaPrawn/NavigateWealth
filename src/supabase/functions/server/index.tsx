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
 * The app itself is built by `createApp()` in ./app.ts. Serving it is the only
 * thing this file does, and the only module-scope side effect in either file
 * (roadmap §5.4 / A18) — that is what makes the app testable.
 * ****************************************************************************
 */

import './console-override.ts';
import { createApp } from './app.ts';

Deno.serve(createApp().fetch);
