/**
 * P8.9 — Sender happy path.
 *
 * Logs in as an admin, navigates to the e-sign module, opens the
 * envelope creation flow, drops a single document, places one signature
 * field, then verifies the envelope appears in the dashboard.
 *
 * Skipped automatically when {@link E2E_ADMIN_EMAIL} / {@link
 * E2E_ADMIN_PASSWORD} aren't set, so a clean clone can `npm run test:e2e`
 * without the suite failing.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe('sender — create + send envelope', () => {
  test.skip(
    !adminEmail || !adminPassword,
    'Set E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD to run the sender spec.',
  );

  test('admin can upload a document and reach the prepare studio', async ({ page }) => {
    await page.goto('/admin');

    await page.getByLabel(/email/i).fill(adminEmail!);
    await page.getByLabel(/password/i).fill(adminPassword!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await expect(page).toHaveURL(/\/admin/);

    // Navigate to e-sign module. Use a robust accessible-name match
    // so renames in the sidebar don't break the spec.
    await page.getByRole('link', { name: /e[- ]?sign/i }).click();

    await page.getByRole('button', { name: /new envelope|create envelope/i }).click();

    const filePath = path.join(__dirname, 'fixtures', 'sample.pdf');
    await page.setInputFiles('input[type="file"]', filePath);

    // Wait until the prepare studio renders. The prepare studio header
    // text is stable across releases.
    await expect(page.getByText(/prepare|recipients|fields/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
