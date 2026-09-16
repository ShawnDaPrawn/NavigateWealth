# Provider Integration: Why Only Allan Gray Works, and How to Rebuild It

**Date:** 2026-09-16
**Scope:** The product-integration module: the admin Integrations UI, the
`integrations-*` server routes, the Playwright portal worker, and the sync
engine that turns staged rows into policy updates.
**Status:** Assessment and proposal. Nothing in this document is landed.

**Method:** Every claim below is grounded in the code on `main` at the time
of writing, with file references. Two full read-throughs were done: one of the
worker pipeline (`scripts/portal-worker/`, `scripts/provider-adapters/`,
`portal-default-flows.ts`, the brain and job routes) and one of the admin UI
and the server route surface it calls.

---

## TL;DR

The module fails for every provider except Allan Gray because of its design,
not because of missing configuration. It is a **selector-driven scraper** in
which an adviser is expected to hand-author CSS selectors, JSON step arrays
and field bindings per provider, and in which the "brain" is a single Gemini
call consulted only when two selector heuristics have already failed, and only
for the search box and the result row. Allan Gray works because it has a
407-line hand-written adapter that does pixel-geometry extraction. Nothing
else has an equivalent, and the generic path has smart assist switched off.

Three structural fixes, in order, will get provider updates working:

1. **Make the brain drive the run.** Replace the selector walk with a
   goal-driven browser agent that observes the page, decides the next action,
   and records what worked as a per-provider playbook. Promote the existing
   (currently unreachable) LLM page extraction to the primary extractor.
2. **Stop logging in every time.** Run the worker as a persistent process,
   not a 30-minute GitHub Actions job, and persist the browser session per
   provider so OTP happens once per device-trust window, not once per run.
3. **Collapse the UI to three concepts.** Connections, Policies (with a
   per-policy Refresh), and a Review queue. Retire flows, selectors, mappings,
   bindings, run modes and discovery reports from the adviser's view.

Alongside this, evaluate a commercial data feed (Astute FSE in South Africa)
for the large life and investment houses. If it covers most of the sixteen
providers, portal scraping becomes the exception rather than the strategy.

---

## 1. What is actually there

### 1.1 Size

| Area                                       | Lines   |
| ------------------------------------------ | ------- |
| Server `integrations-*.ts` (31 files)      | ~9,300  |
| Admin UI under `product-management/`       | ~4,400  |
| Worker `scripts/portal-worker/` + adapters | ~6,000  |
| **Total**                                  | ~19,700 |

For comparison, the whole thing exists to write a handful of field values into
`policy.data` on `policies:client:{clientId}` (`integrations-sync-engine.ts:607-611`).

### 1.2 The three ingestion paths

There are three separate ways a policy value reaches a client record:

| Path               | Entry                                                           | Goes through staging / review?              |
| ------------------ | --------------------------------------------------------------- | ------------------------------------------- |
| Spreadsheet upload | `POST /upload` (`integrations-upload-routes.ts:59`)             | Yes: `buildSyncRun`                         |
| Portal automation  | worker → `/portal-worker/jobs/:id/stage-items`                  | Yes: same `buildSyncRun`                    |
| Policy document AI | `POST /policy-extraction/apply` (`...extraction-routes.ts:392`) | **No.** Writes `policies:client:*` directly |

The first two converge correctly. The third is a parallel write path with its
own review UI (Document AI tab, client profile dialogs) and its own conflict
model (locked fields). The sync engine then explicitly **ignores locked fields
for portal runs** (`integrations-sync-engine.ts:603`), so a value an adviser
locked after reviewing a statement is overwritten by the next portal job.

### 1.3 Provider coverage

The firm's provider catalog has sixteen names (`provider-logos.ts`). The
worker distinguishes exactly four cases (`portal-default-flows.ts:31-39`):

| Provider        | Adapter                       | Smart assist | Extraction                                  | Status                                        |
| --------------- | ----------------------------- | ------------ | ------------------------------------------- | --------------------------------------------- |
| Allan Gray      | `allan-gray.mjs` (407 l.)     | on           | adapter pixel-geometry snapshot             | Works; protected golden                       |
| BrightRock      | `brightrock.mjs` (243 l.)     | **off**      | adapter grid geometry, no fail-closed check | OTP choreography broken, lives in shared code |
| Capital Legacy  | `capital-legacy.mjs` (403 l.) | on           | adapter tab navigation                      | Untested; no golden flow                      |
| Everything else | none                          | **off**      | `extraction.fields: []`                     | Cannot pass search                            |

