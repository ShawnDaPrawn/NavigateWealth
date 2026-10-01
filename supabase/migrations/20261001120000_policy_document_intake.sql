-- ============================================================================
-- Policy document intake — attaching a policy's PDF through SQL alone
-- ============================================================================
--
-- WHY THIS EXISTS
-- The update bot keeps policy values current through the Supabase connector
-- and has no Navigate Wealth login. The only way to attach a policy PDF was
-- `POST /integrations/policy-documents/upload`, which needs a signed-in user,
-- and a PDF cannot be put in Storage with SQL. So, like newsletter_intake, the
-- bot hands the PDF over in a table and a trusted worker does the rest:
--
--   1. The bot calls `policy_document_intake_submit(...)` with the PDF as
--      base64, or stages it in parts first with `policy_document_intake_put_part`
--      when one statement cannot carry it. Everything that can be checked in
--      SQL is checked there and then, so a bad hand-over fails for the bot,
--      not silently later: the ids, the file name, the type, that the bytes
--      decode and start `%PDF-`, the 20 MB limit, and that the client really
--      has that policy in `policies:client:{clientId}`.
--   2. Submit wakes the Edge worker (`POST /policy-document-intake/process`)
--      through pg_net, with the shared cron token from Vault. A pg_cron job
--      runs the same wake-up every 2 minutes, but it only calls out when a row
--      is due, so an idle queue costs one index probe and no Edge invocation.
--   3. The worker claims one row at a time, stores the PDF at
--      `{clientId}/{policyId}/{documentType}.pdf` in the
--      `make-91ed8379-policy-documents` bucket, sets `policy.document` exactly
--      as the app's upload does (the same `replacePolicyDocumentForPolicy`),
--      and marks the row processed, nulling the base64 so the table stays
--      small. A failure is retried twice, a minute then five minutes later,
--      and then left `failed` with its error and its PDF, for
--      `policy_document_intake_retry`.
--
-- The app's upload route is untouched; this is a second door to the same room.
--
-- WHO CAN CALL IT
-- Every function is SECURITY DEFINER and executable by service_role only:
-- the bot through the connector, the worker through its service-role client.
-- `submitted_by` is a label the caller chooses, recorded on the document as
-- `intake:<submitted_by>`. It is not an identity — anyone who can run these
-- functions can already write the policies directly.
--
-- CONVENTIONS (supabase/migrations/README.md)
--   - named `create index if not exists`, never an unnamed CREATE INDEX;
--   - RLS on, no policies, explicit revoke from anon/authenticated;
--   - SECURITY DEFINER functions pin search_path and are revoked from PUBLIC
--     explicitly (revoking only named roles is a no-op) before the grant.
--
-- Safe to re-run: `if not exists`, `create or replace`, and cron.schedule
-- replaces a job of the same name.
-- ============================================================================

-- ── 1. Tables ─────────────────────────────────────────────────────────────────

