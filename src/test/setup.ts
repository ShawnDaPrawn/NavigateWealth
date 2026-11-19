/**
 * Global Vitest setup for the SPA test suite (Phase 4).
 *
 * Wired via `setupFiles` in vitest.config.ts so it runs before every test file.
 * Keep this minimal and side-effect-safe — it applies to the whole suite.
 *
 * It guarantees the jsdom DOM is unmounted between tests. React Testing Library
 * already auto-cleans when an `afterEach` global exists (it does under Vitest's
 * `globals: true`), but registering it explicitly makes the guarantee
 * independent of that detection and is harmless where it already runs —
 * `cleanup()` is idempotent.
 */
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// findBy*/waitFor give up after 1s by default. The public pages load their
// Navigator design lazily, and the first test in each suite pays for that
// import: under coverage instrumentation, or on a busy machine, it can take
// just over a second (1109ms observed), which failed "has one H1" tests while
// the page was rendering correctly. Each test already has 15s
// (vitest.config.ts), so waiting up to 5s for an element costs nothing when the
// element arrives and only slows a test that was going to fail anyway.
configure({ asyncUtilTimeout: 5000 });

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverMock;
}

afterEach(() => {
  cleanup();
});
