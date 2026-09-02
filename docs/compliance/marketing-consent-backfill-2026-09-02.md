# Marketing consent backfill — 2026-09-02

Record of a one-off production data change to `_applicationMeta.communicationConsent`
on client profiles. Written because this field is a consent record: it gates
marketing email and is rendered as "Marketing Consent" in the client and audit
exports (`reporting-service-clients.ts:201`, `reporting-service-audits.ts:93`).

## Why

Before this change, **0 of 186** active client profiles carried
`_applicationMeta` at all, so every consumer of the flag read `false` for every
client. The birthday digest (`calendar-digest-routes.ts:364`) reported
"No marketing consent" against all 186.

That `false` was not an answer from clients. Checking the application records
behind those profiles:

| origin             | recorded `communicationConsent` | count |
| ------------------ | ------------------------------- | ----- |
| `admin_import`     | `false`                         | 183   |
| `self_service`     | `true`                          | 2     |
| `self_service`     | `false`                         | 1     |
| `self_service`     | absent                          | 1     |
| `super_admin_test` | absent                          | 1     |
| `admin_import`     | absent (no `user_id`)           | 1     |

The 183 `admin_import` rows are bulk-created client shells. `false` there is the
hard-coded default in `admin-client-onboarding-service.ts:289` — those clients
were never shown the opt-in and never answered it. Only the four `self_service`
records carry a real answer, from the checkbox in
`Step5Terms.tsx:459` ("I would like to receive marketing communications…").

So the flag was not recording refusals; it was recording the absence of a
question. The business confirmed the imported clients have consent on the basis
of their existing advisory agreements, and authorised the backfill.

## What changed

1. **179 client profiles** (`user_profile:{id}:personal_info`) — set
   `_applicationMeta.communicationConsent = true`, tagged
   `communicationConsentSource: 'admin_backfill'` and
   `communicationConsentBackfilledAt: '2026-09-02'` so the provenance is legible
   and this is never mistaken for a client-supplied tick.
   Scope was the 183 `admin_import` profiles minus 4 whose accounts are
   closed/suspended.

2. **182 application records** (`application:{id}.application_data`) — set
   `communicationConsent = true`. Needed for durability: these sit in
   `submitted` status, where `mergeProfileOnApproval`
   (`profile-application-sync.ts:437`) copies `_applicationMeta` from the
   application over the profile. Without this, approving a client would silently
   revert their consent to `false`.

3. **2 self-service profiles** — propagated their genuine `true` onto the
   profile, tagged `communicationConsentSource: 'client_optin'`. These clients
   had consented and the system was under-reporting them.

## What was deliberately left alone

- **The one client who declined.** A `self_service` applicant who saw the opt-in
  and left it unticked. Their profile carries no consent flag and was not
  touched. (Account is currently suspended; the decline stands regardless.)
- **1 approved application.** Approved applications are frozen audit records
  (`profile-application-sync.ts:9`) and must not be mutated. Its profile was
  backfilled; the application record was not.
- **4 closed/suspended accounts** among the `admin_import` set.
- **3 profiles with no application record**, 1 `super_admin_test` record, and
  1 orphan application with no `user_id`.

## Resulting state

181 of 186 active profiles now read as consented (179 backfilled, 2 genuine
opt-ins); 160 of those also have a date of birth on file.

## How to reverse

The markers make the backfilled set exactly recoverable — only rows written by
this change carry `communicationConsentSource = 'admin_backfill'`:

```sql
update kv_store_91ed8379
set value = jsonb_set(value, '{_applicationMeta,communicationConsent}', 'false'::jsonb, true)
where key like 'user_profile:%:personal_info'
  and value->'_applicationMeta'->>'communicationConsentSource' = 'admin_backfill';
```

The application-record half (step 2) is not distinguishable after the fact and
would need restoring from a backup taken before 2026-09-02.

## Follow-up worth doing

`admin-client-onboarding-service.ts:283-289` still hard-codes every consent to
`false` for admin-created clients, and nothing prompts those clients to answer
later. The next bulk import reintroduces exactly this problem.
