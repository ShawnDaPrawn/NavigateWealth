# AGENTS.md

## Cursor Cloud specific instructions

**Product**: Navigate Wealth — a React SPA (Vite + TypeScript) for a South African financial advisory platform. Single `package.json`, not a monorepo.

**Backend**: Fully remote Supabase (Edge Functions via Deno/Hono). No local backend setup is needed. Supabase credentials are hardcoded in `src/utils/supabase/info.tsx`. The frontend connects to the deployed edge functions at `https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379`.

### Dev commands

All standard commands are in `package.json`:

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (Vite, port 3000) |
| Build | `npm run build` |
| Tests | `npm test` (vitest) |

### Notes

- After changing Edge Function behaviour (for example `GET /admin/stats` fields such as `incomplete` or `draft`), deploy the Supabase Edge Function so production returns the updated JSON; the SPA always calls the deployed function URL above.
- No ESLint config exists in the repo; there is no lint command.
- The test suite has a pre-existing issue: `resolveNestedKey.test.tsx` uses custom assertion logging instead of vitest `test()`/`it()` functions, so vitest reports it as "failed suite" despite all 17 internal assertions passing. 64 tests across 3 other suites pass cleanly.
- The Vite dev server opens a browser by default (`server.open: true` in `vite.config.ts`).
- `tsconfig.json` is at `src/tsconfig.json` (not project root).
- Path alias `@` maps to `./src` (configured in both `vite.config.ts` and `tsconfig.json`).
- **UI/UX changes (Playwright):** For any work that affects what users see or how they interact with the app, build-only verification is not enough. Before sign-off, use the Playwright-based browser inspection script to load the relevant route, capture the outcome, and confirm it matches the original requirement or acceptance criteria (layout, copy, states, and obvious usability issues such as overflow or unreadable contrast). Run: `npm run ui:inspect -- --path /your-route --output tmp/ui-inspect/check.png` (or `--url` if the dev server or another environment is already running). Use `--click` and `--wait-for` when the correct view requires interaction (for example opening a modal or dropdown). If the route cannot be reached in automation (auth, feature flags, missing data), say what blocked inspection or verify manually and note it in the PR.
