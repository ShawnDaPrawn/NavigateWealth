/**
 * Admin module chunk warming.
 *
 * Every admin module is code-split, so switching to one is three steps in
 * series: download its chunk, mount it, then let its queries fire. The first
 * step is pure waiting — nothing about it depends on the click — and on a
 * middling connection a 100KB+ chunk is most of the delay between pressing a
 * sidebar item and seeing anything happen.
 *
 * `preloadAdminModule` moves that step earlier. The sidebar calls it on pointer
 * and keyboard intent, and `AdminDataPrefetch` calls it for the module a deep
 * link names, so the chunk downloads while the user is still deciding.
 *
 * WHY THE SPECIFIERS ARE DUPLICATED FROM AdminDashboardPage
 * ---------------------------------------------------------
 * Warming only works if the specifier here resolves to the SAME chunk the page
 * lazy-loads — the bundler keys chunks by specifier, so a near-miss silently
 * downloads a second copy and saves nothing. The two lists are therefore kept
 * identical by a test (`moduleLoaders.test.ts`) that reads both files and fails
 * on drift, rather than by having the page import these and lose the typing on
 * its `React.lazy` component names.
 *
 * Three modules are absent from the page's lazy list because their barrels
 * already export a lazy component (wrapping that again is React error #306, per
 * the note in AdminDashboardPage). They export a `preload…` of their own
 * instead, which is what this calls.
 *
 * SHELL ENTRIES
 * -------------
 * Warming and lazy-loading only split anything if the admin frame — the page,
 * the layout, the sidebar, global search, the badge counts — never imports a
 * module barrel statically. Rollup cannot move a module into its own chunk
 * when it is imported both statically and through `import()`: one static
 * `import { XSkeleton } from './modules/x'` and the whole of module x lands in
 * the page's chunk, so every admin visit downloads it and the `import()` above
 * fetches nothing new. Until 2026-10 that was true of every module: the page
 * pulled in all of them (3.8 MB of JS, including TipTap, Quill and recharts)
 * before the sidebar could paint.
 *
 * So each module the frame needs something from has a second public entry,
 * `modules/<m>/shell.ts`: its skeleton, any background hook the page mounts,
 * and the odd light helper. Rules for a shell entry:
 *
 *   - re-export only from files that are themselves light — never the module
 *     component, never a file that imports an editor, chart or PDF library;
 *   - never re-export from the barrel (`./index`), which would undo the point;
 *   - the frame imports from `shell`, everything else keeps using the barrel.
 *
 * `admin-shell-static-graph.test.ts` walks the frame's static imports and fails
 * if any module barrel is reachable from it.
 */

import type { AdminModule } from './layout/types';

/**
 * One loader per admin module, keyed exactly as the sidebar and `?module=`
 * name it. `Record<AdminModule, …>` means a new module cannot be added to the
 * union without a loader for it.
 */
export const MODULE_LOADERS: Record<AdminModule, () => Promise<unknown>> = {
  dashboard: () => import('./modules/dashboard'),
  clients: () => import('./modules/client-management'),
  personnel: () => import('./modules/personnel'),
  'advice-engine': () => import('./modules/advice-engine'),
  'product-management': () => import('./modules/product-management'),
  resources: () => import('./modules/resources'),
  publications: () => import('./modules/publications'),
  compliance: () => import('./modules/compliance'),
  tasks: () => import('./modules/tasks'),
  notes: () => import('./modules/notes'),
  applications: () => import('./modules/applications'),
  submissions: () => import('./modules/submissions'),
  communication: () => import('./modules/communication'),
  newsletter: () => import('./modules/newsletter'),
  reporting: () => import('./modules/reporting'),
  calendar: () => import('./modules/calendar'),
  'ai-management': () => import('./modules/ai-management'),
  locked: () => import('./modules/locked'),

  // Barrels that lazy-split internally — see the header.
  esign: () => import('./modules/esign').then((m) => m.preloadEsignModule()),
  marketing: () => import('./modules/social-media').then((m) => m.preloadSocialMediaModule()),
  issues: () => import('./modules/issues').then((m) => m.preloadIssuesModule()),
};

/** Modules already warmed this session, so repeated hover costs nothing. */
const warmed = new Set<AdminModule>();

/**
 * Start downloading a module's chunk.
 *
 * Fire-and-forget by design: this is a bet that the user is about to open the
 * module, and a bet that does not pay off must cost them nothing. A failed
 * chunk fetch is swallowed here and re-thrown later by the real `React.lazy`
 * boundary, which has an ErrorBoundary around it and the stale-chunk recovery
 * in `App.tsx` behind that.
 */
export function preloadAdminModule(module: AdminModule): void {
  if (warmed.has(module)) return;
  const load = MODULE_LOADERS[module];
  if (!load) return;

  warmed.add(module);
  void load().catch(() => {
    // Let it be retried if the user actually navigates there.
    warmed.delete(module);
  });
}
