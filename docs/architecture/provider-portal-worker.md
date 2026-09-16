# Provider Portal Worker

Navigate Wealth stores provider portal flow configuration and credentials in Supabase. The React admin app queues portal jobs; GitHub Actions starts a one-shot Playwright worker for each job.

## Automation north star

The provider portal worker should become a universal, hardened provider
automation engine rather than a collection of provider-specific scripts.

Every provider should move through the same core pipeline:

```text
login -> OTP -> search -> confirm policy -> extract mapped fields -> validate -> stage -> publish or review
```

The default expectation for a new provider is:

```text
provider config + discovery + mapping = working automation
```

Custom code is allowed only when a provider has a real portal-specific quirk,
such as an unusual OTP checkpoint, hidden frame, non-standard document download
control, or page layout that cannot be handled safely from selectors and label
hints.

The shared worker owns:

- Job queue handling
- Credential loading
- Login and OTP orchestration
- Policy search and policy-number confirmation
- Extraction from configured selectors and labels
- Shared semantic field validation
- Document download orchestration
- Staging and failure reporting
- Debug artifacts

A provider-specific pack should own only:

- Provider identity and default flow values
- Selector and label hints
- Small provider-specific download or snapshot hooks, when unavoidable
- Provider-specific validation overrides, when the shared semantic rules are
  not enough

Do not add new `if provider X, do Y` branches to the shared worker unless the
same behavior is valid for every provider. Provider-specific behavior should
live behind an adapter boundary.

## Worker module layout

`scripts/provider-portal-worker.mjs` is a thin entry point. The runtime lives
in stage modules under `scripts/portal-worker/` (split from the original
3,600-line monolith as behavior-preserving moves):

| Module                  | Owns                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `config.mjs`            | CLI/env parsing, help text, startup validation             |
| `state.mjs`             | Active job id, job/item warning buffers                    |
| `api.mjs`               | Integrations API client (claim, runtime, status, staging)  |
| `page-utils.mjs`        | Provider-neutral Playwright helpers                        |
| `debug-artifacts.mjs`   | `NW_PORTAL_DEBUG_DIR` JSON snapshots + screenshots         |
| `live-view.mjs`         | Throttled live screenshot feed                             |
| `login.mjs`             | Login form, Cloudflare handling, configured navigation     |
| `otp.mjs`               | OTP + auth checkpoints (incl. BrightRock quirks, see note) |
| `search.mjs`            | Policy search + brain (smart assist) client                |
| `extraction.mjs`        | Field extraction, semantics, fail-closed checks            |
| `documents.mjs`         | Document artifact downloads/uploads                        |
| `discovery.mjs`         | Discover-mode selector reports                             |
| `shadow-extraction.mjs` | Observe-only LLM page-extraction comparison                |
| `queue.mjs`             | Per-policy queue loop                                      |
| `job-runner.mjs`        | Job lifecycle + poll loop                                  |

Note: the BrightRock-specific OTP delivery choreography currently lives in
`otp.mjs` (moved verbatim from the monolith). It is a known violation of the
adapter boundary and should migrate behind the BrightRock adapter in a later
behavior-preserving slice.

`otp.mjs` also handles PingID-style push approval (used by Allan Gray):
when the checkpoint page asks the user to tap a matching number in the
authenticator app instead of entering a code, the worker extracts the
on-screen number, publishes it via the job message and live view, and waits
passively for the page to move on. The wait uses a 5-minute _inactivity_
window — any page change (new number, redirect, progress text) resets the
window — and succeeds the moment the auth checkpoint clears and the worker
is inside the provider portal.

These files are pinned by
`src/shared/integrations/__tests__/providerPortalGolden.test.ts` (which
concatenates the entry point and all modules) and are excluded from Prettier
for the same reason as the original monolith.

## Shadow LLM extraction (observe-only)

The worker can run the confirmed policy page's visible text through a
server-side LLM extraction (`POST /portal-worker/jobs/:jobId/page-extract`,
reusing the portal-brain Gemini configuration) and compare the result
field-by-field against the selector/adapter extraction.

- Enable per run with `NW_PORTAL_SHADOW_EXTRACT=1` on the worker, or per
  provider with `extraction.shadowLlm: true` on the portal flow.
  `NW_PORTAL_SHADOW_EXTRACT=0` force-disables it.
