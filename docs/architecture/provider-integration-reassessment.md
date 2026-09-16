# Provider Integration: Why Only Allan Gray Works, and How to Rebuild It

**Date:** 2026-09-16
**Scope:** The product-integration module: the admin Integrations UI, the
`integrations-*` server routes, the Playwright portal worker, and the sync
engine that turns staged rows into policy updates.
**Status:** Assessment and proposal, not a decision record. Nothing in this
document is landed, and the four questions in Section 6 are still open. When
they close, the outcome gets its own file under `docs/decisions/`.

**Method:** Every claim below is grounded in the code on `main` at the time
of writing, with file references. Two full read-throughs were done: one of the
worker pipeline (`scripts/portal-worker/`, `scripts/provider-adapters/`,
`portal-default-flows.ts`, the brain and job routes) and one of the admin UI
and the server route surface it calls. Where the text describes a provider's
flow, it describes the **shipped default** from `portal-default-flows.ts`.
Saved production flows in KV were not inspected; `getPortalFlow` merges a
saved flow over the default, and the Setup tab can persist a different
smart-assist setting and field mapping. Claims that depend on that are
marked as such.

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

Three structural fixes will get provider updates working. Section 6 puts them
in a shippable order:

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

A commercial data feed was considered and ruled out. Portal automation is
therefore the only channel, which raises the bar: the module has to become a
provider **onboarding system**, not a scraper. Two consequences run through
the plan below. Adding a provider must stop being an engineering task and
become something an adviser does by logging in once while the agent watches.
And every provider needs a defined path even when its portal cannot be
automated, so the statement-upload fallback becomes load-bearing rather than
a side feature.

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
| Everything else | none                          | **off**      | `extraction.fields: []`                     | Not runnable as shipped                       |

"Smart assist" and "Extraction" describe the shipped defaults. An admin can
turn smart assist on in the Setup tab (`ProviderSetupTab.tsx:300`) and a
saved field mapping supplies extraction fields (`extraction.mjs:228-238`),
so a configured provider may not match this row. The walls in Section 1.5
do not depend on that configuration.

The "generic provider" is therefore not a working default. It has no login
URL, no fields, no adapter, and no AI until someone configures each of them.

### 1.4 What the "brain" really does

`integrations-portal-brain.ts` exposes three routes. Only one is used in
production: `/brain/decide`, a Gemini 2.5 Flash call that picks one element
from up to twenty sanitised candidates for exactly two decisions, "which input
is the search box" and "which row is the result". The worker calls it **only in
the catch block** after the deterministic selector walk has thrown
(`search.mjs:776-783`), and only when the flow has `brain.enabled: true`,
which the shipped defaults set to false for BrightRock and for the generic
template (`portal-default-flows.ts:209,420`). The Setup tab can persist it
as true for a saved flow.

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
4. **Search box ambiguity.** `findInputByIntent` needs exactly one
   candidate input (`search.mjs:617`). Two filters on a dashboard is a hard
   failure. With the shipped default, a generic provider's brain is off and
   never gets asked; with it on, the brain still only picks among the
   candidates the same walk produced.
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
sixteen adapters. With no data feed behind it, that scaling property is not
an optimisation; it is the whole plan.

Concretely, one run becomes:

```text
goal: "Log in to {provider}. Find policy {number} for {client}. Read {fields}.
       Download the latest statement if one is offered."

loop:
  observe  = accessibility tree + visible text + URL, redacted with the
             existing sanitiseBrainSnapshot / redactBrainText rules
  decision = model(goal, observe, playbook step if any, history)
           → { action: click|fill|select|press|goto|wait|ask_user_for_otp|done|stuck, target, value }
  act, record
until done | stuck | budget
```

**Privacy.** The observation is text-only by design, so the model receives
the same class of redacted input the brain and the page-extract route already
receive. Screenshots are **not** sent to the model in this proposal. Nothing
in the current code redacts image pixels: `page.screenshot()` and the live
view upload raw frames to Supabase Storage for the adviser's eyes, not to a
model. If a later phase wants vision input (some portals render values in
canvases or images), that is a change in data-processing posture and needs
its own design: pixel-level masking of client identifiers and amounts before
upload, a retention rule, and a note in the POPIA processing record. It is
out of scope here. The existing `field-semantics.mjs` rules stay as the
validator on extracted values. Allan Gray keeps its adapter until the
agent path matches it on the golden flow, then the adapter is retired.

