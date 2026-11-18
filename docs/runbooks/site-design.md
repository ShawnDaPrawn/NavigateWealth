# Public site design: the Navigator redesign and how to revert it

The public website (every logged-out page, plus the sign-in, sign-up and
document-signing screens) exists in two designs:

| Design                                              | Code                                              | When it is built                                            |
| --------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| **Navigator** (live since the November 2026 launch) | `src/site/`                                       | default — `VITE_SITE_DESIGN` unset or anything but `legacy` |
| **Legacy** (the site before the redesign)           | `src/components/pages/`, `src/components/layout/` | `VITE_SITE_DESIGN=legacy`                                   |

The client portal and the admin are the same in both.

The switch is read at **build time** in `src/site/design.ts`. Each public route
lazy-loads the module for the chosen design (`src/app/publicPages.ts`), so a
build only ever downloads one design. URLs, SEO tags, structured data, forms
and API calls are identical in both — only the presentation differs.

## Reverting to the old design

Pick the fastest that fits:

1. **Vercel instant rollback (seconds).** Vercel → project `navigate-wealth`
   → Deployments → the last Production deployment from before the launch PR →
   ⋯ → _Instant Rollback_. Nothing else changes; the next merge to `main`
   deploys forward again, so pair it with step 2 if the revert must stick.
2. **Flip the switch (one redeploy).** Vercel → Settings → Environment
   Variables → add `VITE_SITE_DESIGN` = `legacy` for **Production** → redeploy
   the latest Production deployment (Deployments → ⋯ → Redeploy). Every
   later deploy stays on the legacy design until the variable is removed.
3. **The code itself.** The pre-redesign site is preserved, untouched, on
   the `legacy-website-2026-11` branch, and the exact live code at the moment
   of launch is the `legacy-website-final` branch.

Edge Functions are not involved: nothing in the redesign changed the backend.

## Checking a design before it is live

Set `VITE_SITE_DESIGN` for the **Preview** environment only, and every pull
request's Vercel preview builds that design. Locally:
`VITE_SITE_DESIGN=legacy npm run dev` shows the old site; plain `npm run dev`
the redesign.

## Tests

`vitest.config.ts` runs the suite with `VITE_SITE_DESIGN=legacy`, so the live
pages' existing tests keep guarding the design a revert would bring back. The
redesign's tests live in `src/site/__tests__/` and select it by mocking
`src/site/design.ts`.

## Retiring the legacy design

After a settled period (the plan is 30 days without a revert), delete the
legacy page modules, the `byDesign` switch in `src/app/publicPages.ts`, the
legacy branch of `MainLayout`, and `VITE_SITE_DESIGN` handling — in one PR,
with the bundle-size baseline re-written downward.