The "generic provider" is therefore not a working default. It has no login
URL, no fields, no adapter, and no AI.

### 1.4 What the "brain" really does

`integrations-portal-brain.ts` exposes three routes. Only one is used in
production: `/brain/decide`, a Gemini 2.5 Flash call that picks one element
from up to twenty sanitised candidates for exactly two decisions, "which input
is the search box" and "which row is the result". The worker calls it **only in
the catch block** after the deterministic selector walk has thrown
(`search.mjs:776-783`), and only when the flow has `brain.enabled: true`,
which is false for BrightRock and for the generic template
(`portal-default-flows.ts:209,420`).

Every other stage has no AI at all: login form detection, Cloudflare handling,
the entire OTP and push-approval flow (regex over `body.innerText`,
`otp.mjs:885`), configured navigation, policy-number confirmation, all
production field extraction, and document download.

The one piece of AI that would matter most, LLM extraction of field values
from page text (`/page-extract`, `shadow-extraction.mjs`), is fully built and
**unreachable**: it needs `NW_PORTAL_SHADOW_EXTRACT=1` or
`extraction.shadowLlm: true`, and neither the workflow, any default flow, nor
any UI ever sets them.

### 1.5 Why a new provider stops after login

The concrete walls, in the order a new provider hits them:

1. **Auth checkpoint false positives.** `detectAuthCheckpoint` fires on any
   page text matching `code|verify|authenticator|passcode|...`
   (`otp.mjs:885`). A dashboard with a "verify your details" banner is read as
   an unpassed OTP step. The escape hatch is a hard-coded list of Allan Gray
   and BrightRock page labels (`otp.mjs:264-268`).
2. **OTP field false positives.** `isOtpishControl` treats any `tel`,
   `number`, or `maxlength 4-12` input as an OTP box (`page-utils.mjs:40`),
   so the worker sits in `waiting_for_otp` for ten minutes on a portal with a
   numeric filter.
3. **BrightRock's SMS choreography applies to everyone.**
   `waitForBrightRockOtpDeliveryProgress` and the delivery-choice logic run
   for every provider (`otp.mjs:528,751`). The module header admits this.
4. **Search box ambiguity with the brain off.** `findInputByIntent` needs
   exactly one candidate input (`search.mjs:617`). Two filters on a dashboard
   is a hard failure, and for a generic provider the brain never gets asked.
5. **Policy-number-only search.** `openPolicySearchResult` requires the
   policy number to appear literally in a result row (`search.mjs:737`).
   Portals that search by client ID number or surname cannot pass.
6. **Label-equals-column extraction.** With no adapter, each field becomes
   `{labels: [spreadsheetColumnName]}` (`extraction.mjs:236`) and the value
   must sit in the next `<td>`, a `<dd>`, or the next three siblings. Anything
   else yields "No business values were extracted".

None of these are configuration gaps an adviser could close. They are the
shared engine encoding two providers' DOMs as if they were universal.

### 1.6 The runtime model makes it worse

- **Cold start on every run.** Each job dispatches a fresh GitHub Actions
  run: checkout, `npm ci`, syntax checks, then Chromium
  (`provider-portal-worker.yml:52-77`). One to three minutes gone before
  login, out of a 30-minute cap.
- **Fresh login every run.** The worker never saves or loads Playwright
  `storageState`. Every run is a full login plus OTP or push approval, which
  is the single most fragile step, repeated on every refresh.
- **OTP by polling.** The worker polls a KV key every five seconds for up to
  ten minutes. The code is consume-once, so a mistyped OTP is lost.
- **No resume.** A timed-out run leaves items `in_progress`; only a
  ten-minute stale reclaim on the next dispatch recovers them.
- **The dry-run safety gate is inert** on the hosted path: the guard ends in
  `&& authToken` (`job-runner.mjs:59`), and GitHub Actions has no admin token.

### 1.7 Why the UI feels bloated

The adviser is two levels deep (Admin → Product Configuration → Integrations)
before four sub-tabs, one sheet, and three cards begin. The UI exposes about
thirty distinct concepts: provider, category, credential profile, flow, login
selector, search label, step JSON, mapping, binding, blank behaviour, selector
override, template, staged run, match status, publish status, job, run mode,
item, artifact, discovery report, selector candidate, brain memory, live view,
OTP vs push, policy schedule, extraction, locked field.

