-- ============================================================================
-- email_delivery_log — one row for every email the platform tries to send
-- ============================================================================
--
-- WHY: every email goes through sendEmail() in
-- src/supabase/functions/server/email-core.ts, but nothing kept a record of
-- the attempt. The Communication Centre's History listed only campaigns and
-- individual messages (12 rows), so a birthday greeting, a newsletter, an
-- article notification or an e-sign request that did not arrive left no trace
-- to look at. sendEmail() now writes a row here for every attempt, success
-- and failure, under the catalogued kind in src/shared/email/emailKinds.ts.
--
-- Bulk sends carry a batch_id (`newsletter:<campaign>`, `publication:<article>`)
-- so History can show one row per send with delivered / failed counts, and
-- open it to the recipients. A retry for the same recipient in the same batch
-- is collapsed to its latest attempt when grouping.
--
-- Sensitive kinds (one-time codes, reset links) are written with no preview.
-- Recipients are stored lower-cased.
--
-- Access: RLS on, no policies; service_role only. The Edge Function reads
-- through the two functions below.
-- ============================================================================

create table public.email_delivery_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null,
  batch_id text,
  recipient text not null,
  cc text[],
  subject text not null default '',
  preview text,
  status text not null check (status in ('sent', 'failed')),
  provider text not null,
  provider_message_id text,
  error text,
  route text,
  request_id text
);

comment on table public.email_delivery_log is
  'Every email send attempt, written by sendEmail() in the Edge Function. Read by the Communication Centre History.';

create index email_delivery_log_created_at_idx on public.email_delivery_log (created_at desc);
create index email_delivery_log_kind_created_at_idx on public.email_delivery_log (kind, created_at desc);
create index email_delivery_log_batch_id_idx on public.email_delivery_log (batch_id) where batch_id is not null;
create index email_delivery_log_recipient_idx on public.email_delivery_log (recipient, created_at desc);

alter table public.email_delivery_log enable row level security;
revoke all on table public.email_delivery_log from public, anon, authenticated;
grant select, insert on table public.email_delivery_log to service_role;

-- ----------------------------------------------------------------------------
-- History page: one row per send (a batch, or a single email), newest first.
-- ----------------------------------------------------------------------------
create or replace function public.email_history_page(
  p_exclude_kinds text[] default '{}',
  p_kinds text[] default null,
  p_status text default null,
  p_search text default null,
  p_recipient_type text default null,
  p_limit integer default 15,
  p_offset integer default 0
)
returns table (
  group_key text,
  kind text,
  batch_id text,
  first_at timestamptz,
  last_at timestamptz,
  subject text,
  preview text,
  recipient text,
  cc text[],
  total bigint,
  sent bigint,
  failed bigint,
  status text,
  last_error text,
  provider_message_id text,
  total_count bigint
)
language sql
stable
set search_path = ''
as $$
  with base as (
    select l.*, coalesce(l.batch_id, l.id::text) as gk
    from public.email_delivery_log l
    where not (l.kind = any (coalesce(p_exclude_kinds, '{}'::text[])))
      and (p_kinds is null or l.kind = any (p_kinds))
  ),
  latest as (
    -- One row per recipient per send: a retry replaces the failed attempt.
    select distinct on (b.gk, b.recipient) b.*
    from base b
    order by b.gk, b.recipient, b.created_at desc
  ),
  grouped as (
    select
      g.gk,
      g.kind,
      max(g.batch_id) as batch_id,
      min(g.created_at) as first_at,
      max(g.created_at) as last_at,
      (array_agg(g.subject order by g.created_at))[1] as subject,
      (array_agg(g.preview order by g.created_at))[1] as preview,
      (array_agg(g.recipient order by g.created_at))[1] as recipient,
      -- array_agg over an array column builds a 2-D array, so carry cc as text.
      (array_agg(array_to_string(g.cc, ',') order by g.created_at))[1] as cc_csv,
      count(*) as total,
      count(*) filter (where g.status = 'sent') as sent,
      count(*) filter (where g.status = 'failed') as failed,
      (array_agg(g.error order by g.created_at desc) filter (where g.error is not null))[1] as last_error,
      (array_agg(g.provider_message_id order by g.created_at desc)
        filter (where g.provider_message_id is not null))[1] as provider_message_id,
      bool_or(
        p_search is null
        or strpos(lower(g.subject), lower(p_search)) > 0
        or strpos(g.recipient, lower(p_search)) > 0
      ) as matches
    from latest g
    group by g.gk, g.kind
  ),
  shaped as (
    select
      gr.*,
      case
        when gr.failed = 0 then case when gr.batch_id is null then 'sent' else 'completed' end
        when gr.sent = 0 then 'failed'
        else 'partial'
      end as st
    from grouped gr
    where gr.matches
  ),
  filtered as (
    select s.*
    from shaped s
    where (p_status is null or s.st = p_status or (p_status = 'completed' and s.st = 'sent'))
      and (
        p_recipient_type is null
        or (p_recipient_type = 'single' and s.batch_id is null)
        or (p_recipient_type = 'multiple' and s.batch_id is not null)
      )
  )
  select
    f.gk, f.kind, f.batch_id, f.first_at, f.last_at, f.subject, f.preview, f.recipient,
    case when coalesce(f.cc_csv, '') = '' then null else string_to_array(f.cc_csv, ',') end,
    f.total, f.sent, f.failed, f.st, f.last_error, f.provider_message_id,
    count(*) over () as total_count
  from filtered f
  order by f.first_at desc, f.gk
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

