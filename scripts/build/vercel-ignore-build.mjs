/**
 * Vercel Ignored Build Step — skip the build when the commit cannot change `dist/`.
 *
 * THE PROBLEM THIS CLOSES
 * -----------------------
 * Vercel's "Deployment Storage" meter is the sum of every RETAINED deployment's
 * build output, not the size of the live site. This project's `dist/` measures
 * ~74 MB (36 MB `img/` responsive webp+avif, 26 MB `assets/`, 12 MB
 * `brand-assets/`), and every push to every branch parks another copy of it
 * for as long as that deployment is retained.
 *
 * The repository's own cadence is what makes that expensive: a sampled 26-hour
 * window carried 20 deployments (13 preview, 7 production) — roughly 1.5 GB of
 * deployment storage per day, which fills the 10 GB free-tier allowance in
 * about a week. That is the alert the owner received; it had nothing to do
 * with traffic.
 *
 * A meaningful share of those builds could not have changed a single byte of
 * `dist/`: comment-only commits under `docs/`, Dependabot bumps to
 * `.github/workflows/**`, test-only pushes, migration-only work under
 * `supabase/`. Six of a sampled 45 first-parent commits on `main` touched no
 * build-affecting file at all, and the share is higher among the per-push
 * preview builds, where the "fix a stale doc block" commits live.
 *
 * CONTRACT (note the inversion — it is the opposite of a test runner's)
 * --------------------------------------------------------------------
 *   exit 0 -> SKIP the build
 *   exit 1 -> RUN the build
 *
 * FAIL-SAFE DIRECTION IS "BUILD"
 * ------------------------------
 * Every uncertainty resolves to exit 1. A wrongly-skipped build is silent and
 * expensive — production stays on an older commit and nothing says so — while a
 * wrongly-run build costs 74 MB and nothing else. So the rule is an ALLOWLIST
 * of paths proven not to reach `dist/`, and anything else, including an
 * unreadable diff, a shallow clone that cannot see the previous commit, or an
 * outright exception, builds.
 *
 * WHY EACH ALLOWLISTED PATH IS SAFE (verified against this repo, not assumed)
 * --------------------------------------------------------------------------
 * `npm run build` is: copy-pdfjs-assets -> generate-figma-webp ->
 * generate-seo-files -> vite build -> apply-static-seo -> verify-seo-build.
 * The allowlist below is exactly the set of paths that no step in that chain
 * reads and that Vite's entry graph does not reach:
 *
 *   docs/, *.md            Documentation. Nothing in the build chain reads it.
 *   .github/               CI config. Vercel's builder never reads it.
 *   e2e/, quality/         Playwright specs and quality tooling; not bundled.
 *   .vscode/, .cursor/     Editor config.
 *   .husky/                Local git hooks; `prepare` is a no-op on Vercel.
 *   supabase/              Migrations and CLI config for project
 *                          vpjmdsltwrnpefzcgdmz. Deployed by its OWN workflow
 *                          (deploy-supabase-function.yml), never by Vercel.
 *   __tests__/, *.test.*   Vitest files. Vite's production entry graph does not
 *   *.spec.*               reach them, so they cannot alter a chunk.
 *   brand-source/          Source artwork for `npm run optimize:images`, which
 *                          is a MANUAL script and not part of `npm run build`.
 *                          What ships is the already-optimized
 *                          `public/brand-assets/`, which is NOT allowlisted.
 *
 * DELIBERATELY NOT ALLOWLISTED, THOUGH IT WOULD PAY
 * -------------------------------------------------
 * `src/supabase/functions/**` — the Edge Function source — is not bundled
 * either: the only importers are `__tests__` golden files that read it as TEXT,
 * and the `make-server-91ed8379` strings in `dist/` are the client's request
 * URL, not the function's code. Allowlisting it would skip a large share of
 * this repo's churn.
 *
 * It is still excluded, because it sits under `src/` and `src/shared/` already
 * mirrors types from it. The day someone imports one of those modules directly
 * instead of mirroring it, this file becomes a silent stale-deploy bug, and
 * nothing in the type system or the test suite would report it. Add it only
 * with a test that pins the no-import invariant.
 *
 * ESCAPE HATCH
 * ------------
 * Put `[vercel build]` anywhere in the commit message to force a build.
 *
 * USAGE
 *   node ./scripts/build/vercel-ignore-build.mjs             # as Vercel runs it
 *   node ./scripts/build/vercel-ignore-build.mjs --explain   # print the reason
 */

