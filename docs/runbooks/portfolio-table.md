# Portfolio table — the provider book, and the endpoint an external agent updates it through

**What this is.** For one provider and one product category, a table with a
row per client policy and a column per field of the Product Structure, plus
when each record was last updated and which policy print (PDF) is on file.
Advisers see it in **Product Configuration → Integrations → Portfolio**;
they can download it as a spreadsheet, amend it and upload it back. The same
table is served as JSON at `/integrations/portfolio-table`, which is where an
outside agent (a scheduled bot such as Grok, ChatGPT or a Claude routine)
reads the book and posts corrections.

This is the **second way** policy details get updated. The first is the
native path — the portal worker and the Review tab, where proposed changes are
staged and an adviser publishes them. This path applies directly, which is why
every caller can dry-run first, why a field an adviser has locked is never
overwritten, and why every write leaves a persisted run and a history entry.

```text
  Adviser                     Edge Function                          Agent (Grok / ChatGPT / Claude)
┌──────────────┐  download   ┌───────────────────────────────┐  GET   ┌──────────────────────┐
│ Portfolio tab│◄───────────►│ /integrations/portfolio-table │◄──────►│ reads the book       │
│ amend, upload│  upload     │  columns = Product Structure  │  POST  │ posts corrected rows │
└──────────────┘             │  match = client + policy no.  │        └──────────────────────┘
                             └──────────────┬────────────────┘
                                            │ publishSyncRun (locks hold, totals recalculated,
                                            ▼ integrationSyncHistory source = portfolio_table)
                                   policies:client:<clientId>
```

## The table

| Column                 | Meaning                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `Client`               | The client's display name, from their profile. One of the two match keys.                           |
| one per schema field   | The Product Structure fields for the category, in schema order. The policy-number field is flagged. |
| `Last Updated`         | ISO timestamp of the last write to the policy record. Read-only.                                    |
| `Policy Print`         | File name and upload date of the most recent PDF on file, or empty. Read-only.                      |
| hidden `_NW …` columns | Policy id, client id, provider id, category id. Keep them: they pin a row to its exact record.      |

Rows are sorted by client name, then policy number. Archived policies are not
included. The book holds only policies filed under **exactly** the requested
category id — its columns come from that one schema, and a row can never write
one schema's field ids into a policy that uses another. Use the leaf ids
`GET /providers` lists (`retirement_pre`, `employee_benefits_risk`, …); a
parent id such as `retirement_planning` returns only legacy policies filed
under the parent itself, never its children.

## How a row finds its policy

1. **Hidden ids first.** A row carrying `_NW Policy ID` + `_NW Client ID`
   (or `policyId` + `clientId` in JSON) targets that exact record. The client
   name on the row, when given, must still match the record's owner.
2. **Otherwise client name + policy number.** The policy number is normalised
   (case, spaces, dashes ignored) and the client name is folded (case, accents,
   punctuation, word order — `Nkosi, Thandi` matches `Thandi Nkosi`).

