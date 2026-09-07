# AGENTS.md

## READ FIRST - Status And Roadmap

Before proposing any large change, read:

```text
docs/STATUS.md
```

That file is the status ledger for:

- what is actually landed on clean `main`
- what was only proposed/stashed by Claude
- what remains operational versus engineering work
- known incidents and the lessons from them
- what future agents should do next

Do not assume Claude's broad production-readiness update is landed just
because this repository contains a roadmap document. The roadmap explicitly
separates `current main` from `proposed/stashed`.

If the user asks any version of:

- "Is this production grade?"
- "What should I do now?"
- "What should we refactor next?"
- "Why is CORS permissive?"
- "What did Claude change?"
- "What is left?"

read `docs/STATUS.md` first and answer from it. For "what next?", read
`docs/ROADMAP.md`.

---

## SHIPPING A CHANGE — non-negotiable finalization protocol

Read this before you push anything.

Past sessions caused real pain by pushing a branch and then **ending the turn
"waiting for the Quality Check" — and never merging.** The user then had to ask
3–5 times whether it had landed on `main`. That pattern is **forbidden**.

Every gate the CI `Quality Check` workflow runs is **runnable locally** — the
`SessionStart` hook installs `node_modules` for exactly this reason. So there is
never a legitimate reason to defer verification to CI and then sit and wait.

When a change is ready to ship, do **all** of the following **in the same turn**:

