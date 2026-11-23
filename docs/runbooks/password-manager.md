# Super admin password manager

The password manager keeps brokerage-wide and personal logins encrypted, and lets AI tools use them over MCP with as much or as little supervision as you choose. Only super admins can open it.

## Opening it

Account menu → **Password manager**. The vault opens only for a session that has just passed two-factor (the email code the platform already uses) and locks again after 15 idle minutes. A super admin without two-factor is asked to turn it on first.

## Keys and storage

The database migration generates a 32-byte master key in Supabase Vault under `navigatewealth_password_manager_key`. Include that secret and the project’s Vault recovery material in your backups: restoring records requires the matching key. Each collection has its own data key, sealed by the master key, so a connection scoped to one collection only ever unwraps that collection’s key. Logins saved before collections existed stay sealed by the master key until they are next saved or moved. Records live in the service-role KV store under `password-vault:` (logins) and `pvault-*` (collections, connections, workflows, runs, approvals, activity). Activity never records a secret.

## Collections and logins

Every login lives in one collection: **Brokerage** (shared by the firm, created automatically) or a person’s own (create one per adviser and set its owner). A login carries its type, tags, category, an optional authenticator setup key (the vault then shows the current code), a rotation reminder, and its **AI access**: Never, Find only, Use only or Reveal, plus **Ask first**. Health flags reused, weak, overdue and “seen by AI” passwords.

Collection owners never open the vault. Under their own account settings, **My saved logins** lists their logins without passwords and lets them replace a password (the previous one is kept 7 days) or add a login (it starts as Find only). Import takes the same CSV as before (`url`, `username`, `password`, optional `name`, `notes`), up to 100 rows and 1 MiB.

## AI connections

Add the server once in the AI tool: `https://www.navigatewealth.co/mcp/password-vault` (Streamable HTTP). Create one connection per person per tool under **AI connections**:

- **Collections** it can see, optionally only logins with one tag.
- **Level**: Find, Find and use, Find use and reveal, or **Full access** (everything in its collections, overriding each login’s own AI access).
- **Autonomy**: Supervised, Checks only or **Full autonomy** (no human in the loop), then any line changed individually: reveal, “Ask first” logins, read-only workflows, record changes, money moves. Each check (signed instruction attached, identity, per-instruction and daily limits, duplicates in 24 hours, page matches) can block, ask a person, log only or be off. Limits are optional; a hold before money moves is optional.
- **Sign-in**: an HTTPS OAuth callback (Claude custom connector, ChatGPT app) — enter the returned client ID and secret in the tool and approve the consent in super admin — or no callback for a 90-day bearer token.

**Pause all AI access** stops every connection at once. Revoking a connection lists the passwords it had seen, so you can rotate them. The trust ladder suggests moving a workflow to the next autonomy level once it has a clean record (10 clean runs from Supervised, 25 from Checks only); you decide.

Tools an AI sees (tools above its level are not listed): `list_collections`, `search_credentials`, `list_workflows`, `get_skill`, `get_approval_status`, `start_workflow`, `get_run`, `session_read`, `session_act`, `complete_run`, `get_one_time_code`, `get_credential`. When a person must approve, the tool answers `waiting_for_approval` with an `approval_id`; approvals appear under **Approvals** (and, for record changes on their own connections, in the owner’s account settings). Repeat the call with the `approval_id` once approved; an approval is used once.

Per-login MCP tokens issued before this change (`nwv_…`, one login each) keep working until they expire.

## Workflows and skills

Each login can carry workflows. **Automated steps** run a broker-reporting workflow on the runner (below). A **skill** is written instructions — when to use it, inputs, steps (some marked as checkpoints), guardrails (allowed websites, checkpoint button labels, never/stop-if rules) and what to return. Edits are drafts; **Publish** freezes a numbered version that runs use.

Skills run in a signed-in browser hosted by `scripts/vault-browser-host.mjs`: it signs in itself, keeps navigation on the allowed websites, and never returns password fields. Run it anywhere with Node 22 and Playwright Chromium behind HTTPS, with `NW_BROWSER_HOST_TOKEN` set to a long random value, then set the Edge Function secrets `NW_BROWSER_HOST_URL` and `NW_BROWSER_HOST_TOKEN` (Supabase dashboard → Edge Functions → Secrets). Until then, skill runs fail with “browser host not configured”; everything else works.

## Broker reporting from Claude, ChatGPT or another MCP client

In **Password manager → Open**, turn on **Use for broker operations**. Choose the provider, enter the signed-in practice label and the reporting page URL, and link each broker with their exact provider code. The broker directory gives each broker a stable ID. Link the same broker on another provider account by choosing that existing directory entry.

Under **Broker operations → Workflows**, configure a login check and a monthly statement workflow against the provider’s reporting page. Selectors are Playwright locators maintained in super admin. The report workflow expects a native broker dropdown if switching brokers is necessary, a current broker label, a native month dropdown with YYYY-MM values, and a uniquely matching row with its own broker code, YYYY-MM and PDF link. The worker waits for the requested broker and month when the provider refreshes its results. Configure the broker and month selectors to match labels inside both a statement row and the empty-results element. If the provider only displays a generic empty message, the run reports that it could not verify the document. Before using a real account, verify these against the provider-approved portal. The installed provider list covers Allan Gray, BrightRock and Capital Legacy. Report page layouts need configuration for each provider. This worker supports provider-side approval prompts. Portals with other sign-in mechanics need an adapter for those mechanics.

Under **AI connections**, copy the server URL into Claude’s custom connector settings or ChatGPT’s MCP app settings. Use a client/workspace supporting remote MCP and tool calls. Register that client’s exact HTTPS callback in Navigate Wealth, enter the returned client ID and secret in the client, and sign in to Navigate Wealth to approve the connection. The assistant can list linked accounts and workflows and run jobs. An OAuth access token lasts up to 30 days. Reconnect to renew it within the connection’s 90-day lifetime. Clients supporting custom authorization headers can use the dashboard’s bearer-token option.

For example, ask the assistant to find a practice account and two brokers, list its provider’s workflows, then run the monthly statement workflow for October 2026. `start_portal_job` takes the account ID, workflow ID, broker IDs, month and a unique request ID. Reuse the request ID to recover the results of the same submission. Keep the returned batch ID to follow partial results through `get_job_status` or `get_job_results`. The latter returns document references. Super admin can open the actual PDFs in **Runs**, filtered by broker. A retry of one broker creates a new run for that broker only.

The GitHub reporting workflow uses the existing Edge Function dispatch configuration and GitHub Actions worker secret. Each broker gets a fresh Chromium session and a single-use claim. The runner verifies the signed-in identity, selected broker, report row and PDF text before filing in private storage. The first six PDF pages must contain the broker code and the month in YYYY-MM, English month/year or abbreviated English month/year format. Scans, ambiguous rows and identity mismatches require review. Run history records the verified identity, broker and outcome. Use **Inspect run** for the latest redacted layout of the sign-in, approval, account or report page. The inspector shows control positions and generic labels. The worker keeps credentials and browser recordings out of chat and GitHub artifacts.

Run the browser regression locally with `node --test scripts/broker-report-worker.test.mjs` after installing Playwright Chromium, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chromium binary. Its local HTTPS fixture exercises successful filing, a missing statement, a document belonging to another broker and provider-side MFA approval.
