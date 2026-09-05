# GoAML morning digest

Daily 08:00 SAST check of the FIC goAML web portal, mailed to the nominated
compliance inboxes through Navigate Wealth's transactional email path.

This is **not** a `pg_cron` scraper. goAML is a browser portal with an email
OTP. The Edge Function cannot complete that login. A Cursor Automation does
the browser work; the application only accepts the scan and sends the email.

## How the pieces fit

```text
08:00 SAST  (cron 0 6 * * *  — SAST is UTC+2)
    │
    ▼
Cursor Automation
    1. Open https://goweb.fic.gov.za/goAMLWeb_PRD/Account/LogOn
    2. Sign in with GOAML_USERNAME / GOAML_PASSWORD from Automation secrets
    3. Read the OTP from info@navigatewealth.co (Outlook / Microsoft 365)
    4. Enter the OTP and land on the portal
    5. Scan notices / messages / outstanding items / news
    6. GET  /goaml-digest/latest   (optional — yesterday's snapshot)
    7. POST /goaml-digest/notify   (structured scan, never credentials)
    │
    ▼
Edge Function  make-server-91ed8379
    • Diff against the last snapshot
    • Render template  goaml_scan_digest
    • sendEmail() to NW_GOAML_DIGEST_TO
      (default: shawn@navigatewealth.co + helen@directfp.co.za)
```

Edit the email in **Communication → Transactional Emails → GoAML Morning Digest**.
Disabling that template stops the send without disabling the automation.

## Operator secrets (never commit these)

Set as **Supabase Edge Function secrets** (Project → Edge Functions → Secrets):

| Secret                  | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `NW_GOAML_DIGEST_TOKEN` | Shared secret the automation sends as `x-nw-goaml-digest-token` |
| `NW_GOAML_DIGEST_TO`    | Optional override of the recipient list (comma-separated)       |

Set as **Cursor Automation secrets** (not Edge Function, not git):

| Secret                  | Purpose                                |
| ----------------------- | -------------------------------------- |
| `GOAML_USERNAME`        | goAML portal username                  |
| `GOAML_PASSWORD`        | goAML portal password                  |
| `NW_GOAML_DIGEST_TOKEN` | Same value as the Edge Function secret |

The Edge Function never receives the goAML password or the OTP. If either
appears in a notify payload, the route strips those keys before persist/mail.

## Endpoints

Base:

```text
https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379
```

| Method | Path                   | Purpose                                      |
| ------ | ---------------------- | -------------------------------------------- |
| `GET`  | `/goaml-digest/latest` | Last stored snapshot (for the next-day diff) |
| `GET`  | `/goaml-digest/status` | Latest snapshot + last send                  |
| `POST` | `/goaml-digest/notify` | Accept a scan and send the digest            |

Auth (any one of):

- Header `x-nw-goaml-digest-token: <NW_GOAML_DIGEST_TOKEN>`
- Shared cron header `x-nw-cron-auth` (Vault token)
- `Authorization: Bearer <service-role or SUPER_ADMIN_PASSWORD>` (manual)

### Notify body

```json
{
  "loginSucceeded": true,
  "otpRequired": true,
  "otpSucceeded": true,
  "sourceUrl": "https://goweb.fic.gov.za/",
  "scannedAt": "2026-09-05T06:05:00.000Z",
  "updates": [
    {
      "title": "Outstanding registration query",
      "summary": "FIC requested supporting documents.",
      "href": "https://goweb.fic.gov.za/…",
      "area": "Messages",
      "severity": "attention"
    }
  ],
  "notes": "Dashboard looked unchanged aside from the message above.",
  "dryRun": false,
  "force": false
}
```

`severity` is `info` | `attention` | `urgent`. A second identical notify on
the same SAST day is ignored unless `force` is true. `dryRun` renders and
diffs but does not send or persist.

Always POST a notify when login fails (`loginSucceeded: false`) so the
operators still get the mail.

## Manual test (after the Edge Function secret is set)

```bash
curl -sS -X POST \
  "$SUPABASE_FUNCTIONS_BASE_URL/make-server-91ed8379/goaml-digest/notify" \
  -H "Content-Type: application/json" \
  -H "x-nw-goaml-digest-token: $NW_GOAML_DIGEST_TOKEN" \
  -d '{
    "loginSucceeded": true,
    "otpRequired": false,
    "updates": [{"title":"Dry-run notice","summary":"Endpoint check","severity":"info"}],
    "dryRun": true
  }'
```

