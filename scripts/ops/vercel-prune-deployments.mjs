/**
 * Delete retained Vercel deployments that are no longer worth their storage.
 *
 * WHY THIS EXISTS
 * ---------------
 * Vercel's "Deployment Storage" allowance (10 GB on the free tier) is the sum
 * of every RETAINED deployment's build output — not the size of the live site,
 * and nothing to do with traffic, despite the "Your site is growing!" framing
 * of the email that announces you have filled it.
 *
 * This project's `dist/` measures ~74 MB. A sampled 26-hour window carried 20
 * deployments, 13 of them per-push previews, so the meter climbs by roughly
 * 1.5 GB/day and crosses 10 GB in about a week. Nothing reclaims that on its
 * own: a preview deployment for a branch that merged months ago is still
 * holding its 74 MB.
 *
 * A preview's whole value is reviewing an open pull request. Once the PR
 * closes, the deployment is pure storage cost, which makes deletion-on-close
 * the cheapest structural fix available — it keeps previews exactly as useful
 * as they are today and stops them accumulating forever.
 *
 * WHAT IT WILL NEVER DELETE
 * -------------------------
 * These are enforced in `isProtected()` below, not merely by the caller's
 * choice of flags, because a wrong deletion here takes down a live site:
 *
 *   - anything with `target: "production"`;
 *   - the project's CURRENT production deployment, re-read from the API on
 *     every run rather than inferred from the listing;
 *   - anything still in flight (BUILDING, QUEUED, INITIALIZING) — deleting one
 *     races the build that is producing it;
 *   - anything on the repository's default branch.
 *
 * USAGE
 *   # what a PR-close cleanup would remove, without removing it
 *   node scripts/ops/vercel-prune-deployments.mjs --branch some/branch --dry-run
 *
 *   # the real thing (what the workflow runs)
 *   node scripts/ops/vercel-prune-deployments.mjs --branch some/branch
 *
 *   # one-off sweep of the accumulated backlog, keeping a fortnight of previews
 *   node scripts/ops/vercel-prune-deployments.mjs --older-than 14 --dry-run
 *
 * ENVIRONMENT
 *   VERCEL_TOKEN       required — https://vercel.com/account/tokens
 *   VERCEL_PROJECT_ID  required — prj_… (Project Settings → General)
 *   VERCEL_TEAM_ID     required for team-scoped projects — team_…
 *
 * Exits 0 on success (including "nothing to do"), 1 on a configuration or API
 * error. A single failed deletion is reported and does not abort the run: the
 * next scheduled cleanup will retry it, and taking the whole job red over one
 * 429 would hide the deletions that did succeed.
 */

const API = 'https://api.vercel.com';

const IN_FLIGHT_STATES = new Set(['BUILDING', 'QUEUED', 'INITIALIZING']);

function parseArgs(argv) {
  const args = { dryRun: false, branch: null, olderThanDays: null, keep: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--branch') args.branch = argv[++i];
    else if (arg === '--older-than') args.olderThanDays = Number(argv[++i]);
    else if (arg === '--keep') args.keep = Number(argv[++i]);
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const token = () => requireEnv('VERCEL_TOKEN');

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${init.method ?? 'GET'} ${path} -> ${response.status} ${body.slice(0, 300)}`);
  }
  return response.json();
}

/**
 * The listing endpoint pages with `until`, an exclusive upper bound on
 * `created`. `pagination.next` carries the timestamp to resume from; it is
 * null on the last page. Without following it, a backlog sweep would only ever
 * see the newest 100 deployments and would look like it had finished.
 */
async function listDeployments({ projectId, teamId, branch }) {
  const deployments = [];
  let until = null;

  for (;;) {
    const query = new URLSearchParams({ projectId, limit: '100' });
    if (teamId) query.set('teamId', teamId);
    if (branch) query.set('meta-githubCommitRef', branch);
    if (until) query.set('until', String(until));

    const page = await api(`/v6/deployments?${query}`);
    const batch = page.deployments ?? [];
    deployments.push(...batch);

    until = page.pagination?.next;
    if (!until || batch.length === 0) break;
  }

  return deployments;
}

/** The deployment currently serving production, read fresh rather than guessed. */
async function currentProductionId({ projectId, teamId }) {
  const query = new URLSearchParams();
  if (teamId) query.set('teamId', teamId);
  const project = await api(`/v9/projects/${projectId}?${query}`);
  const production = project.targets?.production;
  return production?.id ?? production?.uid ?? null;
}

function isProtected(deployment, { productionId, defaultBranch }) {
  const id = deployment.uid ?? deployment.id;
  if (deployment.target === 'production') return 'production target';
  if (productionId && id === productionId) return 'current production deployment';
  if (IN_FLIGHT_STATES.has(deployment.state)) return `in flight (${deployment.state})`;
  const ref = deployment.meta?.githubCommitRef;
  if (ref && ref === defaultBranch) return `default branch (${defaultBranch})`;
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('See the header of this file for usage.');
    return;
  }

  if (!args.branch && args.olderThanDays == null) {
    throw new Error('refusing to run unscoped — pass --branch <ref> or --older-than <days>');
  }
  if (args.olderThanDays != null && !Number.isFinite(args.olderThanDays)) {
    throw new Error('--older-than expects a number of days');
  }

  const projectId = requireEnv('VERCEL_PROJECT_ID');
  const teamId = process.env.VERCEL_TEAM_ID ?? '';
  const defaultBranch = process.env.VERCEL_DEFAULT_BRANCH ?? 'main';

  const productionId = await currentProductionId({ projectId, teamId });
  const all = await listDeployments({ projectId, teamId, branch: args.branch });

  const cutoff =
    args.olderThanDays == null ? null : Date.now() - args.olderThanDays * 24 * 60 * 60 * 1000;

  const candidates = [];
  for (const deployment of all) {
    const reason = isProtected(deployment, { productionId, defaultBranch });
    if (reason) continue;
    if (cutoff != null && deployment.created >= cutoff) continue;
    candidates.push(deployment);
  }

  // Newest first, so --keep retains the most recent previews.
  candidates.sort((a, b) => b.created - a.created);
  const doomed = args.keep > 0 ? candidates.slice(args.keep) : candidates;

  const scope = args.branch ? `branch ${args.branch}` : `older than ${args.olderThanDays}d`;
  console.log(
    `[vercel-prune] ${all.length} deployment(s) listed for ${scope}; ` +
      `${doomed.length} eligible for deletion${args.dryRun ? ' (dry run)' : ''}`,
  );

  let deleted = 0;
  let failed = 0;

  for (const deployment of doomed) {
    const id = deployment.uid ?? deployment.id;
    const age = Math.round((Date.now() - deployment.created) / 86_400_000);
    const label = `${id} ${deployment.url} (${deployment.state}, ${age}d)`;

    if (args.dryRun) {
      console.log(`  would delete ${label}`);
      continue;
    }

    try {
      const query = new URLSearchParams();
      if (teamId) query.set('teamId', teamId);
      await api(`/v13/deployments/${id}?${query}`, { method: 'DELETE' });
      deleted += 1;
      console.log(`  deleted ${label}`);
    } catch (error) {
      failed += 1;
      console.warn(`  FAILED ${label}: ${error.message}`);
    }
  }

  if (!args.dryRun) {
    console.log(
      `[vercel-prune] deleted ${deleted}, failed ${failed}` +
        (failed ? ' — the next run retries these' : ''),
    );
  }
}

main().catch((error) => {
  console.error(`[vercel-prune] ${error.message}`);
  process.exit(1);
});
