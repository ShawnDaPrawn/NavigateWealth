/**
 * P8.9 — Decline flow.
 *
 * Opens the public signer page with a valid token, locates the decline
 * action (a first-class control on the signing toolbar — see Phase 4),
 * and submits a reason. Verifies that the page transitions to the
 * "rejected" terminal state.
 */

import { test, expect } from '@playwright/test';

const token = process.env.E2E_SIGNER_DECLINE_TOKEN;

test.describe('signer — decline document', () => {
  test.skip(!token, 'Set E2E_SIGNER_DECLINE_TOKEN to run the decline spec.');

  test('signer can decline with a reason and reach the rejected screen', async ({ page }) => {
    await page.goto(`/sign?token=${token}`);

    // Wait for the signing surface to settle.
    await expect(page.getByRole('main')).toBeVisible({ timeout: 30_000 });

    // The decline trigger is exposed as a button labelled either
    // "Decline" or "Reject". Use a flexible regex so future copy
    // changes don't immediately break this spec.
    const decline = page.getByRole('button', { name: /decline|reject/i }).first();
    await expect(decline).toBeVisible({ timeout: 15_000 });
    await decline.click();

    const reasonField = page.getByRole('textbox', { name: /reason/i }).first();
    await reasonField.fill('Automated E2E rejection — please ignore.');

    await page.getByRole('button', { name: /confirm|submit|send/i }).first().click();

    // Final terminal screen.
    await expect(
      page.getByRole('main').getByText(/declined|rejected|not signed/i),
    ).toBeVisible({ timeout: 30_000 });
  });
});
