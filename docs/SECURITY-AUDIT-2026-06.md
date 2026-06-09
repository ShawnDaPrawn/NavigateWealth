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

> **M-4 — do NOT "fail closed" on the CORS fallback.** `docs/PRODUCTION-READINESS.md`
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