create table if not exists public.policy_document_intake (
  id               uuid primary key default gen_random_uuid(),
  client_id        text not null check (client_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  policy_id        text not null check (policy_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  document_type    text not null default 'policy_schedule'
                   check (document_type in ('policy_schedule', 'amendment', 'statement', 'benefit_summary', 'other')),
  file_name        text not null check (char_length(file_name) between 1 and 255),
  mime_type        text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  -- The PDF, standard base64. Nulled once processed so the table stays small.
  pdf_base64       text,
  file_size        integer,
  -- The caller's own key for this document (e.g. 'AGRA678002:2026-10-01');
  -- a replay returns the earlier row instead of storing the PDF twice.
  idempotency_key  text not null unique check (char_length(idempotency_key) between 1 and 200),
  submitted_by     text not null default 'agent' check (char_length(submitted_by) between 1 and 80),
  status           text not null default 'pending'
                   check (status in ('pending', 'processing', 'processed', 'failed')),
  attempts         integer not null default 0,
  next_attempt_at  timestamptz,
  claimed_at       timestamptz,
  claim_token      uuid,
  error            text,
  storage_key      text,
  created_at       timestamptz not null default now(),
  processed_at     timestamptz
);

comment on table public.policy_document_intake is
  'Policy PDFs handed over through SQL by an agent with no Navigate Wealth login. The Edge worker stores each in the policy-documents bucket and sets policy.document. See docs/runbooks/policy-document-intake.md.';

-- The wake-up and the claim only ever ask "is anything due?" — one probe of
-- this partial index, however many processed rows accumulate.
create index if not exists policy_document_intake_due_idx
  on public.policy_document_intake (created_at)
  where status in ('pending', 'processing');

-- A PDF too large for one statement is staged here in order, then assembled
-- by submit and deleted.
create table if not exists public.policy_document_intake_parts (
  idempotency_key  text not null check (char_length(idempotency_key) between 1 and 200),
  seq              integer not null check (seq between 0 and 9999),
  data             text not null check (char_length(data) between 1 and 1000000),
  created_at       timestamptz not null default now(),
  primary key (idempotency_key, seq)
);

comment on table public.policy_document_intake_parts is
  'Base64 parts of a policy PDF staged by policy_document_intake_put_part, assembled and deleted by policy_document_intake_submit. Parts abandoned for a day are cleared.';

create index if not exists policy_document_intake_parts_created_idx
  on public.policy_document_intake_parts (created_at);

-- ── 2. RLS and grants ─────────────────────────────────────────────────────────

alter table public.policy_document_intake enable row level security;
alter table public.policy_document_intake_parts enable row level security;
revoke all on table public.policy_document_intake from public, anon, authenticated;
revoke all on table public.policy_document_intake_parts from public, anon, authenticated;

-- ── 3. Waking the worker ──────────────────────────────────────────────────────

-- Calls the Edge worker when, and only when, a row is due: pending and past
-- its retry time, or claimed by a worker that never finished. Returns the
-- pg_net request id, or null when nothing is due or the token is missing.
-- The URL is this project's; a copy of the schema elsewhere would need its own.
create or replace function public.policy_document_intake_kick()
returns bigint
language plpgsql security definer set search_path = '' as $fn$
declare
  v_token text;
begin
  if not exists (
    select 1
      from public.policy_document_intake i
     where i.status in ('pending', 'processing')
       and (
         (i.status = 'pending' and (i.next_attempt_at is null or i.next_attempt_at <= now()))
         or (i.status = 'processing' and i.claimed_at < now() - interval '10 minutes')
       )
  ) then
    return null;
  end if;

  select s.decrypted_secret
    into v_token
    from vault.decrypted_secrets s
   where s.name = 'navigatewealth_cron_auth_token'
   limit 1;
  if coalesce(v_token, '') = '' then
    raise warning 'policy_document_intake_kick: Vault secret navigatewealth_cron_auth_token is missing';
    return null;
  end if;

  return net.http_post(
    url := 'https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/policy-document-intake/process',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-nw-cron-auth', v_token),
    timeout_milliseconds := 60000
  );
end;
$fn$;

comment on function public.policy_document_intake_kick() is
  'Wake the policy document intake worker if a row is due. Called by submit, retry and the every-2-minute pg_cron job.';

revoke execute on function public.policy_document_intake_kick() from public, anon, authenticated;
grant execute on function public.policy_document_intake_kick() to service_role;

-- ── 4. What the bot calls ─────────────────────────────────────────────────────

-- Stage one part of a PDF too large for a single statement. Parts are joined
-- in seq order (0, 1, 2, … with no gaps) when submit is called with no
-- pdf_base64. Returns how many parts are staged for the key.
create or replace function public.policy_document_intake_put_part(
  p_idempotency_key  text,
  p_seq              integer,
  p_data             text
) returns integer
language plpgsql security definer set search_path = public as $fn$
declare
  v_key    text := btrim(coalesce(p_idempotency_key, ''));
  v_status text;
  v_count  integer;
begin
  if v_key = '' or char_length(v_key) > 200 then
    raise exception 'policy_document_intake_put_part: idempotency_key is required (1-200 characters)';
  end if;
  if p_seq is null or p_seq < 0 or p_seq > 9999 then
    raise exception 'policy_document_intake_put_part: seq must be 0..9999';
  end if;
  if p_data is null or char_length(p_data) = 0 or char_length(p_data) > 1000000 then
    raise exception 'policy_document_intake_put_part: data must be 1..1000000 characters';
  end if;

  select i.status into v_status
    from public.policy_document_intake i
   where i.idempotency_key = v_key;
  if found then
    raise exception 'policy_document_intake_put_part: "%" was already submitted (status %); see policy_document_intake_status, or use a new idempotency_key for another document',
      v_key, v_status;
  end if;

  -- Parts abandoned more than a day ago go, so staging cannot grow unbounded.
  delete from public.policy_document_intake_parts pp
   where pp.created_at < now() - interval '1 day';

  insert into public.policy_document_intake_parts (idempotency_key, seq, data)
  values (v_key, p_seq, p_data)
  on conflict (idempotency_key, seq) do update
    set data = excluded.data, created_at = now();

  select count(*)::integer into v_count
    from public.policy_document_intake_parts pp
   where pp.idempotency_key = v_key;
  return v_count;
end;
$fn$;

comment on function public.policy_document_intake_put_part(text, integer, text) is
  'Stage part seq (0-based) of a base64 PDF under an idempotency key; submit with no pdf_base64 joins the parts. Returns the number of parts staged.';

revoke execute on function public.policy_document_intake_put_part(text, integer, text)
  from public, anon, authenticated;
grant execute on function public.policy_document_intake_put_part(text, integer, text)
  to service_role;

-- Queue a PDF for a policy. Returns (id, existed, status); existed = true
-- means the idempotency key was already used, and nothing new was queued.
create or replace function public.policy_document_intake_submit(
  p_client_id        text,
  p_policy_id        text,
  p_file_name        text,
  p_idempotency_key  text,
  p_pdf_base64       text default null,
  p_mime_type        text default 'application/pdf',
  p_document_type    text default 'policy_schedule',
  p_submitted_by     text default 'agent'
) returns table (id uuid, existed boolean, status text)
language plpgsql security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  v_client    text := btrim(coalesce(p_client_id, ''));
  v_policy    text := btrim(coalesce(p_policy_id, ''));
  v_file_name text := btrim(coalesce(p_file_name, ''));
  v_key       text := btrim(coalesce(p_idempotency_key, ''));
  v_mime      text := lower(btrim(coalesce(p_mime_type, 'application/pdf')));
  v_doc_type  text := lower(btrim(coalesce(p_document_type, 'policy_schedule')));
  v_by        text := coalesce(nullif(btrim(p_submitted_by), ''), 'agent');
  v_b64       text := p_pdf_base64;
  v_parts     integer;
  v_min_seq   integer;
  v_max_seq   integer;
  v_bytes     bytea;
  v_inserted  boolean;
  v_row       public.policy_document_intake;
begin
  if v_key = '' or char_length(v_key) > 200 then
    raise exception 'policy_document_intake_submit: idempotency_key is required (1-200 characters)';
  end if;

  -- A replayed key returns the earlier row rather than storing the PDF twice.
  select * into v_row from public.policy_document_intake i where i.idempotency_key = v_key;
  if found then
    delete from public.policy_document_intake_parts pp where pp.idempotency_key = v_key;
    return query select v_row.id, true, v_row.status;
    return;
  end if;

  if v_client !~ '^[A-Za-z0-9_-]{1,128}$' then
    raise exception 'policy_document_intake_submit: client_id must be 1-128 letters, digits, _ or -';
  end if;
  if v_policy !~ '^[A-Za-z0-9_-]{1,128}$' then
    raise exception 'policy_document_intake_submit: policy_id must be 1-128 letters, digits, _ or -';
  end if;
  if v_file_name = '' or char_length(v_file_name) > 255 or v_file_name ~ '[[:cntrl:]/\\]' then
    raise exception 'policy_document_intake_submit: file_name must be 1-255 characters with no slashes or control characters';
  end if;
  if v_mime <> 'application/pdf' then
    raise exception 'policy_document_intake_submit: mime_type must be application/pdf, not %', v_mime;
  end if;
  if v_doc_type not in ('policy_schedule', 'amendment', 'statement', 'benefit_summary', 'other') then
    raise exception 'policy_document_intake_submit: document_type must be policy_schedule, amendment, statement, benefit_summary or other, not %',
      v_doc_type;
  end if;
  if char_length(v_by) > 80 or v_by ~ '[[:cntrl:]]' then
    raise exception 'policy_document_intake_submit: submitted_by must be 1-80 characters';
  end if;

  -- The same lookup the worker makes: the policy must be in this client's list.
  if not exists (
    select 1
      from public.kv_store_91ed8379 k
     where k.key = 'policies:client:' || v_client
       and jsonb_typeof(k.value) = 'array'
       and k.value @> jsonb_build_array(jsonb_build_object('id', v_policy))
  ) then
    raise exception 'policy_document_intake_submit: client % has no policy % (policies:client:%)',
      v_client, v_policy, v_client;
  end if;

  if v_b64 is null or v_b64 = '' then
    select string_agg(pp.data, '' order by pp.seq), count(*)::integer, min(pp.seq), max(pp.seq)
      into v_b64, v_parts, v_min_seq, v_max_seq
      from public.policy_document_intake_parts pp
     where pp.idempotency_key = v_key;
    if v_parts = 0 then
      raise exception 'policy_document_intake_submit: pass pdf_base64, or stage the PDF with policy_document_intake_put_part first';
    end if;
    if v_min_seq <> 0 or v_max_seq <> v_parts - 1 then
      raise exception 'policy_document_intake_submit: staged parts must run 0..% with no gaps (% staged, highest seq %)',
        v_parts - 1, v_parts, v_max_seq;
    end if;
  end if;

  -- Normalise to standard, padded base64 (what the worker's atob expects):
  -- drop a data: URL prefix and whitespace, map the URL-safe alphabet back.
  v_b64 := regexp_replace(v_b64, '^data:[^,]*,', '');
  v_b64 := regexp_replace(v_b64, '\s', '', 'g');
  v_b64 := translate(v_b64, '-_', '+/');
  v_b64 := v_b64 || repeat('=', (4 - char_length(v_b64) % 4) % 4);
  begin
    v_bytes := decode(v_b64, 'base64');
  exception when others then
    raise exception 'policy_document_intake_submit: pdf_base64 is not valid base64';
  end;
  if octet_length(v_bytes) > 20971520 then
    raise exception 'policy_document_intake_submit: the PDF is % bytes; the limit is 20 MB', octet_length(v_bytes);
  end if;
  if octet_length(v_bytes) < 5 or substring(v_bytes from 1 for 5) <> '\x255044462d'::bytea then
    raise exception 'policy_document_intake_submit: the file is not a PDF (missing %%PDF- header)';
  end if;

  insert into public.policy_document_intake
    (client_id, policy_id, document_type, file_name, mime_type, pdf_base64, file_size, idempotency_key, submitted_by)
  values
    (v_client, v_policy, v_doc_type, v_file_name, v_mime, v_b64, octet_length(v_bytes), v_key, v_by)
  on conflict (idempotency_key) do nothing
  returning * into v_row;
  v_inserted := found;

  delete from public.policy_document_intake_parts pp where pp.idempotency_key = v_key;

  if not v_inserted then
    -- A concurrent submit with the same key got there first.
    select * into v_row from public.policy_document_intake i where i.idempotency_key = v_key;
    return query select v_row.id, true, v_row.status;
    return;
  end if;

  -- Wake the worker now. If that fails the pg_cron sweep still finds the row.
  begin
    perform public.policy_document_intake_kick();
  exception when others then
    raise warning 'policy_document_intake_submit: could not wake the worker (%); the 2-minute sweep will', sqlerrm;
  end;

  return query select v_row.id, false, v_row.status;
end;
$fn$;

comment on function public.policy_document_intake_submit(text, text, text, text, text, text, text, text) is
  'Queue a PDF (base64, or staged parts) for a policy; the worker stores it and sets policy.document. Returns (id, existed, status); existed = true means the idempotency key was already used.';

revoke execute on function public.policy_document_intake_submit(text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.policy_document_intake_submit(text, text, text, text, text, text, text, text)
  to service_role;

-- Where a hand-over is up to.
create or replace function public.policy_document_intake_status(p_idempotency_key text)
returns table (
  id            uuid,
  client_id     text,
  policy_id     text,
  document_type text,
  file_name     text,
  file_size     integer,
  status        text,
  attempts      integer,
  error         text,
  storage_key   text,
  created_at    timestamptz,
  processed_at  timestamptz
)
language sql security definer set search_path = public stable as $fn$
  select i.id, i.client_id, i.policy_id, i.document_type, i.file_name, i.file_size,
         i.status, i.attempts, i.error, i.storage_key, i.created_at, i.processed_at
    from public.policy_document_intake i
   where i.idempotency_key = btrim(p_idempotency_key);
$fn$;

revoke execute on function public.policy_document_intake_status(text) from public, anon, authenticated;
grant execute on function public.policy_document_intake_status(text) to service_role;

-- Send a failed hand-over through again, with a fresh set of attempts.
create or replace function public.policy_document_intake_retry(p_idempotency_key text)
returns table (id uuid, status text)
language plpgsql security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  v_row public.policy_document_intake;
begin
  select * into v_row
    from public.policy_document_intake i
   where i.idempotency_key = btrim(coalesce(p_idempotency_key, ''))
   for update;
  if not found then
    raise exception 'policy_document_intake_retry: nothing was submitted with idempotency_key "%"', p_idempotency_key;
  end if;
  if v_row.status <> 'failed' then
    raise exception 'policy_document_intake_retry: only a failed hand-over can be retried; this one is %', v_row.status;
  end if;
  if v_row.pdf_base64 is null then
    raise exception 'policy_document_intake_retry: this hand-over no longer holds its PDF; submit it again under a new idempotency_key';
  end if;

  update public.policy_document_intake i
     set status = 'pending', attempts = 0, error = null, next_attempt_at = null,
         claimed_at = null, claim_token = null
   where i.id = v_row.id;

  begin
    perform public.policy_document_intake_kick();
  exception when others then
    raise warning 'policy_document_intake_retry: could not wake the worker (%); the 2-minute sweep will', sqlerrm;
  end;

  return query select v_row.id, 'pending'::text;
end;
$fn$;

revoke execute on function public.policy_document_intake_retry(text) from public, anon, authenticated;
grant execute on function public.policy_document_intake_retry(text) to service_role;

-- ── 5. What the worker calls ──────────────────────────────────────────────────

-- Claim the oldest due row, or nothing. SKIP LOCKED lets two wake-ups run side
-- by side without taking the same row. A claim older than 10 minutes belongs
-- to a worker that died and is taken over, unless that was the third attempt,
-- in which case the row is given up on rather than retried forever.
create or replace function public.policy_document_intake_claim()
returns table (
  id            uuid,
  client_id     text,
  policy_id     text,
  document_type text,
  file_name     text,
  pdf_base64    text,
  submitted_by  text,
  attempts      integer,
  claim_token   uuid
)
language plpgsql security definer set search_path = public as $fn$
#variable_conflict use_column
declare
  v_id uuid;
begin
  update public.policy_document_intake i
     set status = 'failed',
         error = coalesce(i.error || '; ', '') || 'the worker did not finish attempt ' || i.attempts,
         claimed_at = null,
         claim_token = null
   where i.status = 'processing'
     and i.claimed_at < now() - interval '10 minutes'
     and i.attempts >= 3;

  select i.id into v_id
    from public.policy_document_intake i
   where i.status in ('pending', 'processing')
     and (
       (i.status = 'pending' and (i.next_attempt_at is null or i.next_attempt_at <= now()))
       or (i.status = 'processing' and i.claimed_at < now() - interval '10 minutes')
     )
   order by i.created_at
   limit 1
   for update skip locked;

  if v_id is null then
    return;
  end if;

  return query
  update public.policy_document_intake i
     set status = 'processing',
         attempts = i.attempts + 1,
         claimed_at = now(),
         claim_token = gen_random_uuid(),
         next_attempt_at = null
   where i.id = v_id
  returning i.id, i.client_id, i.policy_id, i.document_type, i.file_name,
            i.pdf_base64, i.submitted_by, i.attempts, i.claim_token;
end;
$fn$;

revoke execute on function public.policy_document_intake_claim() from public, anon, authenticated;
grant execute on function public.policy_document_intake_claim() to service_role;

-- Record a stored document. False when the claim was lost (another worker
-- took the row over), in which case nothing changes.
create or replace function public.policy_document_intake_complete(
  p_id           uuid,
  p_claim_token  uuid,
  p_storage_key  text,
  p_file_size    integer
) returns boolean
language plpgsql security definer set search_path = public as $fn$
begin
  update public.policy_document_intake i
     set status = 'processed',
         processed_at = now(),
         storage_key = p_storage_key,
         file_size = p_file_size,
         pdf_base64 = null,
         error = null,
         next_attempt_at = null,
         claim_token = null
   where i.id = p_id
     and i.claim_token = p_claim_token
     and i.status = 'processing';
  return found;
end;
$fn$;

revoke execute on function public.policy_document_intake_complete(uuid, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.policy_document_intake_complete(uuid, uuid, text, integer)
  to service_role;

-- Record a failed attempt: back to pending a minute later after the first,
-- five minutes after the second, and failed for good after the third.
-- Returns the row's new status, or null when the claim was lost.
create or replace function public.policy_document_intake_fail(
  p_id           uuid,
  p_claim_token  uuid,
  p_error        text
) returns text
language plpgsql security definer set search_path = public as $fn$
declare
  v_status text;
begin
  update public.policy_document_intake i
     set status = case when i.attempts >= 3 then 'failed' else 'pending' end,
         next_attempt_at = case
           when i.attempts >= 3 then null
           else now() + interval '1 minute' * power(5, greatest(i.attempts, 1) - 1)
         end,
         error = left(coalesce(nullif(btrim(p_error), ''), 'unknown error'), 1000),
         claim_token = null
   where i.id = p_id
     and i.claim_token = p_claim_token
     and i.status = 'processing'
  returning i.status into v_status;
  return v_status;
end;
$fn$;

revoke execute on function public.policy_document_intake_fail(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.policy_document_intake_fail(uuid, uuid, text)
  to service_role;

-- ── 6. The safety sweep ───────────────────────────────────────────────────────

-- Retries and missed wake-ups. Calls out only when a row is due.
select cron.schedule(
  'policy-document-intake-sweep',
  '*/2 * * * *',
  $$select public.policy_document_intake_kick()$$
);
