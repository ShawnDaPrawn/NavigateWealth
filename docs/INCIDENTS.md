# Incident Log

Append-only. Add an entry for every regression, near miss, and confusing
cleanup event a future maintainer could repeat. Newest first.

Each entry should carry: what happened, why it was not caught, and the lesson
that changes behaviour next time. An entry without a lesson is just a story.

> Entries before 2026-09 were lifted verbatim from the former
> `docs/PRODUCTION-READINESS.md` Section 6, now archived at
> [`archive/production-readiness-ledger-2026.md`](archive/production-readiness-ledger-2026.md).

---

events that future agents could repeat.

### 2026-09-20 - Search Console "Page With Redirect" On The Home Page; vercel.json Redirects Were Never Live

- **Symptom:** Search Console listed `http://navigatewealth.co/`,
  `https://navigatewealth.co/`, `http://www.navigatewealth.co/` and several
  apex article and service URLs under _Page with redirect_, and the owner read
  it as the home page not being indexed.
- **What was found.** Two independent faults.
  (1) `vercel.json` had carried a legacy `routes` array _and_ the modern
  `redirects` / `headers` arrays since 2026-09-05 (#285). Vercel treats
  `routes` as mutually exclusive with the modern keys; the build did not fail,
  it just deployed the `routes` block and dropped the rest. Verified on the
  live site: the `…-this-easter` article URL that `redirects` sends to its
  canonical twin returned `200`, and none of the configured security headers
  (`X-Frame-Options`, CSP, `Permissions-Policy`) were present, while the
  `X-Robots-Tag` headers that lived in `routes` were. The apex→www redirect
  with the article carve-out from #319 had therefore never executed either.
  (2) The apex domain never reaches Vercel at all. `navigatewealth.co` is not
  attached to the `navigate-wealth` project (only `www` is), and its DNS is
  hosted at the registrar with the apex `A` record pointing at a registrar
  web-forwarding host (`204.69.207.1`), not at Vercel. Every apex request is
  answered by that forwarder, so the redirect Google records for the apex is
  one the repository does not configure, with a status code it does not choose.
- **Why it hid:** The `www` host, which the sitemap and every canonical tag
  name, was serving correctly with a `200` and the right canonical, so nothing
  user-visible broke. The `routes` block still produced the noindex headers
  and the SPA fallback, so the routing looked alive. The apex routing test
  (`src/__tests__/apex-article-escape-routing.test.ts`) reads the `redirects`
  array and passed, because it proves what the config _says_, not what Vercel
  deploys; the runbook's curl check that would have caught both faults was
  never run after #319 merged.
- **Fix:** `vercel.json` rewritten without `routes`: the SPA fallback is a
  `rewrites` entry, the asset caching and noindex headers are `headers`
  entries, and `redirects` is unchanged, so all three now compose. The test
  suite pins that no `routes` key returns. Because the `headers` block goes
  live for the first time with this change, it was re-read against the app:
  `Permissions-Policy` had `microphone=()`, which would have disabled the admin
  notes voice recorder (`useVoiceRecorder` calls `getUserMedia`); it is now
  `microphone=(self)`. The enforced CSP had `object-src 'none'`, which would
  have blanked the public newsletter page: `NewsletterDetailPage` embeds the
  issue with a plain `<object>` whose `data` is the Supabase storage public
  URL. It is now `object-src 'self' https://*.supabase.co`, in the enforced
  and the report-only policy alike. Nothing uses camera, geolocation or the
  Payment Request API, and no `<form action>` or `<embed>` exists. HSTS was
  declared as `includeSubDomains; preload`; once the apex is served by Vercel
  that would pin every `navigatewealth.co` subdomain to HTTPS in visitors'
  browsers, and the registrar-hosted DNS may still carry HTTP-only hosts
  (webmail, forwarding). It ships as `max-age=31536000` only; add
  `includeSubDomains` deliberately after auditing the zone, and `preload`
  only when submitting to the HSTS preload list. The apex attachment and the DNS
  `A` record are dashboard and registrar changes documented in
  `docs/runbooks/deployment.md`; the Vercel token available to agents cannot
  modify project domains, so the owner does those two steps.
- **Lesson:** A config key that Vercel _ignores_ is worse than one it rejects,
  so any change to `vercel.json` is verified against the deployed host with
  `curl -I`, never by reading the file. And "Page with redirect" on a
  non-canonical host variant is only correct when _we_ serve that redirect:
  check `dig` before assuming the platform is the thing answering.

### 2026-09-14 - The Rest Of The Idle Polling, Found By Auditing After The Disk IO Incident

- **Symptom:** None. This was a deliberate sweep of the other resource
  dimensions after the entry below, asking what else cost money while doing
  nothing. Three more instances of the same pattern turned up.
- **What was found.**
  (1) `publications-process-scheduled` ran every minute and called
  `kv.getByPrefix('article:')`, reading all 165 article records and 660 kB of
  JSONB to filter for the ones due in Deno. Zero were scheduled. That is ~950
  MB a day out of Postgres, through PostgREST, into the Edge Function, and
  discarded. In `pg_stat_statements` the prefix-scan statement had consumed
  3,794 s of database time, the largest remaining consumer after the pg_net
  cleanup below.
  (2) `processArticleNotificationJobs` read its job namespace to find work and
  then `buildArticleNotificationProcessorState` read the identical namespace
  again to compute counts, so every tick scanned it twice.
  (3) Five browser accelerators mount at `AdminDashboardPage` level for the
  whole admin session, two of them every 15 seconds, and none checked
  `document.hidden`. One backgrounded admin tab issued 480 Edge Function
  invocations an hour to drain queues nobody was watching.
  Taken together with the cron jobs, more than 99% of the project's Edge
  Function invocations were idle polling: 7,192 in 24 hours, against roughly 60
  for everything else including real user traffic.
- **Why it hid:** Each piece was individually defensible. A prefix scan is the
  obvious way to read a KV namespace and is genuinely fine for a one-off admin
  read; the duplicate scan was two correct functions each doing their own job;
  the pollers were deliberate accelerators, documented as such, and worked. The
  cost only appears when you multiply by the schedule, and nothing in the
  system reports invocations-that-did-nothing.
- **Fix:** `kv.getByPrefixWhereFieldEquals` pushes the filter into Postgres, and
  migration `20260914083818` adds a partial index on `(value->>'status')` so
  the scheduled-publish tick is an index scan touching 2 buffers rather than a
  660 kB read. `buildArticleNotificationProcessorState` accepts the caller's
  snapshot, and reuses it only on a tick that advanced nothing, because a
  working tick has changed statuses the snapshot does not carry. The three
  frequent accelerators moved to `useVisibilityAwarePoll`, which pauses while
  the tab is hidden and ticks immediately on return. The two email-delivery
  crons went from 30 seconds to 2 minutes, an accepted latency the owner
  agreed, which also required raising `SCHEDULER_STALE_AFTER_MS` from 5 to 10
  minutes so a healthy job's skipped heartbeat cannot read as stale.
- **Lesson:** After fixing a resource problem, audit for its siblings rather
  than closing the ticket. The shape to search for is _work whose cost scales
  with how much data exists rather than with how much work is pending_, and its
  companion, _work that runs when nobody is there to benefit_. Two questions
  find most of it: what does an idle tick of this read, and who is waiting for
  the answer? Note also that the partial index predicate had to stay narrow:
  adding the obvious `AND key LIKE 'article:%'` would have made the index
  unusable, because Postgres cannot prove a range bound implies a LIKE.

### 2026-09-13 - Disk IO Budget Depleted By Unpurged pg_cron History And pg_net Bloat

- **Symptom:** Supabase emailed that project `vpjmdsltwrnpefzcgdmz` was
  depleting its Disk IO budget. The database was 1,952 MB; the application's
  own data was under 100 MB of it.
- **Root cause:** Three compounding things, none of them application data.
  (1) `cron.job_run_details` had never been purged. pg_cron appends a row per
  run and each row stores the full job command (~1.5 kB, bearer token
  included); eleven jobs, two of them every 30 seconds, had left ~800,000 rows
  and 1.3 GB. (2) `net._http_response` is trimmed by pg_net's 6-hour TTL
  delete, but the freed space was only ever pruned in place and never
  vacuumed (opportunistic pruning kept `n_dead_tup` under the autovacuum
  threshold), so the file grew to 609 MB for ~1,100 live rows and the TTL
  delete — which runs every few seconds — walked 527 index pages to find
  nothing. (3) Every 30-second tick of both background processors upserted its
  processor-state KV row even when idle: ~5,800 writes a day, 771,000 since
  April, whose only content was a fresh timestamp — the single largest writer
  to the KV table.
  The Sunday `weekly-backup` `pg_dump` reads the whole database, so 1.9 GB of
  junk was pulled from disk every week on a compute tier whose baseline disk
  throughput is a few tens of MB/s (a `count(*)` over the two tables took 97
  s); the runbook's query A and every ad-hoc `cron.job_run_details` query did
  the same at 10 s each. The warning arrived the morning of the third backup
  run.
- **Why it hid:** Both tables live in extension schemas that `list_tables` and
  the dashboard's table view do not show by default, and the performance
  advisor only flagged `net._http_response` as "bloat", not `cron.job_run_details`,
  whose rows were all live. The heartbeat writes looked like health, and were
  even asserted by tests ("records a processor heartbeat either way").
- **Fix:** One-off reclaim by hand (TRUNCATE + reinsert of the last 7 days of
  cron history: 1,294 MB → 51 MB; TRUNCATE of the 6-hour response table: 609
  MB → 32 kB; the TTL delete now touches 1 buffer). Migration `20260913181044`
  installs two nightly pg_cron jobs, `db-maintenance-purge-cron-history` (7-day
  retention, as Supabase's docs recommend) and
  `db-maintenance-vacuum-system-tables`. Both processors now skip the
  processor-state write on an idle tick while the stored heartbeat is younger
  than `IDLE_HEARTBEAT_INTERVAL_MS` (2 minutes, kept under the dashboard's
  5-minute stale threshold), with contract tests for the skip, the refresh,
  the mode change and the error-clear cases.
- **Lesson:** Disk IO on a small Supabase tier is spent by whatever gets read
  in full, and that is rarely the application's tables. Anything that appends
  forever — cron history, HTTP responses, audit trails — needs a retention job
  the day it is created, and a heartbeat that nobody reads more often than
  every few minutes should not be written more often than that either. When a
  disk or IO warning arrives, look at `pg_total_relation_size` across _all_
  schemas first (`cron`, `net`, `auth`, `storage`), and never `count(*)` a
  suspect table on production to find out — read `pg_class.relpages`.

### 2026-09-05 - Newsletter Studio Shipped Without Its Delivery Job, Audience Or A Working Composer

- **Symptom:** The Newsletter Studio admin module looked live (206 reachable
  subscribers on the dashboard) but could not have sent a newsletter to anyone.
  Its own dashboard was warning "The scheduled delivery job has not checked in
  yet", and the composer crashed on open.
- **Root cause:** Three independent gaps, none visible from the code review
  that shipped the module. (1) `supabase/cron/newsletter-studio-jobs.sql` was
  committed but never run, so only the browser accelerator ever ticked
  (`nlstudio:processor:state` had `lastCronRunAt: null`) and scheduled sends
  could not fire unattended. (2) The composer's default audience,
  `sys_newsletter_contacts`, is created lazily by the public sign-up flow, and
  every one of the 218 subscribers had arrived by admin import, so the group
  never existed and a send would have resolved to zero recipients. (3) The
  shared TipTap editor was mounted through `React.lazy` + `Suspense`; TipTap's
  `useEditor` builds the editor during render and schedules its destruction
  when a render is discarded, which a resolving Suspense boundary does, so the
  first effect ran against a destroyed editor.
- **Why it hid:** Each layer reported success from its own point of view. The
  KPI tiles counted consent records, not reachable audience members; the
  processor state said "healthy" because the manual ticks it did run succeeded;
  the cron SQL file existing read as the job existing; and the composer had no
  test that mounted it.
- **Fix:** Job installed in production (jobid 31) and verified by the processor
  state flipping to cron mode, not by `cron.job_run_details` — see
  `runbooks/scheduled-jobs.md`. The subscriber base became a first-class
  audience list backed directly by the consent records
  (`newsletter-studio-service.ts`), with contract tests for the missing-group
  case. The editor loads through an effect-driven loader
  (`components/LazyRichTextEditor.tsx`), reproduced and pinned with a test.
- **Lesson:** "Is it working?" for a module with a background job means checking
  the job's own heartbeat in production, the audience it will actually resolve,
  and the screen a user will open — not the presence of the SQL, the KPI, or
  the component. A cron SQL file in the repo is a to-do, not a deployment.

### 2026-09-05 - Knowledge Base Entries Were Written But Never Read

- **Symptom:** Admins added entries in AI Management → Knowledge Base, tested
  Vasco, and Vasco answered as if the entries did not exist. Reported as "the
  seeding of the articles is not working".
- **Root cause:** Two disconnected systems that the UI presented as one.
  `kb-service.ts` stored entries at `ai:kb:*`; nothing on the server ever read
  them back except the admin list. The only retrieval path — `retrieveContext`
  in `vasco-rag-service.ts` — searched a separate index built from published
  Publications articles, and that index was refreshed only when an admin
  pressed "Re-index Articles" on a different tab. The portal advisor
  (`ai-advisor-chat.ts`) retrieved nothing at all despite `ragEnabled: true`.
- **Why it hid:** The KB tab reported "Active" with a green badge, the
  dashboard card was titled "Knowledge Base Index", and nothing compared what
  was stored with what was retrievable. A green status was describing the
  database row, not Vasco.
- **Fix (this change):** One index for both source kinds. Live KB entries are
  embedded into `vasco:emb:kb:*` / `vasco:chunk:kb:*` on every write
  (`syncKnowledgeEntry`, awaited by the KB routes, outcome returned to the UI);
  published articles sync on publish/unpublish/delete via fire-and-forget hooks
  (`vasco-index-sync.ts`); both Vasco agents retrieve through
  `retrieveContext(query, { agentId })`, which honours per-entry agent scope and
  priority. `GET /vasco/index` now reports indexed-vs-published/live counts so
  the Knowledge tab can say "up to date" or "N waiting to be indexed" with a
  rebuild button. Contract suite: `vasco-rag-service.contract.test.ts`.
- **Operator step:** Existing entries created before this change are not in
  the index until the first **Rebuild index** (AI Management → Knowledge). The
  tab shows them as "waiting to be indexed" until then.
- **Lesson:** A status badge must describe the effect, not the write. When a
  feature's value is "the AI knows X", the UI has to show whether the AI can
  actually retrieve X, and the thing that makes it retrievable has to happen on
  the same save — not on a button on another tab.

### 2026-08-25 - Scheduled Jobs Silently Not Running

- **Symptom:** None visible. No errors, no alerts, no failed requests. Found by
  reading `function_edge_logs` for 401/404 responses after unrelated work.
- **Scope:** 13 of 15 active `pg_cron` jobs were not performing their work —
  three never had, since creation.
- **Root causes:** (1) unsubstituted `<YOUR_PROJECT_REF>` / `<YOUR_ANON_KEY>`
  placeholder text in the job command, so `net.http_post` errored before sending;
  (2) six jobs targeting paths with no handler in the codebase; (3) cron auth
  comparing the bearer against `SUPABASE_SERVICE_ROLE_KEY`, which does not match
  the token the cron rows send.
- **Why it hid:** `cron.job_run_details.status` reports `succeeded` for all of
  them. `net.http_post` is asynchronous — it enqueues and returns a row id, so
  the job is green regardless of the HTTP outcome.
- **Fix:** Not applied. Every fix is a production write and most touch the
  service-role secret; the options are written up in
  `docs/runbooks/scheduled-jobs.md` for an operator decision.
- **Lesson:** A green scheduler is not a working scheduler. Any job that reaches
  a service over HTTP needs its _response_ checked, not its dispatch. Check the
  two planes separately (`cron.job_run_details` **and** `function_edge_logs`) —
  and when adding a scheduled job, verify the target path resolves to a mounted
  route before trusting the first green run.

### 2026-04-18 - CORS Allowlist Locked Production Out

- **Symptom:** Admin dashboard showed "Some dashboard data failed to load -
  Network error". `shawn@navigatewealth.co` lost module visibility. Browser API
  calls to the Edge Function were blocked by CORS.
- **Root cause:** The CORS fallback allowed only `http://localhost:3000` when
  `NW_ALLOWED_ORIGINS` was unset. Production origins were rejected.
- **Fix:** `index.tsx` now reflects any origin and logs a warning when
  `NW_ALLOWED_ORIGINS` is unset. Strict allow-list behavior applies only after
  the operator explicitly sets the env var.
- **Lesson:** Defense-in-depth controls must not become the sole gate. Auth is
  the real boundary; CORS should not brick the app during missing config.

### 2026-04-20 - CORS Restore Deployed And Verified

- **Action:** Deployed `make-server-91ed8379` to Supabase project
  `vpjmdsltwrnpefzcgdmz`.
- **Command used:**
  `npx supabase functions deploy make-server-91ed8379 --project-ref vpjmdsltwrnpefzcgdmz --use-api --workdir .`
- **Commit:** `a9df9358 fix: restore Supabase Edge Function CORS`.
- **Verification:** Live health endpoint returned `version: 4.1.0`.
- **CORS verification:** Preflight from `https://www.navigatewealth.co`
  returned `204 No Content` with
  `Access-Control-Allow-Origin: https://www.navigatewealth.co`. Preflight from
  `https://navigatewealth.co` also passed.
- **Follow-up:** Set `NW_ALLOWED_ORIGINS` explicitly once all active origins are
  known, then redeploy and repeat preflight checks.

### 2026-04-20 - Broad Tooling Update Blocked Hotfix Commit

- **Symptom:** `git commit` failed because a Husky/lint-staged pre-commit path
  ran `eslint --fix`.
- **Root cause:** The broad Claude update included an `eslint.config.js` that
  imported `eslint-plugin-react-refresh`, but that package was not available in
  the current dependency set.
- **Resolution:** The emergency restore commit was made with `--no-verify`, and
  the broad tooling/code/docs update was stashed for review instead of shipping
  with the hotfix.
- **Lesson:** Do not bundle new tooling gates with production hotfixes. Tooling
  must first prove its own dependencies and scripts pass.

### 2026-04-20 - Roadmap Doc Corrected For Actual Repo State

- **Symptom:** Claude's first version of this file claimed broad tooling,
  workflows, migrations, compliance docs, strict TypeScript config, and other
  items were "done" on `main`.
- **Root cause:** The doc described the broad proposed update, not the cleaned
  repository after the CORS hotfix and stash quarantine.
- **Resolution:** This file was rewritten to distinguish landed, deployed work
  from proposed/stashed work.
- **Lesson:** Status documents must be verified against the working tree, not
  generated from an agent's memory of attempted changes.

---
