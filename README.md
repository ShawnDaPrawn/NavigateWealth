# Navigate Wealth

A financial advisory platform for South African advisers and their clients:
client management, financial needs analysis, e-signature, compliance tracking,
and provider portal automation.

**New here?** [`docs/README.md`](docs/README.md) indexes every document.
**Wondering what state the system is in?** [`docs/STATUS.md`](docs/STATUS.md).
**Wondering what to work on?** [`docs/ROADMAP.md`](docs/ROADMAP.md).

## What The App Does

Navigate Wealth serves several audiences from one SPA:

| Audience            | Capabilities                                                                                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public visitors     | Marketing pages, services pages, resources, articles, quote/contact flows, legal pages, sitemap, link-in-bio page, Ask Vasco, and SEO-friendly static output.                                                                                                                |
| Clients             | Authentication, onboarding, application status, dashboards, FNA intake, service-specific financial planning views, documents, communication, e-signature history, adviser details, profile, and security settings.                                                           |
| Advisers and admins | Client management, FNA modules, applications, submissions, tasks, notes, communication, calendar, resources, publications, compliance, reporting, product management, provider automation, e-signature preparation, AI management, Issue Manager, and audit/quality tooling. |
| Automation workers  | Provider portal jobs, form prefill, FNA intake backfill/UAT scripts, GitHub Actions dispatch, and OpenClaw gateway event intake.                                                                                                                                             |

Primary advice domains represented in the UI and backend include risk planning, medical aid, retirement planning, investment management, employee benefits, tax planning, and estate planning.

## Tech Stack

| Layer                    | Technology                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Frontend runtime         | React 18, TypeScript, Vite 6, React Router 7                                                   |
| UI and styling           | Tailwind CSS 4, Radix UI primitives, lucide-react, custom design system components             |
| Data fetching            | TanStack React Query                                                                           |
| Auth and data platform   | Supabase Auth, Supabase client, Supabase Edge Functions, Supabase KV/Postgres-backed workflows |
| Backend runtime          | Supabase Edge Functions with Deno and Hono                                                     |
| Documents and signatures | pdf-lib, pdfjs-dist, jsPDF, docx, signpdf packages, e-sign route modules                       |
| Rich content             | Tiptap, react-quill-new, publications/resources modules                                        |
| Charts and analytics     | Recharts, Vercel Analytics, Vercel Speed Insights                                              |
| Browser automation       | Playwright for provider portal worker and E2E tests                                            |
| Testing and quality      | Vitest, Testing Library, Playwright, ESLint, Prettier, TypeScript, Deno check                  |

## Getting Started

### Prerequisites

- Node.js 20 is recommended because GitHub Actions uses Node 20.
- npm is used for dependency management.
- No local Supabase backend is required for normal frontend development.
- Deno is required only when running the Edge Function typecheck.
- Playwright browser binaries are required for E2E tests and provider automation.

### Install

```bash
npm install
```

For CI-like installs, use:

```bash
npm ci
```

### Environment

Copy the example file if you need local overrides:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