The happy path to refresh one value is fourteen steps, and about half require
CSS selectors, a JSON step array, env-var names, or a CLI command with the
worker secret (`PortalJobCard.tsx:461-466`). There is **no per-policy action**:
the smallest unit of work is every policy for a provider and category
(`integrations-sync-engine.ts:169-202`).

The state model contradicts itself. The same four setup steps are computed
twice, once from the unsaved draft and once from the saved flow, so the Setup
tab can say "4 of 4 complete" while Portal Automation says "finish setup"
(`ProviderSetupTab.tsx:231`, `PortalConfigCard.tsx:85-94`). There are four
different "save" verbs that overlap. The header's History button has no
handler (`IntegrationHeader.tsx:60`). A job silently disappears from view if
any raw value in it matches `/retirement annuit/` while an investments
category is selected (`IntegrationsTab.tsx:69-80`).

---

## 2. Why "explaining it better" has not worked

The user's observation that agents "never get it" no matter how the task is
explained is a symptom of the architecture, not of the prompts. The engine
has no place to put provider knowledge except (a) a hand-written adapter or
(b) a CSS selector in config. Any agent asked to "make BrightRock work" is
forced to either add `if brightrock` branches to shared code (which is what
happened in `otp.mjs`) or to guess selectors against a portal it cannot see.
The golden-flow rules then correctly forbid touching the shared engine, which
leaves no legal move. The module has to change shape before any provider work
can succeed.

---

## 3. Proposal

### 3.1 Principle: the brain leads, the config remembers

Invert the current relationship. Today: config drives, AI rescues two
decisions. Proposed: an agent drives every step toward a stated goal, and
successful runs are recorded as a **playbook** per provider that later runs
replay deterministically for speed and cost. When a replay step fails (the
portal changed), the agent takes over from that step, and the playbook is
patched. This is the standard self-healing pattern in current browser-agent
tooling and it is the only approach that scales to sixteen portals without
sixteen adapters.

Concretely, one run becomes:

```text
goal: "Log in to {provider}. Find policy {number} for {client}. Read {fields}.
       Download the latest statement if one is offered."

loop:
  observe  = accessibility tree + screenshot + URL (redacted per current rules)
  decision = model(goal, observe, playbook step if any, history)
           → { action: click|fill|select|press|goto|wait|ask_user_for_otp|done|stuck, target, value }
  act, record
until done | stuck | budget
```

The model sees the same redacted snapshot the brain already receives, so the
privacy posture does not change. The existing `field-semantics.mjs` rules stay
as the validator on extracted values. Allan Gray keeps its adapter until the
agent path matches it on the golden flow, then the adapter is retired.

Extraction becomes the existing `/page-extract` LLM route, promoted from
shadow to primary, with the adapter snapshot demoted to a cross-check.

Model choice: the server already has OpenAI (Responses API with fallback) and
Gemini wired in. Use one per-feature env override, as `ai-model-config.ts`
already provides, so the agent model can be changed without touching the rest
of the product.

### 3.2 Runtime: persistent worker and persistent sessions

- Run the worker as a long-lived polling process on a small container host
  (Fly.io, Railway, or a VPS) using the existing `NW_PORTAL_POLL=1` mode and
  `scripts/Dockerfile.portal-worker`. Keep GitHub Actions as a manual
  fallback only. This removes cold start and the 30-minute wall.
- Persist Playwright `storageState` per provider (and per credential profile)
  encrypted in Supabase after every successful login, and load it on the next
  run. Most SA portals honour a remembered device for weeks. OTP becomes an
  exception path, not a per-run ritual.
- Make jobs resumable per item, and make OTP entry re-readable until
  consumed successfully.

### 3.3 One pipeline

- Route Document AI extraction through the same `buildSyncRun` → review →
  `publishSyncRun` path. Delete the direct write in
  `POST /policy-extraction/apply`.
- Respect locked fields for every source. Remove the `source !== 'portal'`
  exception.
- Add an "observed values" record shape that every source produces (portal,
  statement PDF, spreadsheet, future data feed) so the review queue is one
  screen regardless of origin.

### 3.4 The adviser-facing model: three screens

