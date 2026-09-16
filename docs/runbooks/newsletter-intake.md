# Newsletter intake — how the monthly routine hands over a PDF

The admin **Newsletters** module sends a finished PDF newsletter to one or more
communication groups: an admin uploads the PDF, writes a title and a short
description, picks the audience and sends (now or scheduled). Recipients get the
PDF attached and a tracked "Read the newsletter" button; read rate is the share
of delivered recipients who clicked through. There is no tracking pixel.

A monthly routine can produce the PDF instead of a person. This runbook is the
contract for handing it over. Whichever path it uses, the result is the same:
a **draft awaiting admin approval** and one **"Newsletter draft ready for
review" email** to the admin inbox with a link straight to the draft. Nothing
is sent to subscribers until an admin approves it in the admin.

## Two ways in

```text
                     ┌──────────────────────────────────────────────┐
  HTTPS (multipart)  │ POST /newsletter-intake/submit               │
  ─────────────────▶ │  token: x-nw-newsletter-intake-token         │──┐
                     └──────────────────────────────────────────────┘  │
                                                                       ▼
                     ┌──────────────────────────────────────────────┐  draft (source: routine)
  SQL (connector)    │ select * from public.newsletter_intake_submit│  + PDF in the private bucket
  ─────────────────▶ │  (…, pdf_base64, …)  → row status 'pending'  │  + review email to admin
                     └──────────────────────────────────────────────┘  ▲
                            │ every 2 min the newsletter cron tick      │
                            │ sweeps one pending row ───────────────────┘
```

**Which one to use.** A routine that can reach the Edge Function over HTTPS
(a GitHub Action, n8n, Make, a Cursor Automation) uses the endpoint. A Claude
or ChatGPT Routine cannot: their environments block egress to the Edge
Function (see `social-automation.md`) but do have the **Supabase connector**,
so they use the SQL function. This sandbox confirmed the block (proxy 403).

## Limits, both paths

| Limit                | Value                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| PDF size             | **5 MB** (checked by bytes; the file must start with `%PDF-`)                                          |
| SQL path recommended | **≤ 4 MB** — the base64 rides inside one SQL statement through the connector; keep the issue lean      |
| Title                | 1–150 characters (also the email subject)                                                              |
| Description          | 1–1000 characters (shown in the email above the Read button)                                           |
| Audience ids         | communication group ids; default `sys_newsletter_contacts` (every confirmed, non-opted-out subscriber) |
| Idempotency key      | 1–64 of `A-Za-z0-9._-`, e.g. `2026-09`; a replay returns the earlier draft and sends no second email   |

Why 5 MB and not more: the PDF is attached to every email as base64 and the
delivery tick sizes its concurrent batch from that; larger files would exhaust
the Edge isolate. See the header of `newsletter-studio-storage.ts`.

## Operator secrets (never commit these)

Set as **Supabase Edge Function secrets** (Project → Edge Functions → Secrets):

| Secret                       | Purpose                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `NW_NEWSLETTER_INTAKE_TOKEN` | Shared secret the routine sends as `x-nw-newsletter-intake-token` (HTTPS path only)             |
| `NW_NEWSLETTER_REVIEW_TO`    | Optional comma list of admin recipients for the review email (default `info@navigatewealth.co`) |

The SQL path needs no secret: the Supabase connector runs as the service role,
which is the only role granted execute on the intake functions.

## Path 1 — HTTPS endpoint

Base:

```text
https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379
```

| Method | Path                        | Purpose                                                |
| ------ | --------------------------- | ------------------------------------------------------ |
| `GET`  | `/newsletter-intake/lists`  | The audience ids and names the routine may name        |
| `POST` | `/newsletter-intake/submit` | Multipart hand-over: PDF + title + description → draft |

Auth (any one of):

- Header `x-nw-newsletter-intake-token: <NW_NEWSLETTER_INTAKE_TOKEN>`
- Shared cron header `x-nw-cron-auth` (Vault token)
- `Authorization: Bearer <service-role or SUPER_ADMIN_PASSWORD>` (manual)

Fields (multipart/form-data):

| Field            | Required | Notes                                                              |
| ---------------- | -------- | ------------------------------------------------------------------ |
| `file`           | yes      | the PDF                                                            |
| `title`          | yes      |                                                                    |
| `description`    | yes      |                                                                    |
| `listIds`        | no       | JSON array (`["sys_all","g2"]`) or comma list; default subscribers |
| `idempotencyKey` | no       | recommended, e.g. `2026-09`                                        |
| `submittedBy`    | no       | shown in the review email, e.g. `github-action`                    |
| `dryRun`         | no       | `true` validates everything and writes nothing                     |