Extraction becomes the existing `/page-extract` LLM route, promoted from
shadow to primary, with the adapter snapshot demoted to a cross-check.

Model choice: the server already has OpenAI (Responses API with fallback) and
Gemini wired in. Use one per-feature env override, as `ai-model-config.ts`
already provides, so the agent model can be changed without touching the rest
of the product.

**Cost shape.** The playbook exists so that model spend is paid once per
provider, not once per policy per month. A first (recording) run costs one
model call per browser action across login, search and confirmation. A replay
run costs none of those, and one extraction call per policy. Steady state is
therefore roughly one call per policy refreshed, with agent calls only when a
portal changes. If a provider's playbook keeps failing, that is a signal to
re-tier it (Section 4), not to raise the budget.

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
  statement PDF, spreadsheet) so the review queue is one screen regardless of
  origin. This is what lets a Tier C provider (Section 4) feel identical to a
  Tier A one from the adviser's side: same review, same audit trail, only the
  source label differs.

### 3.4 The adviser-facing model: three screens

1. **Connections.** One card per provider: how it updates (Section 4's tier,
   in plain words: "updates on its own", "needs you to approve a sign-in",
   "upload a statement"), connection state, last refresh, and a Connect
   button that opens a guided sign-in. In that guided sign-in the agent
   drives and records the playbook; the adviser only supplies an OTP or taps
   a push approval when asked. No selectors, no flows, no run modes. This
   screen is how a new provider gets onboarded, which is why it replaces the
   Provider Setup tab rather than simplifying it.
2. **Policies.** On every policy in the client profile and in a provider
   list: last refreshed, a Refresh button, and a schedule (weekly, monthly,
   off). Refresh queues a single-policy job.
3. **Review.** One queue of proposed changes from all sources, showing
   current value, proposed value, source and evidence (a page snapshot or
   statement page, stored in Supabase Storage for the adviser and never sent
   to a model). Approve, reject, or lock.

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

## 4. Coverage: every provider gets a defined path

With no feed, the honest position is that some of the sixteen portals will
not be fully automatable. A plan that assumes all sixteen will work ends the
same way the current module did: two providers running and the rest in a
permanent "needs discovery" state. So each provider is assigned a **tier**,
the tier is visible on its Connection card, and every tier delivers a working
update path.

| Tier               | How it updates                                                                          | Adviser effort                  |
| ------------------ | --------------------------------------------------------------------------------------- | ------------------------------- |
| **A — unattended** | Saved session plus playbook replay on a schedule                                        | None until the session expires  |
| **B — attended**   | Adviser opens the connection, approves the OTP or push, the agent does the rest         | One approval per refresh cycle  |
| **C — document**   | Adviser uploads the latest statement; AI extraction reads it into the same review queue | One upload per policy per cycle |

A provider moves between tiers as evidence arrives. A provider whose portal
presents a hard bot challenge on every login, or offers no policy-number
search at all, is Tier C and that is a finished answer, not a backlog item.
Capital Legacy is the live example: the worker already fails there on a
Cloudflare challenge (`login.mjs:101-107`), and no amount of selector work
changes that.

**On being blocked.** The adviser has legitimate credentials for every one of
these portals, and the work is reading their own clients' data. The posture
should nonetheless be that of a well-behaved client rather than an arms race:
run at human-like rates, reuse a stored session instead of hammering the
login page, identify the traffic honestly, and stay within whatever each
provider's portal terms allow. Where a provider blocks or forbids automated
access, the answer is to re-tier that provider to C and, if the volume
justifies it, to ask the provider for a proper feed. The answer is not
CAPTCHA-solving services or fingerprint evasion. Those raise legal and FSP
compliance exposure that is out of proportion to refreshing a policy value,
and they break on the next portal change anyway.

**Provider terms are worth one check.** Automated access under an adviser's
own credentials may or may not be permitted by each portal's terms. That is
a question for the firm, not for this document, but it should be answered
before Tier A is switched on for a provider rather than after.

---

## 5. Risks this plan carries

Naming these now because a single-channel strategy has no fallback when one
of them bites.

