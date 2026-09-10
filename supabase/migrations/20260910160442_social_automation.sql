-- ============================================================================
-- Social automation — the agent contract
-- ============================================================================
--
-- WHAT THIS IS
-- ------------
-- The weekly social-media pipeline (generate assets on Saturday, select and
-- schedule them on Sunday, publish through Buffer) is driven by an external
-- AI routine — a Claude Routine or a ChatGPT scheduled task — that reaches
-- this database ONLY through its Supabase connector and reaches Buffer ONLY
-- through its Buffer connector. Neither routine calls the app's REST API.
--
-- So the contract between the routine and the app is this schema: four
-- tables, two views and a handful of SQL functions that a model can call with
-- one statement each. The routine's own instructions live in
-- `social_automation_playbooks`, so the trigger prompt is one line ("read the
-- playbook and follow it") and the rules are editable from the admin UI
-- without touching either routine.
--
-- The Edge Function is a second, lower-privilege client of the same tables:
-- it renders Instagram images (the one thing a text model cannot do), mirrors
-- Buffer's post status back onto `social_assets`, and serves the Assets tab.
--
-- WHY TABLES AND NOT KV
-- ---------------------
-- The selector queries by week, channel and state; the image job queries by
-- image_status; the UI groups by batch. That is relational work, and the KV
-- ratchet (quality/baselines/kv-direct-access-baseline) exists precisely so
-- new namespaces stop landing there. Newer modules (fna_intake_sessions,
-- events) already use tables.
--
-- SECURITY
-- --------
-- RLS is enabled with NO policies on every table: the Edge Function reads and
-- writes with the service role, and the routines act through the Supabase
-- connector (the `postgres` role), both of which bypass RLS. `anon` and
-- `authenticated` get nothing — there is no client-side path to this data.
-- Functions pin `search_path` and are executable by `service_role` only, in
-- line with 20260825004011 / 20260825004035.
-- ============================================================================

-- ── 1. Tables ─────────────────────────────────────────────────────────────────

create table if not exists public.social_asset_batches (
  id                   uuid primary key default gen_random_uuid(),
  -- ISO week the assets are FOR (the posting week), e.g. '2026-W38'.
  week_key             text not null unique check (week_key ~ '^\d{4}-W\d{2}$'),
  source_window_start  date not null,
  source_window_end    date not null,
  status               text not null default 'generating' check (status in (
    'generating', 'generated', 'selecting', 'scheduled', 'failed', 'cancelled'
  )),
  generated_by         text,
  generated_at         timestamptz,
  selected_by          text,
  selected_at          timestamptz,
  -- The SA / world context brief the generator worked from. Kept for the
  -- audit trail and shown in the Assets tab.
  context_brief        text,
  run_report           jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.social_asset_batches is
  'One row per posting week. Created by the weekly generation routine; advanced by the scheduling routine.';

create table if not exists public.social_assets (
  id                   uuid primary key default gen_random_uuid(),
  batch_id             uuid not null references public.social_asset_batches(id) on delete cascade,
  week_key             text not null,
  channel              text not null check (channel in ('linkedin', 'instagram', 'x')),
  title                text not null check (char_length(title) between 1 and 160),
  body                 text not null check (char_length(body) between 1 and 6000),
  first_comment        text,
  hashtags             text[] not null default '{}',
  link_url             text,
  link_title           text,
  source_article_ids   text[] not null default '{}',
  source_summary       text,
  -- Image pipeline. A brief makes the Edge Function render an image; a
  -- ready-made public URL skips rendering. Instagram must have one or the other.
  image_brief          text,
  image_style          text check (image_style is null or image_style in (
    'photorealistic', 'editorial', 'abstract', 'conceptual', 'lifestyle', 'data_visualisation'
  )),
  image_status         text not null default 'none' check (image_status in (
    'none', 'pending', 'rendering', 'ready', 'failed'
  )),
  image_url            text,
  image_storage_path   text,
  image_alt_text       text,
  image_error          text,
  -- Lifecycle.
  state                text not null default 'generated' check (state in (
    'generated', 'shortlisted', 'selected', 'scheduled', 'published', 'failed', 'rejected', 'expired'
  )),
  selection_rank       int,
  selection_rationale  text,
  scheduled_for        timestamptz,
  buffer_post_id       text,
  buffer_status        text,
  buffer_error         text,
  published_at         timestamptz,
  created_by           text,
  updated_by           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint social_assets_instagram_needs_image check (
    channel <> 'instagram' or image_brief is not null or image_url is not null
  )
);

comment on table public.social_assets is
  'Candidate and scheduled social posts. state moves generated -> selected -> scheduled -> published; image_status is owned by the Edge Function image job.';

create index if not exists social_assets_week_channel_state
  on public.social_assets (week_key, channel, state);
create index if not exists social_assets_image_pending
  on public.social_assets (created_at) where image_status = 'pending';
create index if not exists social_assets_buffer_post
  on public.social_assets (buffer_post_id) where buffer_post_id is not null;
create index if not exists social_assets_batch
  on public.social_assets (batch_id);

create table if not exists public.social_automation_settings (
  id                          text primary key default 'default' check (id = 'default'),
  enabled                     boolean not null default true,
  assets_per_channel          int not null default 5 check (assets_per_channel between 1 and 20),
  posts_per_channel_per_week  int not null default 2 check (posts_per_channel_per_week between 0 and 7),
  channels                    text[] not null default array['linkedin', 'instagram', 'x'],
  posting_timezone            text not null default 'Africa/Johannesburg',
  site_origin                 text not null default 'https://www.navigatewealth.co',
  -- Per-channel preferred posting slots, "dow HH:MM" in posting_timezone.
  preferred_slots             jsonb not null default '{}'::jsonb,
  style_guide                 text not null default '',
  compliance_rules            text not null default '',
  updated_by                  text,
  updated_at                  timestamptz not null default now()
);

comment on table public.social_automation_settings is
  'Single-row configuration for the social automation. enabled=false is the kill switch every routine checks first.';

create table if not exists public.social_automation_playbooks (
  id            text primary key check (id in ('generate', 'schedule')),
  title         text not null,
  instructions  text not null,
  version       int not null default 1,
  updated_by    text,
  updated_at    timestamptz not null default now()
);

comment on table public.social_automation_playbooks is
  'The step-by-step instructions a Claude or ChatGPT routine reads and follows. Model-agnostic: only SQL, the Buffer connector and web search.';

-- updated_at maintenance, reusing the trigger function hardened in 20260825004011.
drop trigger if exists social_asset_batches_set_updated_at on public.social_asset_batches;
create trigger social_asset_batches_set_updated_at
  before update on public.social_asset_batches
  for each row execute function public.update_updated_at_column();

drop trigger if exists social_assets_set_updated_at on public.social_assets;
create trigger social_assets_set_updated_at
  before update on public.social_assets
  for each row execute function public.update_updated_at_column();

drop trigger if exists social_automation_settings_set_updated_at on public.social_automation_settings;
create trigger social_automation_settings_set_updated_at
  before update on public.social_automation_settings
  for each row execute function public.update_updated_at_column();

drop trigger if exists social_automation_playbooks_set_updated_at on public.social_automation_playbooks;
create trigger social_automation_playbooks_set_updated_at
  before update on public.social_automation_playbooks
  for each row execute function public.update_updated_at_column();

-- ── 2. RLS and grants ────────────────────────────────────────────────────────

alter table public.social_asset_batches        enable row level security;
alter table public.social_assets               enable row level security;
alter table public.social_automation_settings  enable row level security;
alter table public.social_automation_playbooks enable row level security;

revoke all on table public.social_asset_batches        from anon, authenticated;
revoke all on table public.social_assets               from anon, authenticated;
revoke all on table public.social_automation_settings  from anon, authenticated;
revoke all on table public.social_automation_playbooks from anon, authenticated;

-- ── 3. Views ─────────────────────────────────────────────────────────────────

-- Articles live in the KV table as JSON. This view is the routine's window
-- onto them: published articles only, with the absolute public URL and a
-- tag-stripped body so a model can read them without the KV layout.
create or replace function public.social_safe_timestamptz(p_value text)
returns timestamptz
language plpgsql immutable set search_path = public as $fn$
begin
  return p_value::timestamptz;
exception when others then
  return null;
end;
$fn$;

create or replace view public.social_recent_articles with (security_invoker = true) as
select
  a.value ->> 'id'                                     as id,
  a.value ->> 'title'                                  as title,
  a.value ->> 'subtitle'                               as subtitle,
  a.value ->> 'slug'                                   as slug,
  a.value ->> 'excerpt'                                as excerpt,
  c.value ->> 'name'                                   as category_name,
  a.value ->> 'author_name'                            as author_name,
  a.value ->> 'hero_image_url'                         as hero_image_url,
  public.social_safe_timestamptz(a.value ->> 'published_at') as published_at,
  (select s.site_origin from public.social_automation_settings s where s.id = 'default')
    || '/resources/article/' || (a.value ->> 'slug')   as url,
  left(
    regexp_replace(
      regexp_replace(coalesce(a.value ->> 'body', a.value ->> 'content', ''), '<[^>]+>', ' ', 'g'),
      '\s+', ' ', 'g'
    ),
    6000
  )                                                    as body_text
from public.kv_store_91ed8379 a
left join public.kv_store_91ed8379 c
  on c.key = 'article_category:' || (a.value ->> 'category_id')
where a.key like 'article:%'
  and a.value ->> 'status' = 'published'
  and a.value ->> 'slug' is not null;

comment on view public.social_recent_articles is
  'Published articles from the KV store, shaped for the social routines. Filter on published_at.';

create or replace view public.social_automation_week_status with (security_invoker = true) as
select
  b.week_key,
  b.status        as batch_status,
  b.generated_at,
  b.selected_at,
  a.channel,
  a.state,
  count(a.id)     as assets
from public.social_asset_batches b
left join public.social_assets a on a.batch_id = b.id
group by b.week_key, b.status, b.generated_at, b.selected_at, a.channel, a.state;

revoke all on public.social_recent_articles         from anon, authenticated;
revoke all on public.social_automation_week_status  from anon, authenticated;

-- ── 4. Functions (the routine's verbs) ───────────────────────────────────────

-- Kill switch.
create or replace function public.social_automation_is_enabled()
returns boolean
language sql stable set search_path = public as $fn$
  select coalesce((select enabled from public.social_automation_settings where id = 'default'), false);
$fn$;

-- Idempotent batch start: returns the existing batch when the week already
-- has one, so a re-fired routine can tell "already generated" from "new".
create or replace function public.social_automation_start_batch(
  p_week_key      text,
  p_window_start  date,
  p_window_end    date,
  p_agent         text
) returns jsonb
language plpgsql set search_path = public as $fn$
declare
  b        public.social_asset_batches;
  existed  boolean := true;
  per_channel jsonb;
begin
  select * into b from public.social_asset_batches where week_key = p_week_key;
  if not found then
    insert into public.social_asset_batches (week_key, source_window_start, source_window_end, status, generated_by)
    values (p_week_key, p_window_start, p_window_end, 'generating', p_agent)
    returning * into b;
    existed := false;
  end if;

  select coalesce(jsonb_object_agg(t.channel, t.n), '{}'::jsonb) into per_channel
  from (select channel, count(*) as n from public.social_assets where batch_id = b.id group by channel) t;

  return jsonb_build_object(
    'batch_id', b.id,
    'week_key', b.week_key,
    'status', b.status,
    'existed', existed,
    'source_window_start', b.source_window_start,
    'source_window_end', b.source_window_end,
    'assets_per_channel', per_channel
  );
end;
$fn$;

-- One asset from one JSON object. Keys: channel, title, body, first_comment,
-- hashtags[], link_url, link_title, source_article_ids[], source_summary,
-- image_brief, image_style, image_alt_text, image_url.
create or replace function public.social_automation_add_asset(
  p_batch_id  uuid,
  p_asset     jsonb,
  p_agent     text
) returns uuid
language plpgsql set search_path = public as $fn$
declare
  v_week   text;
  v_id     uuid;
  v_hashtags text[];
  v_sources  text[];
begin
  select week_key into v_week from public.social_asset_batches where id = p_batch_id;
  if v_week is null then
    raise exception 'social_automation_add_asset: batch % not found', p_batch_id;
  end if;

  select coalesce(array_agg(x), '{}') into v_hashtags
  from jsonb_array_elements_text(coalesce(p_asset -> 'hashtags', '[]'::jsonb)) x;
  select coalesce(array_agg(x), '{}') into v_sources
  from jsonb_array_elements_text(coalesce(p_asset -> 'source_article_ids', '[]'::jsonb)) x;

  insert into public.social_assets (
    batch_id, week_key, channel, title, body, first_comment, hashtags, link_url, link_title,
    source_article_ids, source_summary, image_brief, image_style, image_alt_text, image_url,
    image_status, created_by, updated_by
  ) values (
    p_batch_id, v_week, lower(p_asset ->> 'channel'), p_asset ->> 'title', p_asset ->> 'body',
    p_asset ->> 'first_comment', v_hashtags, p_asset ->> 'link_url', p_asset ->> 'link_title',
    v_sources, p_asset ->> 'source_summary', p_asset ->> 'image_brief', p_asset ->> 'image_style',
    p_asset ->> 'image_alt_text', p_asset ->> 'image_url',
    case
      when p_asset ->> 'image_url' is not null then 'ready'
      when p_asset ->> 'image_brief' is not null then 'pending'
      else 'none'
    end,
    p_agent, p_agent
  ) returning id into v_id;

  return v_id;
end;
$fn$;

create or replace function public.social_automation_finish_generation(
  p_batch_id       uuid,
  p_context_brief  text,
  p_report         jsonb
) returns jsonb
language plpgsql set search_path = public as $fn$
declare
  per_channel jsonb;
begin
  update public.social_asset_batches
  set status = 'generated',
      generated_at = now(),
      context_brief = p_context_brief,
      run_report = run_report || jsonb_build_object('generation', coalesce(p_report, '{}'::jsonb))
  where id = p_batch_id;

  select coalesce(jsonb_object_agg(t.channel, t.n), '{}'::jsonb) into per_channel
  from (select channel, count(*) as n from public.social_assets where batch_id = p_batch_id group by channel) t;

  return jsonb_build_object('batch_id', p_batch_id, 'status', 'generated', 'assets_per_channel', per_channel);
end;
$fn$;

-- Selection: records the pick, its rank, why, and the intended slot. Final
-- copy edits are optional — pass null to keep the generated text.
create or replace function public.social_automation_select_asset(
  p_asset_id       uuid,
  p_rank           int,
  p_rationale      text,
  p_scheduled_for  timestamptz,
  p_body           text default null,
  p_first_comment  text default null,
  p_agent          text default null
) returns jsonb
language plpgsql set search_path = public as $fn$
declare
  a public.social_assets;
begin
  update public.social_assets
  set state = 'selected',
      selection_rank = p_rank,
      selection_rationale = p_rationale,
      scheduled_for = p_scheduled_for,
      body = coalesce(p_body, body),
      first_comment = coalesce(p_first_comment, first_comment),
      updated_by = coalesce(p_agent, updated_by)
  where id = p_asset_id
    and state in ('generated', 'shortlisted', 'selected', 'failed')
  returning * into a;

  if a.id is null then
    raise exception 'social_automation_select_asset: asset % not found or not selectable', p_asset_id;
  end if;

  update public.social_asset_batches
  set status = 'selecting', selected_by = coalesce(p_agent, selected_by)
  where id = a.batch_id and status = 'generated';

  return jsonb_build_object('asset_id', a.id, 'channel', a.channel, 'state', a.state, 'scheduled_for', a.scheduled_for);
end;
$fn$;

create or replace function public.social_automation_mark_scheduled(
  p_asset_id        uuid,
  p_buffer_post_id  text,
  p_scheduled_for   timestamptz,
  p_agent           text default null
) returns jsonb
language plpgsql set search_path = public as $fn$
declare
  a public.social_assets;
begin
  update public.social_assets
  set state = 'scheduled',
      buffer_post_id = p_buffer_post_id,
      buffer_status = 'scheduled',
      buffer_error = null,
      scheduled_for = coalesce(p_scheduled_for, scheduled_for),
      updated_by = coalesce(p_agent, updated_by)
  where id = p_asset_id
  returning * into a;

  if a.id is null then
    raise exception 'social_automation_mark_scheduled: asset % not found', p_asset_id;
  end if;

  return jsonb_build_object('asset_id', a.id, 'channel', a.channel, 'state', a.state, 'buffer_post_id', a.buffer_post_id);
end;
$fn$;

create or replace function public.social_automation_mark_failed(
  p_asset_id  uuid,
  p_error     text,
  p_agent     text default null
) returns jsonb
language plpgsql set search_path = public as $fn$
declare
  a public.social_assets;
begin
  update public.social_assets
  set state = 'failed',
      buffer_error = left(coalesce(p_error, 'unknown error'), 2000),
      updated_by = coalesce(p_agent, updated_by)
  where id = p_asset_id
  returning * into a;

  if a.id is null then
    raise exception 'social_automation_mark_failed: asset % not found', p_asset_id;
  end if;

  return jsonb_build_object('asset_id', a.id, 'channel', a.channel, 'state', a.state);
end;
$fn$;

create or replace function public.social_automation_finish_selection(
  p_batch_id  uuid,
  p_report    jsonb,
  p_agent     text default null
) returns jsonb
language plpgsql set search_path = public as $fn$
declare
  scheduled_count int;
  per_channel jsonb;
begin
  select count(*) into scheduled_count
  from public.social_assets where batch_id = p_batch_id and state = 'scheduled';

  update public.social_asset_batches
  set status = case when scheduled_count > 0 then 'scheduled' else 'failed' end,
      selected_at = now(),
      selected_by = coalesce(p_agent, selected_by),
      run_report = run_report || jsonb_build_object('selection', coalesce(p_report, '{}'::jsonb))
  where id = p_batch_id;

  select coalesce(jsonb_object_agg(t.channel, t.n), '{}'::jsonb) into per_channel
  from (select channel, count(*) as n from public.social_assets
        where batch_id = p_batch_id and state = 'scheduled' group by channel) t;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', case when scheduled_count > 0 then 'scheduled' else 'failed' end,
    'scheduled_per_channel', per_channel
  );
end;
$fn$;

-- Candidate posting slots for a channel, from settings.preferred_slots
-- ("dow HH:MM" strings in posting_timezone), as absolute timestamps after
-- p_from. The routine picks among these; it may deviate with a reason.
create or replace function public.social_automation_next_slots(
  p_channel  text,
  p_from     timestamptz default now(),
  p_count    int default 8
) returns table (slot_at timestamptz, slot_local text, slot_label text)
language sql stable set search_path = public as $fn$
  with s as (
    select posting_timezone as tz,
           coalesce(preferred_slots -> lower(p_channel), '[]'::jsonb) as slots
    from public.social_automation_settings
    where id = 'default'
  ),
  parsed as (
    select s.tz,
           lower(split_part(e, ' ', 1)) as dow,
           split_part(e, ' ', 2)::time  as tod,
           e                            as label
    from s, jsonb_array_elements_text(s.slots) as e
    where e ~* '^(mon|tue|wed|thu|fri|sat|sun)\s+\d{1,2}:\d{2}$'
  ),
  days as (
    select (d)::date as day
    from s, generate_series(
      (p_from at time zone s.tz)::date,
      (p_from at time zone s.tz)::date + 21,
      interval '1 day'
    ) as d
  ),
  candidates as (
    select ((days.day + parsed.tod) at time zone parsed.tz) as slot_at,
           to_char(days.day + parsed.tod, 'Dy DD Mon YYYY HH24:MI') as slot_local,
           parsed.label                                        as slot_label
    from days
    join parsed on lower(to_char(days.day, 'dy')) = parsed.dow
  )
  select slot_at, slot_local, slot_label
  from candidates
  where slot_at > p_from
  order by slot_at
  limit greatest(coalesce(p_count, 8), 1);
$fn$;

-- Executable by the service role (Edge Function) and the owner only.
revoke execute on function public.social_safe_timestamptz(text)                                   from public, anon, authenticated;
revoke execute on function public.social_automation_is_enabled()                                  from public, anon, authenticated;
revoke execute on function public.social_automation_start_batch(text, date, date, text)           from public, anon, authenticated;
revoke execute on function public.social_automation_add_asset(uuid, jsonb, text)                  from public, anon, authenticated;
revoke execute on function public.social_automation_finish_generation(uuid, text, jsonb)          from public, anon, authenticated;
revoke execute on function public.social_automation_select_asset(uuid, int, text, timestamptz, text, text, text) from public, anon, authenticated;
revoke execute on function public.social_automation_mark_scheduled(uuid, text, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.social_automation_mark_failed(uuid, text, text)                 from public, anon, authenticated;
revoke execute on function public.social_automation_finish_selection(uuid, jsonb, text)           from public, anon, authenticated;
revoke execute on function public.social_automation_next_slots(text, timestamptz, int)            from public, anon, authenticated;

grant execute on function public.social_safe_timestamptz(text)                                    to service_role;
grant execute on function public.social_automation_is_enabled()                                   to service_role;
grant execute on function public.social_automation_start_batch(text, date, date, text)            to service_role;
grant execute on function public.social_automation_add_asset(uuid, jsonb, text)                   to service_role;
grant execute on function public.social_automation_finish_generation(uuid, text, jsonb)           to service_role;
grant execute on function public.social_automation_select_asset(uuid, int, text, timestamptz, text, text, text) to service_role;
grant execute on function public.social_automation_mark_scheduled(uuid, text, timestamptz, text)  to service_role;
grant execute on function public.social_automation_mark_failed(uuid, text, text)                  to service_role;
grant execute on function public.social_automation_finish_selection(uuid, jsonb, text)            to service_role;
grant execute on function public.social_automation_next_slots(text, timestamptz, int)             to service_role;

-- ── 5. Seed: settings ────────────────────────────────────────────────────────

insert into public.social_automation_settings (
  id, enabled, assets_per_channel, posts_per_channel_per_week, channels, posting_timezone,
  site_origin, preferred_slots, style_guide, compliance_rules, updated_by
) values (
  'default', true, 5, 2, array['linkedin', 'instagram', 'x'], 'Africa/Johannesburg',
  'https://www.navigatewealth.co',
  '{
    "linkedin":  ["tue 07:30", "wed 12:15", "thu 07:45", "thu 17:30", "fri 08:00"],
    "instagram": ["mon 18:30", "wed 12:30", "thu 19:00", "fri 17:30", "sat 10:00"],
    "x":         ["tue 08:00", "wed 17:45", "thu 12:30", "fri 08:15", "sun 18:00"]
  }'::jsonb,
  $sg$NAVIGATE WEALTH — SOCIAL STYLE GUIDE (v1)

VOICE
Warm, plain-spoken, expert. We explain; we never hype. South African English spelling (optimise, programme, licence, colour). Rand amounts with a space as the thousands separator and a point for decimals: R12 500, R2.5 million. Dates as 12 Sep 2026. Percentages with the % sign: 8.25%.

AUDIENCE
Retail clients and prospective clients in South Africa: individuals, families and small-business owners making decisions about retirement, investing, tax, medical aid, life and disability cover, and estate planning. Assume intelligence, not expertise.

PURPOSE OF EVERY POST
Give the reader one genuinely useful thing — an insight, a rule of thumb, a deadline, a question worth asking an adviser. The call to action is soft and optional: "speak to your adviser", "read the full article", "book a consultation at navigatewealth.co".

LINKEDIN (company page)
- 900–1,300 characters. The first two lines carry the hook; they are all that shows before "see more".
- Short paragraphs, one idea each. Plain line breaks, no bullet symbols needed.
- At most two emoji, and only if they earn their place. 2–3 hashtags at the very end.
- Article-led posts attach the article as a link card: set link_url and link_title. Do not also request an image for a link-card post.
- Tone: thoughtful professional, first-person plural ("we see this often with clients").

INSTAGRAM (business account)
- Caption: 120–300 characters of real content, then a blank line, then 4–6 hashtags.
- Always an image. Describe it in image_brief: premium, calm, on-brand (deep navy #1B2A4A and warm gold #C9A84C tones), South African settings welcome, no text inside the image, no close-up faces, no logos, no currency notes. Provide image_alt_text (one sentence).
- Tone: friendly and direct, second person ("you"). One clear takeaway per post.

X
- Up to 240 characters INCLUDING the link (a link counts as 23 characters). One sharp idea or one striking, sourced number, then the article link.
- One hashtag at most, or none. Tone: crisp and confident, no jargon, no threads.

WEEKLY MIX (per channel, 5 assets)
- 2 × article-led: from this week's published Navigate Wealth articles.
- 1 × news-led: this week's SA or global development, explained for what it means to a client.
- 1 × evergreen principle: budgeting, emergency fund, TFSA vs RA, two-pot retirement system, medical aid gap cover, estate planning basics, life-stage planning.
- 1 × question we get asked: a question clients ask, answered briefly and honestly.
Do not repeat a topic used in the previous three weeks (check recent social_assets titles). Vary the opening line pattern across the five assets.$sg$,
  $cr$NON-NEGOTIABLE COMPLIANCE RULES (Navigate Wealth is an authorised financial services provider; FAIS/FSCA apply)
1. Never promise or imply guaranteed returns, "safe" investments, or specific future performance. Past performance may be stated only as fact, with its period and source.
2. No product recommendations to the public. Discuss categories (retirement annuities, tax-free savings accounts, unit trusts, life cover, medical aid) and principles — never "buy X", "switch to Y", or a named provider in a recommending tone.
3. Any post touching investing, tax, insurance or retirement decisions must make clear that the right answer depends on personal circumstances and that readers should speak to a licensed financial adviser. The soft CTA covers this.
4. South African tax and regulatory figures must be current and correct (SARS, SARB, FSCA, National Treasury). If a number cannot be verified, leave the number out.
5. No client stories, names or identifying details — real or implied. No screenshots of statements or portfolios.
6. No fear-based urgency ("act now or lose everything"), no political opinion, no commentary on the prospects of a specific listed company.
7. No medical advice. Medical aid content is about cover, cost and process, not treatment.
8. When in doubt, leave it out: shorter and correct beats longer and doubtful.
9. AI-generated imagery must not depict real or recognisable people, brands, logos, or currency.
10. Posts are published in the practice's name. Write as the practice ("we"), never as a named individual, and never impersonate a client or a regulator.$cr$,
  'migration:20260910'
) on conflict (id) do nothing;

-- ── 6. Seed: playbooks ───────────────────────────────────────────────────────

insert into public.social_automation_playbooks (id, title, instructions, version, updated_by) values
(
  'generate',
  'Weekly social asset generation (Saturday)',
  $pb_gen$NAVIGATE WEALTH — WEEKLY SOCIAL ASSET GENERATION

You are the social-media content strategist for Navigate Wealth, an independent South African financial advisory practice. In this run you CREATE candidate assets for next week. You do NOT post anything. You work through exactly two capabilities: the Supabase connection (run SQL against project vpjmdsltwrnpefzcgdmz) and web search. Identify yourself in every write as AGENT = 'claude-routine' or 'chatgpt-routine', whichever you are.

Run the SQL statements below verbatim, substituting the bracketed values. When a text value could contain quotes or newlines, wrap it in dollar quotes ($q$ ... $q$) instead of single quotes.

STEP 0 — KILL SWITCH AND SETTINGS
  select enabled, assets_per_channel, channels, style_guide, compliance_rules, site_origin
  from public.social_automation_settings where id = 'default';
If enabled is false: stop, and report "Social automation is disabled in settings." Read style_guide and compliance_rules in full; they govern everything you write.

STEP 1 — WHICH WEEK
  select to_char(case when extract(isodow from d) >= 6 then d + 7 else d end, 'IYYY-"W"IW') as week_key,
         (d - 7)::date as window_start, d::date as window_end
  from (select (now() at time zone 'Africa/Johannesburg')::date as d) t;
week_key is the ISO week the assets are FOR (next week when run on Saturday/Sunday). window_start/window_end is the 7-day source window for articles.

STEP 2 — START THE BATCH (idempotent)
  select public.social_automation_start_batch('[week_key]', '[window_start]', '[window_end]', '[AGENT]');
Read the JSON result. If existed = true and status is not 'generating', this week is already generated: stop and report it. If existed = true and status = 'generating', a previous run stopped early: continue, and only create the assets still missing per channel (assets_per_channel minus the count in assets_per_channel for that channel). Keep batch_id.

STEP 3 — SOURCE MATERIAL: THIS WEEK'S ARTICLES
  select id, title, subtitle, excerpt, category_name, published_at, url, body_text
  from public.social_recent_articles
  where published_at >= '[window_start]'
  order by published_at desc;
body_text is truncated to 6,000 characters. If there are more than eight articles, group them by theme and keep the six to eight with the most client value, timeliness and diversity across categories. If there are none, use evergreen topics from the style guide plus this week's context.

Also check what was used recently so you do not repeat it:
  select week_key, channel, title from public.social_assets
  where created_at > now() - interval '21 days' order by created_at desc;

STEP 4 — CONTEXT: SOUTH AFRICA AND THE WORLD THIS WEEK
Run three to six web searches, for example: "South Africa personal finance news this week", "SARB repo rate decision", "SARS tax season deadline", "two-pot retirement system withdrawals", "JSE rand this week", "global markets this week investors". Prefer Moneyweb, BusinessLIVE, Daily Maverick Business, News24 Business, FAnews, the SARB, SARS, FSCA and National Treasury. Write a CONTEXT BRIEF of 150–250 words: dated facts only, no speculation, with the source names. You will store it in Step 6.

STEP 5 — GENERATE THE ASSETS
For each channel listed in settings.channels, write assets_per_channel assets following the WEEKLY MIX and channel formats in style_guide, and every rule in compliance_rules. Insert each one:
  select public.social_automation_add_asset('[batch_id]'::uuid, $q${
    "channel": "linkedin | instagram | x",
    "title": "short internal label, max 120 chars",
    "body": "the post text (LinkedIn/X: hashtags at the end of body; Instagram: caption, blank line, hashtags)",
    "first_comment": "optional — a first comment (e.g. the article link for LinkedIn) or null",
    "hashtags": ["FinancialPlanning", "SouthAfrica"],
    "link_url": "https://www.navigatewealth.co/resources/article/<slug> or null",
    "link_title": "article title when link_url is set, else null",
    "source_article_ids": ["article id(s) this draws on, or empty"],
    "source_summary": "one line: what this asset is based on",
    "image_brief": "REQUIRED for instagram; optional for linkedin without a link; null for x. Describe the visual.",
    "image_style": "editorial | photorealistic | abstract | conceptual | lifestyle | data_visualisation (only when image_brief is set)",
    "image_alt_text": "one-sentence alt text when image_brief is set"
  }$q$::jsonb, '[AGENT]');
Rules of thumb: hashtags without the # symbol in the array (write them with # inside body). Instagram assets MUST have image_brief. Article-led LinkedIn assets use link_url and no image_brief. X bodies must stay under 240 characters including the link.

Before inserting, self-check every asset against compliance_rules. Rewrite or drop anything that fails. Never insert a doubtful figure.

STEP 6 — FINISH THE BATCH
  select public.social_automation_finish_generation('[batch_id]'::uuid, $q$[CONTEXT BRIEF]$q$,
    $q${"articles_considered": [n], "articles_used": [n], "searches": [n], "notes": "[anything the operator should know]"}$q$::jsonb);
The Edge Function will render images for every asset that has an image_brief within the next hour or two; you do not wait for that.

STEP 7 — REPORT
Finish with a short report: week_key, assets created per channel, the articles used (titles), the context brief, and anything skipped and why. Do not paste every asset body into the report.

FAILURE HANDLING
- If a SQL statement errors, read the message, fix the statement and retry once. If it still fails, stop and report the error with the statement.
- If web search is unavailable, generate from the articles and evergreen topics only and say so in the report.
- Never delete or edit assets from other weeks.$pb_gen$,
  1,
  'migration:20260910'
),
(
  'schedule',
  'Weekly selection and scheduling (Sunday)',
  $pb_sch$NAVIGATE WEALTH — WEEKLY SELECTION AND SCHEDULING

You are the social-media editor for Navigate Wealth, an independent South African financial advisory practice. In this run you CHOOSE the best assets generated for next week, finalise their copy, pick the posting times, and SCHEDULE them in Buffer. You work through exactly three capabilities: the Supabase connection (run SQL against project vpjmdsltwrnpefzcgdmz), the Buffer connection, and web search. Identify yourself in every write as AGENT = 'claude-routine' or 'chatgpt-routine', whichever you are. Times are Africa/Johannesburg (SAST, UTC+02:00) unless stated.

Run the SQL statements below verbatim, substituting the bracketed values. Wrap free text in dollar quotes ($q$ ... $q$).

STEP 0 — KILL SWITCH AND SETTINGS
  select enabled, posts_per_channel_per_week, channels, posting_timezone, style_guide, compliance_rules
  from public.social_automation_settings where id = 'default';
If enabled is false: stop and report "Social automation is disabled in settings."

STEP 1 — WHICH WEEK
  select to_char(case when extract(isodow from d) >= 6 then d + 7 else d end, 'IYYY-"W"IW') as week_key,
         date_trunc('week', (case when extract(isodow from d) >= 6 then d + 7 else d end)::timestamp) as week_start
  from (select (now() at time zone 'Africa/Johannesburg')::date as d) t;
week_start is the Monday 00:00 local of the posting week; the posting window is week_start to week_start + 7 days.

STEP 2 — LOAD THE BATCH
  select id as batch_id, status, generated_at, context_brief, run_report
  from public.social_asset_batches where week_key = '[week_key]';
If there is no batch or status is 'generating': the generation run has not completed — stop and report it (do not generate assets in this run). If status is 'scheduled': this week is already scheduled — stop and report it. Otherwise continue with batch_id.

  select id, channel, title, body, first_comment, hashtags, link_url, link_title, source_summary,
         image_status, image_url, image_alt_text, state
  from public.social_assets
  where batch_id = '[batch_id]'::uuid and state in ('generated', 'shortlisted', 'selected')
  order by channel, created_at;
Instagram candidates are usable only when image_status = 'ready' (image_url set). If an Instagram asset's image is 'failed', skip it. If every Instagram asset is still 'pending' or 'rendering', the image job has not run yet: skip Instagram this week and say so in the report.

STEP 3 — WHAT IS ALREADY SCHEDULED (idempotency)
  select channel, count(*) from public.social_assets
  where week_key = '[week_key]' and state in ('scheduled', 'published') group by channel;
Also, through the Buffer connection: get_account (note the organisation and currentTime), list_channels, then list_posts for the organisation with dueAt between week_start and week_start + 7 days and status in (scheduled, sending, sent). For any channel that already has posts_per_channel_per_week or more posts scheduled in the window (from either source), skip that channel this week.

Map channels by service: linkedin (type page, the Navigate Wealth company page) = 'linkedin'; instagram (business, navigate_wealth) = 'instagram'; twitter = 'x'. A channel that is not connected in Buffer is skipped with a note; never guess a channel id.

STEP 4 — CONTEXT REFRESH
Run two to four web searches for what has happened in South Africa and world markets since the generation run (repo rate, budget or tax announcements, major market moves, national events). Use this to (a) prefer timely assets and (b) tone-check: if there is a national tragedy or a sharp market shock, prefer calm, educational assets and avoid anything that could read as opportunistic.

STEP 5 — SELECT AND FINALISE
For each channel still in play, choose posts_per_channel_per_week assets. Criteria, in order: genuine client value; timeliness against the context; compliance (re-check every rule in compliance_rules — drop anything doubtful); diversity across the week (no two posts on the same theme; for LinkedIn prefer one article-led and one principle or question); Instagram must have a ready image.

Polish the copy without changing its substance. Hard limits: X ≤ 240 characters including the link (count a link as 23); LinkedIn ≤ 3,000 characters (aim 900–1,300; hook in the first two lines); Instagram ≤ 2,200 characters (caption, blank line, 4–6 hashtags). No new facts or figures at this stage.

Pick posting times from the preferred slots:
  select slot_at, slot_local, slot_label from public.social_automation_next_slots('[channel]', now(), 10);
Choose posts_per_channel_per_week slots on DIFFERENT days within the posting week, avoiding the same hour on two channels. You may pick a time outside the list when the context justifies it (for example a budget-speech morning) — say why in the rationale. slot_at is an absolute timestamp; when you pass it to Buffer, format it as ISO 8601 with the +02:00 offset (e.g. 2026-09-15T07:30:00+02:00) and make sure it is in the future relative to Buffer's currentTime.

Record each pick:
  select public.social_automation_select_asset('[asset_id]'::uuid, [rank 1..n], $q$[one or two sentences: why this asset, why this slot]$q$,
    '[slot_at as ISO 8601]'::timestamptz, $q$[final body, or null to keep the generated body]$q$, $q$[final first comment or null]$q$, '[AGENT]');

STEP 6 — SCHEDULE IN BUFFER
For each selected asset, create exactly one Buffer post with the Buffer connection's create_post:
- channelId: the mapped channel id.
- text: the final body (LinkedIn and X: hashtags already at the end; Instagram: caption, blank line, hashtags).
- mode: customScheduled; dueAt: the slot as ISO 8601 with +02:00; schedulingType: automatic.
- Instagram: assets = [{ "image": { "url": image_url, "metadata": { "altText": image_alt_text } } }]; metadata.instagram = { "type": "post", "shouldShareToFeed": true, "isAiGenerated": true }.
- LinkedIn with link_url: metadata.linkedin.linkAttachment = { "url": link_url, "title": link_title }; no assets. LinkedIn without a link and with a ready image: assets = [{ "image": { "url": image_url, "metadata": { "altText": image_alt_text } } }].
- X: text only (the link is inside the text). If the asset has a ready image, you may attach it as an image asset.
Do not set saveToDraft. Do not add tags.

After each successful create_post, immediately record it:
  select public.social_automation_mark_scheduled('[asset_id]'::uuid, '[buffer post id]', '[dueAt ISO 8601]'::timestamptz, '[AGENT]');
If create_post fails, record it and try the next-best asset for that channel and slot (one retry per slot):
  select public.social_automation_mark_failed('[asset_id]'::uuid, $q$[error message]$q$, '[AGENT]');

STEP 7 — FINISH THE BATCH
  select public.social_automation_finish_selection('[batch_id]'::uuid,
    $q${"scheduled": {"linkedin": [n], "instagram": [n], "x": [n]}, "skipped": {"[channel]": "[reason]"}, "failures": ["[asset title]: [error]"], "context_notes": "[one or two lines]"}$q$::jsonb,
    '[AGENT]');

STEP 8 — REPORT
Finish with a short report: week_key, what was scheduled per channel with day and time, the rationale for each pick in one line, anything skipped or failed and why. The operator monitors the accounts and will delete a post in Buffer if needed, so make the report easy to scan.

FAILURE HANDLING
- If a SQL statement errors, read the message, fix the statement and retry once; if it still fails, stop and report the error with the statement.
- If the Buffer connection is unavailable, record nothing as scheduled, finish the batch with an empty "scheduled" object (the batch will show as failed), and report it.
- Never edit or delete Buffer posts you did not create in this run. Never schedule more than posts_per_channel_per_week posts per channel for the week.$pb_sch$,
  1,
  'migration:20260910'
)
on conflict (id) do nothing;
