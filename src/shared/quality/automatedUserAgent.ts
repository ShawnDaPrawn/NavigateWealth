/**
 * Search-engine crawlers and other automated browsers
 * ====================================================
 *
 * Crawlers that render JavaScript (Googlebot, Bingbot and friends) run the SPA
 * like a visitor, and the browser issue reporter dutifully files whatever goes
 * wrong in their renderer. What goes wrong is almost always the same thing:
 * the renderer declines or cuts off the cross-origin API call, and the page
 * logs "GET /publications/articles failed: Network request failed". That was
 * the single most repeated open finding in the Issue Manager in October 2026 —
 * 12 occurrences on the home page, the latest from Googlebot, plus one-offs on
 * article pages from Bingbot — each pass re-opening an issue that had already
 * been closed as noise and minting another high-priority task.
 *
 * None of it is actionable. A crawler is not a user, its fetch policy is not
 * ours to fix, and what it indexes comes from the prerendered HTML the build
 * writes for every public route (docs/runbooks/seo.md), not from these calls.
 *
 * Pure and dependency-free on purpose: the browser reporter uses it to stay
 * quiet, and the Edge Function's public ingest uses it to drop reports from
 * bundles cached before the browser-side check shipped. Both must agree.
 */

/**
 * Crawlers and link unfurlers that name themselves. Deliberately NOT here:
 * `HeadlessChrome`, because our own Playwright smoke runs against production
 * (e2e/form-prefill-smoke.spec.ts) and what they hit is worth seeing.
 */
const NAMED_AGENTS = [
  'googlebot',
  'google-inspectiontool',
  'googleother',
  'storebot-google',
  'adsbot-google',
  'mediapartners-google',
  'apis-google',
  'feedfetcher-google',
  'google-read-aloud',
  'chrome-lighthouse',
  'bingbot',
  'bingpreview',
  'msnbot',
  'adidxbot',
  'yandex',
  'baiduspider',
  'duckduckbot',
  'applebot',
  'slurp',
  'petalbot',
  'bytespider',
  'ahrefsbot',
  'semrushbot',
  'mj12bot',
  'dotbot',
  'seznambot',
  'gptbot',
  'oai-searchbot',
  'chatgpt-user',
  'claudebot',
  'claude-user',
  'perplexitybot',
  'amazonbot',
  'facebookexternalhit',
  'meta-externalagent',
  'twitterbot',
  'linkedinbot',
  'slackbot',
  'discordbot',
  'telegrambot',
  'pinterestbot',
];

/**
 * Self-identifying crawlers follow one convention even when they are not on
 * the list above: a `(compatible; NameBot/1.0; +https://…)` product comment.
 * The `+http` contact URL and a `bot`/`crawler`/`spider` token inside a
 * `compatible;` comment are both signatures no ordinary browser sends.
 */
const CONVENTION_PATTERNS = [/\+https?:\/\//i, /compatible;[^)]*\b[\w-]*(bot|crawler|spider)\b/i];

export function isAutomatedUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  if (NAMED_AGENTS.some((name) => ua.includes(name))) return true;
  return CONVENTION_PATTERNS.some((pattern) => pattern.test(userAgent));
}