The app can boot without local Supabase variables because `src/utils/supabase/info.tsx` contains fallback project values. For production and preview deployments, set explicit `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, and `VITE_SUPABASE_ANON_KEY` values in the host environment.

Never put secrets in `VITE_*` variables. Vite embeds those values into the browser bundle.

### Start The Dev Server

```bash
npm run dev
```

Vite serves the app at:

```text
http://localhost:3000/
```

## Scripts

The main scripts in the current `package.json` are:

| Task                                       | Command                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| Start Vite dev server                      | `npm run dev`                                                                |
| Production build with SEO generation       | `npm run build`                                                              |
| Verify SEO output only                     | `npm run seo:verify`                                                         |
| Run Vitest once                            | `npm test`                                                                   |
| Run Vitest in watch mode                   | `npm run test:watch`                                                         |
| Run Playwright E2E tests                   | `npm run test:e2e`                                                           |
| Run Playwright headed                      | `npm run test:e2e:headed`                                                    |
| Typecheck SPA code                         | `npm run typecheck`                                                          |
| Typecheck Vercel middleware                | `npm run typecheck:middleware`                                               |
| Typecheck Supabase Edge code with Deno     | `npm run typecheck:deno`                                                     |
| Run ESLint                                 | `npm run lint`                                                               |
| Run ESLint autofix                         | `npm run lint:fix`                                                           |
| Format with Prettier                       | `npm run format`                                                             |
| Check Prettier formatting                  | `npm run format:check`                                                       |
| Optimize images                            | `npm run optimize:images`                                                    |
| Capture optional UI inspection screenshot  | `npm run ui:inspect -- --path /your-route --output tmp/ui-inspect/check.png` |
| Run provider worker once                   | `npm run provider:sync`                                                      |
| Watch provider worker in headed/debug mode | `npm run provider:watch`                                                     |
| Run long-poll provider worker              | `npm run provider:worker`                                                    |
| Backfill FNA intake KV to Postgres         | `npm run fna-intake:backfill`                                                |
| Bootstrap FNA UAT actors                   | `npm run fna-intake:bootstrap-uat`                                           |
| Run FNA intake API UAT                     | `npm run fna-intake:api-uat`                                                 |
| Generate FNA intake UAT report             | `npm run fna-intake:uat-report`                                              |
| Run form prefill API smoke                 | `npm run form-prefill:smoke`                                                 |
| Run form prefill E2E smoke                 | `npm run form-prefill:e2e`                                                   |
| Migrate form templates to storage          | `npm run form-prefill:migrate-templates`                                     |

## Repository Layout

```text
.
|-- src/
|   |-- App.tsx                         # App-level bootstrapping and global handlers
|   |-- AppRoutes.tsx                   # Route definitions and lazy page loading
|   |-- assets/                         # Imported Figma/exported image assets
|   |-- components/
|   |   |-- admin/modules/              # Admin/adviser operational modules
|   |   |-- auth/                       # Auth context, guards, login/session flows
|   |   |-- client/                     # Client-facing FNA, communication, e-sign areas
|   |   |-- layout/                     # Public/dashboard layout
|   |   |-- pages/                      # Route-level public and portal pages
|   |   |-- providers/                  # AppProviders and global provider wiring
|   |   |-- shared/                     # Shared UI/application helpers
|   |   `-- ui/                         # Reusable UI primitives
|   |-- config/                         # Frontend environment helpers
|   |-- middleware/                     # Route policy helpers and tests
|   |-- router/                         # Data-router wrapper
|   |-- services/                       # Browser-side domain services
|   |-- shared/                         # Shared domain libraries and pure logic
|   |-- supabase/functions/server/      # Hono Edge Function implementation
|   |-- styles/                         # Styling support
|   |-- types/                          # Shared TypeScript types
|   `-- utils/                          # API, auth, Supabase, formatting, quality utilities
|-- supabase/
|   |-- functions/make-server-91ed8379/ # Supabase deploy entrypoint
|   |-- migrations/                     # Postgres migrations
|   `-- cron/                           # Cron SQL and the publications smoke test
|-- scripts/                            # SEO, provider worker, UAT, migration, smoke scripts
|-- docs/                               # Status, roadmap, guidelines, architecture, runbooks, archive
|-- e2e/                                # Playwright specs
|-- public/                             # Public assets, robots, service worker, generated SEO output
|-- .github/
|   |-- workflows/                      # Quality, e2e, deploy, worker, backup
|   |-- ISSUE_TEMPLATE/                 # Bug and operations-task forms
|   |-- CODEOWNERS                      # Review routing for high-risk paths
|   |-- dependabot.yml                  # Grouped weekly dependency updates
|   `-- pull_request_template.md        # The finalization checklist, as tick-boxes
|-- AGENTS.md                           # Working agreement for coding agents
|-- SECURITY.md                         # Vulnerability reporting policy
|-- vite.config.ts
|-- vitest.config.ts
|-- playwright.config.ts
|-- vercel.json
`-- package.json
```

## Testing And Quality

Use the narrowest reliable verification for the change:

- Pure logic, services, route contracts, and component behavior: `npm test`
- Auth hydration regressions: `npm test -- src/utils/auth/__tests__/loadUserProfile.sessionHint.test.ts src/components/auth/__tests__/authContext.invariants.test.ts`
- SPA TypeScript: `npm run typecheck`
- Middleware TypeScript: `npm run typecheck:middleware`
- Supabase Edge Function TypeScript/Deno graph: `npm run typecheck:deno`
- Lint: `npm run lint`
- Formatting: `npm run format:check`
- Browser flows: `npm run test:e2e`
- Optional rendered UI screenshot inspection: `npm run ui:inspect -- --path /route --output tmp/ui-inspect/check.png`

