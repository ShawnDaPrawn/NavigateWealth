# Security Policy

Navigate Wealth is a private, proprietary application handling personal and
financial information for South African advisory clients. Findings are treated
as production incidents, not as backlog.

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private vulnerability reporting:

https://github.com/ShawnDaPrawn/NavigateWealth/security/advisories/new

If that is unavailable to you, contact the repository owner directly.

Useful to include: the affected route or file, what an attacker gains, and
whether authentication is required. A request ID (`x-request-id`, on every Edge
Function response) shortens the trace considerably.

Please do not include real client data in a report. A redacted example or a
synthetic account demonstrates the same finding without widening the exposure.

## Scope

In scope: the SPA, the `make-server-91ed8379` Supabase Edge Function, database
migrations and row-level security policies, the provider portal worker, and the
GitHub Actions workflows.

Out of scope: findings that require an already-compromised administrator
account, denial of service by volume, and reports against Supabase or Vercel
themselves — those go to the respective vendor.

## What is already known

Open follow-ups from the June 2026 audit are listed under **Open security
follow-ups** in [`docs/STATUS.md`](docs/STATUS.md), with detail in
[`docs/archive/2026-06-security-audit.md`](docs/archive/2026-06-security-audit.md).
A report matching one of those is still worth sending — it tells us the priority
is wrong — but it is not news.

## Design notes that look like findings and are not

Both are deliberate, documented, and load-bearing. `docs/STATUS.md` records the
conditions under which each is removed.

- **The Edge Function reflects any browser origin when `NW_ALLOWED_ORIGINS` is
  unset**, and logs a warning. A stricter fallback locked production out once.
  CORS is not the authorization boundary here; per-router authentication is.
- **`verify_jwt = false` on the function**, because it exposes anonymous health
  probes. Every sub-router applies its own authentication at mount time.

A demonstration that per-router authentication is _missing_ somewhere is a real
finding, and a serious one. The two settings above, on their own, are not.
