-- ============================================================================
-- Newsletter intake — the SQL hand-over path for the monthly newsletter routine
-- ============================================================================
--
-- WHY THIS EXISTS
-- The routine that produces the monthly newsletter PDF may run in an
-- environment that cannot reach the Edge Function over HTTPS (the Claude
-- Routine environment blocks that egress — docs/runbooks/social-automation.md)
-- but does have the Supabase connector. So, next to the HTTPS endpoint
-- (`POST /newsletter-intake/submit`), the routine can call
-- `public.newsletter_intake_submit(...)` with the PDF as base64. The Edge
-- Function's every-2-minute newsletter tick sweeps `status = 'pending'` rows,
-- stores the PDF in the private newsletters bucket, creates a draft awaiting
-- admin approval, emails the admin, and marks the row processed (nulling the
-- base64 so the table never grows).
--
-- CONVENTIONS (supabase/migrations/README.md)
--   - named `create index if not exists`, never an unnamed CREATE INDEX;
--   - RLS on, no policies, explicit revoke from anon/authenticated;
--   - SECURITY DEFINER functions pin search_path and are revoked from PUBLIC
--     explicitly (revoking only named roles is a no-op) before the grant.
--
-- No pg_net, no vault: nothing here calls out; the Edge tick calls in.
-- ============================================================================

-- ── 1. Table ──────────────────────────────────────────────────────────────────

create table if not exists public.newsletter_intake (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(title) between 1 and 150),
  description      text not null check (char_length(description) between 1 and 1000),
  list_ids         text[] not null default '{sys_newsletter_contacts}',
  file_name        text not null default 'newsletter.pdf',
  -- The PDF, base64. Nulled once processed so the table stays small.
  pdf_base64       text,
  -- A routine's own key for the issue (e.g. '2026-09'); a replay is a no-op.
  idempotency_key  text unique,
  submitted_by     text not null default 'routine',
  status           text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  error            text,
  campaign_id      text,
  created_at       timestamptz not null default now(),
  processed_at     timestamptz
);

comment on table public.newsletter_intake is
  'Newsletter PDFs handed over by the monthly routine through the Supabase connector. Swept by the Edge newsletter tick into drafts awaiting admin approval.';

-- The sweep asks only "is anything pending?" — one probe of this partial index.
create index if not exists newsletter_intake_pending_idx
  on public.newsletter_intake (created_at)
  where status = 'pending';

-- ── 2. RLS and grants ─────────────────────────────────────────────────────────

alter table public.newsletter_intake enable row level security;
revoke all on table public.newsletter_intake from anon, authenticated;

-- ── 3. The submit function the routine calls ──────────────────────────────────

create or replace function public.newsletter_intake_submit(
  p_title            text,
  p_description      text,
  p_pdf_base64       text,
  p_file_name        text default 'newsletter.pdf',
  p_idempotency_key  text default null,
  p_list_ids         text[] default null,
  p_submitted_by     text default 'routine'
) returns table (id uuid, existed boolean, status text)
language plpgsql security definer set search_path = public as $fn$
declare
  v_bytes    bytea;
  v_existing public.newsletter_intake;
  v_row      public.newsletter_intake;
begin
  if p_title is null or char_length(btrim(p_title)) = 0 then
    raise exception 'newsletter_intake_submit: title is required';
  end if;
  if p_description is null or char_length(btrim(p_description)) = 0 then
    raise exception 'newsletter_intake_submit: description is required';
  end if;
  if p_pdf_base64 is null or char_length(p_pdf_base64) = 0 then
    raise exception 'newsletter_intake_submit: pdf_base64 is required';
  end if;

  -- A replayed key returns the earlier row rather than queueing a second draft.
  if p_idempotency_key is not null then
    select * into v_existing from public.newsletter_intake n
      where n.idempotency_key = p_idempotency_key;
    if found then
      return query select v_existing.id, true, v_existing.status;
      return;
    end if;
  end if;

  -- Validate the PDF here so a bad hand-over fails loudly for the routine,
  -- not silently two minutes later in the sweep.
  begin
    v_bytes := decode(regexp_replace(p_pdf_base64, '\s', '', 'g'), 'base64');
  exception when others then
    raise exception 'newsletter_intake_submit: pdf_base64 is not valid base64';
  end;
  if octet_length(v_bytes) > 5 * 1024 * 1024 then
    raise exception 'newsletter_intake_submit: the PDF is % bytes; the limit is 5 MB',
      octet_length(v_bytes);
  end if;
  if octet_length(v_bytes) < 5 or substring(v_bytes from 1 for 5) <> '\x255044462d'::bytea then
    raise exception 'newsletter_intake_submit: the file is not a PDF (missing %%PDF- header)';
  end if;

  insert into public.newsletter_intake
    (title, description, list_ids, file_name, pdf_base64, idempotency_key, submitted_by)
  values (
    btrim(p_title),
    btrim(p_description),
    coalesce(p_list_ids, '{sys_newsletter_contacts}'::text[]),
    coalesce(nullif(btrim(p_file_name), ''), 'newsletter.pdf'),
    p_pdf_base64,
    p_idempotency_key,
    coalesce(nullif(btrim(p_submitted_by), ''), 'routine')
  )
  returning * into v_row;

  return query select v_row.id, false, v_row.status;
end;
$fn$;

comment on function public.newsletter_intake_submit(text, text, text, text, text, text[], text) is
  'Queue a newsletter PDF (base64) for the admin to review. Returns (id, existed, status); existed = true means the idempotency key was already used.';

revoke execute on function public.newsletter_intake_submit(text, text, text, text, text, text[], text)
  from public, anon, authenticated;
grant execute on function public.newsletter_intake_submit(text, text, text, text, text, text[], text)
  to service_role;

-- ── 4. A read-back the routine can use to confirm the sweep picked it up ──────

create or replace function public.newsletter_intake_status(p_idempotency_key text)
returns table (id uuid, status text, error text, campaign_id text, processed_at timestamptz)
language sql security definer set search_path = public stable as $fn$
  select n.id, n.status, n.error, n.campaign_id, n.processed_at
  from public.newsletter_intake n
  where n.idempotency_key = p_idempotency_key;
$fn$;

revoke execute on function public.newsletter_intake_status(text) from public, anon, authenticated;
grant execute on function public.newsletter_intake_status(text) to service_role;
