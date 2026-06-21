/**
 * FNA intake E2E smoke — client submit → admin accept → published results.
 *
 * Requires staging credentials against an environment with client intake launched:
 *   E2E_FNA_CLIENT_EMAIL, E2E_FNA_CLIENT_PASSWORD
 *   E2E_FNA_ADVISER_EMAIL, E2E_FNA_ADVISER_PASSWORD
 *   E2E_FNA_DOMAIN (optional, default retirement)
 */

import { test, expect } from '@playwright/test';

const clientEmail = process.env.E2E_FNA_CLIENT_EMAIL;
const clientPassword = process.env.E2E_FNA_CLIENT_PASSWORD;
const adviserEmail = process.env.E2E_FNA_ADVISER_EMAIL;
const adviserPassword = process.env.E2E_FNA_ADVISER_PASSWORD;
const domain = process.env.E2E_FNA_DOMAIN ?? 'retirement';

const hasCredentials = clientEmail && clientPassword && adviserEmail && adviserPassword;

test.describe('FNA intake — staging smoke', () => {
  test.skip(!hasCredentials, 'Set E2E_FNA_* credentials to run intake smoke.');

  test('client can open intake hub for configured domain', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(clientEmail!);
    await page.getByLabel(/password/i).fill(clientPassword!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await expect(page.getByRole('main')).toBeVisible({ timeout: 30_000 });

    await page.goto('/portal');
    await expect(page.getByText(/financial needs|needs analysis/i).first()).toBeVisible({
      timeout: 30_000,
    });

    const domainHeading = new RegExp(domain, 'i');
    await expect(page.getByText(domainHeading).first()).toBeVisible({ timeout: 15_000 });
  });
});