- The comparison is strictly observational: it is logged, written to the
  `shadow-extraction-comparison` debug artifact, and stored on the job item as
  `shadowExtraction`, but staged values and item success/failure never change.
- Each field gets a status (`match`, `mismatch`, `shadow_only`, `worker_only`,
  `both_empty`), the LLM's confidence, and whether the LLM value passes the
  shared field-semantics plausibility rules.
- Page text sent to the model is lightly redacted (emails, SA-ID-length digit
  runs) while preserving the policy number, amounts, and dates the extraction
  needs — the same privacy posture as the existing policy-document extraction.

The goal: once shadow results consistently match or beat the adapter values on
the golden flows, the LLM path can be promoted to the primary extraction
engine and the pixel-math adapter logic retired.

## Current refactor phases

Use this sequence when hardening the automation module:

1. Document the universal automation north star and provider-change guardrails.
2. Freeze Allan Gray RA as the golden regression flow before moving runtime
   logic. The current golden flow ledger is
   `docs/architecture/provider-automation-golden-flows.md`.
3. Introduce a provider adapter registry and move Allan Gray-specific logic into
   an Allan Gray provider pack.
4. Standardize shared field semantics and regression tests for common financial
   fields.
5. Split server flow configuration and portal routes after the worker/provider
   boundary is safe.

Allan Gray RA currently works and must be treated as a protected baseline.
BrightRock and future provider refinements must not be allowed to quietly break
Allan Gray or the generic provider flow.

## Codex provider-change protocol

When asking Codex to refine one provider, use a scoped prompt like:

```text
Refine only the BrightRock provider automation flow.

Do not change Allan Gray behavior.
Do not change the shared portal worker unless the change is provider-neutral.
If shared engine changes are required, explain why and preserve existing
provider behavior.

Verification required:
1. BrightRock targeted check.
2. Allan Gray RA regression check.
3. Generic provider-flow check.
```

For any provider-specific work, Codex should first identify whether the change
belongs in provider config, a provider adapter, or the shared engine. Shared
engine changes need the highest bar because they can affect every provider.

## Provider onboarding checklist

For each new provider, capture the following before production use:

- Provider name and provider id
- Product categories covered
- Login URL
- Credential profile
- OTP type and selectors
- Search method
- Policy confirmation rule
- Extraction fields
- Field labels and selectors
- Required stageable fields
- Document download steps
- Known portal quirks
- Whether a provider adapter is required
- Regression coverage added

## Why a separate worker exists

Supabase Edge Functions handle the job API and storage. Playwright needs a Node process with browser binaries, so it should run as a hosted worker on Render, Railway, Fly.io, a VPS, or any container host that can keep a long-running process alive.

The lowest-friction live option is GitHub Actions:

1. The admin clicks **Create Portal Job**.
2. Supabase calls GitHub's workflow dispatch API.
3. GitHub starts `.github/workflows/provider-portal-worker.yml`.
4. The workflow runs `scripts/provider-portal-worker.mjs` with the job id and worker secret.
5. The worker updates Supabase as it logs in, waits for OTP, discovers selectors, performs dry-runs, or stages rows.

## Required Supabase Edge Function secrets

Set these on the Supabase Edge Function:

```bash
NW_GITHUB_ACTIONS_TOKEN=<fine-grained GitHub token with Actions: write on ShawnDaPrawn/NavigateWealth>
NW_GITHUB_ACTIONS_REPO=ShawnDaPrawn/NavigateWealth
NW_GITHUB_ACTIONS_WORKFLOW_ID=provider-portal-worker.yml
NW_GITHUB_ACTIONS_REF=main
NW_PORTAL_WORKER_SECRET=<shared random secret also stored in GitHub Actions secrets>
```

`NW_GITHUB_ACTIONS_TOKEN` is only used by Supabase to dispatch the workflow. It is never sent to the React frontend.

## Required GitHub Actions secret

Set this in the GitHub repository under **Settings -> Secrets and variables -> Actions**:

```bash
NW_PORTAL_WORKER_SECRET=<same shared random secret configured on Supabase>
```

## Required hosted worker environment variables

Set these on the worker host:

