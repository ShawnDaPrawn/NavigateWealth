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