-- Which kinds have been sent, and how many sends of each (for the filter).
create or replace function public.email_history_kinds(p_exclude_kinds text[] default '{}')
returns table (kind text, sends bigint)
language sql
stable
set search_path = ''
as $$
  select l.kind, count(distinct coalesce(l.batch_id, l.id::text)) as sends
  from public.email_delivery_log l
  where not (l.kind = any (coalesce(p_exclude_kinds, '{}'::text[])))
  group by l.kind
  order by l.kind;
$$;

revoke all on function public.email_history_page(text[], text[], text, text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.email_history_kinds(text[]) from public, anon, authenticated;
grant execute on function public.email_history_page(text[], text[], text, text, text, integer, integer)
  to service_role;
grant execute on function public.email_history_kinds(text[]) to service_role;

-- ----------------------------------------------------------------------------
-- Backfill: the two bulk senders that already kept per-recipient records.
-- Everything else starts from the day this ships; there is no record of it.
-- ----------------------------------------------------------------------------

-- Article notifications (publications), from article_email_tracking:<article>:<token>.
insert into public.email_delivery_log
  (created_at, kind, batch_id, recipient, subject, status, provider, provider_message_id, error)
select
  coalesce(
    nullif(v.value ->> 'sentAt', '')::timestamptz,
    nullif(v.value ->> 'lastAttemptedAt', '')::timestamptz,
    nullif(v.value ->> 'createdAt', '')::timestamptz,
    now()
  ),
  'publication_notification',
  'publication:' || (v.value ->> 'articleId'),
  lower(trim(v.value ->> 'recipientEmail')),
  'New article: ' || coalesce(v.value ->> 'articleTitle', ''),
  case when v.value ->> 'deliveryStatus' = 'sent' then 'sent' else 'failed' end,
  'backfill',
  nullif(v.value ->> 'providerMessageId', ''),
  nullif(v.value ->> 'deliveryError', '')
from public.kv_store_91ed8379 v
where v.key like 'article_email_tracking:%'
  and coalesce(v.value ->> 'recipientEmail', '') <> ''
  and coalesce(v.value ->> 'articleId', '') <> ''
  and (v.value ->> 'deliveryStatus' = 'sent' or v.value ->> 'deliveryStatus' like 'failed%');

-- Newsletter Studio campaigns, from nlstudio:recipient:<campaign>:<token>.
insert into public.email_delivery_log
  (created_at, kind, batch_id, recipient, subject, status, provider, error)
select
  coalesce(
    nullif(r.value ->> 'sentAt', '')::timestamptz,
    nullif(r.value ->> 'lastAttemptedAt', '')::timestamptz,
    now()
  ),
  'newsletter',
  'newsletter:' || (r.value ->> 'campaignId'),
  lower(trim(r.value ->> 'email')),
  coalesce(c.value ->> 'title', 'Newsletter'),
  case when r.value ->> 'deliveryStatus' = 'sent' then 'sent' else 'failed' end,
  'backfill',
  nullif(r.value ->> 'deliveryError', '')
from public.kv_store_91ed8379 r
left join public.kv_store_91ed8379 c
  on c.key = 'nlstudio:campaign:' || (r.value ->> 'campaignId')
where r.key like 'nlstudio:recipient:%'
  and coalesce(r.value ->> 'email', '') <> ''
  and coalesce(r.value ->> 'campaignId', '') <> ''
  and (r.value ->> 'deliveryStatus' = 'sent' or r.value ->> 'deliveryStatus' like 'failed%');
