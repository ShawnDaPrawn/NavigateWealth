/**
 * Public render smoke — the one e2e journey that runs in CI (roadmap §8.3).
 *
 * WHAT GAP THIS CLOSES
 * --------------------
 * Nothing in CI has ever verified that the application RUNS. `npm run build`
 * proves the bundle compiles; it does not prove the app renders, and the two
 * come apart in exactly the way that hurts:
 *
 *   - a lazy chunk that 404s after a deploy (the stale-`.default` crash class
 *     already recorded in the ledger for 2026-08-24),
 *   - a provider that throws on mount,
 *   - a router change that turns a public marketing route into a blank page.
 *
 * Every one of those ships green today. This spec opens the two highest-traffic
 * public routes in a real browser and asserts they actually painted.
 *
 * WHY THESE TWO ROUTES
 * --------------------
 * `/` and `/get-quote` are the top of the revenue funnel and are reachable with
 * no session, which is what makes this journey credential-free — and therefore
 * the only one of the six specs in this directory that can run in CI at all.
 * The other five are skipped without seeded accounts or signer tokens.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ----------------------------------
 * It submits nothing. A real quote submission would create a live lead and fire
 * two staff emails, because a preview deploy still talks to the production Edge
 * Function. Asserting the wizard renders and is interactive is the honest limit
 * of what can be tested without a seeded environment; the full submit journey is
 * tracked in §8.3 and needs the seeded accounts §7 is blocked on.
 */
import { test, expect } from '@playwright/test';

const ROUTES = [
  { path: '/', mustContain: 'Navigate Wealth' },
  { path: '/get-quote', mustContain: 'Get Your Personalised Quote' },
];

for (const route of ROUTES) {
  test(`${route.path} renders in a real browser`, async ({ page }) => {
    /** Console errors that indicate the app itself broke, not the network. */
    const appErrors: string[] = [];
    page.on('pageerror', (err) => appErrors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();

      // A LAZY-CHUNK FAILURE IS THE HEADLINE CASE THIS SPEC EXISTS TO CATCH, and
      // it reports as "Failed to fetch dynamically imported module". React's
      // error boundary may absorb it, so it can arrive as a console error rather
      // than a pageerror — and on `/` the surviving nav shell still contains
      // "Navigate Wealth" and well over 200 characters, so the other assertions
      // would not notice. Never filter these, whatever else they match.
      if (
        /dynamically imported module|ChunkLoadError|Loading chunk .* failed|Importing a module script failed/i.test(
          text,
        )
      ) {
        appErrors.push(`console: ${text}`);
        return;
      }

      // Otherwise ignore only KNOWN-BENIGN sources, matched by origin rather
      // than by error phrasing:
      //   - Supabase: a preview build carries no session and a sandboxed runner
      //     may not egress to it at all;
      //   - `/_vercel/insights` + `/_vercel/speed-insights`, injected by Vercel's
      //     CDN at serve time and therefore 404 against any other origin.
      //     Verified 2026-08-25: those two were the ONLY 4xx on the homepage.
      if (/supabase\.co|\/_vercel\//i.test(text)) return;

      // A bare resource 404 with no URL attached is browser noise we cannot
      // attribute; the response listener below is the authoritative check for
      // first-party assets.
      if (/^Failed to load resource/i.test(text) && !/localhost|127\.0\.0\.1/i.test(text)) return;

      appErrors.push(`console: ${text}`);
    });

    // First-party assets must all load. A 404 on our own JS chunk is the
    // deploy-time failure this spec is for, and it is far more reliably seen
    // here than in console text.
    page.on('response', (res) => {
      const url = res.url();
      if (res.status() < 400) return;
      if (!/localhost|127\.0\.0\.1/.test(url)) return;
      if (/\/_vercel\//.test(url)) return;
      appErrors.push(`asset ${res.status()}: ${url}`);
    });

    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${route.path} did not return 200`).toBeLessThan(400);

    // The app must actually paint — not just serve index.html. A crashed React
    // tree still returns 200 with an empty <div id="root">.
    await expect(page.locator('body')).toContainText(route.mustContain, { timeout: 20_000 });

    const bodyText = (await page.locator('body').innerText()).trim();
    expect(bodyText.length, `${route.path} rendered an essentially empty page`).toBeGreaterThan(
      200,
    );

    expect(appErrors, `${route.path} raised application errors`).toEqual([]);
  });
}

test('/get-quote presents an interactive wizard, not a static page', async ({ page }) => {
  // The quote wizard is the untested revenue path. This does not submit — see
  // the header — but it does assert the first step is present and interactive,
  // which is the difference between "the route renders" and "the funnel works".
  await page.goto('/get-quote', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toContainText('Choose your service', { timeout: 20_000 });
  await expect(page.locator('body')).toContainText('Your details');

  // Target a NAMED service card. `getByRole('button').first()` was the public
  // navigation, which renders before the wizard — so it stayed green even if
  // every ServiceCard were disabled or its selection broken, i.e. it asserted
  // nothing about the funnel it claimed to cover.
  const serviceCard = page.getByRole('button', { name: /Risk Management/i });
  await expect(serviceCard).toBeVisible();
  await expect(serviceCard).toBeEnabled();

  // And prove the selection actually does something: step 2 collects details,
  // so choosing a service must surface a form control. A card that renders but
  // no longer advances the wizard is a broken funnel that still looks fine.
  await serviceCard.click();
  await expect(page.locator('input, select, textarea').first()).toBeVisible({ timeout: 20_000 });
});
