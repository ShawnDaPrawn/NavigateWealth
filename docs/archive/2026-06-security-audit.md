> **ARCHIVED — the P0/Critical findings are remediated. Several follow-ups are NOT.**
> The audit below opens by saying its Critical findings are "live and exploitable in
> production right now". That was true on 2026-06-09 and is no longer true of the P0
> set: those were remediated through the 2026-08 migrations
> (`20260825004011_harden_function_search_path_and_grants.sql`,
> `20260826073401_close_rls_bypasses_and_over_broad_grants.sql` and their siblings),
> and the router-auth ratchet in `quality/baselines/route-auth-baseline` holds the line.
>
> **Still open**, as this document itself records under "Not yet addressed (follow-up)":
> H-3/H-4 (rate-limiter fail-closed + atomic + OTP brute-force), H-5 rotation (owner
> action — the KV fallback in `esign-pdf-protect.ts` still stores the platform signing
> key and its passphrase in application-readable storage when no environment
> certificate is provisioned), H-6/H-9 (e-sign download/attachment ownership), H-11
> (upload limits), M-7 (XSS sink hardening), M-12 (idempotency body caching), and the
> missing `POST /requests/:id/submit` endpoint. Do not read the archive banner as
> "all clear" — see [`../STATUS.md`](../STATUS.md) for the current posture and
> [`../ROADMAP.md`](../ROADMAP.md) for where these sit in the plan.

---

# Navigate Wealth — Security Audit & Remediation Plan

**Date:** 2026-06-09
**Scope:** Supabase Edge Function backend (`src/supabase/functions/server/`), Vite/React
frontend (`src/`), deployment config (`vercel.json`, `supabase/config.toml`), Node scripts.
**Method:** Manual review + four parallel domain deep-dives (auth/authz, e-sign/OTP,
SSRF/secrets, frontend/XSS). Every "Critical" finding below was re-verified by reading the
exact handler code, not inferred.

> ⚠️ **The Critical findings are live and exploitable in production right now.** Several
> require no authentication at all and lead to full data disclosure, privilege escalation,
> and super-admin account takeover. Treat the P0 list as an active incident.

---

## 1. Root cause (the one bug behind most of the others)

The Edge Function gateway runs with **`verify_jwt = false`** (`supabase/config.toml:15`).
That is intentional — it lets the health probes stay public. The documented compensating
control is:

> "every sub-router applies `app.use('*', requireAuth)` (or stricter) at mount time."
> — `supabase/config.toml`, `index.tsx:18-20`

**This invariant is false.** Many sub-routers are mounted by a parent that applies **no**
auth middleware, and the leaf route files don't apply it either. The KV store is accessed
with the **service-role key** (`kv_store.tsx:14`), so it bypasses Row-Level Security
entirely — the _only_ thing standing between the internet and every record is the
per-router `requireAuth` that, in these files, isn't there.

Result: dozens of endpoints that read/write client PII, policies, profiles, and auth
state are reachable **unauthenticated**.

The fixes below are therefore two layers: (a) plug each hole, and (b) make the gateway /
default fail _closed_ so a missing `requireAuth` can never again silently expose data.

---

## 2. Critical findings (verified, unauthenticated, exploitable)

### C-1 — Unauthenticated arbitrary read of the entire datastore (`/kv-store/:key`)

- **Where:** `kv-routes.ts:18-41`, mounted at `/kv-store` (`mount-core.ts:33`). No auth.
- **Impact:** `GET /make-server-91ed8379/kv-store/<key>` returns any KV value. Namespaces
  include `user_profile:*`, `security:*`, `application:*` (full POPIA-protected financial
  PII), `compliance_*`, `policies:*`, `esign:*`.
- **Escalation:** the e-sign platform signing certificate is stored at the KV key
  `esign_config:platform_signing_cert` (`esign-pdf-protect.ts:47`) **with its passphrase**.
  `GET /kv-store/esign_config:platform_signing_cert` hands an attacker the private signing
  key → ability to forge platform signatures on any PDF.
- **Fix:** delete the route, or gate it behind `requireSuperAdmin` _and_ scope it. There is
  no legitimate reason to expose a generic KV reader over HTTP.

### C-2 — Unauthenticated profile read **and write** + privilege escalation (`/profile/personal-info`)

- **Where:** `client-management-profile-crud-routes.ts:26` (GET), `:74` (POST), `:228`
  (PUT). Parent `client-management-profile-routes.ts:15-19` mounts them with no auth.
- **Read:** `GET /profile/personal-info?key=user_profile:<uuid>:personal_info` returns any
  profile.
