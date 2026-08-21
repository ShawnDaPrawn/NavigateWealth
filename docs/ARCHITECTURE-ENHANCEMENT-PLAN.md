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
Adopt them as `warn` first (surfaces the backlog without blocking), then flip to
`error` once the current tree is clean.

| #   | Fitness function                                                                                                                   | Enforces                       | Status today                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------ |
| F1  | **Real module boundaries** — fix dependency-cruiser's resolver so first-party TS resolves, then the 3 boundary rules actually fire | §2.2, §2.4 module isolation    | **DONE (Stage A, 2026-08-21)** — resolver fixed; 210 real violations now surfaced as `warn` (109 cross-feature, 100 outsider-admin, 1 spa-edge type-only false positive). Burn down, then flip to `error`. |
| F2  | **File-size budget ratchet** (1000 → 800 → 600, `error`)                                                                           | §2.2 module granularity        | 1000 as `warn`; 60 files over                                                                                                                                                                              |
| F3  | **Router-auth-guard**, extended toward route-granularity                                                                           | §3.4 auth coverage             | Exists, module-granular — keep                                                                                                                                                                             |
| F4  | **Per-layer coverage floors**, SPA + backend separate, ratcheting                                                                  | §8 test pyramid                | One blended floor; backend unmeasured                                                                                                                                                                      |
| F5  | **Type-aware lint**: `no-floating-promises`, `no-misused-promises`, `complexity`, `no-explicit-any` (warn→error)                   | §5 async safety, simplicity    | Not enabled                                                                                                                                                                                                |
| F6  | **Bundle-size budget** per entry/vendor chunk                                                                                      | §2.3 code-splitting discipline | None                                                                                                                                                                                                       |
| F7  | **`npm audit` gated** on high/critical (allowlist-ratcheted like the Deno baseline)                                                | supply chain                   | Advisory (`                                                                                                                                                                                                |     | true`) |
| F8  | **Response-contract validation** present for high-value endpoints                                                                  | §4 single source of truth      | None                                                                                                                                                                                                       |
| F9  | **`verify_jwt=true` guard test** + no-unbounded-`getByPrefix` test                                                                 | §3.4 auth, §6 data             | None                                                                                                                                                                                                       |
| F10 | **One-way-to-do-it linters**: ban raw `fetch` in features, ban `react-toastify`, ban direct `kv_store` import outside repositories | §5 convergence                 | None                                                                                                                                                                                                       |

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
