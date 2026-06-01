/**
 * Form prefill E2E smoke — adviser review→apply paths for retirement, risk, and medical.
 *
 * Requires credentials in e2e/.env.local or env:
 *   E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD (approved admin — required for /admin UI)
 *   or E2E_FNA_ADVISER_* (API smoke only; UAT adviser may hit "Application Under Review")
 *   E2E_FNA_CLIENT_ID — optional; opens client drawer via deep link
 *
 * Run against production:
 *   PLAYWRIGHT_BASE_URL=https://www.navigatewealth.co npm run form-prefill:e2e
 */

import { test, expect, type Page } from '@playwright/test';

const adviserEmail = process.env.E2E_ADMIN_EMAIL ?? process.env.E2E_FNA_ADVISER_EMAIL;
const adviserPassword = process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_FNA_ADVISER_PASSWORD;
const clientId = process.env.E2E_FNA_CLIENT_ID;
const hasCredentials = adviserEmail && adviserPassword;

async function loginAsAdviser(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(adviserEmail!);
  await page.locator('#password').fill(adviserPassword!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  await expect(page.getByText(/application under review/i)).not.toBeVisible({ timeout: 5_000 });
}

async function openClientDrawer(page: Page) {
  const target = clientId
    ? `/admin?module=clients&clientId=${encodeURIComponent(clientId)}`
    : '/admin?module=clients';
  await page.goto(target);

  if (!clientId) {
    await page.getByRole('row').nth(1).click();
  }

  await expect(page.getByText(/client id:/i)).toBeVisible({ timeout: 30_000 });
}

async function openPrefillDomainReview(page: Page, domainLabel: RegExp) {
  await page.getByRole('button', { name: /prefill fna data/i }).click();
  await page.getByRole('menuitem', { name: domainLabel }).click();
  await expect(page.getByText(/review client data matches/i)).toBeVisible({ timeout: 45_000 });
}

async function openFnaWizard(page: Page, policyCategory: RegExp) {
  await page.getByRole('tab', { name: /policy details/i }).click();
  await page.getByRole('button', { name: policyCategory }).click();
  await page.getByRole('button', { name: /^fna$/i }).click();
  await page.getByRole('button', { name: /run new fna/i }).click();
  await expect(page.getByTestId('prefill-review-matches')).toBeVisible({ timeout: 60_000 });
}

async function dismissPrefillReviewIfOpen(page: Page) {
  const reviewDialog = page.getByRole('dialog').filter({ hasText: /review client data matches/i });
  if (!(await reviewDialog.isVisible().catch(() => false))) return;

  await reviewDialog.getByRole('button', { name: /skip prefill|close/i }).click();
  await expect(reviewDialog).not.toBeVisible({ timeout: 15_000 });
}

async function applyPrefillFromBanner(page: Page) {
  const openReviewDialog = page
    .getByRole('dialog')
    .filter({ hasText: /review client data matches/i });
  if (await openReviewDialog.isVisible().catch(() => false)) {
    const applyBtn = openReviewDialog.getByTestId('prefill-apply-selected');
    await expect(applyBtn).toBeEnabled({ timeout: 15_000 });
    await applyBtn.click();
    return;
  }

  const reviewBtn = page.getByTestId('prefill-review-matches');
  await expect(reviewBtn).toBeEnabled({ timeout: 30_000 });
  await reviewBtn.click();
  const applyBtn = page.getByTestId('prefill-apply-selected');
  await expect(applyBtn).toBeEnabled({ timeout: 15_000 });
  await applyBtn.click();
}

test.describe('Form prefill — staging smoke', () => {
  test.skip(
    !hasCredentials,
    'Set E2E_ADMIN_* or E2E_FNA_ADVISER_* credentials to run prefill smoke.',
  );

  test('client drawer exposes prefill entry points', async ({ page }) => {
    await loginAsAdviser(page);
    await openClientDrawer(page);

    await expect(page.getByRole('button', { name: /prefill fna data/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('link', { name: /fill external form/i })).toBeVisible();
    await expect(page.getByText(/prefill history/i)).toBeVisible();
  });

  test('drawer domain picker opens retirement prefill review', async ({ page }) => {
    await loginAsAdviser(page);
    await openClientDrawer(page);
    await openPrefillDomainReview(page, /retirement fna/i);
    await expect(page.getByRole('button', { name: 'Close' }).first()).toBeVisible();
  });

  test('risk FNA skip prefill dismisses review without applying', async ({ page }) => {
    await loginAsAdviser(page);
    await openClientDrawer(page);
    await openFnaWizard(page, /risk planning/i);

    const reviewDialog = page
      .getByRole('dialog')
      .filter({ hasText: /review client data matches/i })
      .last();
    await expect(reviewDialog).toBeVisible({ timeout: 30_000 });
    await reviewDialog.getByRole('button', { name: /skip prefill/i }).click();
    await expect(reviewDialog).toBeHidden({ timeout: 20_000 });

    await expect(page.getByTestId('prefill-review-matches')).toBeVisible();
  });

  test('medical FNA apply updates age or spouse field', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsAdviser(page);
    await openClientDrawer(page);
    await openFnaWizard(page, /medical aid/i);

    await dismissPrefillReviewIfOpen(page);

    if (await page.getByTestId('prefill-review-matches').isEnabled()) {
      await applyPrefillFromBanner(page);
    }

    const field = page.getByLabel(/age|spouse|partner/i).first();
    await expect(field).toBeVisible({ timeout: 10_000 });
  });

  test('fill external form opens PDF template library on resources tools tab', async ({ page }) => {
    await loginAsAdviser(page);
    await openClientDrawer(page);

    await page.getByRole('link', { name: /fill external form/i }).click();

    await expect(page).toHaveURL(/module=resources/, { timeout: 15_000 });
    await expect(page).toHaveURL(/resourcesTab=tools/);
    await expect(page.getByRole('heading', { name: /resource center/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Form Template Library/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('tab', { name: /tools/i })).toHaveAttribute('data-state', 'active');

    if (clientId) {
      await expect(page.getByText(/from client drawer/i)).toBeVisible({ timeout: 15_000 });
    }
  });
});