- **Write:** `POST /profile/personal-info` writes an arbitrary `data` object to an
  arbitrary `key`. `deepSanitize()` does **not** strip `role`, so an attacker can set
  `role: "super_admin"` on any profile.
- **Bonus escalation:** the GET handler (lines 40-49) upgrades a profile to `super_admin`
  whenever the `email` query param matches a super-admin allowlist entry — so a crafted
  request both reads _and_ persists a privileged role.
- **Fix:** `requireAuth` on the router; derive the key from `c.get('userId')` server-side
  (never accept a caller-supplied `key`); whitelist writable fields (never `role`,
  `accountStatus`, `adviserAssigned`).

### C-3 — Unauthenticated super-admin account creation (`POST /auth/signup`)

- **Where:** `auth-routes.ts:204-265`. No auth, only an IP blocklist.
- **Impact:** the handler passes the client-supplied `metadata` straight into
  `user_metadata` (`:230-234`), and `auth-mw.ts:69` later trusts `user_metadata.role`. So
  `POST /auth/signup {"email","password","metadata":{"role":"super_admin"}}` creates a
  working super-admin login.
- **Fix:** remove this endpoint (real signup lives in `auth-signup.ts`) or require a
  bootstrap secret; **never** accept `role`/privileged metadata from the client; strip it
  server-side before `createUser`.

### C-4 — Unauthenticated account takeover (`POST /auth/ensure-dev-user`)

- **Where:** `auth-admin-routes.ts:155-225`, mounted at `/auth` (`auth-routes.ts:29`). The
  secret check is **commented out** (`:162-163`).
- **Impact:** `POST /auth/ensure-dev-user {"email":"shawn@navigatewealth.co","password":"…"}`
  resets the **existing** super-admin's password (`:178-187`) → immediate takeover of the
  highest-privilege account. For unknown emails it creates a new `role: admin` user.
- **Fix:** delete this dev-only endpoint from the production build, or hard-gate it behind a
  server secret + `requireSuperAdmin`. It must never ship enabled.

### C-5 — Unauthenticated IDOR over insurance policies (`/integrations/policies`)

- **Where:** `integrations-policy-routes.ts` (GET/POST/PUT/DELETE/archive/reinstate),
  mounted by `integrations.tsx:29` with no auth.
- **Impact:** read, create, modify, **delete** any client's policies by passing their
  `clientId`. Same unguarded pattern applies to the other integrations sub-routers mounted
  in `integrations.tsx` (provider, schema, upload, policy-documents, policy-extraction).
- **Fix:** apply `requireAuth` at the `integrations.tsx` parent; authorize the caller
  against the requested `clientId` (adviser-owns-client / self check) before any read or
  mutation.

### C-6 — Unauthenticated bulk user enumeration (`GET /profile/all-users`)

- **Where:** `client-management-user-admin-routes.ts:21+`, mounted with no auth.
- **Impact:** returns every user's UUID, email, phone, status — the directory an attacker
  needs to weaponise C-1/C-2 at scale (no UUID guessing required).
- **Fix:** `requireAdmin`.

> **Common fix for C-1, C-2, C-5, C-6:** these are all the same root cause (§1). Auditing
> every `*-routes.ts` parent for a missing `requireAuth` is mandatory, not optional.

---

## 3. High findings

### H-1 — Unauthenticated SSRF via feed discovery (`POST /auto-content/sources/discover-feeds`)

- **Where:** `auto-content-routes.ts:262` → `auto-content-service.ts:715-848`, mounted at
  `/auto-content` (`mount-modules.ts:19`). No auth, no URL validation.
- **Impact:** server fetches any caller-supplied URL and probes derived paths — reach
  internal services and cloud metadata (`169.254.169.254`), exfiltrate via blind SSRF.
- **Fix:** require auth; reject non-public hosts (RFC-1918, loopback, link-local, `0.0.0.0`,
  metadata IPs) **after DNS resolution**; cap response size; disable redirects to internal
  hosts.

### H-2 — SSRF allow-list bypass in RSS proxy (`/rss-proxy`)

- **Where:** `rss-proxy.ts` (only `app.get('/')`, unauthenticated). Allow-list uses
  `hostname.endsWith('.'+domain)` (`:22-30`) → attacker-controlled subdomains and DNS
  rebinding bypass it.
- **Fix:** exact-host allow-list (`Set.has(hostname)`); re-validate the resolved IP before
  fetch; keep it unauthenticated only if strictly necessary.

### H-3 — Rate limiter fails **open** and is non-atomic

- **Where:** `rateLimiter.ts:146-155` returns `allowed:true` on any KV error;
  `:74-117` is read-then-write (TOCTOU race) and keyed only on email/identifier (no IP
  dimension).