- **Credential custody.** Sixteen sets of adviser portal credentials, plus
  sixteen saved browser sessions, at rest in Supabase. A saved session is a
  bearer token: whoever holds it is logged in. These need encryption at rest
  with a key the application holds rather than the database, per-provider
  scoping, rotation on adviser departure, and an audit trail of every use.
  Treat a session store leak as equivalent to a credential leak.
- **The worker becomes a single point of failure.** One long-lived process
  now owns every provider refresh. It needs health checks, automatic restart,
  and an alert when the claim loop stops, or refreshes silently stop and
  nobody notices. The current GitHub Actions design at least fails loudly.
- **Silent staleness.** The worst outcome is a policy value that looks
  current and is not. Every policy carries a "last verified" timestamp, the
  Connections screen shows the oldest, and a failed refresh marks the
  connection as needing attention rather than leaving the last-known value
  looking fresh.
- **Portal change.** Playbook replay fails, the agent repairs it, and if the
  agent cannot, the connection is flagged and the provider falls back to its
  next tier for that cycle. This is the designed failure mode and it should
  be exercised deliberately before it happens by accident.
- **Model dependence.** Extraction and navigation both depend on a third-party
  model. The per-feature env override keeps the blast radius to this module,
  and `field-semantics.mjs` stays as the deterministic guard on any value the
  model proposes.

---

## 6. Phased plan

Each phase is shippable on its own and leaves Allan Gray working. The order
changed from the earlier draft: because there is no feed, the phases that
give the thirteen currently-dead providers _some_ working path now come
before the agent work.

| Phase | Deliverable                                                                                                                      | Effort | What it proves                                                          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| 0     | Assign every provider a starting tier from policy count and a single manual login attempt. No code.                              | S      | Where the value actually is                                             |
| 1     | Persistent worker on a container host. Encrypted saved sessions per provider. Resumable items. Re-readable OTP. Health alerting. | M      | Allan Gray refreshes without a fresh OTP; no cold start                 |
| 2     | Promote `/page-extract` to primary extraction behind a per-provider flag. Field semantics unchanged.                             | S      | Values come from page text, not `<td>` adjacency                        |
| 3     | One pipeline: Document AI through staging, locked fields universal, observed-values record, per-policy refresh job.              | M      | **Every provider has a working path today**, via Tier C if nothing else |
| 4     | Agent loop for login, checkpoint, search and confirm. Playbook record and replay. Guided Connect flow.                           | L      | A provider is onboarded without an engineer                             |
| 5     | The three screens. Delete the four tabs and the delete list in 3.5.                                                              | L      | Adviser path is under five clicks with no technical input               |
| 6     | Retire the Allan Gray adapter once the agent matches the golden flow. A golden flow per live provider.                           | S      | One engine, no provider branches                                        |

Phase 3 is the one that changed position, and it is the most valuable early
move now. The AI document-extraction path already works; it only bypasses
staging and review (`integrations-policy-extraction-routes.ts:392-446`).
Routing it through the same staging and review path turns it into a genuine
fallback, which means every provider in the book has a supported way to be
updated before any agent work ships.

Phases 1 and 2 remain low risk, touch no adviser-facing screen, and can start
immediately.

### Success measures

The plan is working if these move. They are worth recording before Phase 1 so
there is a baseline.

| Measure                                              | Today                        |
| ---------------------------------------------------- | ---------------------------- |
| Providers with a working update path                 | 1 of 16 (plus manual upload) |
| Engineer time to onboard a new provider              | Days, if it works at all     |
| Scheduled refreshes completing without a human touch | Effectively none             |
| Logins (and OTPs) per refresh cycle per provider     | One per run                  |

---

## 7. Decisions needed

1. **Hosting for a persistent worker.** A small always-on container versus
   staying on GitHub Actions. This blocks Phase 1, which blocks everything
   else.
2. **Credential and session custody.** Where the sixteen credential sets and
   saved sessions live, who may use them, and what the firm's compliance
   position is on storing them. This is an FSP governance question as much as
   an engineering one, and Phase 1 creates the session store.
3. **First providers and their tiers.** Phase 0's output. Policy count should
   decide, not which adapters happen to exist.
4. **Approval to remove the configuration UI** (Section 3.5) rather than keep
   it running alongside the new screens.