```bash
curl -sS -X POST "$BASE/newsletter-intake/submit" \
  -H "x-nw-newsletter-intake-token: $NW_NEWSLETTER_INTAKE_TOKEN" \
  -F "file=@september-2026.pdf" \
  -F "title=September 2026 newsletter" \
  -F "description=Rates, retirement annuities and the two-pot changes explained." \
  -F "idempotencyKey=2026-09" \
  -F "submittedBy=github-action"
```

Responses:

- `201 { success, campaignId, duplicate: false, reviewUrl, notified }` — draft created, email sent (`notified: false` means the draft exists but the email failed; the admin will still see it pinned in the module).
- `200 { …, duplicate: true }` — the idempotency key was already used; nothing new was created or mailed.
- `400 { error }` — not a PDF, over 5 MB, missing title/description, or an unknown audience id (the message lists the valid ids).
- `401` — no valid token.

## Path 2 — SQL through the Supabase connector

Migration `newsletter_intake` (in `supabase/migrations/`) creates the table
`public.newsletter_intake` and two functions granted to `service_role` only.

Hand over:

```sql
select *
from public.newsletter_intake_submit(
  p_title           => 'September 2026 newsletter',
  p_description     => 'Rates, retirement annuities and the two-pot changes explained.',
  p_pdf_base64      => '<base64 of the PDF>',
  p_file_name       => 'september-2026.pdf',
  p_idempotency_key => '2026-09',
  p_list_ids        => null,              -- null = subscribers; or '{sys_all,g2}'
  p_submitted_by    => 'claude-routine'
);
-- → (id, existed, status). existed = true means the key was used before.
```

The function validates the base64, the `%PDF-` header and the 5 MB cap and
raises a plain-English exception on any of them, so a bad hand-over fails in
the routine's own run rather than silently two minutes later.

Confirm it was picked up (the newsletter cron tick sweeps one pending row per
2-minute run):

```sql
select * from public.newsletter_intake_status('2026-09');
-- status 'processed' + campaign_id once the draft exists; 'failed' + error otherwise.
```

Once processed the row's `pdf_base64` is nulled, so the table never grows.

### Claude Routine

One Routine, fresh session per fire, monthly (e.g. first Monday 05:00 UTC),
connector **Supabase** (plus whatever the routine needs to produce the PDF).
Prompt: run the `newsletter-monthly-intake` skill
(`.claude/skills/newsletter-monthly-intake/SKILL.md`), which spells out the
hand-over above. The routine's job ends at the hand-over; it never sends.

## What the admin sees

1. The review email: "Newsletter draft ready for review: <title>", with the
   description, file name and size, audience and who submitted it, and a
   **Review the draft** button to `https://www.navigatewealth.co/admin?module=newsletter&campaign=<id>`.
2. In **Newsletters**, the draft is pinned under "Waiting for your review" and
   flagged "awaiting review" in the list.
3. On the draft: preview the PDF, adjust title / description / audience, send a
   test to their own address, then **Send now** or **Schedule**.

## Failure modes

| Symptom                                              | Cause and fix                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `401` from the endpoint                              | `NW_NEWSLETTER_INTAKE_TOKEN` is unset or differs from what the routine sends. Empty on either side never matches.                                                  |
| `400 … not a PDF`                                    | The bytes do not start with `%PDF-`. A renamed file, an HTML error page saved as `.pdf`, or a base64 of something else.                                            |
| `400 … limit is 5 MB`                                | Compress images in the PDF; the cap is deliberate (see above).                                                                                                     |
| SQL row stays `pending` for more than a few minutes  | The newsletter cron tick is not running: check `newsletter-studio-process-campaigns` in `scheduled-jobs.md` (the module header shows "Scheduler live" when it is). |
| SQL row `failed` with an error                       | The error column says why (bad PDF, unknown audience). Fix and hand over again with a **new** idempotency key — the old key is now taken by the failed row.        |
| Draft exists but no email arrived                    | The response said `notified: false`; check the Edge Function logs for `newsletter-intake-notify`. The draft is still pinned in the module.                         |
| Routine reports success but the module shows nothing | Look for `duplicate: true` / `existed = true`: the key was reused, so the earlier draft (possibly already sent) is the one it refers to.                           |
