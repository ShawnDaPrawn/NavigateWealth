# Vercel Deployment Storage

**What this is.** What to do when Vercel emails that the team has used 100% of
its included Deployment Storage, why it fills, and the two mechanisms in this
repository that keep it from filling again.

## Read this first: the email is not about traffic

The alert arrives titled **"Your site is growing!"** and suggests congratulating
yourself on the traffic. It is measuring something else entirely.

**Deployment Storage is the sum of every _retained_ deployment's build output.**
Not the size of the live site, not bandwidth, not visits. Every deployment Vercel
still holds — every preview from every push to every branch, going back to the
project's first build — counts its full build output against the allowance,
forever, until something deletes it.

So the meter is `size of dist/` × `number of retained deployments`, and both
factors are ours to control.

## The numbers for this project

Measured, not estimated. `npm run bundle:check` already tracks the build size
and prints `totalDistBytes`; `du -sh dist` reports a couple of MB more because
it counts block allocation rather than bytes.

| Factor                       | Value                                        |
| ---------------------------- | -------------------------------------------- |
| `dist/` per deployment       | **~71 MB** (74 MB on disk)                   |
| — `dist/img/`                | 36 MB (380 webp + 380 avif responsive sizes) |
| — `dist/assets/`             | 26 MB (~13 MB JS in 334 chunks, ~13 MB webp) |
| — `dist/brand-assets/`       | 12 MB (28 PNGs, up to 1.5 MB each)           |
| Deployments in a sampled 26h | **20** (13 preview, 7 production)            |
| Implied fill rate            | **~1.5 GB/day → 10 GB in about a week**      |

The dominant term is the deployment count, not the build size. This repository's
cadence is agent- and Dependabot-driven, so most of those 20 were per-push
previews on pull-request branches, several of which were comment-only commits.

## What is in place

**1. Builds are skipped when the commit cannot change `dist/`.**
`vercel.json` sets `ignoreCommand` to `scripts/build/vercel-ignore-build.mjs`,
which compares the commit against the last successful deployment and exits 0
(skip) only when every changed path is one that provably never reaches `dist/`
— `docs/`, `.github/`, `e2e/`, `quality/`, `supabase/`, tests, `*.md`,
`brand-source/`. Anything else, including any error, builds.

To force a build that the rule would skip, put `[vercel build]` anywhere in the
commit message.

**2. Previews are deleted when their pull request closes.**
`.github/workflows/vercel-preview-cleanup.yml` runs
`scripts/ops/vercel-prune-deployments.mjs` on `pull_request: closed`. Production
deployments, the current production deployment, in-flight builds and the default
branch are protected in the script itself, not by the caller's flags.

## One-time setup

The cleanup workflow no-ops with a notice until these exist under
**Settings → Secrets and variables → Actions**:

| Kind     | Name                | Where to get it                       |
| -------- | ------------------- | ------------------------------------- |
| Secret   | `VERCEL_TOKEN`      | <https://vercel.com/account/tokens>   |
| Variable | `VERCEL_PROJECT_ID` | Vercel → Project → Settings → General |
| Variable | `VERCEL_TEAM_ID`    | Vercel → Team → Settings → General    |

Only the token is a credential. The two IDs are identifiers and are repository
variables, readable in run logs.

## Clearing a backlog (what to do when the email arrives)

The workflow only prunes pull requests that close from now on. To reclaim what
has already accumulated:

1. **Actions → Vercel Preview Cleanup → Run workflow.**
2. Set `older_than_days` (14 is a reasonable first pass). **Leave `dry_run`
   ticked.**
3. Read the log. It lists every deployment it would delete, with age and state,
   and deletes nothing.
4. Satisfied, run it again with `dry_run` unticked.

Locally, the same thing:

```bash
export VERCEL_TOKEN=…            # never commit this
export VERCEL_PROJECT_ID=prj_…
export VERCEL_TEAM_ID=team_…

node scripts/ops/vercel-prune-deployments.mjs --older-than 14 --dry-run
```

Deleting a preview deployment removes its `*.vercel.app` URL. Anything linking
to a specific preview — an old PR comment, a bookmarked review link — will 404.
Production and its rollback targets are never touched.

## Also check: orphaned projects

Deployment Storage is billed per **team**, so a forgotten project counts too. As
of 2026-09-09 the team carried two single-deployment projects created during a
2026-04 debugging session and never used since:

- `nw-deploy-fix`
- `nw-frontend-perf-deploy`

Neither is linked to a Git repository and neither serves a domain. Deleting a
project is **Vercel → Project → Settings → General → Delete Project**, and is not
reversible — confirm nothing points at them first.

## If it still fills

In rough order of return, the levers left:

- **`dist/brand-assets/` is 12 MB of PNG logos**, several over 1 MB, for artwork
  that renders at a few hundred pixels. Re-encoding them (there is already a
  `npm run optimize:images` and a `brand-source/`) is the largest single
  reduction available and affects every future deployment. It changes shipped
  brand artwork, so it wants a visual check, not a blind pass.
- **`dist/img/` ships both AVIF and WebP** at every responsive width — 380 files
  each, 36 MB together. Dropping the AVIF set halves that directory at a real
  but modest delivery cost, since AVIF is the smaller format for users whose
  browsers take it.
- **Allowlist the Edge Function source in the ignore rule.**
  `src/supabase/functions/` is not bundled into `dist/` today, and a large share
  of this repository's churn is Edge Function work.
  `vercel-ignore-build.mjs` explains in its header why it is excluded anyway,
  and what would have to be true to include it safely.
- **Shorten preview retention** — run the sweep on a schedule rather than only
  on PR close.

## Related

- [`deployment.md`](deployment.md) — how each part reaches production
- [`../architecture/build-and-seo.md`](../architecture/build-and-seo.md) — what `npm run build` actually does
