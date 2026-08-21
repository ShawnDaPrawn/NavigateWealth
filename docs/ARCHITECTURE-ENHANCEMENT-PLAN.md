# Navigate Wealth — Production-Grade Architecture & Codebase Organisation Enhancement Plan

> **What this is.** The target-state blueprint: the architecture and code
> organisation we are converging on, the conventions that get us there, and an
> incremental adoption path that lands without a risky big-bang rewrite.
>
> **How it relates to the other docs.**
>
> - `docs/PRODUCTION-READINESS.md` — the status ledger ("what is on `main`").
> - `docs/ARCHITECTURE-REMEDIATION-PLAN.md` — the security-and-correctness fix
>   list, sequenced by risk (P0…P4). Stops the bleeding.
> - **This doc** — the organisational north star. Where the remediation plan
>   says _what to fix first_, this says _what good looks like_ and _how the
>   codebase should be shaped_ when the dust settles. The two are designed to be
>   worked together: the remediation phases are the vehicle, these conventions
>   are the destination.

---

## 0. Guiding philosophy — read this first

Four rules govern every recommendation below. If a proposed change violates one
of these, it is the wrong change.

1. **Enforce, don't exhort.** Every architectural rule here must become a
   _fitness function_ — an automated CI check that fails the build — or it will
   rot into a doc nobody reads. Navigate Wealth already proves this works (the
   router-auth-guard ratchet, the Deno-error baseline). We extend that model;
   we do not add "please remember to…" guidelines.
2. **Incremental strangler, never big-bang.** This is a 585K-line codebase
   serving live clients. We do **not** rename `src/components/admin/modules` to
   `src/features` across 317K lines for aesthetic tidiness — that is pure churn
   and merge risk. We formalise the conventions where the files already are,
   enforce boundaries in place, and relocate only genuine offenders.
3. **Touch-it-you-fix-it.** New code meets the target on day one. Existing code
   is migrated to the target _when it is next edited for another reason_ — not
   in speculative mass refactors. This keeps diffs small and reviewable and ties
   cleanup to real work.
4. **Preserve what is already good.** The `§3` "do not regress" list in the
   remediation plan is binding here too: strict types, the API-client design,
   the lazy-router, code-splitting, `resolveTrustedRole`, and the funnel-all-DB-
   through-the-edge-function rule are _assets_. The target extends them, never
   replaces them.

---

## 1. Target architecture at a glance

```
                         ┌───────────────────────────────────────────┐
   Browser (SPA)         │  src/app  →  src/features/*  →  src/ui     │
   React + Vite          │        │            │                      │
                         │        └── src/shared (CONTRACTS) ─────────┼──┐
                         └───────────────────────────────────────────┘  │  type-only
                                          │ HTTPS (validated JSON)       │  (enforced)
                                          ▼                              │
   Edge (Deno/Hono)      ┌───────────────────────────────────────────┐  │
   bounded-context       │  transport (route + zValidator)           │  │
   functions             │      → service (business logic)           │◄─┘  runtime + type
                         │          → repository (data access)       │
                         │              → store: Postgres | KV       │
                         └───────────────────────────────────────────┘
                                          │
                                          ▼
   Data                  Relational tables (RLS) for modelled entities;
                         KV only for genuinely schemaless / ephemeral state.
```

Three ideas carry the whole design:

- **Contracts in the middle.** `src/shared` holds the Zod schema + inferred type
  for every cross-boundary entity. The SPA validates responses against it; the
  edge validates requests against it. One definition, both sides.
- **Dependencies flow one direction.** `app → features → ui/shared`; within the
  edge, `transport → service → repository → store`. Never the reverse, never
  sideways into another module's internals. This is enforced, not requested.
- **Bounded contexts are deployables.** The 136K-line mono-function splits along
  its natural seams so a change to marketing lead-gen cannot break e-signatures.

---

## 2. Frontend organisation

### 2.1 Target top-level layout

The move is to make the _roles_ of the top-level folders explicit and
consistent, **keeping existing paths** where a rename would be pure churn.