1. **Verify locally and make it green _before_ committing** (mirror CI):

   ```bash
   npm run format            # prettier --write, then re-stage
   npm run lint              # eslint  (baseline: 0 errors)
   npm run typecheck         # SPA tsc (baseline: 0 errors)
   npm run typecheck:middleware
   npm run typecheck:deno    # must not exceed quality/baselines/deno-check-baseline
   npm run depcruise         # boundary rules (blocking)
   npm test -- --coverage    # vitest WITH coverage — CI enforces the thresholds
                             # in vitest.config.ts, so plain `npm test` can pass
                             # locally while CI fails on a coverage drop. Mirror it.
   npm run test:coverage:server  # SEPARATE gate on quality/vitest.config.server.ts.
                             # The line above does NOT enforce the backend's
                             # per-layer floors — different config, different job.
   npm run bundle:check      # ratcheted; trips when a dependency lands in an
                             # eagerly-loaded chunk. Re-baseline only deliberately.
   npm audit                 # ratcheted against quality/baselines/npm-audit-baseline
                             # on high+critical only
   npm run build             # production build
   ```

   All eleven are blocking in `.github/workflows/quality-check.yml`. The three
   added here were missing from this list for a while, which meant a run that
   looked complete locally could still fail after push — the exact failure mode
   this protocol exists to prevent.

   If a gate genuinely cannot run (e.g. a blocked `npm install`), **say so
   explicitly with the error** — do not commit unverified code and "let CI catch
   it."

   **`npm run test:coverage:server` is NOT a substitute for `npm test`, and
   running only the suites you touched is not either.** Hit for real on
   2026-08-26 (PR #247): a one-line `kv.mget` added to fix an RoA delete bug
   pushed the tree-wide direct-KV count from 1772 to 1773 and failed the
   `kv-direct-access` ratchet. Every suite that the commit touched passed. Two
   things make this class of failure invisible to a partial run:
   - The **global ratchets** — `kv-direct-access`, `auth-without-authz` — count
     call sites across the WHOLE server tree, so any single added line can trip
     one no matter which module it lands in. They live in the backend suite but
     are not about the code under test.
   - `vitest.config.ts` deliberately does **not** exclude
     `src/supabase/functions/**`, so `npm test` runs the backend tests too. One
     backend failure therefore surfaces as BOTH `test exit code: 1` and
     `backend coverage floor: exit 1` in the CI summary. That is one root cause
     reported twice — do not go hunting for a second, unrelated SPA failure.

   When a ratchet legitimately has to rise, its own failure message names the
   sanctioned path: re-baseline to the new number and **say why in the PR**.

   **`typecheck:deno` is the easiest one to skip and the easiest one to
   misread.** Two traps, both hit for real on 2026-08-26 (PR #237), where CI
   reported 4 new edge type errors against a floor of 0 after every other gate
   had been run and passed locally:
   - **Deno may not be installed in the sandbox**, so the script fails with
     "deno: not found" rather than a type-error count. That is not a passing
     gate. Install the version CI pins (`deno-version` in
     `.github/workflows/quality-check.yml`, `v2.8.1` at the time of writing) —
     the release zip downloads fine through the proxy:

     ```bash
     curl -fsSL https://github.com/denoland/deno/releases/download/v2.8.1/deno-x86_64-unknown-linux-gnu.zip -o deno.zip
     unzip -q deno.zip && chmod +x deno
     ```

   - **The local count is inflated and will not match CI.** In a sandbox where
     the Supabase types do not fully resolve, `deno check` reports ~34 extra
     pre-existing `TS7006 Parameter implicitly has an 'any' type` errors that CI
     never sees, so a raw "Found 38 errors" against a floor of 0 looks hopeless
     and invites ignoring the gate. **Do not compare the local total to the
     baseline.** Diff the error set against `origin/main` instead — that isolates
     exactly what your branch added:

     ```bash
     git worktree add /tmp/main-wt origin/main
     sig() { NO_COLOR=1 ./deno check --config src/supabase/functions/server/deno.json \
       src/supabase/functions/server/index.tsx 2>&1 \
       | grep -oE 'server/[a-zA-Z0-9._/-]+\.tsx?:[0-9]+:[0-9]+' | sed 's|.*/||' | sort; }
     (cd /tmp/main-wt && sig) > /tmp/main.txt
     sig > /tmp/head.txt
     comm -13 /tmp/main.txt /tmp/head.txt   # errors your branch ADDS
     git worktree remove /tmp/main-wt --force
     ```

     Read the result by line, not by file: an unchanged error moves line number
     when you add an import above it, and will otherwise look new.

     A faster first pass, when the change is small, is to group by error CODE.
     The local-only noise is entirely `TS7006`, so anything else is yours; a
     clean run reads `34 TS7006` and nothing else.

     ```bash
     ./deno check --config src/supabase/functions/server/deno.json \
       src/supabase/functions/server/index.tsx 2>&1 |
       grep -oE 'TS[0-9]+' | sort | uniq -c
     ```

     This caught a real CI-failing `TS2559` on 2026-08-26 that every other local
     gate passed. Worth knowing why they could not catch it:
     `tsconfig.typecheck.json` EXCLUDES the edge-function tree, so
     `npm run typecheck` returning 0 says nothing whatsoever about `server/`.
     `deno check` is the only thing that type-checks that code.

     **A clean `34 TS7006` is NOT proof, and reading it as proof cost two CI
     cycles on 2026-09-05 (PR #300).** Those 34 all read
     `Parameter implicitly has an 'any' type` — the SYMPTOM of the JSR Supabase
     types failing to resolve here. When they do not resolve, every row collapses to
     `any`, so code whose correctness depends on a row's real type checks
     vacuously here and fails in CI, where the types do resolve. The local
     reading was `34 TS7006` and nothing else; CI found two real errors. The
     blind spot is exactly the code most edge changes touch — anything handling
     a `supabase` query result.

     So when a change touches the shape of a query result, do not stop at the
     count. Write a scratch `.ts` file that calls the changed function with the
     repo's OWN row types (`CalendarEvent`, `Reminder`, and so on) in the
     shapes the service actually uses, run `deno check` on that file, and
     delete it. It needs no network, so it sees what CI sees; it reproduced
     both errors in seconds after the count had said clean.

     One further trap in the same gate: the workflow reports the count as
     `999999` when there is exactly ONE error, because Deno prints its
     `Found N errors` summary only for N greater than 1 and the grep then
     matches nothing. `999999` means "one error, or the check died" — read the
     log, never the number.

2. **Commit, push the branch, open/update the PR** (ready for review, not a
   draft).

3. **Arm auto-merge — do not poll.** Enable GitHub auto-merge (squash) on the PR
   via the GitHub MCP `enable_pr_auto_merge` tool. GitHub then merges to `main`
   **automatically** the moment `Quality Check` goes green. You never sit and
   wait on CI.

4. **Report the PR URL and that auto-merge is armed**, then end the turn.

**NEVER end a turn with "waiting for the quality check" and an open loop.** The
only two acceptable end states are:

- ✅ verified locally + pushed + auto-merge armed (steps 1–4 done), or
- ❌ a named gate failed / could not run — state which one and what is blocking.

The user must never have to ask "did it merge yet?"

---

## DEPLOYMENT — already automated; never deploy by hand

Deployment is fully wired up and has worked for months. Triggered by merging to
`main`:

- **Edge function** (`make-server-91ed8379`):
  `.github/workflows/deploy-supabase-function.yml` auto-deploys on every push to
  `main` that touches `src/supabase/functions/**`, using the long-standing
  `SUPABASE_ACCESS_TOKEN` repo secret. Project ref `vpjmdsltwrnpefzcgdmz`.
- **Frontend**: Vercel auto-deploys `main`.

So when the user says **"deploy"**, the entire action is: finish the
finalization protocol above so the PR **merges to `main`** — the Action + Vercel
then deploy on their own. After the merge lands, confirm the
`Deploy Supabase Edge Function` workflow run went green (GitHub MCP Actions /
Actions tab) and report it.

**Forbidden** — these only waste the user's time and have caused real grief:

- Do **not** run `supabase functions deploy` (or any `supabase` CLI deploy)
  manually.
- Do **not** run a deploy by hand just because you now have credentials. The
  deploy path is automated and stays automated (see above).

**UPDATED 2026-08-24 — asking for credentials is now ALLOWED.** The earlier
blanket rule here ("do not ask the user for, or generate, a Supabase access
token") is withdrawn by explicit standing permission from the repository owner.
An agent MAY request tokens and credentials from the user, and use them, **for
the purpose of establishing or inspecting the environment** — reconciling
schema, reading migration state, running advisors, provisioning a staging
project, and similar setup work.

That permission has boundaries, and they are not negotiable:

- **Never commit a credential.** Not to a file, not to a commit message, not to
  a PR body, not to a doc, not in an example. Anything pasted into the session
  stays in the session.
- **Never send a credential to a third party**, or paste it into a URL, header
  or payload bound for anywhere other than the service it authenticates.
- **Least privilege, and say which.** Ask for the narrowest credential that does
  the job, and name exactly what you will do with it before asking.
- **Read before you write.** Introspect first; a write against production is a
  separate decision that needs its own confirmation, credentials or not.
- **Credentials do not widen the deploy rule.** Holding a Supabase token is
  still not a licence to deploy the Edge Function by hand — merging to `main`
  deploys it.

**What is already wired (check before asking for anything).** This repo's
sessions have a Supabase MCP server with read/write access to project
`vpjmdsltwrnpefzcgdmz`: `list_migrations`, `list_tables`, `execute_sql`,
`apply_migration`, `get_advisors`, `list_edge_functions`. That is how the
2026-08-24 migration reconciliation (D2) was closed after two prior sessions had
recorded it as blocked on credentials — it was never actually blocked. Try the
MCP server before asking the user for anything.

**What the MCP server does NOT cover**, and therefore still needs the operator:
Edge Function **environment secrets**. There is no tool to read or set them, so
anything gated on `NW_ESIGN_PLATFORM_P12_BASE64`, `NW_ESIGN_REQUIRE_ENV_CERT`,
`ESIGN_DUAL_WRITE` or similar is an operator action in the Supabase dashboard
(Project → Edge Functions → Secrets), not something an agent can do.

- Do **not** try to deploy from the agent sandbox — its network egress blocks
  `api.supabase.com`, so manual attempts fail regardless.

The user's established flow is simply: _say "deploy" → it merges to `main` →
it auto-deploys._ Honour that path; never reinvent it.

---

## The product, in three paragraphs

**Product**: Navigate Wealth - a React SPA (Vite + TypeScript) for a South
African financial advisory platform. Single `package.json`, not a monorepo.

**Backend**: Fully remote Supabase Edge Functions via Deno/Hono. No local
backend setup is needed. Supabase credentials currently have hardcoded
fallbacks in `src/utils/supabase/info.tsx`. The frontend connects to the
deployed Edge Function at:

```text
https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379
```

The Edge Function has an intentional CORS fallback: if `NW_ALLOWED_ORIGINS` is
unset, it reflects the incoming browser origin and logs a warning. Do not
"tighten" this fallback casually; it exists because a too-strict fallback
previously locked production out. Auth middleware is the real security
boundary.

## Dev Commands

**`package.json` is the list.** This section used to carry two tables of
commands "as of 2026-04-20" plus a list of commands that do not exist. Both went
stale — the repository gained scripts the tables never mentioned, and the
finalization protocol above already names every gate you must run. Read
`package.json` rather than trusting a copy of it, which this file tells you to do
elsewhere anyway.

Three things worth knowing that `package.json` does not tell you:

- The Vite dev server opens on **port 3000**, not Vite's default 5173.
- `npm test` runs the backend suites too — `vitest.config.ts` deliberately does
  not exclude `src/supabase/functions/**`. That is why a partial run misses the
  global ratchets, as the finalization protocol explains at length.
- `npm run ui:inspect` is **not** a default sign-off step. Use it only when a
  browser-level check is genuinely needed.

## Auth hydration (do not regress — 2026-05 incident)

Session handling in `src/components/auth/AuthContext.tsx` and
`src/utils/auth/profileService.ts` previously regressed twice:

1. **Parallel cold-start `getSession()` bootstrap** alongside
   `onAuthStateChange` contended with Supabase auth, triggered long timeouts,
   and sometimes called `resolveAuthSession(null)` while `SIGNED_IN` was active
   (users bounced to login despite valid credentials).
2. **`loadUserProfile` always calling `auth.getUser()`** during hydration piled
   on the same client and caused slow logins / profile timeouts.

**Invariants future changes must preserve:**

- **Single pipeline:** hydrate only from `onAuthStateChange`
  (`INITIAL_SESSION` / `SIGNED_IN`). Do **not** add another bootstrapping
  `getSession()` path without explicit review.
- **Session hint:** pass `session.user` into `loadUserProfile(..., hint)` during
  that pipeline so hydration does **not** stack a redundant `getUser()` on the
  hot path. `refreshUser` may omit the hint.
- **Regression tests** (must stay green — run `npm test`):
  - `src/utils/auth/__tests__/loadUserProfile.sessionHint.test.ts`
  - `src/components/auth/__tests__/authContext.invariants.test.ts`

## Notes

- Edge Function changes deploy **automatically** when they land on `main` — see
  the "DEPLOYMENT" section above. Do **not** run `supabase functions deploy` by
  hand.
- The Supabase function deploy entrypoint is
  `supabase/functions/make-server-91ed8379/index.ts`, which imports
  `src/supabase/functions/server/index.tsx`.
- `tsconfig.json` is at the project root.
- Path alias `@` maps to `./src` in Vite and TypeScript config.
- ESLint config lives at `eslint.config.mjs`; `npm run lint` gates CI at
  0 errors (warnings are an accepted baseline).
- The historical `resolveNestedKey.test.tsx` suite issue is fixed — the file
  uses real Vitest `describe`/`it` and the full suite exits 0.
- Architecture guidelines live in `docs/GUIDELINES.md`.
- Status lives in `docs/STATUS.md`; the plan lives in `docs/ROADMAP.md`.
- `docs/README.md` indexes every document and states the docs conventions.
- Do not require the Playwright/UI-inspection path by default for routine
  sign-off. Use `npm run ui:inspect` only when the user explicitly asks for it
  or when a browser-level check is truly necessary and practical.
- If authenticated admin UI verification is explicitly requested, the owner
  keeps an encrypted credential file outside the repository on their own
  machine; its path is in `AGENTS.local.md`, which is git-ignored. It is not
  recorded here because a shared file is the wrong place to publish one
  person's home directory layout. Whatever the path, the rule is the same:
  never copy credentials into source, commits, screenshots, or logs.
