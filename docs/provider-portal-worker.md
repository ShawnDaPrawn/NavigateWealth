# Provider Portal Worker

Navigate Wealth stores provider portal flow configuration and credentials in Supabase. The React admin app queues portal jobs; GitHub Actions starts a one-shot Playwright worker for each job.

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