| Role                                          | Target home                                                                                               | Today                                                                                                    | Action                                                                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| App shell, providers, router, root boundaries | `src/app/`                                                                                                | `src/App.tsx`, `src/AppRoutes.tsx`, `src/components/providers`, `src/router`                             | Consolidate the shell into `src/app/` (small, high-value, low-churn move).                                                                   |
| Feature modules                               | `src/features/<domain>/` (aspirational name) — **keep `src/components/admin/modules/*` in place for now** | `src/components/admin/modules/*` (28 modules), plus scattered `pages/`, `client/`, `portal/`, `modules/` | Formalise the module contract (§2.2) in place; do **not** mass-rename. Apply the contract to the less-structured public/client/portal areas. |
| Design system primitives                      | `src/ui/`                                                                                                 | `src/components/ui/` (50 shadcn/Radix files)                                                             | Rename is optional; the important change is the _rule_ (§2.4) that `ui` never imports a feature.                                             |
| Cross-cutting shared code + contracts         | `src/shared/`                                                                                             | `src/shared/*` (already shared client↔edge)                                                              | Expand to hold contracts (§4); keep as the single source of truth.                                                                           |
| Framework-agnostic utilities                  | `src/lib/`                                                                                                | `src/utils/*`                                                                                            | Keep `src/utils`; the name matters less than the boundary rule that features depend on it, not vice-versa.                                   |

**Net:** one genuinely new folder (`src/app/`), one convention formalised
(`src/features` naming is a north-star label, not a mandate to move 317K lines
today), and the rest is boundary enforcement on the current tree.

### 2.2 The Feature Module contract

Navigate Wealth already has an excellent, near-universal convention (27 of 28
admin modules conform). We make it _the_ standard and enforce it:

```
<module>/
  index.ts        ← the ONLY public surface. Nothing outside the module may
                     import a path deeper than this barrel.
  api.ts          ← thin endpoint wrappers over the shared api client
                     (src/utils/api/client). No raw fetch(). No hand-rolled
                     Authorization headers.
  types.ts        ← module-local types; shared shapes RE-EXPORT from
                     src/shared/contracts (§4), never redefine them.
  queries.ts      ← React Query hooks; keys from the central factory
                     (src/utils/queryKeys.ts).
  components/      ← module-private UI (incl. co-located *Skeleton loaders).
  hooks/           ← module-private hooks.
  __tests__/       ← behaviour tests (see §8).
```

**Rules (all become fitness functions in §9):**

- **No cross-module internals.** Module A imports Module B only via B's
  `index.ts`. Reaching into `B/components/…` or `B/hooks/…` fails CI.
- **No feature code in shared, no shared feature-knowledge.** Logic used by ≥2
  modules moves to `src/shared`; `src/shared` never imports a feature.
- **One data path.** Every network call goes through the shared `api` client so
  it inherits refresh-mutex, retry, `APIError`, and session recovery. The two
  current stragglers (`publications/api.ts` — 76 raw fetches; `social-media/api.ts`
  — 27) are the migration targets.
- **File-size budget.** 1,000-line ceiling now (already the lint rule), ratcheting
  to 800 then 600. The 60 files over 1,000 lines migrate under touch-it-you-fix-it.

### 2.3 App shell & routing

- `src/app/` owns `AppProviders`, the router, and the root/error-boundary tree.
  The catch-all data-router shell (`createAppRouter.tsx`) and the 80-route
  `AppRoutes.tsx` stay as-is — routing is already good (72 lazy pages, mature
  chunk-load recovery). The only change is _location_, for discoverability.
- **Kill the boundary leaks that defeat code-splitting:** `HomeDashboardPage`
  (client-facing) statically importing the 1,600-line admin `ClientOverviewTab`,
  and `AdminDashboardPage` statically importing 19 module-internal skeletons.
  These become CI failures once §9's boundary gate is real.

### 2.4 Design system layer

- `src/components/ui` (→ `src/ui`) is the design system: Radix/shadcn primitives
  - the token set in `globals.css`. **Direction rule:** features import `ui`;
    `ui` imports nothing from features. Enforced.
- Scope vendored editor CSS out of the global bundle — the 1,056 lines of Quill
  CSS in `src/index.css` become a scoped import inside the editor component so
  the marketing homepage stops shipping it.

---

## 3. Backend organisation

### 3.1 The missing layer: transport → service → repository → store

Today three patterns coexist (clean layered, fat route-file, god-service) and
128 files import `kv_store` directly. The target is one layering, enforced:

| Layer          | Responsibility                                                               | Rule                                                                            |
| -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **transport**  | Hono route: auth middleware, `zValidator` request parsing, response shaping. | No business logic, no data access. Never constructs a Supabase client.          |
| **service**    | Business logic, orchestration, external calls.                               | Storage-agnostic. Talks to repositories, never to `kv_store` or `createClient`. |
| **repository** | Data access for one entity/aggregate. Hides KV-vs-Postgres.                  | The _only_ layer that imports `kv_store` / builds queries. Owns key namespaces. |
| **store**      | Postgres (RLS) for modelled entities; KV for schemaless/ephemeral.           | Implementation detail behind the repository.                                    |

Introducing `repositories/` is the highest-leverage backend change: it makes the
KV→Postgres migration (§6) a swap behind an interface instead of a 128-file edit,
and it is where bounded, paginated reads replace unbounded `getByPrefix`.

### 3.2 Split the god files

Decompose along the layering, not by line count:

- `resources-service.ts` (1,702) → `resources-repository` + `legal-documents-service`
  - `rss-service` + `zip-archive-service`. (Nine bounded contexts in one class today.)
- `communication-service.ts` (1,387) → `messaging-service` + `contact-group-service`
  - `email-template-service` + `campaign-service`, over a `communication-repository`.
- `quote-request-routes.ts` (1,580, a single handler) → route (validate + rate-limit)
  → `quote-service` → `quote-repository`, with email templating extracted to a
  reusable, **escaped** builder (see remediation S10).

### 3.3 Bounded-context functions (split the monolith)

One 136K-line function means a marketing typo can take down auth, e-sign, and AI
together, with no canary and no per-domain rollback. Target: a small number of
independently deployable functions grouped by bounded context, sharing code via
`src/shared`:

| Function       | Contexts                                              | Why separate                                                         |
| -------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| `health`       | unauthenticated health/readiness                      | **First split** — lets the gateway flip to `verify_jwt=true`.        |
| `esign`        | envelopes, signers, fields, PDF signing, certificates | Heaviest cold path (~19K lines + crypto), most compliance-sensitive. |
| `integrations` | provider portals, portal worker, honeycomb            | Long-running, distinct auth (worker secret), scraper-adjacent.       |
| `ai`           | advisor, vasco, social/content generation             | Latency- and cost-sensitive; own rate limits.                        |
| `public`       | quote / contact / consultation lead-gen               | Unauthenticated; smallest, most-exposed surface — isolate it.        |
| `core`         | auth, clients, tasks, documents, FNA, everything else | The remainder.                                                       |

This is Stage E of the adoption path — sequenced _after_ the auth keystone, so
it inherits `verify_jwt=true` rather than re-implementing per-function auth.

### 3.4 One auth model

Collapse the six parallel mechanisms (`requireAuth`/`requireAdmin`/`requireSuperAdmin`,
`getAuthContext`, `fna-auth.authenticateUser`, `requirePortalWorker`, local
`verifyAdmin`, shared-secret checks) onto **`auth-mw.ts` as the single source**,
plus one `requireResourceOwnership(resourceOwnerId)` helper modelled on the
reference implementation already in `client-portal-routes.ts:48-57`. `fna-auth`
delegates to `auth-mw`; the anon-key-as-admin branch is deleted (remediation
P1). Gateway `verify_jwt=true` makes router-level auth defence-in-depth rather
than the sole gate.

---

## 4. Shared contracts — one source of truth

The single biggest correctness lever after auth. Today `publications/types.ts`
(1,291 lines) and `advice-engine/types.ts` (1,287) are hand-maintained,
client-only, and drift from the server shapes they mirror.

**Target:**

```
src/shared/contracts/
  client.ts        ← export const ClientSchema = z.object({...});
                     export type Client = z.infer<typeof ClientSchema>;
  application.ts
  esign.ts
  fna.ts
  ...
```

- The **edge** imports the schema and validates requests (`zValidator`) and,
  where it shapes responses, parses outputs.
- The **SPA** imports the same schema (type-only across the SPA→edge boundary,
  already enforced by the ESLint `no-restricted-imports` rule) and — for
  high-value responses (client list, client profile, envelope) — calls
  `Schema.parse()` at the API-client boundary so a server shape change surfaces
  as a caught error, not a silent `undefined` three components deep.
- Duplicated `types.ts` shapes are deleted in favour of re-exports from
  `contracts` under touch-it-you-fix-it.

This closes the audit's "caller-asserted `api.get<T>()`" gap: `<T>` stops being
a promise the compiler can't keep and becomes a validated fact.

---

## 5. Cross-cutting standards — exactly one way to do each

The recurring theme in the audit was N implementations of one concern. The
target is one, enforced:

