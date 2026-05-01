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

## Current refactor phases

Use this sequence when hardening the automation module:

1. Document the universal automation north star and provider-change guardrails.
2. Freeze Allan Gray RA as the golden regression flow before moving runtime
   logic. The current golden flow ledger is
   `docs/provider-automation-golden-flows.md`.
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
```

The Supabase Edge Function must also have:

```bash
NW_PORTAL_WORKER_SECRET=<same value configured on the worker host>
```

## Container command

Use `Dockerfile.portal-worker` and run:

```bash
npm run provider:worker
```

The worker polls `/integrations/portal-worker/jobs/claim`. When an admin clicks **Create Portal Job**, the next poll claims the job and starts the Playwright flow.

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
