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
 * `public/` overrides all of the above (see ALWAYS_BUILD_PATTERNS): Vite copies
 * it into `dist/` verbatim, so a path there ships whatever its extension.
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
 * Checked BEFORE the allowlist, and wins over it.
 *
 * Vite copies `public/` into `dist/` verbatim, so NOTHING under it can ever be
 * skip-safe whatever its extension. This is a separate list rather than an
 * exclusion bolted onto each rule below because the next rule added would have
 * to remember to carry the same exclusion, and the one that forgot would be
 * silent.
 *
 * Not hypothetical: `public/brand-assets/README.md` exists today and ships as
 * `dist/brand-assets/README.md`. The `*.md` rule below would otherwise have
 * allowlisted it, so editing it — or adding any intended public Markdown
 * download — would have changed the deployment and skipped the build.
 */
const ALWAYS_BUILD_PATTERNS = [/^public\//];

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
 * THERE IS NO `HEAD^` FALLBACK ON VERCEL, and that is the whole point.
 * An earlier revision fell back to `HEAD^` whenever the advertised base was not
 * in the (shallow) clone, which quietly destroyed the guarantee the paragraph
 * above claims. The failure needs two ordinary events: a deployment carrying an
 * app change fails, then the next commit touches only docs. `HEAD^` sees just
 * the docs commit, exits 0, and the app change is never deployed — while the
 * base that would have caught it, the last SUCCESSFUL deployment, sits behind
 * both. An advertised base we cannot read is uncertainty, so it builds.
 *
 * `HEAD^` survives only as a convenience for running this locally, where there
 * is no deployment history to consult and nothing is at stake.
 *
 * Returns null when no range can be established, which the caller treats as
 * "build".
 */
function resolveRange() {
  const previous = process.env.VERCEL_GIT_PREVIOUS_SHA;
  const current = process.env.VERCEL_GIT_COMMIT_SHA || 'HEAD';

  if (previous) {
    if (haveCommit(previous) && haveCommit(current)) {
      return { base: previous, head: current, source: 'VERCEL_GIT_PREVIOUS_SHA' };
    }
    return null;
  }

  // No previous successful deployment was advertised. On Vercel that means a
  // first deployment (or an env we do not understand); either way there is no
  // deployed state to diff against, so build.
  if (process.env.VERCEL) return null;

  if (haveCommit('HEAD^')) {
    return { base: 'HEAD^', head: 'HEAD', source: 'HEAD^ (local)' };
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
    // `--no-renames` is load-bearing, not tidiness. Git detects renames by
    // default, and `--name-only` then prints ONLY the destination: moving
    // `src/app.ts` to `docs/app.ts` reports `docs/app.ts` alone, which the
    // allowlist reads as a docs-only change and skips — while the deletion of
    // `src/app.ts` genuinely changes `dist/`. Disabling detection reports the
    // rename as its two halves, so the source path faces the allowlist too.
    changed = git(['diff', '--no-renames', '--name-only', `${range.base}..${range.head}`])
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
    (file) =>
      ALWAYS_BUILD_PATTERNS.some((pattern) => pattern.test(file)) ||
      !NON_BUILD_PATTERNS.some((pattern) => pattern.test(file)),
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