```bash
NW_API_BASE=https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/integrations
NW_PORTAL_WORKER_SECRET=<same value configured on the Supabase Edge Function>
NW_PORTAL_POLL=1
NW_PLAYWRIGHT_HEADED=0
NW_PLAYWRIGHT_RECORD_VIDEO=1
NW_PLAYWRIGHT_RECORD_TRACE=1
```

The Supabase Edge Function must also have:

```bash
NW_PORTAL_WORKER_SECRET=<same value configured on the worker host>
```

## Container command

Use `scripts/Dockerfile.portal-worker` and run:

```bash
npm run provider:worker
```

The worker polls `/integrations/portal-worker/jobs/claim`. When an admin clicks **Create Portal Job**, the next poll claims the job and starts the Playwright flow.

## Watching automation

There are now two supported debugging modes for portal automation:

1. Local live watching on this machine.

```bash
npm run provider:watch -- --job-id <portal-job-id> --worker-secret <portal-worker-secret>
```

This launches a visible Chromium window so you can watch the automation move through the provider flow in real time.

If you prefer the explicit environment form, this is equivalent to:

```bash
NW_PLAYWRIGHT_HEADED=1 NW_PORTAL_DEBUG_DIR=tmp/provider-portal-worker npm run provider:sync -- --job-id <portal-job-id> --worker-secret <portal-worker-secret>
```

2. Hosted replay through GitHub Actions artifacts.

The hosted workflow runs headless, but it now records Playwright video plus a Playwright trace under `tmp/provider-portal-worker` and uploads them as the `provider-portal-worker-<run id>` artifact.

The admin Portal Automation screen also shows a live provider screenshot feed while a job is active. That feed updates from the running worker and is the quickest way to see what page the automation is currently on inside the provider portal.

When a job fails, download that artifact from the GitHub Actions run and inspect:

- `videos/` for the browser recording
- `*.zip` trace files for Playwright Trace Viewer
- `*.png` and `*.json` debug artifacts for targeted snapshots and messages

For OTP failures such as BrightRock, this is the fastest way to see whether the worker selected the right delivery option, whether the provider actually showed a sent confirmation, and which screen the automation was on when it paused or timed out.

## How policy-detail logic is defined

Each provider flow contains:

- Login URL
- Login selectors for username, password, and submit
- Manual SMS OTP selectors
- Optional post-login URL
- Optional policy list steps JSON, such as clicking a menu item or waiting for a table
- Policy row selector
- Field selectors that map provider page data into the spreadsheet-style staging rows

Supported policy list step actions are:

```json
[
  { "id": "open-policies", "action": "click", "selector": "a:has-text(\"Policies\")" },
  { "id": "wait-policy-table", "action": "wait_for_selector", "selector": "table tbody tr" }
]
```

Other supported actions: `goto`, `fill`, `press`, and `wait_for_url`.

## The navigator agent

The selector walk asks "which element matches my configured selector?". The
navigator asks "given this page and this goal, what should I do next?", does
one action, looks again, and repeats. It exists because the selector-driven
engine only ever worked for the one provider that also had a hand-written
adapter, and because there was nowhere to put provider knowledge except more
selectors.

It drives three post-login stages, each with its own goal:

| Stage                  | Goal                                                      |
| ---------------------- | --------------------------------------------------------- |
| `pass_auth_checkpoint` | Get through the OTP or push-approval step into the portal |
| `find_policy`          | Search by policy number and open that policy's page       |
| `confirm_policy`       | Confirm the open page is the requested policy             |

### Turning it on

Off by default. A provider opts in through its portal flow:

```json
{
  "agent": {
    "enabled": true,
    "maxStepsPerStage": 12,
    "recordPlaybook": true,
    "replayPlaybook": true
  }
}
```

The backend also needs a Google AI key — the same
`NW_GOOGLE_AI_API_KEY` the existing smart assist uses. `NW_PORTAL_AGENT_MODEL`
overrides the model for this feature alone, and `NW_PORTAL_AGENT_ENABLED=0` is
the kill switch.

Enabling the navigator can only add a way to succeed. If it gets stuck or
exhausts its step budget, the run falls back to the configured selector walk,
which is why Allan Gray is unaffected: its flow does not opt in, and even if it
did, the existing path is still there underneath.