| Outcome           | Meaning                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `updated`         | Matched and at least one cell differed; written (or, in a dry run, would be written).                                             |
| `unchanged`       | Matched; nothing differed, or every differing field was locked.                                                                   |
| `unmatched`       | No policy in this provider/product carries that number.                                                                           |
| `client_mismatch` | The number exists but belongs to a different client (`matchedClientName` says who). Never applied.                                |
| `duplicate`       | Two identical policies for that client share the number; use the hidden ids to pick one.                                          |
| `invalid`         | A missing key, a cell that fails its field type (currency, date, dropdown…), or ids that match nothing. The whole row is refused. |
| `failed`          | Matched and applied, but the write failed at publish time (the row's warnings say why).                                           |

Other rules:

- **Locks hold.** A field an adviser locked on the policy is reported in
  `warnings` and left alone, whatever the source.
- **Blank cells do nothing** unless the field's binding in Mapping
  Configuration says _Clear on blank_ (then a blank stages a clear) or _Error on
  blank_ (then the row is invalid). Same rules as a template upload.
- **Values are coerced by field type** exactly as a spreadsheet upload's are:
  `R 125,000` becomes `125000`, an Excel date serial becomes `YYYY-MM-DD`,
  `group life` resolves to the dropdown option `Group Life`.
- **Unknown columns are ignored** with a warning; `Last Updated` and
  `Policy Print` are read-only.
- **Provenance.** An applied row appends `{ source: 'portfolio_table', fieldsApplied }`
  to the policy's `integrationSyncHistory`, the run is persisted under
  `sync-run:<runId>` (readable with `GET /integrations/sync-runs/<runId>` as an
  admin), and a history entry feeds the Integrations header's "last sync".
  A run that changed nothing and hit no errors leaves no history entry, so a
  bot on a tight schedule does not fill the namespace.
- **Idempotent.** Re-sending the same values reports `unchanged` and writes
  nothing.

## The endpoint

Base: `https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/integrations/portfolio-table`

| Method | Path         | Purpose                                                                                   |
| ------ | ------------ | ----------------------------------------------------------------------------------------- |
| `GET`  | `/providers` | Every provider, its product categories, and policy/client counts.                         |
| `GET`  | `/`          | The table. `?providerId=&categoryId=`                                                     |
| `GET`  | `/download`  | The same table as an `.xlsx` workbook (Portfolio, Instructions, Field Dictionary sheets). |
| `GET`  | `/print`     | A one-hour signed link to a policy's PDF print. `?policyId=&clientId=`                    |
| `POST` | `/`          | Apply rows (JSON). `dryRun: true` reports without writing.                                |
| `POST` | `/upload`    | Multipart `file` + `providerId` + `categoryId` + `mode=preview\|apply`.                   |

Auth (any one of):

- Header `x-nw-portfolio-token: <the agent's own token>` — the agent path (see
  [Agent tokens](#agent-tokens)).
- Shared cron header `x-nw-cron-auth` (Vault cron token).
- An admin session bearer — how the Portfolio tab reads and writes.
- Under `DENO_ENV=development` only, a matching `NW_PORTFOLIO_TABLE_TOKEN` env value.

### Reading the book

```bash
curl -sS "$BASE/integrations/portfolio-table?providerId=$PROVIDER&categoryId=employee_benefits" \
  -H "x-nw-portfolio-token: $PORTFOLIO_TOKEN"
```

```json
{
  "success": true,
  "table": {
    "providerId": "…",
    "providerName": "Allan Gray",
    "categoryId": "employee_benefits",
    "categoryLabel": "Employee Benefits",
    "generatedAt": "2026-09-30T08:00:00.000Z",
    "columns": [
      {
        "id": "eb_1",
        "name": "Policy Number",
        "type": "text",
        "required": true,
        "isPolicyNumber": true
      },
      {
        "id": "eb_4",
        "name": "Cover Amount",
        "type": "currency",
        "required": false,
        "isPolicyNumber": false
      }
    ],
    "rows": [
      {
        "clientId": "…",
        "clientName": "Thandi Nkosi",
        "policyId": "…",
        "policyNumber": "EB-001",
        "categoryId": "employee_benefits",
        "updatedAt": "2026-01-01T00:00:00.000Z",
        "lockedFields": ["eb_5"],
        "values": { "eb_1": "EB-001", "eb_4": 100000 },
        "lastSync": { "source": "portal", "publishedAt": "…" },
        "policyPrint": {
          "fileName": "print.pdf",
          "uploadDate": "…",
          "documentType": "policy_schedule",
          "fileSize": 1234
        }
      }
    ],
    "clientCount": 12,
    "policyCount": 14
  }
}
```

`values` are keyed by field **id**; `columns` gives the id ↔ name mapping.
Row ids in `/providers` and `columns` are stable; use the leaf `categoryId`s
the catalogue lists.

### Writing rows

```bash
curl -sS -X POST "$BASE/integrations/portfolio-table" \
  -H "x-nw-portfolio-token: $PORTFOLIO_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "providerId": "…", "categoryId": "employee_benefits",
    "dryRun": true,
    "rows": [
      { "clientName": "Thandi Nkosi", "policyNumber": "EB-001",
        "values": { "Cover Amount": 125000, "eb_5": 550 } },
      { "policyId": "…", "clientId": "…", "clientName": "John Smith",
        "values": { "eb_4": 60000 } }
    ]
  }'
```

`values` keys may be a field id, a field name, or the spreadsheet column
configured in Mapping Configuration. At most 1000 rows per request; the JSON
body limit is 2 MB. Send the same request without `dryRun` to apply.

Every write is recorded against the agent the token belongs to
(`agent:grok`). A `submittedBy` field is still accepted, so an older agent's
requests do not fail validation, but it does not change who the write is
recorded against.

Response (200 for both dry run and apply):

```json
{
  "success": true,
  "dryRun": true,
  "providerId": "…",
  "providerName": "Allan Gray",
  "categoryId": "…",
  "categoryLabel": "…",
  "source": "api",
  "runId": null,
  "appliedAt": "…",
  "summary": {
    "rows": 2,
    "updated": 1,
    "unchanged": 1,
    "unmatched": 0,
    "clientMismatch": 0,
    "duplicate": 0,
    "invalid": 0,
    "failed": 0,
    "clientsTouched": 1
  },
  "warnings": [],
  "rows": [
    {
      "rowNumber": 1,
      "clientName": "Thandi Nkosi",
      "policyNumber": "EB-001",
      "status": "updated",
      "policyId": "…",
      "clientId": "…",
      "matchedClientName": "Thandi Nkosi",
      "matchedBy": "client_name_policy_number",
      "changes": [
        { "fieldId": "eb_4", "fieldName": "Cover Amount", "oldValue": 100000, "newValue": 125000 }
      ],
      "warnings": ["Monthly Contribution is locked and was not changed"],
      "errors": []
    }
  ]
}
```

In a dry run, `updated` means _would be updated_ and `runId` is null. After an
apply, `runId` names the persisted run. `400` means the body did not validate
(the message says which field) or the provider id is unknown; `401` no valid
credential; `403` a signed-in non-admin.

### The recommended agent loop

1. `GET /providers` once → the provider ids and leaf category ids.
2. Per provider/category on the schedule: `GET /` → the current book.
3. Gather the provider's current figures however the agent does (a statement,
   a portal, an email), build rows keyed by client name + policy number.
4. `POST /` with `dryRun: true` → inspect `summary` and any `client_mismatch`,
   `duplicate`, `invalid` rows.
5. `POST /` without `dryRun` → apply. Report `summary.updated` and `runId`.

Run one agent per provider at a time. Writes are read-modify-write on each
client's policy array, so two agents writing the same client simultaneously
can lose an update — the same constraint every writer in this system has.
Reading the book scans the whole policy namespace (like the template
download), so a schedule of hours, not minutes, is the right cadence.

## Agent tokens

**Every agent has its own token.** The agent's name is the actor recorded on
everything it writes (`agent:grok`, on the persisted run and in the history
entry), and it comes from the token: a name in the request body cannot change
it. Revoking one agent leaves every other agent working.

Tokens live in `public.portfolio_agent_tokens` (migration
`portfolio_agent_tokens`), which stores only the SHA-256 of each token: the
token itself is shown once, when it is issued, and never stored. The table is
service-role only.

### Issue, revoke, rotate

In **Product Configuration → Integrations → Portfolio → Endpoint for external
agents → Agent tokens**, as a **super admin**:

- **Issue token**: type the agent's name (`grok`, `chatgpt`, `claude-routine`:
  2 to 40 lowercase letters, digits, `-` or `_`) and copy the token from the
  green box straight away. It starts `nwpa_` and is shown only that once.
- **Revoke**: stops that token on the agent's next request. The row stays as
  the record of the old token.
- **Rotate**: revoke the name, then issue the same name a new token. The actor
  on its writes stays the same.
- If a token is lost, rotate it: there is no way to read a token back.

The same three operations are `GET`, `POST { name }` and
`POST /:name/revoke` on `/integrations/portfolio-agents`, which only a super
admin's session reaches. An agent token never gets in there, so no agent can
mint or revoke tokens.

Emergency revoke without the UI (dashboard SQL editor):

```sql
update public.portfolio_agent_tokens
set revoked_at = now(), revoked_by = 'sql'
where agent_name = 'grok' and revoked_at is null;
```

See which agents exist and when each last called (never the token or hash):

```sql
select agent_name, created_at, created_by, last_used_at, revoked_at
from public.portfolio_agent_tokens
order by created_at desc;
```

### The `shared` token

Before tokens were per agent there was one shared secret, in Vault as
`navigatewealth_portfolio_table_token`. The migration carried its hash over
as the agent **`shared`**, so a bot already configured with it keeps working,
now recorded as `agent:shared`. Give each bot its own token, then revoke
`shared`. The Vault secret and its oracle `public.verify_portfolio_table_token`
are no longer read by the Edge Function; a follow-up migration drops them
([`ROADMAP.md`](../ROADMAP.md) §9a).

Each token is admin-equivalent on this surface: whoever holds it can read
every client's policy values for every provider and write to them. Give each
token only to its one agent, and revoke it if in doubt.

### Setting a bot up

Issue the bot its own token first. Then, as a scheduled ChatGPT task or
Custom GPT Action, or a Grok agent with an HTTP tool: base URL as above,
authentication **API Key**, header name `x-nw-portfolio-token`, value the
token. Give it the loop above. A Claude Routine whose environment blocks
egress to the Edge Function (see `social-automation.md`) cannot use this path
today; it can read the same records through the Supabase connector, but there
is no SQL write function for policies yet.

## The Portfolio tab

- **Download spreadsheet** → `<Provider> - <Product> - Portfolio.xlsx`. The
  `Portfolio` sheet is the table; `Instructions` says how matching works;
  `Field Dictionary` lists each column's field id, type, options and blank
  handling. The four `_NW` columns are hidden but present.
- **Upload spreadsheet** → always a preview first (rows, statuses, cell
  changes, notes), then **Apply N updates** writes. Any `.xlsx`/`.csv` whose
  headers are field names (or ids, or the configured column names) works; the
  `Client` column plus the policy-number column are required unless the hidden
  ids are present.
- **Policy Print** on a row is a button carrying the print's upload date, so a
  stale print shows at a glance; it opens the PDF in a new tab via a signed
  link.
- **Search** finds a row by client name (case and accents ignored) or policy
  number (spaces and dashes ignored). **Every header sorts**; empty cells sort
  last either way. Sorting **Last Updated** ascending puts the records an
  agent has not touched lately at the top. **Policy Print** sorts by the
  print's upload date, and a policy with no print on file sorts last.
- **Client** stays pinned on the left while the product fields scroll. On a
  wide enough panel, **Last Updated** and **Policy Print** stay pinned on the
  right too, so the two columns checked first never scroll out of view.
- Dates read `05 Sep 2026`, whatever the browser's locale, and money uses the
  app's canonical format (`R551,894.41`). A date field stored as `YYYY-MM-DD`
  is shown in that same form, read as a calendar date so it never shifts a day
  across time zones; one stored in another spelling (a portal may store
  `02 Jul 2018`) is shown as stored.
- **Endpoint for external agents** at the bottom of the tab shows the exact
  URL for the selected provider/product, with a Copy button, and the header
  name. For a super admin it also lists the **agent tokens** (issued, last
  used, live or revoked) with Issue and Revoke; anyone else sees who manages
  them. The tokens are fetched only when the panel is opened.

## Failure modes

| Symptom                                           | Cause and fix                                                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `401` from the endpoint                           | The token is revoked, mistyped or never issued. Check the agent's row under Agent tokens; if it is lost or revoked, issue the name a new token. An empty header never matches. |
| `400 Invalid provider ID`                         | The `providerId` is not a provider record id; take it from `GET /providers`.                                                                                                   |
| Every row `unmatched`                             | Wrong category (a parent id, or the policies are filed under a sibling), or the policy numbers differ in more than case/spaces/dashes. Compare with `GET /`.                   |
| Rows `client_mismatch`                            | The agent's client names are not the profile names. Send `policyId` + `clientId` from `GET /` instead, or fix the names; never drop the name check.                            |
| `updated` in the dry run, `unchanged` after apply | Every differing field was locked at publish time; the row's warnings name them.                                                                                                |
| The Integrations header shows no "last sync"      | The run changed nothing and hit no errors, so no history entry was written. That is by design.                                                                                 |
| A value keeps reverting after the agent writes it | The native path (portal worker / Review tab) publishes its own value on its schedule. Decide which source owns that field, or lock it.                                         |
