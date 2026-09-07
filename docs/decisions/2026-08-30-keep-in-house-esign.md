# E-Sign: In-House Platform vs Documenso — Comparison & Recommendation

**Date:** 2026-08-30
**Scope:** Should Navigate Wealth keep and invest in its in-house e-signature
platform, or replace it with (or embed) [Documenso](https://github.com/documenso/documenso),
the open-source DocuSign alternative?

**Method:** The in-house column is grounded in the code on `main` as of this
writing (file references throughout). The Documenso column is based on its
public documentation, GitHub repository, and published pricing as of
August 2026. Documenso's docs site is the authority for its feature claims;
nothing in the Documenso column was verified by running it.

---

## TL;DR — Recommendation

**Keep the in-house platform.** Documenso is an impressive, healthy project,
but for this product it would be a _sideways-to-backwards_ move:

1. **No compliance upgrade.** Both systems produce _standard_ electronic
   signatures under ECTA (Act 25 of 2002). Neither offers an ECTA s37
   _advanced_ electronic signature (that requires a SAAA-accredited provider,
   e.g. LAWtrust — Documenso's AES/QES story is eIDAS/EU-oriented, via
   third-party Trust Service Providers). Switching buys no legal standing.
2. **The in-house build's differentiators are exactly the SA-specific,
   advice-workflow-specific parts Documenso doesn't have** — ECTA consent
   registry with pinned versions, POPIA-gated SMS OTP (Clickatell/Twilio
   adapters), SA-ID validation and masking, KBA adapter hooks, Afrikaans and
   isiZulu signer i18n, CRM prefill tokens with a governance doc, evidence-pack
   ZIP export, per-firm retention policies, packet chaining, escalating
   reminders, and a client-management tab that reuses the same wizard
   in-process. All of that would be lost or need re-building against
   Documenso's API.
3. **Switching adds infrastructure and licensing that don't exist today.**
   Documenso self-hosted is a containerised Node + Prisma + PostgreSQL app;
   this product currently runs entirely on Supabase Edge Functions + Vercel
   with no container operations. Embedding Documenso Cloud inside the product
   is the Platform plan ($250/month, annual) — and self-hosting while
   embedding raises AGPL-3.0 obligations that their commercial licence exists
   to relieve.
4. **The real gaps in the in-house platform are ours to fix either way** and
   are already tracked (P12 key material in KV, OTP brute-force hardening,
   token-in-URL, half-wired dropdown/radio). Migrating wouldn't make them go
   away; several would reappear as migration work.

**Where Documenso is genuinely ahead**, treat as a backlog to borrow from, not
a reason to switch — see [§7](#7-what-to-borrow-from-documenso).

If this platform were being started today, self-hosted Documenso would be a
credible foundation. With ~68k lines of working, tested, firm-scoped,
compliance-framed e-sign code already integrated into the advice workflow, it
is not the right trade now.

---

## 1. The two systems at a glance

|            | **In-house (Navigate Wealth)**                                                                                                       | **Documenso**                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Nature     | Product module inside this repo                                                                                                      | Standalone product (SaaS + self-host)                                                                                                   |
| Scale      | ~236 files, ~68k lines (≈47.5k product, ≈14.4k tests); 16 Hono sub-apps mounted at `/esign` (`esign-routes.tsx`, `mount-modules.ts`) | ~14.8k GitHub stars, 4.1k+ commits, VC-backed company; external PRs currently paused                                                    |
| Stack      | Deno + Hono on Supabase Edge Functions; KV canonical store; React SPA frontends                                                      | TypeScript, React Router v7, Hono, Prisma, **PostgreSQL**, tRPC; swappable storage/signing/email/job providers                          |
| Licence    | Proprietary (ours)                                                                                                                   | AGPL-3.0 + commercial (Platform/Enterprise) dual licence                                                                                |
| Deployment | Already deployed with the product; no extra infra                                                                                    | Docker / Compose / K8s / Railway / Render / Koyeb / Elestio, or Documenso Cloud                                                         |
| Cost       | Engineering time only                                                                                                                | Cloud: free (5 docs/mo) → $25/mo individual → $40/mo teams (5 users) → $250/mo Platform → custom Enterprise. Self-host: free under AGPL |

## 2. Feature comparison

Legend: ✅ has it · 🟡 partial/caveat · ❌ not offered.

### 2.1 Envelope lifecycle

| Capability                            | In-house                                                                                                                                                                                                                     | Documenso                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Draft → send → sign → complete flow   | ✅ 10-state machine incl. transient `completing` (`esign-types.ts`)                                                                                                                                                          | ✅                                          |
| Sequential and parallel signing order | ✅ server-enforced (`esign-signer-guards.ts`), changeable post-send                                                                                                                                                          | ✅ signer ordering                          |
| Reminders                             | ✅ fixed _and_ escalating tiers (default day 3/7/10/13) + pre-expiry urgent tier, per-envelope config, bulk remind (`esign-reminder-service.ts`)                                                                             | 🟡 basic re-send/reminder                   |
| Expiry                                | ✅ `expiryDays` (default 30) + 6-hourly sweeps — in-process interval plus the pg_cron backstop (repaired 2026-08-26 after the green-when-broken cron incident; `docs/archive/production-readiness-ledger-2026.md` Section 0) | ✅ document expiry                          |
| Recall / void                         | ✅ recall with token rotation + recall emails; guarded delete state machine; bulk void                                                                                                                                       | ✅ void/delete                              |
| Recovery bin (soft delete)            | ✅ 90-day window, restore/hard-delete (`esign-recovery-bin.ts`)                                                                                                                                                              | ❌                                          |
| Multi-document envelopes              | ✅ ordered doc refs, page-level manifests (reorder/rotate/delete) (`esign-pdf-transform.ts`)                                                                                                                                 | 🟡 one PDF per document; combine beforehand |
| Packet workflows (chained envelopes)  | ✅ template chains that auto-advance on completion (`esign-packet-service.ts`)                                                                                                                                               | ❌                                          |
| Completion pipeline                   | ✅ background queue with retries + dead-letter; seal → certificate → hash → distribute (`esign-completion-queue.ts`, `esign-workflow.ts`)                                                                                    | ✅ (internally handled)                     |

### 2.2 Fields, templates, bulk

| Capability                             | In-house                                                                                                                                                                                     | Documenso                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Field types                            | 🟡 signature, initials, text, date, checkbox, **attachment**; dropdown/radio half-wired (schema + signer renderer, not in canonical union or palette — roadmap A19)                          | ✅ signature, initials, name, email, date, text, number, checkbox, radio, dropdown |
| File-attachment field (signer uploads) | ✅ dedicated private bucket, strict MIME allowlist, included in evidence pack                                                                                                                | ❌                                                                                 |
| Conditional logic                      | ✅ show/hide rules with 6 operators + `clearOnHide` (`ruleEngine.ts`)                                                                                                                        | ❌                                                                                 |
| Calculated fields                      | ✅ formula tokens with precision/prefix (`ruleEngine.ts`)                                                                                                                                    | ❌                                                                                 |
| Input validation                       | ✅ regex presets incl. `sa_id` (checksum-validated), phone, email, custom with live compile check (`FieldPropertiesPanel.tsx`)                                                               | 🟡 basic per-type validation                                                       |
| CRM prefill                            | ✅ closed token list (`client.*`, canonical `key:profile_*` shared with FNA prefill), lockable, audited, governance doc (`esign-prefill.ts`, `docs/compliance/form-prefill-esign-tokens.md`) | ❌ (API caller can pre-set field values, but no CRM binding)                       |
| Auto field detection                   | ✅ AcroForm widget parsing + text-anchor detection with accept/reject UI (`esign-pdf-analysis.ts`)                                                                                           | ❌ (open feature request)                                                          |
| Placement editor                       | ✅ studio with snap-to-grid, undo/redo, autosave, multi-select bulk reassign, page replication, preview-as-recipient (`PrepareFormStudio.tsx`)                                               | ✅ drag-and-drop editor                                                            |
| Templates                              | ✅ versioned; envelopes pin template id + version; rebuild-from-envelope (`esign-template-service.ts`)                                                                                       | ✅ templates (unversioned)                                                         |
| Direct/shareable signing links         | ❌                                                                                                                                                                                           | ✅ Direct Link templates (public link → each use creates a document)               |
| Bulk send                              | ✅ CSV or communication-group campaigns, per-row status, kill switch (`esign-campaign-service.ts`)                                                                                           | ✅ CSV bulk send from a template                                                   |

### 2.3 Signer authentication & identity

| Capability                            | In-house                                                                                                                                         | Documenso                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Tokenised email link                  | ✅ with rotation on recall/resend, audited                                                                                                       | ✅                                                                                       |
| OTP to email                          | ✅ CSPRNG, hashed at rest, constant-time compare (`esign-otp.ts`)                                                                                | 🟡 "Require 2FA" exists but is tied to a Documenso account, not a per-envelope email OTP |
| OTP to SMS                            | ✅ Twilio + **Clickatell (SA-local)** adapters, POPIA s69 opt-in gate (`sms-service.ts`)                                                         | ❌                                                                                       |
| Static access code                    | ✅ (non-constant-time compare — audit L-1, open)                                                                                                 | ❌                                                                                       |
| Account / passkey auth                | ❌                                                                                                                                               | ✅ require account, 2FA, or passkey                                                      |
| KBA (knowledge-based auth)            | 🟡 adapter framework (Smile ID / Onfido / Persona) — **all three are stubs today**; status surfaces on certificate + evidence (`kba-service.ts`) | ❌                                                                                       |
| Versioned consent registry            | ✅ immutable ECTA consent versions, pinned per envelope at send (`esign-consent-registry.ts`)                                                    | ❌ (implicit consent in the signing action)                                              |
| Signing capacity / reason attestation | ✅ optional prompt, printed on certificate                                                                                                       | ❌                                                                                       |
| Signature capture telemetry           | ✅ strokes, duration, method (draw/type/upload), printed on certificate                                                                          | ❌                                                                                       |

### 2.4 Cryptographic sealing & evidence

| Capability                          | In-house                                                                                                                                          | Documenso                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| PDF sealing                         | ✅ invisible PKCS#7/CMS via `@signpdf` (`esign-pdf-protect.ts`) — **fails open** (returns unsealed PDF on error)                                  | ✅ seals every signed document                                                                                 |
| Signing certificate                 | 🟡 self-signed X.509 (RSA-2048, CN "Navigate Wealth E-Signature Platform"); Adobe shows "validity UNKNOWN" until an AATL cert is used             | 🟡 you supply the P12 when self-hosting; their cloud uses their cert                                           |
| RFC 3161 trusted timestamps         | ❌                                                                                                                                                | ✅ supported                                                                                                   |
| AES/QES path                        | ❌ (adapter hooks only)                                                                                                                           | 🟡 via third-party Trust Service Providers (Cloud Signature Consortium API) — eIDAS/EU-oriented, not SAAA/ECTA |
| Completion certificate              | ✅ branded multi-page PDF: per-signer IP/UA/timestamps, telemetry, KBA result, consent text verbatim, full audit table (`esign-certificates.tsx`) | ✅ audit certificate                                                                                           |
| Evidence pack export                | ✅ ZIP: signed.pdf, certificate.pdf, audit.json, manifest.json, consent.txt, signer attachments (`esign-evidence-export.ts`)                      | ❌ (certificate + audit log, no bundled export)                                                                |
| Document hash verification endpoint | ✅ public `POST /verify-hash`                                                                                                                     | ❌                                                                                                             |
| Audit trail                         | ✅ ~65 action verbs, append-only KV + Postgres shadow-write; CSV export; firm-wide audit search — **no hash chaining**                            | ✅ audit log per document                                                                                      |

### 2.5 Compliance posture (South Africa)

| Aspect                                             | In-house                                                                                                                                                                                                                             | Documenso                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| ECTA framing                                       | ✅ explicit: consent registry wording, certificate integrity block, signer dialogs all cite Act 25 of 2002                                                                                                                           | ❌ no ECTA-specific claims; SES-compliant under ESIGN/UETA/eIDAS                                          |
| ECTA classification                                | Standard electronic signature (s13(3))                                                                                                                                                                                               | Standard electronic signature                                                                             |
| ECTA _advanced_ e-signature (s37, SAAA-accredited) | ❌                                                                                                                                                                                                                                   | ❌                                                                                                        |
| POPIA                                              | 🟡 SMS opt-in never inferred (s69 justification in code) — but the Supabase database lives in `us-east-2`, so signer data is already processed offshore and needs the same s72 transfer analysis (`src/utils/api/functionRegion.ts`) | 🟡 cloud adds a second offshore processor (fresh s72 analysis); self-host keeps data wherever you host it |
| Retention policies                                 | ✅ per-firm, three windows + artifact deletion, daily sweep (`esign-retention-service.ts`)                                                                                                                                           | ❌ (manual deletion)                                                                                      |
| SA identity handling                               | ✅ SA-ID checksum validation + masking (`signingIdentity.ts`)                                                                                                                                                                        | ❌                                                                                                        |

Note for both systems: ECTA excludes certain documents from electronic signing
entirely (wills, alienation of immovable property, long leases of land, bills
of exchange), and requires an _advanced_ electronic signature where a law
demands a signature without specifying the kind (e.g. suretyships). Neither
platform covers those cases; if AES ever becomes a requirement, the answer is
integrating a SAAA-accredited provider — an equal amount of work from either
starting point.

### 2.6 API, integrations, extensibility

| Capability                           | In-house                                                                                                                                                                                            | Documenso                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Public API                           | 🟡 read-mostly v1 (list/get envelopes, audit, signed PDF, templates) + `POST /v1/envelopes/from-template`; contract-tested. **No raw-upload create, no signing-session API** (`esign-v1-routes.ts`) | ✅ full REST API v1 + typed v2; create/send/recipients/fields; API access even on the free tier |
| API keys                             | ✅ per-firm, scoped, rotate/revoke, redacted after mint (`api-key-service.ts`)                                                                                                                      | ✅                                                                                              |
| Outbound webhooks                    | ✅ 7 events, HMAC-signed, durable outbox, backoff, dead-letter + replay UI, SSRF guard (`webhook-service.ts`)                                                                                       | ✅ webhooks                                                                                     |
| Embedded signing in third-party apps | ❌ (signing is first-party only)                                                                                                                                                                    | ✅ SDKs: React, Preact, Vue, Svelte, Solid, Angular, web components                             |
| CRM integration                      | ✅ in-process: client-management `EsignTab` reuses the wizard, pre-populates the client as signer, links `advice_case_id`/`product_id`/`request_id`, shared prefill resolver with FNA               | n/a (would be rebuilt over API/embedding)                                                       |
| Zapier etc.                          | ❌                                                                                                                                                                                                  | ✅ Zapier integration                                                                           |

### 2.7 Operations & observability

| Capability            | In-house                                                                                                                                               | Documenso                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Metrics               | ✅ funnel (sent→opened→started→completed), time-to-sign by template, stuck list, 30-day throughput (`esign-metrics-service.ts`) — KV-scan based        | 🟡 basic dashboard                                           |
| Synthetic probes      | ✅ hourly hermetic probe with SLO + history ring (`esign-synthetic-probe.ts`)                                                                          | ❌ (self-host: bring your own)                               |
| Stuck-envelope alerts | ✅ email + in-app + `envelope.stuck` webhook, cooldown (`esign-stuck-alert-service.ts`)                                                                | ❌                                                           |
| Rate limiting         | ✅ six tuned buckets (OTP send/verify, signer access/submit, sender bulk/mutate) (`esign-rate-limit.ts`)                                               | 🟡 platform-level                                            |
| Scheduled jobs        | ✅ 9 in-process interval jobs + `/maintenance/*` + `/cron/*` endpoints — runs only while an instance is warm, backstopped by the repaired pg_cron jobs | ✅ background-job provider (proper worker model)             |
| Who fixes it at 2am   | Us                                                                                                                                                     | Us (self-host) or Documenso (cloud, with SLAs on Enterprise) |

### 2.8 Branding, notifications, i18n

| Capability                          | In-house                                                                                                                                                               | Documenso                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Per-tenant branding of signing page | ✅ per-firm logo/accent/support email, validated, zero-round-trip delivery (`esign-branding-service.ts`) — fixed "Powered by Navigate Wealth" footer, no custom domain | ✅ org/team branding incl. custom CSS (Platform plan); teams inherit org branding |
| Sender notification prefs           | ✅ every-event / completion-only / nightly digest / off (`esign-notification-prefs.ts`)                                                                                | 🟡 basic                                                                          |
| In-app notification bell            | ✅ unconditional per-user queue (`esign-inapp-notifications.ts`)                                                                                                       | ❌                                                                                |
| Signer i18n                         | 🟡 en / **af / zu** typed dictionary — ~13 keys; main surface still English (`esign-signer/i18n.ts`)                                                                   | ✅ broader i18n via Lingui (community translations, EU-centric)                   |

### 2.9 Storage & multi-tenancy

| Aspect          | In-house                                                                                                                                                                         | Documenso                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Canonical store | 🟡 KV (`kv_store_91ed8379`); Postgres tables exist as an **off-by-default dual-write shadow with no read path** (`esign-postgres-repo.ts`, unapplied migration `20260420000001`) | ✅ PostgreSQL via Prisma — queryable, indexable, reportable |
| Object storage  | ✅ four private Supabase buckets (docs, signatures, certificates, attachments)                                                                                                   | ✅ swappable (S3-compatible etc.)                           |
| Multi-tenancy   | ✅ firm scoping from trusted app metadata on every route; IDOR family closed and pinned by tests (`esign-firm-scope.ts`, `esign-object-authz.test.ts`)                           | ✅ organisations → teams model                              |

## 3. Where Documenso is clearly better

1. **Data model.** Postgres-first with Prisma vs our KV-canonical store with
   scan-based analytics and a stalled dual-write cutover. Their model is what
   our roadmap is slowly walking toward.
2. **API completeness & embedding.** Full create/send API, typed v2 API, and
   first-class embedded signing SDKs. Our public API can't create an envelope
   from a raw upload and has no embedded-signing story.
3. **Field-type completeness.** All ten field types actually shipped; our
   dropdown/radio are half-wired (roadmap A19 leftover).
4. **Trusted timestamps.** RFC 3161 support out of the box; we have none.
5. **Direct links.** Public reusable signing links — useful for mandate/consent
   forms; we have no equivalent.
6. **Worker model.** Real background-job providers vs our `setInterval`-on-warm
   -instance scheduler with pg_cron as backstop — workable, but the 2026-08
   cron incident showed how quietly that path can rot while reporting green.
7. **Many hands.** A funded team and community continuously ship fixes;
   our module only improves when we spend our own engineering time.

## 4. Where the in-house platform is clearly better (for us)

1. **SA compliance framing end-to-end:** ECTA consent registry with immutable
   pinned versions, POPIA-justified SMS opt-in, SA-ID validation/masking,
   Afrikaans/isiZulu signer strings, ECTA-cited certificate.
2. **Stronger signer-identity evidence:** per-envelope email/SMS OTP, access
   codes, KBA hooks surfaced on the certificate, signing-capacity attestation,
   signature-capture telemetry, versioned consent text in the evidence pack.
   Documenso's strongest signer auth requires the signer to hold a Documenso
   account — a non-starter for one-off advice clients.
3. **Evidence-pack ZIP** (signed PDF + certificate + audit JSON + manifest +
   consent text + attachments) — exactly what a compliance officer or
   ombud/FAIS query needs, one click.
4. **Advice-workflow integration in-process:** EsignTab inside client
   management, CRM prefill with governance, `advice_case_id`/`product_id`
   linkage, packet chaining for multi-step advice journeys, escalating
   reminders tuned to advice timelines.
5. **Firm-level controls:** retention policies, recovery bin, branding, firm
   admin routes, metrics — all scoped to our existing firm model and auth.
6. **Conditional + calculated fields and attachment fields** — none of which
   Documenso has.

## 5. What replacement would actually cost

Not a build-vs-buy on features alone — the switching costs are structural:

- **New infrastructure class.** Self-hosted Documenso = containerised Node +
  PostgreSQL + SMTP + storage + background workers. We currently operate zero
  containers; everything is Supabase Edge + Vercel. That's new deploy
  pipelines, patching, monitoring, and a second database to back up (the
  weekly backup + DR-rehearsal workflow — itself still awaiting its first
  successful live run — covers the Supabase project only).
- **Licensing.** AGPL-3.0 is fine for internal use, but embedding the signing
  experience inside our commercial product is precisely the case their
  commercial Platform licence ($250/mo cloud, or paid self-host licence)
  exists for. Cloud also adds a second offshore processor of signer PII →
  fresh POPIA s72 transfer analysis (our own stack already processes data in
  `us-east-2` — see §2.5).
- **Rebuild the integration layer.** EsignTab, prefill, packet flows,
  campaign bulk-send against communication groups, firm-scoped metrics — all
  would be re-implemented over Documenso's API/webhooks/embeds.
- **Port or lose the compliance layer.** Consent registry, SMS OTP, SA-ID
  checks, retention, evidence pack: either contribute them upstream (external
  PRs are currently paused), maintain a fork (AGPL fork of a fast-moving
  codebase), or lose them.
- **Migrate live evidence.** Completed envelopes, sealed PDFs, hashes, audit
  trails, and consent versions must remain retrievable for years. Running two
  systems in parallel for the retention tail is effectively guaranteed.

Estimated realistically, replacement is a multi-month project that ends with
_fewer_ SA-specific capabilities than we have today.

## 6. When to revisit this decision

- If the firm decides to **stop investing engineering time in e-sign** as a
  differentiator — then Documenso Cloud (Teams/Platform) with a thinner
  integration is the honest cheaper path, accepting the compliance-feature
  regression.
- If **AES becomes a business requirement** (e.g. suretyship signing): neither
  system helps today; evaluate SAAA-accredited providers (LAWtrust/SigniFlow)
  at that point, possibly alongside whichever platform remains.
- If Documenso ships **KBA, per-envelope OTP without accounts, or an
  evidence-pack export**, the gap narrows materially — worth a yearly
  re-check of their changelog.

## 7. What to borrow from Documenso

Concrete, already-tracked-or-new backlog items, in rough priority order:

1. **AATL-trusted signing certificate + RFC 3161 timestamping.** Replace the
   self-signed P12 so Adobe shows a green tick, and countersign with a TSA.
   Do this together with the outstanding S4/H-5 operator step (get the P12 and
   passphrase out of KV via `NW_ESIGN_REQUIRE_ENV_CERT=true`, rotate the
   KV-resident key).
2. **A real background-job runner for the sweeps.** Today they ride
   `setInterval` on a warm Edge instance with pg_cron as backstop — repaired
   2026-08-26 after running green-while-broken for months; Documenso's
   swappable job-provider model is the direction to move toward.
3. **Finish dropdown/radio** (and consider name/email/number field types) —
   closes the A19 remainder.
4. **Envelope-create API from raw upload**, then an embedded/direct-link
   signing surface if product ever needs signing outside the first-party app.
5. **Postgres read path** for metrics and audit search (the dual-write
   scaffold already exists; their Prisma-first model is the destination).
6. **Widen signer i18n** beyond the current ~13 keys to the full signing
   surface — we already have the af/zu scaffolding they don't.

---

## Appendix: sources

In-house platform: code on `main` (`src/supabase/functions/server/esign-*`,
`src/components/esign-signer/`, `src/components/admin/modules/esign/`),
`docs/archive/production-readiness-ledger-2026.md`, `docs/archive/2026-06-security-audit.md`,
`docs/ROADMAP.md`, `docs/compliance/form-prefill-esign-tokens.md`.

Documenso (retrieved August 2026):

- [Documenso GitHub repository](https://github.com/documenso/documenso) — stack, licence, deployment options, activity
- [Documenso docs](https://docs.documenso.com/) — [signature levels](https://docs.documenso.com/docs/compliance/signature-levels), [standards & regulations](https://docs.documenso.com/docs/compliance/standards), [signing certificate](https://docs.documenso.com/docs/self-hosting/configuration/signing-certificate), [fields](https://docs.documenso.com/docs/users/documents/add-fields), [sending & recipient authentication](https://docs.documenso.com/users/documents/sending-documents), [templates](https://docs.documenso.com/docs/users/templates/use), [direct links](https://docs.documenso.com/docs/users/documents/direct-links), [embedding](https://docs.documenso.com/developers/embedding), [recipients API](https://docs.documenso.com/docs/developers/api/recipients)
- [Advanced signing fields announcement](https://documenso.com/blog/introducing-advanced-signing-fields)
- [Organizations announcement](https://documenso.com/blog/organizations-the-foundation-of-enterprise-for-documenso)
- [Direct Link feature page](https://documenso.com/features/direct-link)
- Pricing as summarised in the [2026 pricing teardown](https://dev.to/beton/documenso-pricing-teardown-3ic6) and Documenso's pricing page
- ECTA context: [Juro — e-signature legality in South Africa](https://juro.com/esignature-legality/south-africa), [Adobe — SA e-signature regulations](https://helpx.adobe.com/legal/esignatures/regulations/south-africa.html), [Dommisse Attorneys — electronic signatures in SA](https://dommisseattorneys.co.za/blog/understanding-electronic-signatures-in-south-africa/)