import { execFileSync } from 'node:child_process';

const SKIP = 0;
const BUILD = 1;

const explain = process.argv.includes('--explain');

/**
 * Anchored at the repository root, matched against `git diff --name-only`
 * output (which is always root-relative and forward-slashed, on every OS).
 */
const NON_BUILD_PATTERNS = [
  /^docs\//,
  /^\.github\//,
  /^e2e\//,
  /^quality\//,
  /^\.vscode\//,
  /^\.cursor\//,
  /^\.husky\//,
  /^supabase\//,
  /^brand-source\//,
  /(^|\/)__tests__\//,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /\.md$/,
  /^\.(gitignore|prettierignore|prettierrc\.json|npmrc)$/,
];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

/** True when `ref` is an object this (possibly shallow) clone actually holds. */
function haveCommit(ref) {
  try {
    git(['cat-file', '-e', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * The commit range to inspect.
 *
 * `VERCEL_GIT_PREVIOUS_SHA` is the last SUCCESSFUL deployment for this project,
 * which is the correct base: it means a run of skipped commits is compared
 * against what is actually deployed rather than against the previous commit,
 * so three doc commits in a row cannot combine into a missed build. Vercel only
 * exposes it once an Ignored Build Step is configured, and it is empty on a
 * branch's first deployment.
 *
 * Returns null when no range can be established — first deploy, or a shallow
 * clone that does not hold the base — which the caller treats as "build".
 */
function resolveRange() {
  const previous = process.env.VERCEL_GIT_PREVIOUS_SHA;
  const current = process.env.VERCEL_GIT_COMMIT_SHA || 'HEAD';

  if (previous && haveCommit(previous) && haveCommit(current)) {
    return { base: previous, head: current, source: 'VERCEL_GIT_PREVIOUS_SHA' };
  }
  if (haveCommit('HEAD^')) {
    return { base: 'HEAD^', head: 'HEAD', source: 'HEAD^' };
  }
  return null;
}

function decide() {
  const message = process.env.VERCEL_GIT_COMMIT_MESSAGE || '';
  if (message.includes('[vercel build]')) {
    return { code: BUILD, reason: 'commit message contains [vercel build]' };
  }

  const range = resolveRange();
  if (!range) {
    return { code: BUILD, reason: 'no comparable base commit (first deploy or shallow clone)' };
  }

  let changed;
  try {
    changed = git(['diff', '--name-only', `${range.base}..${range.head}`])
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return { code: BUILD, reason: `could not diff ${range.base}..${range.head}` };
  }

  // An empty diff means the deployment was triggered by something other than a
  // code change (a redeploy, a settings change). Those are rare and cheap to
  // honour, and "changed nothing" is not the same evidence as "changed only
  // safe things" — so build.
  if (changed.length === 0) {
    return { code: BUILD, reason: 'empty diff' };
  }

  const buildAffecting = changed.filter(
    (file) => !NON_BUILD_PATTERNS.some((pattern) => pattern.test(file)),
  );

  if (buildAffecting.length === 0) {
    return {
      code: SKIP,
      reason: `all ${changed.length} changed file(s) are non-build paths (base: ${range.source})`,
      changed,
    };
  }

  return {
    code: BUILD,
    reason: `${buildAffecting.length} of ${changed.length} changed file(s) can affect dist/`,
    changed: buildAffecting,
  };
}

let decision;
try {
  decision = decide();
} catch (error) {
  // Never let a bug here silently stop a deploy.
  decision = { code: BUILD, reason: `ignore-step threw (${error?.message ?? error})` };
}

const verdict = decision.code === SKIP ? 'SKIP build' : 'RUN build';
console.log(`[vercel-ignore-build] ${verdict} — ${decision.reason}`);
if (explain && decision.changed?.length) {
  for (const file of decision.changed.slice(0, 40)) console.log(`  ${file}`);
  if (decision.changed.length > 40) console.log(`  …and ${decision.changed.length - 40} more`);
}

process.exit(decision.code);
