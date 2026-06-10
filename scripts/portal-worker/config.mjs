/**
 * Portal worker — CLI/env configuration.
 * ======================================
 *
 * Extracted verbatim from scripts/provider-portal-worker.mjs (worker
 * decomposition). Parses CLI args + environment once at import time, prints
 * the help text, and validates the startup contract exactly as the monolith
 * did. Behaviour-preserving move.
 */

const DEFAULT_API_BASE = 'https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/integrations';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`Usage:
  npm run provider:sync -- --job-id <portal-job-id> --auth-token <admin-session-token>
  npm run provider:sync -- --mode discover --job-id <portal-job-id> --auth-token <admin-session-token>
  npm run provider:sync -- --mode dry-run --job-id <portal-job-id> --auth-token <admin-session-token>
  npm run provider:sync -- --poll

Environment:
  NW_API_AUTH_TOKEN                    Admin session token for Navigate Wealth API access
  NW_PORTAL_WORKER_SECRET              Hosted worker secret for live polling mode
  NW_PORTAL_JOB_ID                     Portal job id, if not passed as --job-id
  NW_PORTAL_MODE                       run, discover, or dry-run
  NW_PORTAL_POLL=1                     Poll Supabase for queued jobs continuously
  NW_PORTAL_FORCE_STAGE=1              Allow staging without a prior dry-run-ready job
  NW_PORTAL_SHADOW_EXTRACT=1           Run the LLM page-extraction shadow comparison per policy
  NW_PROVIDER_ALLAN_GRAY_USERNAME      Allan Gray username
  NW_PROVIDER_ALLAN_GRAY_PASSWORD      Allan Gray password
  NW_PROVIDER_BRIGHTROCK_USERNAME      BrightRock username
  NW_PROVIDER_BRIGHTROCK_PASSWORD      BrightRock password
  NW_PLAYWRIGHT_HEADED=1               Optional visible browser mode
  NW_PLAYWRIGHT_RECORD_VIDEO=1         Optional Playwright video capture
  NW_PLAYWRIGHT_RECORD_TRACE=1         Optional Playwright trace capture
`);
  process.exit(0);
}

export const apiBase = String(args['api-base'] || process.env.NW_API_BASE || DEFAULT_API_BASE).replace(/\/$/, '');
export const authToken = String(args['auth-token'] || process.env.NW_API_AUTH_TOKEN || '');
export const workerSecret = String(args['worker-secret'] || process.env.NW_PORTAL_WORKER_SECRET || process.env.PORTAL_WORKER_SECRET || '');
export const initialJobId = String(args['job-id'] || process.env.NW_PORTAL_JOB_ID || '');
export const headed = Boolean(args.headed || process.env.NW_PLAYWRIGHT_HEADED === '1');
export const maxPages = Number(args['max-pages'] || process.env.NW_PLAYWRIGHT_MAX_PAGES || 20);
export const mode = String(args.mode || process.env.NW_PORTAL_MODE || 'run');
export const forceStage = Boolean(args['force-stage'] || process.env.NW_PORTAL_FORCE_STAGE === '1');
export const poll = Boolean(args.poll || process.env.NW_PORTAL_POLL === '1');
export const workerId = String(args['worker-id'] || process.env.NW_PORTAL_WORKER_ID || `worker-${process.pid}`);
export const debugDir = String(args['debug-dir'] || process.env.NW_PORTAL_DEBUG_DIR || '').trim();
export const recordVideo = Boolean(
  args['record-video']
  || process.env.NW_PLAYWRIGHT_RECORD_VIDEO === '1'
  || debugDir,
);
export const recordTrace = Boolean(
  args['record-trace']
  || process.env.NW_PLAYWRIGHT_RECORD_TRACE === '1'
  || debugDir,
);
export const shadowExtractEnabledByEnv = process.env.NW_PORTAL_SHADOW_EXTRACT === '1';
export const shadowExtractDisabledByEnv = process.env.NW_PORTAL_SHADOW_EXTRACT === '0';

if (!['run', 'discover', 'dry-run'].includes(mode)) {
  throw new Error('--mode must be run, discover, or dry-run.');
}

if (!initialJobId && !poll) {
  throw new Error('Missing --job-id or NW_PORTAL_JOB_ID.');
}

if (!authToken && !workerSecret) {
  throw new Error('Missing --auth-token/NW_API_AUTH_TOKEN or --worker-secret/NW_PORTAL_WORKER_SECRET.');
}

export const liveViewIntervalMs = Math.max(3000, Number(process.env.NW_PORTAL_LIVE_VIEW_INTERVAL_MS || 6000));
export const cloudflareResolutionTimeoutMs = Math.max(
  15000,
  Number(process.env.NW_PORTAL_CLOUDFLARE_TIMEOUT_MS || (headed ? 300000 : 15000)),
);
