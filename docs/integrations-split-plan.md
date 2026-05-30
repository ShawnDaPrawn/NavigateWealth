# `integrations.tsx` Split — Execution Plan

> Companion to `docs/PRODUCTION-READINESS.md` Section 4.4. This is the concrete,
> slice-by-slice plan for breaking up the largest Edge Function module. It is
> grounded in the actual file as of 2026-05-30 — not the roadmap's earlier
> estimate.

## Why

`src/supabase/functions/server/integrations.tsx` is **6,613 lines**, **~248 KB**,
with **68 top-level routes** and **~108 helper functions** in a single Hono app.
It is the highest-risk file in the server: large blast radius, hard to review,
slow to load. The goal is to shrink it **without changing behavior**.

## Current wiring (the seam to preserve)

- `mount-core.ts` lazy-mounts it at `/integrations`:
  ```ts
  lazy(app, '/integrations', () => import('./integrations.ts'));
  ```
- `integrations.ts` is a 6-line **extension proxy** that re-exports
  `integrations.tsx` (`export * from './integrations.tsx'; export { default }`).
  This is the established workaround pattern (see `email-service.ts`).
- The module builds one `const app = new Hono()` and `export default app`.

**This split must follow the convention already used by the 59 existing
`*-routes.ts` files in the same directory** (e.g. `calendar-routes.ts`,
`fna-routes.ts`, `product-management-routes.ts`). Each is a self-contained Hono
sub-app mounted via `mount-core.ts`. We are not inventing a new pattern — we are
applying the existing one to the last big hold-out.

## Route inventory (first path segment → count)

| Group | Routes | Suggested target file |
|---|---|---|
| `/portal-worker` | 14 | `integrations-portal-worker-routes.ts` ⚠️ public contract (see below) |
| `/portal-jobs` | 12 | `integrations-portal-job-routes.ts` |
| `/policy-extraction` | 8 | `integrations-policy-extraction-routes.ts` |
| `/portal-flows` | 6 | `integrations-portal-flow-routes.ts` |
| `/policies` | 6 | `integrations-policy-routes.ts` |
| `/schemas` + `/custom-keys` | 4 | `integrations-schema-routes.ts` |
| `/policy-documents` | 3 | `integrations-policy-document-routes.ts` |
| `/provider-terminology` | 2 | `integrations-provider-terminology-routes.ts` |
| `/sync-runs` + `/history` | 3 | `integrations-sync-routes.ts` |
| `/config` + `/providers` + `/` | 4 | `integrations-config-routes.ts` |
| `/upload` + `/template` | 2 | `integrations-upload-routes.ts` |
| `/policy-renewals` + `/recalculate-totals` + `/dashboard-stats` | 3 | `integrations-policy-routes.ts` (fold in) |

Counts are from `grep -oE "app\.(get|post|put|delete|patch)\(..."` on
2026-05-30; re-derive before each slice in case the file has changed.

## Slice order (one group per PR/commit)

Ordered low-risk → high-risk so the mechanism is proven on safe groups first.
**The roadmap (§4.4) mandates: pure move first, behavior change later; one route
group per PR; auth + validation behavior identical; deploy/smoke after each.**

1. **Config/root** (`/config`, `/providers`, `/`) — smallest, low traffic.
2. **Provider terminology** (`/provider-terminology`).
3. **Schemas + custom-keys** (`/schemas`, `/custom-keys`).
4. **Sync/history** (`/sync-runs`, `/history`).
5. **Upload/template** (`/upload`, `/template`).
6. **Policy documents** (`/policy-documents`).
7. **Policy extraction** (`/policy-extraction`) — 8 routes, heavier logic.
8. **Policies** (`/policies`, `/policy-renewals`, `/recalculate-totals`,
   `/dashboard-stats`) — core domain.
9. **Portal flows** (`/portal-flows`).
10. **Portal jobs** (`/portal-jobs`) — 12 routes.
11. **Portal worker** (`/portal-worker`) — 14 routes, **DO LAST**.

### ⚠️ Portal-worker is a public contract

`/portal-worker/*` is consumed by `scripts/provider-portal-worker.mjs`
(`npm run provider:sync` / `provider:worker`). Request/response shapes here are a
contract with that external script — treat as breaking-change-sensitive. Verify
the script still round-trips after this slice before deploying.

## Per-slice checklist (repeat for each group)

1. **Re-derive** the exact routes in the group from the current file (don't
   trust this doc's counts blindly).
2. **Create** `integrations-<group>-routes.ts` as a new Hono sub-app, following
   an existing `*-routes.ts` file as a template (imports: `requireAuth`/
   `requireAdmin` from `auth-mw.ts`, `kv`, loggers, validation utils).
3. **Move** the routes + only the helpers they exclusively use. Leave shared
   helpers in `integrations.tsx` (or extract to `integrations-shared.ts` only if
   a dedicated refactor is scoped — not as a side effect).
4. **Preserve** mount path. Either:
   - mount the new sub-app at the same `/integrations/...` prefix in
     `mount-core.ts`, **or**
   - `app.route('/...', subApp)` from within `integrations.tsx` so external URLs
     are byte-for-byte unchanged.
   Confirm the full external path is identical (`/integrations/<group>/...`).
5. **Keep auth identical** — same middleware, same order, same `requireAdmin` vs
   `requireAuth` per route. This is the security boundary; do not "tidy" it.
6. **Verify** (requires deps installed — see note):
   - `npm run typecheck` (no new errors)
   - `npm test` (green; add a route-presence test if one doesn't exist)
   - `npm run build`
7. **Deploy/smoke** the Edge Function path per AGENTS.md before considering the
   slice done. Do not deploy to production until the moved routes are verified.

## Acceptance (per §4.4)

- Route count in `integrations.tsx` decreases each slice.
- Moved routes return the same shapes (no behavior change).
- `npm run build` passes; `npm test` green.
- External URLs and auth unchanged.

## ⚠️ Environment prerequisite

Every slice needs `npm run typecheck` / `npm test` / `npm run build` to verify
safely. Those require `node_modules`, which currently **cannot be installed in
Claude-on-the-web sessions** because the environment's network policy blocks
`npm.jsr.io` (`@jsr/*` deps → 403, npm aborts the whole install). **Do not start
slicing until that policy is widened** (or run the slices locally). Splitting a
6.6k-line auth-bearing file blind — without test/typecheck verification — is
exactly the unverified-change risk the roadmap warns against.
