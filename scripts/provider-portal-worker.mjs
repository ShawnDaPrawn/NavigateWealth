/**
 * Provider portal worker — entry point.
 * =====================================
 *
 * The worker runtime was decomposed from this 3,600-line monolith into stage
 * modules under scripts/portal-worker/ (behaviour-preserving moves):
 *
 *   config.mjs            CLI/env parsing, help text, startup validation
 *   state.mjs             active job id + job/item warning buffers
 *   api.mjs               integrations API client (claim/status/stage/runtime)
 *   page-utils.mjs        provider-neutral Playwright helpers
 *   debug-artifacts.mjs   NW_PORTAL_DEBUG_DIR snapshots + screenshots
 *   live-view.mjs         throttled live screenshot feed
 *   login.mjs             login form, Cloudflare, configured navigation
 *   otp.mjs               OTP + auth checkpoints (incl. BrightRock quirks)
 *   search.mjs            policy search + brain (smart assist) client
 *   extraction.mjs        field extraction, semantics, fail-closed checks
 *   documents.mjs         document artifact downloads/uploads
 *   discovery.mjs         discover-mode selector reports
 *   shadow-extraction.mjs observe-only LLM page-extraction comparison
 *   queue.mjs             per-policy queue loop
 *   job-runner.mjs        job lifecycle + poll loop
 *
 * Importing config.mjs first preserves the original startup behaviour:
 * --help output and argument validation run before anything else.
 */
import { initialJobId, poll } from './portal-worker/config.mjs';
import { pollForJobs, runJob } from './portal-worker/job-runner.mjs';

(poll ? pollForJobs() : runJob(initialJobId)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
