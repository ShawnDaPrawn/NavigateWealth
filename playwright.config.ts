/**
 * P8.9 — Playwright config (OPT-IN).
 *
 * This suite is intentionally NOT part of `npm test`. It runs only when
 * the user explicitly invokes `npm run test:e2e`, because:
 *  1. It needs a running dev server (`npm run dev`) on PLAYWRIGHT_BASE_URL.
 *  2. It exercises real PDF rendering / canvas / browsers, which is too
 *     slow + flaky to run on every Vitest invocation.
 *  3. We don't want it gating CI builds until we have a stable
 *     ephemeral environment (tracked in the production-grade roadmap).
 *
 * The config covers the three top-of-funnel happy paths the e-sign
 * module promises:
 *   - sender: create envelope, place fields, send invites
 *   - signer: open token link, sign successfully
 *   - decline: open token link, refuse to sign
 * Each spec is run on a desktop + mobile viewport so we catch responsive
 * regressions in the signer page (the most-used surface).
 */

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