GitHub's `Quality Check` workflow runs build, Vitest with coverage, SPA typecheck, ESLint, Prettier check, middleware typecheck, Deno edge-code typecheck with a ratchet baseline, focused FNA/form-prefill tests, npm audit capture, and quality issue publishing.

## Security And Operational Notes

- Do not commit `.env.local`, service-role keys, provider credentials, admin passwords, GitHub tokens, or worker secrets.
- Treat every `VITE_*` value as public.
- Supabase anon keys are publishable but still rely on RLS/auth/API checks.
- `SUPABASE_SERVICE_ROLE_KEY` belongs only in Supabase secrets, controlled scripts, or secure CI/ops contexts.
- CORS is defense-in-depth, not authorization. Business routes must require auth even if `NW_ALLOWED_ORIGINS` is configured.
- The permissive CORS fallback is intentional when `NW_ALLOWED_ORIGINS` is unset; do not tighten it as an incidental cleanup.
- Health endpoints are unauthenticated by design; business endpoints should not be.
- PII, financial data, e-signature artifacts, and provider credentials should not appear in screenshots, logs, commits, or issue payloads unless deliberately redacted.
- Runtime client issues and CI quality snapshots feed the Issue Manager; preserve useful request IDs and error context without leaking secrets.

## Documentation

Everything is indexed in [`docs/README.md`](docs/README.md). The entry points:

| Document                                                         | Purpose                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`docs/STATUS.md`](docs/STATUS.md)                               | What is true today: system shape, deliberate fallbacks, open operator items, open security follow-ups. |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)                             | The live plan — what to build or fix next.                                                             |
| [`docs/GUIDELINES.md`](docs/GUIDELINES.md)                       | How code must be structured.                                                                           |
| [`docs/INCIDENTS.md`](docs/INCIDENTS.md)                         | What has gone wrong before, and the lesson from each.                                                  |
| [`docs/architecture/overview.md`](docs/architecture/overview.md) | How a request travels from browser to Edge Function to storage.                                        |
| [`docs/architecture/`](docs/architecture/)                       | Per-subsystem write-ups: provider worker, golden flows, OpenClaw gateway, build and SEO pipeline.      |
| [`docs/runbooks/`](docs/runbooks/)                               | Operating, verifying and repairing things in production — including deployment and troubleshooting.    |
| [`docs/decisions/`](docs/decisions/)                             | Why past choices were made.                                                                            |
| [`AGENTS.md`](AGENTS.md)                                         | Working agreement for coding agents: the finalization protocol and deployment rules.                   |
| [`SECURITY.md`](SECURITY.md)                                     | Reporting a vulnerability, and the two design choices that look like findings and are not.             |

## Contributing Guidelines

1. Read [`docs/STATUS.md`](docs/STATUS.md) before large changes, and
   [`docs/GUIDELINES.md`](docs/GUIDELINES.md) before structural ones.
2. Check the current `package.json` before assuming which scripts exist.
3. Keep changes scoped to the requested domain.
4. Preserve auth hydration invariants and run the auth regression tests for auth/session work.
5. For Edge Function changes, run focused route tests and consider `npm run typecheck:deno`.
6. For public route, SEO, or Vercel route changes, run `npm run build` or at least `npm run seo:verify`.
7. For provider automation changes, use the golden-flow docs and keep provider-specific behavior behind provider boundaries.
8. Avoid regenerating SEO files, screenshots, reports, coverage, or build outputs unless they are part of the task.
9. Do not use `npm run ui:inspect` as a default sign-off step; reserve it for explicit UI verification or practical browser-level checks.

Opening a pull request loads [a checklist](.github/pull_request_template.md) of
the gates above. Every one of them runs locally — [`AGENTS.md`](AGENTS.md)
explains why pushing and waiting on CI instead is not the way this repository
works, and flags the two gates that are easy to misread.

## Credits

This project includes components from [shadcn/ui](https://ui.shadcn.com/) under the
[MIT licence](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md), and photographs from
[Unsplash](https://unsplash.com) under the [Unsplash licence](https://unsplash.com/license).

## License

This repository is marked `"private": true` in `package.json` and does not currently include a public license file. Treat the codebase as proprietary unless the project owner adds an explicit license.
