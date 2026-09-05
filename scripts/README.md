# Scripts

Grouped by what a script is _for_, because "when would I run this?" is the
question someone actually arrives with. Thirty-six files used to sit loose at
this level, mixing build steps with one-off admin fixups.

| Folder                                 | What lives here                                  | When it runs                                            |
| -------------------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| `build/`                               | Asset and payload preparation                    | During `npm run build`, and in the deploy workflow      |
| `seo/`                                 | The prerender pipeline                           | During `npm run build`; `npm run seo:verify` on its own |
| `brand/`                               | Generating and optimising brand and image assets | By hand, when brand source material changes             |
| `ops/`                                 | Acting on a live environment                     | By hand or from a workflow, deliberately                |
| `uat/`                                 | Launch-time API smoke and acceptance harnesses   | By hand, around a launch                                |
| `dev/`                                 | Local developer conveniences                     | By hand, rarely                                         |
| `portal-worker/`, `provider-adapters/` | The provider automation engine                   | From the worker entry point below                       |

## Why the provider worker is still flat

`provider-portal-worker.mjs`, `provider-portal-runtime-validation.mjs`,
`Dockerfile.portal-worker`, `run-provider-discovery.ps1` and
`start-provider-worker.cmd` deliberately stayed at this level rather than moving
into a folder with the rest.

They are already a coherent cluster with two dedicated subfolders, and their
paths are pinned in three places that would all have to move in step: the
`COPY` lines in `Dockerfile.portal-worker`, the `node --check` loop in
`.github/workflows/provider-portal-worker.yml`, and a test that reads
`scripts/portal-worker` by directory glob
(`src/shared/integrations/__tests__/providerPortalGolden.test.ts`). The churn
buys nothing a reader of this table does not already get.

## Entry points, which look unreferenced and are not

A script nothing else calls is not necessarily dead — an entry point is
_defined_ by having no inbound reference. These are run by a person:

| Script                                              | How it is reached                                                                                                                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start-provider-worker.cmd`                         | Double-clicked on Windows; prompts for a mode and calls `run-provider-discovery.ps1`                                                                                   |
| `run-provider-discovery.ps1`                        | Directly, or via the `.cmd` above                                                                                                                                      |
| `ops/dedupe-kv-key-indexes.sql`                     | Pasted into the Supabase SQL editor. **Still current** — `supabase/migrations/README.md` and migration `20260824223052` both name it as the tool for the manual dedupe |
| `ops/capture-db-shape.sh`, `ops/compare-restore.py` | Called by `.github/workflows/weekly-backup.yml`                                                                                                                        |

## Scripts with no automated caller

These have no reference anywhere — not in `package.json`, a workflow, or a
document. That is not proof they are dead; it does mean nobody has written down
when to run them. Read one before running it, and if you establish that it is
finished work, delete it and say so.

- `ops/enable-super-admin-personal-client.mjs`
- `ops/fix-client-import-xlsx.mjs`
- `ops/publish-security-intake.mjs`
- `brand/generate-brand-vector-assets.mjs`
- `brand/generate-brand-approved-raster-assets.mjs`
- `brand/optimize-large-png-assets.ps1`

Two files that _were_ in this position have been deleted:
`_add-route-defaults.mjs` and `_simplify-approutes-lazy.mjs`, one-shot codemods
whose output has long been committed. Git history keeps them.

## A note on paths

Scripts under `ops/` and `uat/` resolve the repository root from their own
location. They sit two levels below it, so that hop is `'../..'`, not `'..'`.
Getting this wrong is silent: a script writes to `scripts/tmp/` instead of
`tmp/`, or reads an `.env.local` that is not there, and simply behaves as though
the file were missing.

Scripts under `build/`, `seo/` and `brand/` mostly use `process.cwd()` instead,
because npm runs them from the repository root regardless of where they live.