1. **Connections.** One card per provider: connected / needs sign-in /
   needs OTP / error, last refresh, a Connect button that opens a guided
   sign-in (the agent drives, the adviser only supplies an OTP or taps a
   push approval when asked). No selectors, no flows, no run modes.
2. **Policies.** On every policy in the client profile and in a provider
   list: last refreshed, a Refresh button, and a schedule (weekly, monthly,
   off). Refresh queues a single-policy job.
3. **Review.** One queue of proposed changes from all sources, showing
   current value, proposed value, source and evidence (screenshot crop or
   statement page). Approve, reject, or lock.

Everything in the current four tabs that is not one of those three concepts
becomes either automatic (playbooks, bindings inferred from schema semantics)
or an engineering-only diagnostics view (live view, traces, playbook editor)
reachable from a Connection card's overflow menu, not from the main flow.

### 3.5 Delete list

Once 3.1 to 3.4 land, the following are removed rather than migrated:
`ProviderSetupTab`, `ProviderAdvancedSheet`, `MappingTab`, the discovery
report and "Apply selectors to flow", the run-mode selector, the duplicate
`/portal-jobs/*` vs `/portal-worker/jobs/*` route pairs, the BrightRock
branches in `otp.mjs`, the Allan Gray content sniff in `IntegrationsTab.tsx`,
the Allan Gray name check in `integrations-sync-engine.ts:887`, the inert
dry-run gate, `policyScheduleToDocumentArtifacts` (imported nowhere), and the
flow keys the worker never reads (`otp.mode`, `search.mode`,
`resultPolicyNumberSelector`, `clientListSelector`, `needsDiscovery`).

---

## 4. The alternative to scraping: a data feed

Several of the sixteen providers are large life and investment houses. In
South Africa, Astute Financial Services Exchange sells adviser-facing policy
and portfolio data feeds across many of them, licensed to an FSP. If the firm
can subscribe, the majority of value refreshes become an API call, and portal
automation is reserved for the providers a feed does not cover (the smaller
risk and estate providers such as BrightRock and Capital Legacy). Coverage,
cost and onboarding time must be confirmed commercially. This is a business
decision, not an engineering one, but it should be made before the agent work
is scoped, because it changes which providers the agent must handle first.

---

## 5. Phased plan

Each phase is shippable on its own and leaves Allan Gray working.

| Phase | Deliverable                                                                                                                                                                                                      | Effort | What it proves                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------- |
| 0     | This document. Decide feed vs scrape per provider. Pick the first two non-Allan-Gray providers by policy count.                                                                                                  | S      | Scope                                                     |
| 1     | Persistent worker on a container host. Encrypted `storageState` per provider. Resumable items. Re-readable OTP.                                                                                                  | M      | Allan Gray refreshes without a fresh OTP; no cold start   |
| 2     | Promote `/page-extract` to primary extraction for non-adapter providers, behind a per-provider flag. Field-semantics validation unchanged.                                                                       | S      | Values come from page text, not `<td>` adjacency          |
| 3     | Agent loop for login, checkpoint, search and confirm. Playbook record and replay. Generic providers get smart assist by default. Allan Gray stays on its adapter, compared against the agent on the golden flow. | L      | The two chosen providers stage correct rows               |
| 4     | One pipeline: Document AI through staging; locked fields universal; observed-values record. Per-policy refresh job.                                                                                              | M      | Review queue is one screen                                |
| 5     | New UI: Connections, Policies refresh, Review. Delete the four tabs and the delete list.                                                                                                                         | L      | Adviser path is under five clicks with no technical input |
| 6     | Retire the Allan Gray adapter once the agent matches the golden flow. Add golden flows for each live provider.                                                                                                   | S      | One engine, no provider branches                          |

Phases 1 and 2 are low risk and can start immediately; they do not touch the
adviser UI and they make the current Allan Gray flow more reliable. Phase 3
is where the module changes shape and where the first real BrightRock and
Capital Legacy runs should be attempted.

---

## 6. Decisions needed

1. **Feed or scrape** for the large providers (Section 4). Worth one
   conversation with Astute before scoping Phase 3.
2. **Hosting for a persistent worker.** A small always-on container, roughly
   the cost of a coffee a month, versus staying on GitHub Actions.
3. **First two target providers** after Allan Gray. BrightRock and Capital
   Legacy already have partial adapters, but policy count should decide.
4. **Approval to remove the configuration UI** (Section 3.5) rather than
   keep it alongside the new screens.
