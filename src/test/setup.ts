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
import { cleanup } from '@testing-library/react';

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
