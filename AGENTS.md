# AGENTS.md

## READ FIRST - Status And Roadmap

Before proposing any large change, read:

```text
docs/PRODUCTION-READINESS.md
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

read `docs/PRODUCTION-READINESS.md` first and answer from it.

---

## Cursor Cloud Specific Instructions

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

Commands that exist on clean `main` as of 2026-04-20:

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Dev server | `npm run dev` (Vite, port 3000) |
| Build | `npm run build` |
| Tests | `npm test` |
| Test watch | `npm run test:watch` |
| UI inspection | `npm run ui:inspect -- --path /your-route --output tmp/ui-inspect/check.png` |
| Provider sync | `npm run provider:sync` |
| Provider worker | `npm run provider:worker` |

Commands that do **not** exist on clean `main` unless later tooling work lands:

- `npm run lint`
- `npm run typecheck`
- `npm run test:coverage`
- `npm run format`
- `npm run deps:audit`
- `npm run deps:boundaries`
- `npm run check-env`

## Notes

- After changing Edge Function behavior, deploy:
  `npx supabase functions deploy make-server-91ed8379 --project-ref vpjmdsltwrnpefzcgdmz --use-api --workdir .`
- The Supabase function deploy entrypoint is
  `supabase/functions/make-server-91ed8379/index.ts`, which imports
  `src/supabase/functions/server/index.tsx`.
- `tsconfig.json` is at the project root.
- Path alias `@` maps to `./src` in Vite and TypeScript config.
- No ESLint config is present on clean `main` as of 2026-04-20.
- The test suite has a known pre-existing issue:
  `src/components/admin/modules/resources/components/__tests__/resolveNestedKey.test.tsx`
  uses custom assertion logging instead of Vitest `test()`/`it()` functions.
  It logs `17/17 passed` internally, but Vitest reports "No test suite found."
- The Vite dev server opens `http://localhost:3000/` by default.
- Architecture guidelines live in `src/guidelines/Guidelines.md`.
- Status and roadmap live in `docs/PRODUCTION-READINESS.md`.
- For user-visible UI changes, build-only verification is not enough. Run the
  UI inspection tool before sign-off. Use `--click` and `--wait-for` when the
  state requires interaction, such as opening a modal or dropdown.
- For authenticated admin UI verification, use the machine-local encrypted
  credential file at
  `C:\Users\ShawnFrancisco\.codex\secrets\navigate-wealth-admin.credential.clixml`.
  This file is intentionally outside the repo; do not copy credentials into
  source, commits, screenshots, or logs.