| Concern                    | The one way                                                                    | Current offenders to converge                                    |
| -------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| **Auth (edge)**            | `auth-mw` + `requireResourceOwnership`; `verify_jwt=true`                      | 6 mechanisms; 8 discarded-`_ctx` handlers; anon-key-as-admin     |
| **Request validation**     | `zValidator` + a `src/shared/contracts` schema                                 | 82/283 mutating routes validated; `zValidator` used 0×           |
| **Error response**         | `{ error, code, requestId, details? }` via a globally-registered `app.onError` | 3 envelope shapes; handler never registered globally             |
| **Logging**                | Structured JSON, `requestId` threaded from context, levels preserved           | emoji strings, request-id read in 6 places, all forced to stderr |
| **Metrics**                | request/error counters + p50/p95 per route family                              | none                                                             |
| **Data fetching (client)** | React Query + central `queryKeys` + shared `api` client                        | 204 raw `fetch()`; 100 hand-rolled `Bearer` headers              |
| **Toasts**                 | `sonner` only                                                                  | `react-toastify` (1 file, silently broken) — delete it           |
| **Rate limiting**          | one KV limiter with atomic increment, IP+identity keys, fail-safe posture      | 6 copies, non-atomic, IP-blind public forms, fail-open           |
| **Config/secrets**         | one config module reading `Deno.env` once; no hardcoded origins                | 71 ad-hoc `SERVICE_ROLE_KEY` reads; 62 hardcoded site URLs       |
| **Images**                 | the optimized webp/avif pipeline, wired into `npm run build`                   | 812 MB raw PNGs shipped; optimizer not in build                  |

---

## 6. Data architecture

- **Repository pattern first** (§3.1) — the interface that makes everything else
  swappable.
- **Promote high-value entities out of JSONB** into real tables with indexes and
  RLS, using the _proven_ dual-write → read-flag → backfill → cutover pattern the
  team already executed for `fna_intake_sessions`. Priority order by value and
  query pressure: `clients`, `applications`, `tasks`, `policies`,
  `communications`. KV stays for genuinely schemaless/ephemeral state (drafts,
  rate-limit counters, transient job markers).
- **Every table has a migration and RLS-on by default.** The unmigrated
  `kv_store_91ed8379`, `personal_client_applications`, and `tasks_91ed8379` get
  committed migrations asserting their RLS state (remediation D1).
- **No unbounded reads on a request path.** `getByPrefix` without a limit is
  banned by fitness function; hot dashboards/lists use paginated repository
  methods with explicit truncation handling.

---

## 7. Observability & operability (the currently-missing spine)

A production-grade system can answer "what happened to request X?" The target:

- Global `app.onError` + `app.notFound` registered in each function's entry;
  mount failures fail the boot (or surface a degraded `/health`) instead of being
  swallowed.
- `requestId` threaded into every log line; structured JSON logs; severity
  preserved.
- Minimal metrics exported per route family.
- A **blocking** post-deploy smoke (health + a couple of gated routes → assert
  200/401) with a rollback path, so ~136K lines never again deploy unverified.

---

## 8. Testing architecture

Target shape (the pyramid, with the layer that actually protects this system
called out):

- **Unit** — `src/shared`, `src/utils`, edge services. Already strong (79–92%
  in shared/utils); keep and extend as logic moves into services.
- **Contract tests — the backbone.** Every route family gets an
  `esign-routes.contract.test.ts`-style test (mount the real Hono app, mock only
  the IO boundary, assert status/authz/validation contracts). **Required for
  every new route.** This is the backend's primary safety net given it deploys
  fast.
- **Component behaviour tests** — interaction and callback wiring, not
  mount-only. Rebalance the 70% of component tests that assert nothing beyond
  "it rendered."
- **E2E** — a handful of _seeded_ critical journeys (e-sign round trip, login,
  quote submit) running unattended in CI. Not the 9 credential-skipped specs of
  today.
- **Coverage floors, reported per layer** (SPA and backend separately), ratcheting
  up — never one blended number that hides a 0%-measured backend.

---

## 9. Fitness functions — the architecture, enforced

This section is the point of the whole plan. Each rule below is a CI gate.

**The three-step adoption pattern** (use this for every fitness function — it is
how `.deno-check-baseline` was already run down to 0, and how F1 landed):

1. **Warn** — turn the rule on at `warn` so it surfaces the real backlog without
   blocking anyone.