Expect `{ "success": true, "outcome": "dry_run", "sent": false }`. Repeat
with `"dryRun": false` only when you want a real email.

---

## Cursor Automation — how to set it up

1. Open **Cursor → Automations → New**.
2. **Trigger:** On a schedule. Custom cron: `0 6 * * *` (08:00 SAST / 06:00 UTC).
3. **Tools:** Browser. Outlook / Microsoft 365 (or whatever reads `info@navigatewealth.co`). MCP only if the editor lists a connected, authenticated mail server. Do not invent a server name.
4. **Secrets:** `GOAML_USERNAME`, `GOAML_PASSWORD`, `NW_GOAML_DIGEST_TOKEN`. Never paste them into the prompt.
5. **Repo:** this Navigate Wealth repo, default branch.
6. **Name:** `GoAML morning digest`.
7. **Description:** Sign in to the FIC goAML portal at 08:00 SAST, scan for updates, and post the result to Navigate Wealth so the transactional digest is mailed.
8. Paste the prompt below into the automation instructions.

### Prompt to paste

```text
You are the Navigate Wealth goAML morning scanner. Run this exactly once per trigger.

GOAL
Sign in to the FIC goAML web portal, scan for anything new, and POST a structured
report to the Navigate Wealth Edge Function so it can send the branded digest.
You do not send the email yourself.

SECRETS (read from Automation secrets — never print them, never put them in URLs,
never include them in the notify JSON, never write them to the repo)
- GOAML_USERNAME
- GOAML_PASSWORD
- NW_GOAML_DIGEST_TOKEN

URLS
- Login: https://goweb.fic.gov.za/goAMLWeb_PRD/Account/LogOn
- Home:  https://goweb.fic.gov.za/
- Latest snapshot:
  GET https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/goaml-digest/latest
  Header: x-nw-goaml-digest-token: $NW_GOAML_DIGEST_TOKEN
- Notify:
  POST https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/goaml-digest/notify
  Header: x-nw-goaml-digest-token: $NW_GOAML_DIGEST_TOKEN
  Header: Content-Type: application/json

STEPS
1. GET /goaml-digest/latest and keep the returned snapshot for comparison.
2. Open the login URL in the browser. If you are already on the portal home,
   skip to step 6.
3. Fill the username and password from secrets. Submit the form.
4. When the portal asks for a one-time PIN:
   a. Wait up to 3 minutes for a new email in info@navigatewealth.co.
   b. Search recent mail for FIC / goAML / one-time / OTP / verification.
   c. Use only an email that arrived after this run started.
   d. Type the code into the portal. Do not store it.
5. If login or OTP fails: POST notify with
   { "loginSucceeded": false, "otpRequired": true, "otpSucceeded": false,
     "updates": [], "notes": "<what failed, no secrets>" }
   then stop.
6. Walk the authenticated portal. Open every obvious inbox / notices /
   messages / outstanding reports / news / circulars surface. For each
   item that a compliance officer would care about, capture:
   { "title", "summary", "href" (absolute if possible), "area",
     "severity": "info" | "attention" | "urgent" }
   Cap at 50 items. Prefer items that are not in yesterday's snapshot.
   If the portal is unchanged, send updates: [] — the app still mails a
   "no new updates" heartbeat.
7. POST /goaml-digest/notify with:
   {
     "loginSucceeded": true,
     "otpRequired": <boolean>,
     "otpSucceeded": <boolean>,
     "sourceUrl": "<page you ended on>",
     "scannedAt": "<ISO now>",
     "updates": [ ... ],
     "notes": "<one or two sentences, no secrets>"
   }
8. Confirm the JSON response has success true. If it is skipped_duplicate,
   that is OK — the same scan already mailed today.
9. Sign out of goAML if a logout control is visible.

HARD RULES
- Never commit, log, screenshot, or email the password or OTP.
- Never put password, otp, username, or token fields in the notify body.
- Never invent filings or mark the portal "all clear" without looking.
- Never deploy, push, or edit application code during this run.
- If Outlook/mail tools are missing, fail the login notify (step 5) rather
  than guessing an OTP.
```
