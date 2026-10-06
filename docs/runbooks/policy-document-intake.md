# Policy document intake — attaching a policy PDF with no login

**What this is.** The way an agent with no Navigate Wealth login attaches a
PDF (a policy schedule, a statement) to a client's policy. An agent that can
make an HTTPS request **uploads the file** ([below](#uploading-the-file-over-https));
an agent that only has the **Supabase connector** hands the PDF over in a table,
because SQL cannot put a file in Storage. Either way a worker in the Edge
Function stores it. The result is exactly what the app's own upload
produces: the PDF in the `make-91ed8379-policy-documents` bucket and
`policy.document` describing it, which is what the Portfolio tab's
**Policy Print** column and the client's policy view show.

The app's upload (`POST /integrations/policy-documents/upload`) is unchanged
and still needs a signed-in user. This is a second door to the same room.

```text
  Agent (Supabase connector)                Postgres                              Edge Function
┌────────────────────────────┐  submit   ┌──────────────────────────────┐  pg_net  ┌──────────────────────────────────┐
│ policy_document_intake_    │──────────►│ public.policy_document_intake│─────────►│ POST /policy-document-intake/    │
│   submit(…, pdf_base64)    │           │  row: pending                │  wake-up │   process                        │
│ (or put_part × n, submit)  │           └──────────────┬───────────────┘          │ claim → store → complete / fail  │
└────────────────────────────┘                          │ pg_cron every 2 min:     └───────────────┬──────────────────┘
                                                        │ the same wake-up, only                   │ replacePolicyDocumentForPolicy
                                                        │ when a row is due                        ▼
                                                        ▼                      {clientId}/{policyId}/{documentType}.pdf
                                              status: processed                + policy.document in policies:client:{clientId}
```

Migration `policy_document_intake` (in `supabase/migrations/`) creates
everything on the database side. Every function in it is `SECURITY DEFINER`
and executable by `service_role` only; anon and authenticated hold nothing.

## Uploading the file over HTTPS

Use this whenever the agent can make an HTTPS request. A PDF passed through
the connector as base64 rarely fits in one SQL statement, and cutting it into
parts by hand is where hand-overs go wrong: on 2026-10-01 the update bot staged
three short pieces under `agra678002-statement-2026-10-01` and could not
finish. Here the file travels whole, in one request.

```bash
curl -sS -X POST \
  "https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/policy-document-intake/upload" \
  -H "x-nw-portfolio-token: $AGENT_TOKEN" \
  -F "file=@AG_InvestmentStatement_AGRA678002_2026-10-01.pdf;type=application/pdf" \
  -F "clientId=8c4158a6-d7ea-43bf-8386-af0cabda8eee" \
  -F "policyId=policy_1769783741137_mfqeoq" \
  -F "documentType=statement" \
  -F "idempotencyKey=agra678002-statement-2026-10-01-v2"
```

| Field            | Required | Notes                                                                                                  |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `file`           | yes      | The whole PDF, up to 20 MB. Its name is recorded as the document's name.                               |
| `clientId`       | yes      | As in [Finding the ids](#finding-the-ids).                                                             |
| `policyId`       | yes      | The client must have this policy.                                                                      |
| `documentType`   | no       | `policy_schedule` (default), `amendment`, `statement`, `benefit_summary` or `other`.                   |
| `idempotencyKey` | no       | One per document. Sending it again returns that hand-over instead of storing twice. Made up if absent. |
| `submittedBy`    | no       | Only used with the cron token, as a label. An agent is named by its token.                             |

**Who may call it**, any one of:

- `x-nw-portfolio-token: <the agent's own token>`, the same token the
  portfolio table takes, issued by a super admin in the Portfolio tab
  ([Agent tokens](portfolio-table.md#agent-tokens)). The document records
  `intake:agent:<name>`, whatever the form says. **Use this.**
- `x-nw-cron-auth: <the shared cron token>`, recorded as
  `intake:scheduled:<submittedBy>`.
- An admin session.

**What happens.** The upload is checked at the door (a PDF that starts
`%PDF-`, ends with `%%EOF` in its last 1 KB, and is at most 20 MB), then
submitted whole, in one call to the same `policy_document_intake_submit` an
agent calls, so the same checks run and the same row is queued. That call is
atomic. Two requests racing with one key, such as a retry overlapping the
first try, settle on one hand-over: the first is stored whole, and the other
answers with its status. Anything an earlier attempt left staged under that
key is cleared, never joined in. The request then runs the worker itself, so
the PDF is normally on the policy by the time it answers:

| Answer | Meaning                                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------- |
| `200`  | Stored. `storageKey` says where; `existed: true` means the key had been handed over before, and nothing was stored again.  |
| `202`  | Queued, not stored yet: another hand-over for the same client is being stored. The worker finishes it; check its `status`. |
| `400`  | Refused, with the reason: not a PDF, cut short, a client without that policy, a malformed field. Nothing was queued.       |
| `413`  | Over 20 MB.                                                                                                                |
| `422`  | The hand-over under that key failed for good; `error` says why. Send it again under a new key.                             |

To check on a `202`, `select * from public.policy_document_intake_status('<idempotencyKey>');`
or send the same request again (same key): it answers with the hand-over's
status and stores nothing new.

## Limits

| Limit           | Value                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| PDF size        | **20 MB** (checked by bytes; the file must start with `%PDF-`), the same as the app's upload                                |
| One statement   | Keep the base64 in one SQL statement to what the connector carries comfortably (about 1 MB). Larger: hand it over in parts. |
| Parts           | `seq` 0–9999, each part 1–1,000,000 characters. **60,000** is a safe size per part.                                         |
| Ids             | `client_id` and `policy_id`: 1–128 of `A-Za-z0-9_-`, and the client must have that policy                                   |
| File name       | 1–255 characters, no slashes or control characters. Recorded as the document's name; it does not decide where it is stored. |
| Document type   | `policy_schedule` (default), `amendment`, `statement`, `benefit_summary` or `other`. It names the stored file.              |
| Idempotency key | 1–200 characters, one per document, e.g. `AGRA678002:2026-10-01`. A replay returns the earlier hand-over.                   |

**One document per policy.** `policy.document` holds a single PDF. A new
hand-over for a policy replaces what is on file, whatever its type, and the
old object is deleted when it was stored under a different name (an upload
from the app, say). It is stored at `{clientId}/{policyId}/{documentType}.pdf`,
so with the default type that is `…/policy_schedule.pdf`.

## Finding the ids

Policies live in KV under `policies:client:{clientId}`, an array of policies,
each with an `id`. The policy number sits in one of the policy's `data` fields
(which one depends on the product, e.g. `ret_pre_1`), so search the values:

```sql
select substring(k.key from 'policies:client:(.*)') as client_id,
       p ->> 'id'            as policy_id,
       p ->> 'providerName'  as provider,
       p ->> 'categoryId'    as category,
       p -> 'document' ->> 'storageKey' as document_on_file
from public.kv_store_91ed8379 k
cross join lateral jsonb_array_elements(k.value) p
where k.key like 'policies:client:%'
  and jsonb_path_exists(p -> 'data', '$.* ? (@ == $n)', jsonb_build_object('n', 'AGRA678002'));
```

## Handing a PDF over

In SQL, for an agent that has only the connector. An agent that can make an
HTTPS request should [upload the file](#uploading-the-file-over-https) instead.

**In one statement:**

```sql
select *
from public.policy_document_intake_submit(
  p_client_id       => '8c4158a6-d7ea-43bf-8386-af0cabda8eee',
  p_policy_id       => 'policy_1769783741137_mfqeoq',
  p_file_name       => 'AG_InvestmentStatement_AGRA678002_FRANCISCO,Shawn_323076_2026-10-01.pdf',
  p_idempotency_key => 'AGRA678002:2026-10-01',
  p_pdf_base64      => '<base64 of the PDF>',
  p_mime_type       => 'application/pdf',   -- the default; anything else is refused
  p_document_type   => 'policy_schedule',   -- the default
  p_submitted_by    => 'update-bot'         -- recorded as uploadedBy = 'intake:update-bot'
);
-- → (id, existed, status). existed = true means the key was used before and nothing new was queued.
```

**In parts**, when the base64 is too long for one statement. Stage the parts
under the idempotency key, in any order, numbered from 0 with no gaps, then
submit with no `p_pdf_base64`:

```sql
select public.policy_document_intake_put_part('AGRA678002:2026-10-01', 0, '<characters 1–60,000>');
select public.policy_document_intake_put_part('AGRA678002:2026-10-01', 1, '<characters 60,001–120,000>');
-- … each call returns how many parts are staged so far; re-sending a seq replaces that part

select *
from public.policy_document_intake_submit(
  p_client_id       => '8c4158a6-d7ea-43bf-8386-af0cabda8eee',
  p_policy_id       => 'policy_1769783741137_mfqeoq',
  p_file_name       => 'AG_InvestmentStatement_AGRA678002_FRANCISCO,Shawn_323076_2026-10-01.pdf',
  p_idempotency_key => 'AGRA678002:2026-10-01',
  p_submitted_by    => 'update-bot'
);
```

Submit joins the parts in order, then deletes them. Parts staged and never
submitted are cleared after a day.

**What submit checks**, so a bad hand-over fails in the bot's own call rather
than later: the ids, the file name, the type, that the base64 decodes (the
URL-safe alphabet, missing padding, line breaks and a `data:` prefix are all
accepted), that the bytes start `%PDF-`, the 20 MB limit, and that
`policies:client:{client_id}` really holds a policy with that id. Each failure
raises an exception that says which.

## Confirming it landed

```sql
select * from public.policy_document_intake_status('AGRA678002:2026-10-01');
```

| `status`     | Meaning                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------- |
| `pending`    | Waiting for the worker. Normally seconds; after a failed attempt, until its retry time.           |
| `processing` | A worker has it.                                                                                  |
| `processed`  | Stored. `storage_key` is where; the base64 has been dropped from the row.                         |
| `failed`     | Three attempts failed. `error` says why, and the row still holds the PDF for a retry (see below). |

`attempts` counts the tries so far, and `error` holds the last failure even
while a retry is pending.

## Order with value updates

The PDF upload is the slow part. Afterwards the worker reads
`policies:client:{clientId}` again and sets `document` on that current list,
so a value update that lands while the bytes are uploading is kept. If the
policy was removed in that time, the list is left as it is, the uploaded
object is removed, and the attempt fails with `Policy not found`.

A write that lands in the moment between that read and its write can still
be overwritten. The worker notices when the list it wrote is no longer the
one stored and patches the newer list, up to three times. Writing the values
first, then handing the document over, remains the straightforward order.

## Retries, failures and wake-ups

- **A failed attempt** is retried a minute later, then five minutes after
  that. The third failure is final: `failed`, with the error and the PDF kept.
- **A worker that dies mid-attempt** (an Edge timeout) leaves the row
  `processing`. Ten minutes later it counts as abandoned and the next wake-up
  takes it over. An abandoned third attempt is final too.
- **Retry a failed hand-over** with fresh attempts:

  ```sql
  select * from public.policy_document_intake_retry('AGRA678002:2026-10-01');
  ```

- **Discard one instead** (drops the PDF; the row stays as the record):

  ```sql
  update public.policy_document_intake
     set pdf_base64 = null
   where idempotency_key = 'AGRA678002:2026-10-01' and status = 'failed';
  ```

- **Wake-ups.** Submit and retry call `public.policy_document_intake_kick()`,
  which posts to `/policy-document-intake/process` through pg_net with the
  shared cron token from Vault (`navigatewealth_cron_auth_token`). The pg_cron
  job `policy-document-intake-sweep` runs the same function every 2 minutes.
  It calls out only when a row is due, so an idle queue costs one index probe
  and no Edge invocation. `select public.policy_document_intake_kick();` by
  hand returns the pg_net request id, or null when nothing is due.
- **The worker** stores at most three rows per wake-up, one at a time, and
  claims nothing new after 40 seconds; the next wake-up takes the rest. It
  accepts the cron token or an admin session, nothing else.
- **One client at a time.** Storing a document rewrites the client's whole
  policies array, so two hand-overs for the same client are never stored at
  once. While one of a client's rows is `processing`, that client's other
  rows wait and other clients go ahead. The claim checks this under a
  per-client lock, so two wake-ups at the same moment cannot both take the
  same client.

## Failure modes

| Symptom                                                    | Cause and fix                                                                                                                                                                                                                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `… client X has no policy Y`                               | Wrong ids, or swapped. Look them up with the query above.                                                                                                                                                                                       |
| `… not a PDF (missing %PDF- header)` / `not valid base64`  | The bytes are not the PDF: an HTML error page, a base64 of something else, or a truncated string. In parts: a part missing or out of place.                                                                                                     |
| `… staged parts must run 0..n with no gaps`                | A part is missing. Re-send it with `put_part`, then submit again.                                                                                                                                                                               |
| `The PDF is incomplete: it has no %%EOF in its last 1 KB`  | The file was cut short: only some of its parts were staged, or the base64 was truncated. Nothing is stored. Hand the whole file over again under a new key, by HTTPS upload if the agent can.                                                   |
| `… was already submitted` from `put_part`                  | That idempotency key was used. Check its status; a different document needs a new key.                                                                                                                                                          |
| `existed = true` and nothing changed on the policy         | The key was used before. That earlier hand-over is the one the status refers to.                                                                                                                                                                |
| Row stays `pending` with `attempts = 0`                    | Nothing woke the worker. Check `policy-document-intake-sweep` in `scheduled-jobs.md` (query A), that the Vault secret exists, and the pg_net response for the request id `kick()` returns (`select * from net._http_response where id = <id>`). |
| `failed`, error `Upload failed: …`                         | Storage refused three times. Check the bucket in the dashboard, then `policy_document_intake_retry`.                                                                                                                                            |
| `failed`, error `Policy not found`                         | The policy left the client's list after submit. Hand it over again for the right policy, under a new key.                                                                                                                                       |
| `failed`, error `the worker did not finish attempt 3`      | Three attempts timed out in the Edge Function. Usually a very large PDF; check the Edge logs for `policy-document-intake`.                                                                                                                      |
| `processed`, but the policy shows the old values elsewhere | A value update overlapped the hand-over (see "Order with value updates"). Re-apply the values.                                                                                                                                                  |