2. **Ratchet** — commit the current count to a baseline file and fail CI if the
   count _rises above it_. This is the load-bearing step: warn-only is an
   advisory list that silently rots, whereas a ratchet makes the problem
   strictly non-worsening from day one, before a single violation is fixed.
   Lower the floor as the backlog burns down.
3. **Error** — once the floor reaches 0, flip the rule to `error` and gate on it
   directly for a hard zero.

Skipping step 2 is the trap: it is the difference between "we can see the
problem" and "the problem cannot get worse."

| #   | Fitness function                                                                                                                                                        | Enforces                       | Status today                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **Real module boundaries** — fix dependency-cruiser's resolver so first-party TS resolves, then the 3 boundary rules actually fire, ratcheted against a committed floor | §2.2, §2.4 module isolation    | **DONE + RATCHETED (Stage A, 2026-08-21)** — resolver fixed; 210 real violations surfaced as `warn` (109 cross-feature, 100 outsider-admin, 1 spa-edge type-only false positive) and gated by `.depcruise-baseline` in CI: the job now FAILS if the count rises above the floor. Burn the floor down, then flip the rules to `error` for a hard zero.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| F2  | **File-size budget ratchet** (1000 → 800 → 600, `error`), enforced via the total-warning floor in `.eslint-warning-baseline`                                            | §2.2 module granularity        | **DONE (Stage A, 2026-08-21)** — warnings were wholly ungated, so `max-lines` warned constantly and blocked nothing. Removed 4 dead `eslint-disable` directives (59 → **55**) and ratcheted the TOTAL warning count, which is strictly stronger than a max-lines-only gate. Verified by probe: a new 1,100-line file pushes 55 → 56 and fails CI. Real `max-lines` count is **40** files (the rule skips blanks/comments and exempts `scripts/**`), not the 74 raw-line figure. Split those, then step the budget to 800 → 600, re-baselining each time; at 0 promote to `error`.                                                                                                                                                                                                                                                                                                                                                |
| F3  | **Router-auth-guard**, extended to route-granularity via `route-auth-granular.test.ts` + `.route-auth-baseline`                                                         | §3.4 auth coverage             | **DONE (Stage A, 2026-08-21)** — the module-granular test passes a module if ANY auth marker exists in its import tree, so a new unguarded route in an already-guarded file was invisible (`auth-routes.ts` passes with 10 unguarded routes). The new test counts **routes**: of **1032**, 859 are guarded and **173** have no visible guard; floor ratcheted. Resolves router-scoped `use('*')`, path-scoped `use('/links')`, parent inheritance via `parent.route()`, and in-handler checks. Sanity-checked: it independently re-derives the known `documents.tsx` IDOR. The 173 is a REVIEW LIST (it includes public-by-design routes like `/login`), not a vulnerability count — the value is the delta.                                                                                                                                                                                                                     |
| F4  | **Per-layer coverage floors** — SPA via `vitest.config.ts`, backend via `vitest.config.server.ts`, ratcheting                                                           | §8 test pyramid                | **DONE (Stage A, 2026-08-21)** — the ~136K-line backend was excluded from coverage entirely, so the blended "~31%" described the SPA only and the layer holding auth/PII/e-signatures was unmeasured. First honest backend measurement: **statements 13.43%, branches 9.38%, functions 12.88%, lines 13.79%** (573 tests). Floors set just below and gated in CI as a separate step, so the two layers now report as two numbers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| F5  | **Type-aware lint**: `no-floating-promises` + `no-misused-promises` at **`error`** on the core logic layers                                                             | §5 async safety                | **DONE (Stage A, 2026-08-21)** — nothing gated unawaited promises, a live bug class in an async-heavy codebase. Measured repo-wide first: **1,197** violations, but **1,187 of them sit in `src/components/`** (577 floating + 610 misused, overwhelmingly `onClick={async …}` handlers — real but low-severity and far too many for one pass). The core layers (`utils`/`hooks`/`shared`/`services`/`config`/`router`) had just **10**, all floating promises, all fire-and-forget refreshes in `useSecuritySettings.ts` (9) and `useFnaBatchStatus.ts` (1) — where a dropped rejection silently leaves stale security data. Those were **fixed** with an explicit `void`, so the scope landed at **`error` with zero debt** rather than another warn-baseline. Cost ~10s (repo-wide would be ~83s). `complexity`/`no-explicit-any` deliberately deferred — see note below.                                                     |
| F6  | **Bundle-size budget** — 6 metrics ratcheted against `.bundle-size-baseline.json` (5% headroom) via `npm run bundle:check`                                              | §2.3 code-splitting discipline | **DONE (Stage A, 2026-08-21)** — build output was never measured. Floors: eager entry **2.34 MB / 659 KB gzipped**, total JS 12.51 MB, largest chunk 918 KB, images **864 MB**, dist 882 MB. Immediately surfaced two pre-existing problems: `vendor-tiptap` (353 KB) and `vendor-jspdf` (382 KB) are in the **eager** graph — every marketing visitor downloads an editor and a PDF generator; and `imageBytes` is 864 MB from raw PNGs (A7). Fails closed (exit 2) when `dist/` is missing. **Caught A16 and then verified its fix**: the eager entry fell 655.5 → **496.6 KB gzipped (−24%)** once `jspdf`/`tiptap` stopped being forced into named manual chunks (Vite's preload helper had been hoisted into them). Re-baselined.                                                                                                                                                                                           |
| F7  | **`npm audit` gated** on high/critical, ratcheted against `.npm-audit-baseline`                                                                                         | supply chain                   | **DONE (Stage A, 2026-08-21)** — was fully advisory. Audit then showed 7 high + 2 moderate (the ledger's "0 vulnerabilities" was stale); `npm audit fix` cleared 6 highs + both moderates with no `package.json` change, incl. a runtime `react-router` XSS/open-redirect. Floor is **1** (`sharp`, dev-only, needs a major bump). CI now fails if high+critical rises.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| F8  | **Response-contract validation** — `src/shared/contracts` schemas pinned to their declared types by a compile-time drift assertion                                      | §4 single source of truth      | **MECHANISM DONE (Stage A, 2026-08-21)** — `src/shared/types/` already declared the shared shapes, but types are erased at runtime, so `api.get<T>()` was a claim the compiler could not keep. Adds `parseContract` (**report-only**: never throws, returns the original payload unchanged, so adoption cannot change behaviour) plus `BaseClientSchema`. The schema is pinned to the `BaseClient` interface by an `Equals<>` assertion — **verified to fail typecheck when they drift**. A meta-test enforces that every future schema carries one. **Not yet wired to live endpoints**: the real response shapes cannot be verified from a dev machine, and a wrong schema would emit false violations in production. Wire incrementally per §4, starting with the client list/profile.                                                                                                                                        |
| F9  | **`verify_jwt=true` guard test** + no-unbounded-`getByPrefix` test                                                                                                      | §3.4 auth, §6 data             | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| F10 | **One-way-to-do-it**: `react-toastify` banned at `error`; raw-`fetch` ratcheted via `.raw-fetch-baseline`                                                               | §5 convergence                 | **DONE (Stage A, 2026-08-21)** — `react-toastify` banned at **`error`** after fixing the bug that made it bannable: its toasts were a **silent no-op** (no `<ToastContainer>` mounted anywhere, CSS never imported), so admins saving e-sign reminder settings got no success or failure feedback. Swapped to `sonner` (identical API, already used by every sibling), dependency removed, and dropped from the eager `vendor-feedback` chunk — entry graph 659.3 → **655.5 KB gzipped**. Raw `fetch` is **186** call sites (103 in just `publications/api.ts` and `social-media/api.ts`), far too many to error and too many to warn without drowning F2's 55-warning signal — so it is a **count ratchet** instead: call site #187 cannot land silently. Banning direct `kv_store` imports is deliberately deferred — 177 files import it and the `repositories/` layer it should point at does not exist yet (§3.1, Stage B). |

**Note on F5's deferred halves.** `complexity` and `no-explicit-any` were
considered and deliberately left off. `no-explicit-any` is currently `'off'`,
but `src/shared` and `src/utils` already contain **zero** `any` — the remaining
uses are concentrated in the Deno edge source where `npm:`/`jsr:` interop
forces them, so switching it on repo-wide would produce noise in exactly the
places it cannot be fixed yet. `complexity` needs a threshold chosen from
measured data rather than a guess; pick it when the `max-lines` burn-down (F2)
starts splitting the 40 oversized files, since the same refactors move both
numbers. Neither is a gate worth adding blind.

Delete the CI theatre while here: the two fake test steps that write `.exit`
files nothing reads, and add `continue-on-error` to the quality-snapshot publish
so a Supabase blip can't fail every PR.

---

## 10. Adoption path — strangler, staged, riding the remediation phases

No stage is a big-bang. Each lands in reviewable slices under touch-it-you-fix-it.

| Stage | Theme                                   | Key work                                                                                                                                                      | Rides remediation |
| ----- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **A** | Make the guardrails real (cheap, first) | Fix depcruise resolver (F1); add F2–F10 as `warn`; write the module contract into `CONTRIBUTING`/this doc; `src/app/` consolidation. **No behaviour change.** | Parallel to P0    |
| **B** | Backend spine                           | Introduce `repositories/`; global `onError`; request-id logging + metrics; consolidate auth onto `auth-mw`; `zValidator` on auth + esign.                     | P1 / P2           |
| **C** | Shared contracts                        | Stand up `src/shared/contracts`; response validation on high-value endpoints; delete duplicated `types.ts`.                                                   | P2 / P3           |
| **D** | Data model (long pole)                  | Promote clients/applications/tasks/policies to relational tables via dual-write pattern; bounded reads.                                                       | P3                |
| **E** | Split the monolith                      | `health` sibling → `verify_jwt=true` → carve out `esign`, `integrations`, `ai`, `public`.                                                                     | P1.3 → P2         |
| **F** | Frontend hardening                      | Burn down boundary violations (now visible via F1); split god files; de-dupe the 7 quote wizards; ratchet F2 down.                                            | P4                |

**Throughout:** flip each fitness function from `warn` to `error` the moment its
backlog hits zero. That is the ratchet that makes the gains permanent.

---

## 10a. Stage B — verified preconditions (2026-08-21)

Investigated before implementing. Four findings change the plan; the first
invalidates the obvious approach entirely.

**B1. A root `app.onError` would NOT catch the routes that matter.**
`lazy-router.ts:77` dispatches every sub-router with
`return router.fetch(new Request(...))`. Each sub-router is its own Hono
instance, and Hono's `.fetch()` handles errors _inside_ that call — returning
its own 500 Response rather than propagating the throw. So registering
`onError` on the root app in `index.tsx` covers only the 3 health routes and
the request-id middleware, **not the 584 routes behind lazy mounts**. A root
`try/catch` around `router.fetch()` fails for the same reason: there is no
throw to catch.

_The fix that does work_ is one place: when `lazy-router` caches a module, call
`mod.default.onError(errorHandler)` on it. Sub-routers `export default app`
(a real Hono instance), so `.onError` is available at runtime, and
`honeycomb-routes.ts:27` already uses exactly this pattern — precedent, not
invention. One edit, all 77 mount points.

**B2. `@hono/zod-validator` is not available to the edge function.**
`src/supabase/functions/server/deno.json` pins the import map to `hono`, `zod`,
`@supabase/supabase-js`, `pdf-lib`, `xlsx` — no validator package. Either add an
import-map entry (new third-party dependency in the request path of a financial
backend) or hand-roll ~20 lines over the existing `zod` + `formatZodError`.
Prefer the latter; it adds no supply-chain surface.

**B3. Zod versions are skewed across the boundary — affects F8.**
The SPA resolves `zod@3.25.76`; the edge import map pins `zod@3.24.1`. Edge code
already imports from `src/shared/` (e.g. `auth-routes.ts:22`). Any schema placed
in `src/shared/contracts/` is therefore compiled against two different Zod
versions. Both are 3.x so most usage is compatible, but "one schema, both sides"
is not literally true today. Align the versions before expanding F8 across the
boundary.

**B4. Request-scoped logging cannot be verified from a dev machine.**
`AsyncLocalStorage` is the only way to get `requestId` into the 235
module-scoped loggers without touching every call site, and nothing in the
codebase uses `node:async_hooks` today. Whether it behaves correctly in the
_deployed_ Supabase edge runtime is a runtime question, not a source question —
it cannot be settled from this repo. Do NOT adopt a module-level variable as a
substitute: the isolate serves concurrent requests, so that leaks request IDs
across users. Either prove AsyncLocalStorage on a staging deploy first, or
scope the change to explicitly threading `c` through the handful of
highest-value paths.

## 11. Definition of "production-grade organised" — exit checklist

The target is reached when all of these are _true and CI-enforced_:

- [ ] Dependency-cruiser resolves first-party TS; all 3 boundary rules are
      `error` and green (F1).
- [ ] No module imports another module's internals; every module exposes a barrel.
- [ ] Zero raw `fetch()` / hand-rolled `Bearer` in feature code; all traffic
      through the shared `api` client (F10).
- [ ] Edge layering holds: no route touches `kv_store`; no service constructs a
      Supabase client; data access is behind repositories.
- [ ] One auth model; `verify_jwt=true`; object-level ownership checks on every
      `:id`/`:userId` route (F3, F9).
- [ ] `src/shared/contracts` is the single definition for cross-boundary
      entities; requests validated with `zValidator`, high-value responses
      validated on the client (F8).
- [ ] One error envelope, globally registered; request-id in every log line;
      per-function post-deploy smoke is blocking.
- [ ] Modelled entities live in relational tables with migrations + RLS; no
      unbounded `getByPrefix` on a request path (F9).
- [ ] The monolith is split into bounded-context functions with independent
      deploy/rollback.
- [ ] Coverage floored and reported per layer (SPA + backend), ratcheting (F4);
      every route family has a contract test; critical journeys have seeded CI
      e2e.
- [ ] File-size budget at the target ceiling as `error` (F2); `npm audit` gated
      (F7); bundle-size budgeted (F6); type-aware lint enabled (F5).

---

## Appendix 0 — F2 file-size burn-down worklist

Measured 2026-08-21 via `eslint --format json` (counted lines exclude blanks and
comments, so these are lower than raw `wc -l`; `scripts/**` is exempt from the
rule). **40 files** breach the 1000-line budget. Worst offenders:

| Counted lines | File                                                                               |
| ------------: | ---------------------------------------------------------------------------------- |
|         2,035 | `admin/modules/advice-engine/components/RoAModuleContractManager.tsx`              |
|         1,568 | `admin/modules/product-management/keyManagerConstants.ts`                          |
|         1,504 | `admin/modules/resources/components/EmailSignatureGenerator.tsx`                   |
|         1,467 | `admin/modules/resources/legal-documents/LegalDocumentsManager.tsx`                |
|         1,458 | `modules/wills/WillDraftingFlow.tsx`                                               |
|         1,407 | `pages/quote/components/MedicalAidQuoteWizard.tsx`                                 |
|         1,393 | `supabase/functions/server/quote-request-routes.ts`                                |
|         1,366 | `pages/ProductsServicesDashboardPage.tsx`                                          |
|         1,363 | `admin/modules/client-management/components/clientOverviewUtils.ts`                |
|         1,345 | `admin/modules/client-management/components/compliance/ComplianceResultViewer.tsx` |
|         1,344 | `admin/modules/esign/components/PrepareFormStudio.tsx`                             |
|         1,333 | `supabase/functions/server/resources-service.ts`                                   |

Sequencing notes:

- Several of these are already scheduled by other workstreams — the quote
  wizards by §5/A4 (de-duplication), and `quote-request-routes.ts` /
  `resources-service.ts` by §3.2 (god-file decomposition). Splitting them there
  burns this list down for free; don't schedule the same file twice.
- All 40 currently exceed 800 and 600 as well, so stepping the budget does not
  reclassify any of them — but it **will** surface files that sit between the
  thresholds today and are therefore uncounted. **Re-measure at each step**
  rather than assuming the count only falls; re-baseline
  `.eslint-warning-baseline` as part of the same change.

---

## Appendix A — module template skeleton

```
src/features/<domain>/            (or existing admin/modules/<domain>)
  index.ts                        // public API — the only import surface
  api.ts                          // import { api } from '@/utils/api/client'
  queries.ts                      // React Query hooks; keys from queryKeys.ts
  types.ts                        // re-export from @/shared/contracts where shared
  components/
    <Domain>Panel.tsx
    <Domain>Skeleton.tsx          // co-located loader
  hooks/
  __tests__/
    <domain>.contract.test.ts     // for edge; behaviour tests for UI
```

## Appendix B — edge module template skeleton

```
src/supabase/functions/<function>/<domain>-routes.ts     // transport only
src/supabase/functions/<function>/<domain>-service.ts    // business logic
src/supabase/functions/<function>/<domain>-repository.ts  // data access
   // schema + type imported from src/shared/contracts/<domain>.ts
```

---

_Prepared 2026-08-21 against `main` @ `6303993` as a companion to
`docs/ARCHITECTURE-REMEDIATION-PLAN.md`. This is a target-state blueprint; it
changes no application code and mandates no big-bang move — every step is
incremental, enforced by a fitness function, and reversible._