### Playbooks

A stage that succeeds is written to `portal-playbook:{providerId}:{categoryId}`
as an ordered list of steps with durable selectors. The next run replays those
directly, with no model calls, and hands back to the navigator from the first
step that no longer matches. So the model is paid for once per provider rather
than once per policy per month, and a portal redesign degrades to "the agent
re-derives that step" instead of "the provider is broken".

### What keeps it safe

- **Credentials never reach the model.** An action carries a `valueRef`
  (`username`, `password`, `policy_number`), not a value; the worker
  substitutes locally. A model-authored literal aimed at a password field is
  refused server-side.
- **It cannot invent a target.** Observed elements are tagged in the DOM and
  actions address those tags. A candidate id the worker did not report is
  rejected before it reaches the browser.
- **It cannot leave the provider's site.** A `goto` to another host is refused.
- **It is read-only by construction.** The action set has no way to submit an
  instruction or move money, and the prompt says so.
- **It cannot spend without limit.** `maxStepsPerStage` bounds a stage;
  `NW_PORTAL_AGENT_JOB_BUDGET` (default 200 decisions) bounds a whole job
  across its queue. Decisions are counted before the call, since a failed paid
  call still costs.
- **Observations are redacted** with the same rules the existing brain uses,
  and element values are never observed — only what a control is.

### Watching it work

Every navigator action is logged and published to the live view as it happens,
so the Portal Automation screen shows the reasoning as the run moves. Failures
carry the navigator's own stated reason rather than a selector timeout, which
is the difference between "could not confidently find the provider search box"
and "the page is asking to approve a sign-in in an authenticator app".

## Connection tests

### The question nobody could afford to ask

"Do this provider's stored credentials still work?" had no cheap answer. The
only way to find out was to start a real sync run, which needed the provider to
already have policies captured and which wrote to the book if it succeeded. So
the first question an adviser asks was the most expensive one, and in practice
it went unasked — which is how a provider whose password expired sat broken
without anyone noticing.

A **connection test** is a job with `connectionTest: true`. It carries an empty
policy queue by construction, is forced to `discover` whatever run mode is
requested, and refuses a `policyIds` scope outright. The worker runs the normal
login path — credentials, OTP checkpoint, navigator auth stage — and then
**returns**, before post-login navigation and before any discovery report.

Stopping there is the point. A provider whose policy pages are not mapped yet
would fail at post-login navigation, and reporting that as a broken connection
would send an adviser to reset a password that was never the problem.

### What it is allowed to start without

`assertPortalRuntimeConfigured` demands a login URL, a credential profile, and
the three login selectors. A connection test passes `requireLoginSelectors:
false`, because it runs at the one moment a provider is least configured. The
worker then falls back to generic sign-in field guesses
(`FALLBACK_USERNAME_SELECTOR` and friends in `login.mjs`).

A real run keeps the strict gate. There a guessed field would be filled with
something that may not belong in it, and the run goes on to write policy data.
The password guess is deliberately the narrowest of the three.

### Where the result lands

A finished connection test writes
`portal-connection:{providerId}:{credentialProfileId}` — provider and profile,
not category, because credentials are not per category: the same username and
password open the same front door whichever product the flow was set up for.

`GET /portal-connections` folds that record together with the flow's login URL
and the stored credential status into one state per provider:

| State            | Means                              | Next action         |
| ---------------- | ---------------------------------- | ------------------- |
| `no_login_url`   | No portal address captured         | Set up              |
| `no_credentials` | Address but no username/password   | Add sign-in details |
| `untested`       | Stored, but nobody has tried       | Test sign-in        |
| `testing`        | A test is in flight                | —                   |
| `connected`      | Sign-in worked at `checkedAt`      | Test again          |
| `failed`         | Somebody tried and it did not work | Fix and retry       |

`untested` and `failed` stay distinct deliberately. Collapsing them into "not
connected" is what let a broken provider look exactly like an unconfigured one.

`connected` claims only that sign-in worked at `checkedAt`. It does not claim
the policy pages are mapped or that a sync will find anything — those are
separate failures with separate surfaces, and rolling them into one traffic
light is how the module ended up unable to say what was wrong.
