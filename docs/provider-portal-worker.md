# Provider Portal Worker

Navigate Wealth stores provider portal flow configuration and credentials in Supabase. The React admin app queues portal jobs; a separate Node Playwright worker claims those jobs and runs the browser automation.

## Why a separate worker exists

Supabase Edge Functions handle the job API and storage. Playwright needs a Node process with browser binaries, so it should run as a hosted worker on Render, Railway, Fly.io, a VPS, or any container host that can keep a long-running process alive.

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