- **Impact:** brute-force protection (login, OTP, password reset, e-sign OTP) is bypassable
  by inducing KV errors or firing concurrent requests.
- **Fix:** fail **closed** on error for sensitive actions; make the counter atomic (DB
  increment / atomic upsert); add an IP dimension.

### H-4 — E-sign OTP brute-force is under-protected

- **Where:** `esign-rate-limit.ts` (6 attempts / signer / 15 min), `esign-otp.ts:12-14`
  (6-digit numeric, 10-min window). Limit is per-`signer.id`, not per-IP; an attacker who
  can mint multiple envelopes to the same email multiplies the guess budget.
- **Fix:** per-IP + per-email limiting, exponential backoff, fail-closed (see H-3),
  consider 7–8 digits or TOTP for legal-signature OTPs.

### H-5 — E-sign signing key stored in the KV store

- **Where:** `esign-pdf-protect.ts:176-188` — PKCS#12 archive **and** passphrase persisted
  in plaintext KV (the file's own comment flags this). Directly dumpable via C-1.
- **Fix:** move the signing key + passphrase to a secrets manager / HSM; never store
  private-key material in the app KV.
- **🟡 PARTIAL 2026-06-10:** `getOrCreatePlatformP12` now reads
  `NW_ESIGN_PLATFORM_P12_BASE64` + `NW_ESIGN_PLATFORM_P12_PASSPHRASE` (Supabase secrets)
  before falling back to KV. **Owner action still required:** generate a fresh P12, set the
  two secrets on the Edge Function, then delete the KV entry
  (`esign_config:platform_signing_cert`) — the old KV-resident key must be treated as
  compromised and rotated.

### H-6 — E-sign download / attachment IDOR

- **Where:** `esign-signer-extras-routes.ts:34-123` (download) and `:237-250` (attachment
  upload) authorize on a valid signer token but don't verify the token's signer is the
  party for the requested document/field.
- **Fix:** verify the resolved signer owns the envelope/field before returning or writing.

---

## 4. Medium findings

| ID  | Finding                                                                                                                                       | Where                                                                                                   | Fix                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-1 | Non-constant-time secret comparison (`===`) for `CRON_SECRET`, portal-worker secret, OpenClaw secret                                          | `esign-diagnostics-routes.ts:45,134`; `integrations-portal-guards.ts:21-28`; `openclaw-routes.ts:26-37` | Use the existing `constantTimeEqual()` (`api-key-service.ts:262`) everywhere                                                                         |
| M-2 | Unauthenticated `POST /setup/database` runs DDL via service role                                                                              | `setup.ts:22`                                                                                           | Gate behind `requireSuperAdmin` or remove; it's a one-time bootstrap                                                                                 |
| M-3 | No security headers anywhere (no CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)                     | `vercel.json`, `index.html`                                                                             | Add a `headers` block in `vercel.json`; ship a CSP (defense-in-depth for the XSS items below)                                                        |
| M-4 | CORS fails **open** when `NW_ALLOWED_ORIGINS` unset (reflects any origin)                                                                     | `index.tsx:57-71`                                                                                       | **Keep the warning fail-open fallback** (it is required — see note below); assert the allowlist _is_ set in production at boot and alert if it isn't |
| M-5 | Email/SMS send helpers accept arbitrary recipients                                                                                            | `email-core.ts:356-393`, `sms-service.ts:34-48`                                                         | Validate recipient against allow-list; rate-limit per user; (contact-form already does this well — reuse it)                                         |
| M-6 | Stack traces leak unless `DENO_ENV === 'production'` (fails open)                                                                             | `error.middleware.ts:94-127`                                                                            | Require an explicit debug flag; default to no internals                                                                                              |
| M-7 | Print/rich-text XSS sinks: `document.write()` + `dangerouslySetInnerHTML` of post-processed HTML; `style` attr allowed in legal-doc sanitizer | `ArticleDetailPage.tsx:732,1315`; `legalHtml.ts:1-20`; `RichTextEditor.tsx:92`; `ComposeForm.tsx`       | Re-run DOMPurify after any DOM post-processing; drop `style` from allowed attrs; render print content via a sandboxed blob URL, not `document.write` |
| M-8 | GitHub Actions API error returned to clients (potential info leak)                                                                            | `integrations-portal-runtime.ts:177-190`                                                                | Return a sanitized message, never the raw upstream body                                                                                              |

> **M-4 — do NOT "fail closed" on the CORS fallback.** `docs/archive/production-readiness-ledger-2026.md`
> (§4.1 and the 2026-04-18 post-mortem) explicitly requires preserving the warning
> fail-open fallback: a restrictive fallback previously locked production out (admin
> dashboard "Network error", super-admin lost module visibility) when `NW_ALLOWED_ORIGINS`
> was unset. Because auth — not CORS — is the real boundary, fail-open CORS is low risk.
> The correct remediation is to **keep** the fallback and instead **assert** the allowlist
> is configured in production (boot-time check + alert), not to brick browser clients.

---

## 5. Low / informational

- **L-1** Non-constant-time e-sign access-code compare (`esign-otp.ts:139`) — plaintext
  compare; low over real networks but trivial to fix with `constantTimeEqual`.
- **L-2** OTP-hash compare uses `!==` (`esign-otp.ts:106`) — comparing SHA hashes, so the
  timing channel is effectively theoretical; fix opportunistically.
- **L-3** `BroadcastChannel` session messages aren't shape/timestamp-validated
  (`sessionSync.ts:59`) — same-origin only; validate message shape to harden against an
  in-page XSS forging logout/navigation.
- **L-4** Cross-firm saved-signature reuse keyed only on email
  (`esign-signer-access-routes.ts:176`) — scope to (email, firm).
- **L-5** Blob URLs not always revoked; e-sign in-progress state in `localStorage` not
  cleared on unmount — minor leak/hygiene.
- **L-6** `.gitignore` ignores `.env.local` but not a bare `.env` — add `.env` to be safe.
- **Info** Supabase anon key is in the bundle (expected for SPAs) — confirm RLS on every
  real table; confirm the `kv_store_91ed8379` table is **not** anon-readable via PostgREST.

**Clean / good:** `npm audit` reports 0 vulnerabilities; no secrets committed to git;
**super-admin** authority specifically is an email allowlist (`constants.ts`) that
overrides metadata, so it can't be claimed via `user_metadata`; bearer-token (not cookie)
auth keeps CSRF risk low; contact-form has solid IP/domain blocklisting that should be
reused elsewhere.

> ⚠️ **Important caveat — this does _not_ extend to `admin`/`client` roles.** For any email
> outside the super-admin allowlist, `auth-mw.ts:69` (and `:117`) derive the effective role
> from `user.user_metadata?.role`, which **is** client-influenceable via the unauthenticated
> signup handler (see C-3). Only the super-admin override is safe; the general role model is
> not. The C-3 role-metadata remediation remains mandatory.

---

## 6. Remediation plan (phased)

### P0 — Emergency (deploy today; these are live)

1. **Disable the dev/admin backdoors:** remove `POST /auth/ensure-dev-user` (C-4) and
   `POST /auth/signup` (C-3) from the deployed function, or hard-gate behind a server
   secret + `requireSuperAdmin`.
2. **Remove `/kv-store` (C-1)** entirely from `mount-core.ts`.
3. **Stop trusting client `role`:** strip `role`/`accountStatus`/`adviserAssigned` from any
   `user_metadata`/profile write path (C-2, C-3); add them to `deepSanitize`'s deny-list.
4. **Add `requireAuth` to the parent routers** that currently mount children unguarded:
   `client-management-profile-routes.ts`, `integrations.tsx`, plus an audit of every other
   `*-routes.ts` parent (C-2, C-5, C-6).
5. **Rotate the e-sign signing certificate** (assume the KV-stored P12 in H-5/C-1 is
   compromised) and move it out of KV.
6. **Reset the super-admin password** and review auth logs for prior abuse of C-3/C-4.

### P1 — This week

7. **Make the gateway fail closed:** split health checks into an unauthenticated sibling
   function and flip `verify_jwt = true` (the plan already noted in `config.toml`). This
   turns "forgot `requireAuth`" from "data breach" into "still need a token."
8. **Authorize by ownership** on every `clientId`/`userId`-parameterised route (C-2, C-5,
   H-6) — caller must be the subject or an adviser/admin who owns them.
9. **SSRF guards** for H-1/H-2 (post-resolution IP allow/deny, size caps, no internal
   redirects) and require auth on feed discovery.
10. **Rate-limiter hardening** (H-3, H-4): fail closed for sensitive actions, atomic
    counter, IP dimension.
11. **Constant-time comparisons** everywhere (M-1, L-1, L-2) using the existing helper.

### P2 — This sprint

12. Security headers + CSP (M-3); assert the CORS allowlist is set in prod while keeping the
    fail-open fallback (M-4); error-detail fail-closed (M-6).
13. XSS sink hardening (M-7): re-sanitize post-processed HTML, drop `style`, sandbox print.
14. Recipient allow-listing / rate-limiting for email & SMS (M-5).
15. Gate `POST /setup/database` (M-2); sanitize upstream error passthrough (M-8).

### P3 — Hardening & prevention (ongoing)

16. **Add a CI guard** that fails the build if any sub-router is mounted without an auth
    middleware (a lint rule / dependency-cruiser rule / unit test enumerating routes). This
    is the durable fix for §1.
17. Move all server secrets to a managed secrets store; document rotation.
18. Add request size limits on uploads; review `localStorage`/blob hygiene (L-5).
19. Add automated auth/authorization integration tests (one per route: unauthenticated →
    401, wrong-owner → 403).

---

## 7. Suggested verification tests (run against a staging deploy)

```
# Must all return 401/403 after P0 — today they return data/200:
GET  /make-server-91ed8379/kv-store/esign_config:platform_signing_cert
GET  /make-server-91ed8379/profile/personal-info?key=user_profile:<uuid>:personal_info
GET  /make-server-91ed8379/profile/all-users
POST /make-server-91ed8379/auth/signup        {"email","password","metadata":{"role":"super_admin"}}
POST /make-server-91ed8379/auth/ensure-dev-user {"email":"<known-admin>","password":"x"}
GET  /make-server-91ed8379/integrations/policies?clientId=<uuid>
POST /make-server-91ed8379/auto-content/sources/discover-feeds {"url":"http://169.254.169.254/"}
```

---

## 8. Second pass — independent fresh re-audit (delta)

A full second audit was run independently (five parallel domain agents, verifying from
source without reference to §§2–5 above). **Outcome: every original finding (C-1…C-6,
H-1…H-6, the Mediums and Lows) was re-confirmed.** The second pass also found additional
issues the first pass missed. New items below were verified by reading the handler code.

A few first-pass items were also **re-scoped** for accuracy: `POST /setup/database` (M-2)
runs a **hard-coded** DDL string, not attacker-supplied SQL — it's an unauthenticated DDL
_trigger_ (DoS / policy churn), not SQL injection; and the OTP-hash timing compare (L-2)
stays Low (it compares SHA-256 hashes).

### New Critical

- **C-7 — FNA/estate/form modules accept the PUBLIC anon key as admin.**
  `fna-auth.ts:72-76`: `if (token === anonKey) return ADMIN_USER`. The anon key ships in the
  browser bundle (`src/utils/supabase/info.tsx`), so **anyone** can send
  `Authorization: Bearer <anon-key>` and be treated as a full admin. `authenticateUser()` is
  used by `fna-intake-routes`, `estate-planning-fna-*-routes`, `fna-batch-status-routes`,
  `form-prefill-routes`, `form-template-routes`, `communication-service`. Impact:
  unauthenticated admin read/write over highly sensitive financial-needs-analysis and estate
  data, FNA queue listing, intake acceptance. **Fix:** delete the anon-key branch entirely;
  admin endpoints must require a real privileged user token (or a server-only secret).

- **C-8 — Unauthenticated IDOR over client applications (`/applications/*`).**
  `client-applications-routes.ts`: `GET /:userId` (`:203`) returns any user's full financial
  application; `POST /submit` (`:83`) submits one for an arbitrary `userId`; `POST /step/:step`
  mutates step data — all with no auth. **Fix:** `requireAuth` + ownership check on `userId`.
  **✅ FIXED 2026-06-10:** router-wide `requireAuth` + per-route ownership (self-or-admin;
  step routes resolve the application owner via `getById`). Frontend callers
  (`applicationService.ts`, `useOnboarding.ts` keepalive save, `ApplicationStatusGuard.tsx`)
  migrated from the anon key to the session JWT. Contract-tested in
  `__tests__/applications-auth.contract.test.ts`.

### New High

- **H-7 — OTP generated with `Math.random()`** (`esign-otp.ts:28`). Not a CSPRNG; e-sign
  signing OTPs are predictable. **Fix:** `crypto.getRandomValues()`.
- **H-8 — Unauthenticated account-status change (`POST /profile/update-status`)**
  (`client-management-status-routes.ts:14`). Sets any user's `accountStatus`/`accountType`
  (self-approve an application, or suspend a competitor). **Fix:** `requireAdmin`.
  **✅ FIXED 2026-06-10:** `requireAuth` + self-or-admin ownership, with a self-service
  status whitelist (`application_in_progress`, `submitted_for_review`) so non-admins cannot
  self-approve. `AccountTypeSelectionPage` migrated to the central API client (session JWT).
- **H-9 — E-sign signed-PDF download IDOR** (`esign-sender-download-routes.ts:26`).
  Authenticates but discards the context (`_ctx`), no firm/owner check — any logged-in user
  downloads any completed envelope by ID. A `belongsToFirm` helper already exists
  (`esign-sender-envelope-routes.ts:62`) and should gate this.
- **H-10 — Entire `/auto-content/*` router is unauthenticated** (not just feed discovery,
  H-1): `configs`, `trigger`/`trigger-all`, and source CRUD all lack auth — content
  injection + OpenAI quota burn. **Fix:** `requireAdmin` at the router.
  **✅ FIXED 2026-06-10:** router-wide `requireAdmin`; `AutoContentAPI` (publications
  module) migrated from the static anon-key headers to `getAuthHeaders()` (session JWT).
- **H-11 — File-upload validation gaps** (`esign-storage.ts`): no per-request size cap (only
  a 50 MB bucket limit) and the stored extension is taken from the filename without an
  allow-list (`:111`) → upload `.exe` under `Content-Type: application/pdf`. **Fix:** size
  cap + extension allow-list.
- **H-12 — FNA-intake RLS lets a client mutate a submitted session.**
  `20260520000001_fna_intake_sessions.sql:66-74` — the UPDATE policy permits
  `status IN ('client_draft','submitted')`, so a client can edit/resubmit after the adviser
  has it. **Fix:** restrict the policy to `status = 'client_draft'` in USING and WITH CHECK.
- **H-13 — More timing-unsafe secret comparisons** (extends M-1): the OpenClaw, portal-worker,
  `CRON_SECRET` (`esign-diagnostics-routes.ts:48,134`), calendar-digest (`:92`), tasks-digest
  (`:144`), quality-issues-ingest, and newsletter-confirm (`newsletter.tsx:282`) guards all
  use `===`/`!==`. **Fix:** route every secret compare through `constantTimeEqual`.

### New Medium

- **M-9 — `POST /auth/confirm-email` is unauthenticated** (`auth-routes.ts:633`). Confirms any
  existing unconfirmed email (anti-enumeration is present, so impact is limited to bypassing
  email verification for legacy accounts). **Fix:** gate behind a secret or remove.
- **M-10 — Validation schemas use `.passthrough()`** (e.g. `applications-validation.ts`,
  `communication-validation.ts`) instead of `.strict()`, letting unknown/privileged fields
  ride through to KV writes (the vehicle for the C-2/C-3 `role` injection). **Fix:** `.strict()`.
- **M-11 — `kv_store_91ed8379` has no migration and (unverified) no RLS policy.** The backend
  correctly uses the service-role key, but the table should have RLS enabled with an explicit
  service-role-only / deny-anon policy so a PostgREST/grant misconfig can't expose it to the
  anon key. **Action:** verify in the Supabase dashboard and add the policy.
- **M-12 — Idempotency cache stores full response bodies (≤256 KB) in KV for 24 h**
  (`idempotency.ts:221`) — sensitive responses (e.g. applications with PII) sit in KV and are
  also reachable via the C-1 KV read. **Fix:** cache status + hash only, not bodies.
- **M-13 — Application status state-machine defined but unused** (`_VALID_TRANSITIONS`,
  `client-applications-service.ts:75`) — status is set without validating transitions; no
  audit log on approvals. **Fix:** enforce the transition table; audit-log every change.
- **M-14 — Sensitive SPA routes lack `Cache-Control: private, no-store`** (`vercel.json`) — on
  top of M-3's missing headers, `/admin`,`/dashboard` HTML can be cached on shared devices.
- **M-15 — No rate limit on `POST /applications/submit`** (`client-applications-routes.ts:83`)
  — application/email-notification spam.
- **M-16 — Incomplete log redaction** (`shared-logger-types.ts` `SENSITIVE_KEYS`) — missing
  `passport`, `dob`/`dateOfBirth`, `phone`/`cellphone`. POPIA-relevant PII can hit logs.
- **M-17 — `workflow_dispatch` open** on `deploy-supabase-function.yml` /
  `provider-portal-worker.yml` — any push-access contributor can trigger prod deploys / portal
  jobs with arbitrary inputs. **Fix:** restrict / require approvals.

### New Low

- **L-7 — Role-string inconsistency** (`auth-mw.ts`): `requireAdmin` accepts both `super_admin`
  and `super-admin`, but the code only ever assigns `super_admin` — harmless today, brittle.
- **L-8 — `returnUrl` open-redirect edge cases** (`LoginPage.tsx:46`): the `startsWith('/')
&& !startsWith('//')` check can be skirted by backslash/encoding tricks; parse-and-compare
  origin instead.
- **L-9 — E-sign signer tokens never expire** (`esign-services.tsx:628`) — a leaked signing
  link is valid indefinitely until the envelope is voided. Add a TTL.

### Updated counts

Original 26 + 19 new = **45 findings**: **8 Critical** (C-1…C-8), **13 High** (H-1…H-13),
**17 Medium** (M-1…M-17), **7 Low** (L-1…L-9, minus merges). The systemic root cause (§1)
remains the dominant theme: most Criticals/Highs are "a router mounted without `requireAuth`"
or "trusting a client-supplied identity/credential."

### P0 additions (deploy with the rest of P0)

- Remove the anon-key-as-admin branch in `fna-auth.ts` (C-7).
- Add `requireAuth` + ownership to `/applications/*` (C-8) and `requireAdmin` to
  `/profile/update-status` (H-8) and `/auto-content/*` (H-10).
- Swap OTP generation to `crypto.getRandomValues()` (H-7).

---

## 9. The blocker: the frontend authenticates with the PUBLIC anon key

A re-audit finding that governs how much can be fixed server-side alone: the SPA sends the
**public Supabase anon key** as its bearer token across many self-service flows — e.g.
`applicationService.ts` (all calls), `profileService.ts` (several calls),
`publications/api.ts`, `esign-signer/*`, `onboarding`, `wills`, `history`. The central
`api` client (`utils/api/client.ts`) also **falls back to the anon key** whenever there is
no session.

Consequence: a blanket `requireAuth` on these routers returns 401 for legitimate traffic,
because that traffic carries the anon key, not the user's session JWT. This is precisely
why the routes were left open — and it means several fixes (full auth on `/profile`,
`/applications`, removing the `fna-auth` anon-admin branch) are **blocked on a frontend
auth-token migration**: every caller must send `session.access_token` (via the `api`
client's `getAccessToken()`), after which the backend can enforce auth + ownership and the
gateway can flip to `verify_jwt = true`.

Admin-only areas that already use the `api` client with a real session (client-management,
adviser dashboards) are safe to gate today — and were.

> Also note the **Hono mounting gotcha** discovered while fixing this: a sub-router mounted
> with `.route('/', sub)` that calls `sub.use('*', mw)` leaks that middleware onto its
> sibling sub-routers (they share the `/` tree). Auth middleware on such routers must be
> applied **per-route**, not via a wildcard, or it will gate (and break) unrelated siblings.

---

## 10. Fixes applied in this PR (code), and what's deferred

**Applied (safe — no legitimate flow depends on the old behaviour; full test suite green):**

- **C-1** `/kv-store/*` now requires admin (`requireAdmin`; standalone mount, no leak).
- **C-3** `/auth/signup` strips privileged metadata (`role`/`accountStatus`/`adviserAssigned`/
  `suspended`) before `createUser` — kills unauthenticated super-admin creation.
- **C-4** `/auth/ensure-dev-user` re-gated behind the `SUPER_ADMIN_PASSWORD` secret
  (constant-time), fail-closed if unset — kills the account-takeover backdoor.
- **C-5** `/integrations/policies` CRUD now `requireAuth` **per-route** (admin/adviser
  callers already send real tokens) — closes the policy IDOR for unauthenticated callers.
- **C-6** `/profile/all-users` + user-admin metadata route now `requireAdmin` (per-route).
- **C-2 (partial)** profile writes strip privileged fields for non-admins (defence-in-depth
  against role escalation via profile update).
- **H-7** OTP generation switched to a CSPRNG (`crypto.getRandomValues` via
  `secureRandomDigits`) — no more predictable `Math.random()` codes.
- **H-1** SSRF guard (`ssrf-guard.ts`) added to feed discovery — blocks loopback / RFC-1918 /
  link-local / cloud-metadata targets.
- **M-1 / H-13** constant-time comparison (`crypto-utils.constantTimeEqual`) applied to the
  OTP/access-code, OpenClaw, cron (`esign-diagnostics`), calendar/tasks-digest, and
  newsletter-confirm secret checks.
- **M-3 / M-14** security headers (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `HSTS`, `Permissions-Policy`) + `Cache-Control: private, no-store` on
  authenticated SPA routes (`vercel.json`).
- **M-16** expanded log redaction (`passport`, `dob`, `tax_number`, `otp`, `passphrase`, …).

**Fixed 2026-06-11 — H-14 (PR #106 review): privileged roles trusted from client-editable
user_metadata.** `resolveAuthUser`/`getAuthContext` (auth-mw), `fna-auth`, and the local
admin guards in `applications-routes` / `admin-client-onboarding-routes` derived the
effective role from `user_metadata.role`, which any authenticated user can set on
themselves via `supabase.auth.updateUser({ data: { role: 'admin' } })` — full
`requireAdmin` bypass. **Fix:** all role resolution now goes through
`resolveTrustedRole()` (constants.ts): super-admin email allowlist → `app_metadata.role`
(service-role-only writable) → `NW_ADMIN_EMAILS` env allowlist → user_metadata, with
privileged values from user_metadata demoted to `client`. Provisioning paths
(super-admin bootstrap, ensure-dev-user, personnel create/backfill, admin metadata
updates) now write `app_metadata.role`. **Deploy step:** run
`node ./scripts/ops/backfill-trusted-roles.mjs` once (or set `NW_ADMIN_EMAILS`) so existing
staff keep access. Tests: `__tests__/trusted-role-resolution.test.ts`.

**Fixed 2026-06-10 (server gating + frontend JWT migration shipped together):**

- **C-8** auth + ownership on `/applications/*`; **H-8** auth + self-or-admin (with a
  self-service status whitelist) on `/profile/update-status`; **H-10** `requireAdmin` on
  `/auto-content/*`. Each caller was migrated to `session.access_token` in the same change
  (`applicationService.ts`, `useOnboarding.ts`, `ApplicationStatusGuard.tsx`,
  `AccountTypeSelectionPage.tsx`, publications `AutoContentAPI`). Contract tests:
  `__tests__/applications-auth.contract.test.ts`. **H-5 (partial):** env-secret-first
  signing-cert loading landed; key rotation is still an owner action.

**Deferred (require the §9 frontend auth-token migration — would 401 live traffic if done
server-side alone; documented in-code with `SECURITY-AUDIT` markers):**

- **C-2 (full)** blanket auth on `/profile/*`; **C-7** removing the `fna-auth` anon-key-admin
  branch; and the eventual `verify_jwt = true` flip. These need each remaining caller
  migrated to `session.access_token` first.

**Fixed 2026-06-11 (quick-wins pass):**

- **H-2** rss-proxy: exact-host allow-list (no subdomain wildcard) + `assertPublicHttpUrl`
  SSRF guard on the target URL.
- **H-12** FNA-intake RLS: clients can now UPDATE only `client_draft` sessions
  (migration `20260611000001_fna_intake_rls_draft_only.sql`; submission goes through the
  Edge Function with the service role).
- **P3 #16 (the durable fix): router-auth CI guard landed** —
  `__tests__/router-auth-guard.test.ts` parses every `lazy()` mount, recursively scans each
  router's import tree (`import`/`export … from`) for auth markers, and fails the build for
  any new router that is neither authed, explicitly allow-listed as public (with a reason),
  nor in the tracked `KNOWN_UNAUTH_DEBT` list. `SERVICE_ROLE_KEY` is deliberately NOT a
  marker (it is a DB credential reached via the KV store by nearly every router, not an
  inbound-request guard — PR #115 review). The guard caught and led to fixing several live
  gaps:
  - `requests-routes.ts` — template/lifecycle/compliance CRUD had NO auth → `requireAdmin`
    on all back-office routes (`GET /:id` stays public for emailed completion links).
  - `publications-ai-routes.ts` — unauthenticated OpenAI generation → `requireAdmin`;
    `AIWritingAPI` frontend callers migrated to session JWTs.
  - `setup.ts` — **unauthenticated raw-DDL endpoints** (`/database`, `/tasks-table`,
    `/check*` ran `CREATE TABLE/FUNCTION/TRIGGER` via the service role) → `requireSuperAdmin`.
  - `sitemap.ts` `POST /publish` → `requireAdmin` (GET sitemap stays public for crawlers).
  - `linktree-routes.ts` — `/links`, `/reorder`, `/settings` mutations → `requireAdmin`
    (the admin LinktreeTab uses the session API client); `/public` + `/click` stay public.
  - Intentionally public (allow-listed with reasons): `consultation`, `contact-form`,
    `quote-request`, `auth-signup`, `rss-proxy`, `fna-routes`.
  - Tracked debt (`KNOWN_UNAUTH_DEBT`): `documents.ts` — IDOR over client documents
    (by `:userId`); fix is blocked on C-7/C-2 because client pages still send the anon key.
- **Discovered while sweeping:** the public `POST /requests/:id/submit` the
  RequestCompletionPage calls has never existed server-side — the client-facing request
  completion flow 404s on submit today. Needs a product decision (response storage +
  status transition) — tracked as follow-up, NOT fixed here.

**Not yet addressed (follow-up):** H-3/H-4 (rate-limiter fail-closed + atomic + OTP
brute-force), H-5 rotation (owner action — see §3), H-6/H-9 (e-sign download/attachment
ownership), H-11 (upload limits), M-7 (XSS sink hardening), M-12 (idempotency body
caching), and the missing `/requests/:id/submit` endpoint above.
