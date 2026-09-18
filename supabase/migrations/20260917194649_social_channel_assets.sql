-- ============================================================================
-- Social channel assets — the media library the Assets tab shows
-- ============================================================================
--
-- WHAT THIS IS
-- ------------
-- A row per finished picture or video, tagged with the channel it was made
-- for (LinkedIn, Instagram, X). An outside agent — ChatGPT today — adds them
-- through `POST /social-library/assets`; a Claude routine will later pick from
-- what is `available` and publish it through Buffer, marking the row `used`.
--
-- WHY A TABLE, WHEN THE EARLIER MEDIA LIBRARY DELIBERATELY HAD NONE
-- -----------------------------------------------------------------
-- That library stored bare uploads and read them back by listing a storage
-- prefix, because name, size, type and created_at were the whole of it and a
-- table would have been a second source of truth. This is not that. A channel,
-- a caption, an alt text, tags, and above all a LIFECYCLE ("has a routine
-- published this yet?") are facts storage cannot hold. The moment an agent
-- needs to ask "what have you got for Instagram that I have not used", the
-- answer has to live in a queryable row.
--
-- Storage still holds the bytes, under `channels/<channel>/` in the same
-- public bucket the automation's rendered images use. Public because Buffer
-- fetches media from the URL it is handed, days later for a scheduled post,
-- which a signed URL would not survive.
--
-- WHY `social_channel_assets` AND NOT `social_assets`
-- ---------------------------------------------------
-- `social_assets` already exists and means something else: the weekly
-- routine's candidate POSTS, which carry body text, hashtags and an image
-- brief. These are the media files themselves. Two different things; two
-- names. The admin UI shows this one under the Assets tab and the older one
-- under Weekly pipeline.
-- ============================================================================

-- ── 1. The table ────────────────────────────────────────────────────────────

create table if not exists public.social_channel_assets (
  id              uuid primary key default gen_random_uuid(),
  channel         text not null check (channel in ('linkedin', 'instagram', 'x')),
  media_type      text not null check (media_type in ('image', 'video')),

  -- Where the bytes are. `storage_path` is unique so the same object can never
  -- be registered twice, and `url` is the permanent public link Buffer fetches.
  storage_path    text not null unique,
  url             text not null,
  file_name       text,
  content_type    text not null,
  byte_size       bigint not null check (byte_size >= 0),

  -- Optional shape, when the uploader knows it. Instagram cares about aspect
  -- ratio and video length, so a routine can filter on these rather than
  -- discovering the hard way that Buffer rejected the post.
  width               int check (width is null or width > 0),
  height              int check (height is null or height > 0),
  duration_seconds    numeric check (duration_seconds is null or duration_seconds > 0),

  -- What to say with it. The caption is a SUGGESTION from whoever made the
  -- asset; the publishing routine may rewrite it.
  caption         text check (caption is null or char_length(caption) <= 3000),
  alt_text        text check (alt_text is null or char_length(alt_text) <= 1000),
  tags            text[] not null default '{}',
  notes           text,

  -- Lifecycle. `available` is the queue a routine draws from.
  status          text not null default 'available'
                    check (status in ('available', 'used', 'archived')),
  used_at         timestamptz,
  buffer_post_id  text,
  published_at    timestamptz,

  -- Provenance: which agent or person put this here.
  source          text not null default 'admin',
  created_by      text,
  updated_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.social_channel_assets is
  'Finished images and videos per social channel. Added by an outside agent (ChatGPT) or an admin; a publishing routine draws from status = available and marks them used. Bytes live in the public bucket under channels/<channel>/.';

-- The query a routine actually runs: "available media for this channel,
-- newest first".
create index if not exists social_channel_assets_channel_status_created
  on public.social_channel_assets (channel, status, created_at desc);

create index if not exists social_channel_assets_status_created
  on public.social_channel_assets (status, created_at desc);

drop trigger if exists social_channel_assets_set_updated_at on public.social_channel_assets;
create trigger social_channel_assets_set_updated_at
  before update on public.social_channel_assets
  for each row execute function public.update_updated_at_column();

-- ── 2. RLS: no browser reaches this directly ────────────────────────────────
--
-- On with no policies, which denies everything to anon and authenticated. The
-- Edge Function holds the service_role key and is the only way in, exactly as
-- the rest of the social automation works.

alter table public.social_channel_assets enable row level security;

revoke all on public.social_channel_assets from public, anon, authenticated;
grant select, insert, update, delete on public.social_channel_assets to service_role;

-- ── 3. The agent contract ───────────────────────────────────────────────────
--
-- A routine whose only reach into this database is the Supabase connector
-- calls these rather than writing SQL against the table by hand. The HTTPS
-- endpoint calls the same functions, so both paths behave identically.

create or replace function public.social_channel_assets_add(
  p_asset  jsonb,
  p_agent  text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  a      public.social_channel_assets;
  v_tags text[];
begin
  select coalesce(array_agg(x), '{}') into v_tags
  from jsonb_array_elements_text(coalesce(p_asset -> 'tags', '[]'::jsonb)) x;

  insert into public.social_channel_assets (
    channel, media_type, storage_path, url, file_name, content_type, byte_size,
    width, height, duration_seconds, caption, alt_text, tags, notes,
    source, created_by, updated_by
  ) values (
    lower(p_asset ->> 'channel'),
    lower(p_asset ->> 'media_type'),
    p_asset ->> 'storage_path',
    p_asset ->> 'url',
    p_asset ->> 'file_name',
    p_asset ->> 'content_type',
    coalesce((p_asset ->> 'byte_size')::bigint, 0),
    (p_asset ->> 'width')::int,
    (p_asset ->> 'height')::int,
    (p_asset ->> 'duration_seconds')::numeric,
    p_asset ->> 'caption',
    p_asset ->> 'alt_text',
    v_tags,
    p_asset ->> 'notes',
    coalesce(p_asset ->> 'source', coalesce(p_agent, 'admin')),
    p_agent,
    p_agent
  )
  returning * into a;

  return to_jsonb(a);
end;
$fn$;

comment on function public.social_channel_assets_add(jsonb, text) is
  'Register one already-stored media file against a channel. The caller uploads the bytes first and passes storage_path and url.';

/**
 * What a publishing routine reads. Defaults to the available queue so the
 * common call is `select * from social_channel_assets_list('instagram')`.
 */
create or replace function public.social_channel_assets_list(
  p_channel     text default null,
  p_status      text default 'available',
  p_media_type  text default null,
  p_limit       int default 50,
  p_offset      int default 0
) returns jsonb
language sql
security definer
set search_path = public
as $fn$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
  from (
    select *
    from public.social_channel_assets a
    where (p_channel is null or a.channel = lower(p_channel))
      and (p_status is null or a.status = lower(p_status))
      and (p_media_type is null or a.media_type = lower(p_media_type))
    order by a.created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 200))
    offset greatest(0, coalesce(p_offset, 0))
  ) t;
$fn$;

comment on function public.social_channel_assets_list(text, text, text, int, int) is
  'Media for a channel. Defaults to status = available, which is the queue a publishing routine draws from.';

/** Called right after Buffer accepts the post, so the asset is not reused. */
create or replace function public.social_channel_assets_mark_used(
  p_id             uuid,
  p_buffer_post_id text default null,
  p_agent          text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  a public.social_channel_assets;
begin
  update public.social_channel_assets
  set status = 'used',
      used_at = now(),
      buffer_post_id = coalesce(p_buffer_post_id, buffer_post_id),
      updated_by = coalesce(p_agent, updated_by)
  where id = p_id
  returning * into a;

  if a.id is null then
    raise exception 'social_channel_assets_mark_used: asset % not found', p_id;
  end if;

  return to_jsonb(a);
end;
$fn$;

/** Put one back in the queue, or take it out of circulation. */
create or replace function public.social_channel_assets_set_status(
  p_id     uuid,
  p_status text,
  p_agent  text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  a public.social_channel_assets;
begin
  if lower(p_status) not in ('available', 'used', 'archived') then
    raise exception 'social_channel_assets_set_status: % is not a valid status', p_status;
  end if;

  update public.social_channel_assets
  set status = lower(p_status),
      -- Returning an asset to the queue clears the mark that took it out.
      used_at = case when lower(p_status) = 'available' then null else used_at end,
      updated_by = coalesce(p_agent, updated_by)
  where id = p_id
  returning * into a;

  if a.id is null then
    raise exception 'social_channel_assets_set_status: asset % not found', p_id;
  end if;

  return to_jsonb(a);
end;
$fn$;

-- Grants. This project's default privileges hand EXECUTE on new public
-- functions to anon and authenticated, so revoking PUBLIC alone leaves them
-- (lesson from 20260825085435).
revoke execute on function public.social_channel_assets_add(jsonb, text)
  from public, anon, authenticated;
revoke execute on function public.social_channel_assets_list(text, text, text, int, int)
  from public, anon, authenticated;
revoke execute on function public.social_channel_assets_mark_used(uuid, text, text)
  from public, anon, authenticated;
revoke execute on function public.social_channel_assets_set_status(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.social_channel_assets_add(jsonb, text) to service_role;
grant execute on function public.social_channel_assets_list(text, text, text, int, int) to service_role;
grant execute on function public.social_channel_assets_mark_used(uuid, text, text) to service_role;
grant execute on function public.social_channel_assets_set_status(uuid, text, text) to service_role;

-- ── 4. The integration token, in Vault ──────────────────────────────────────
--
-- ChatGPT authenticates to `POST /social-library/assets` with a shared secret
-- in `x-nw-social-assets-token`. It lives in Vault rather than an Edge
-- Function env var for the reason cron-auth.ts records: Edge secrets cannot be
-- read or set from the Management API or MCP, so a mismatch is invisible from
-- SQL and uncorrectable from here. Rotation is one `vault.update_secret` with
-- no redeploy.
--
-- An ORACLE, not a getter: a getter would hand the secret to its caller and
-- into PostgREST responses and logs. Brute-forcing 32 random bytes through a
-- boolean is not a practical attack.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'navigatewealth_social_assets_token') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'navigatewealth_social_assets_token',
      'Shared secret an outside agent (ChatGPT) sends as x-nw-social-assets-token to /social-library on make-server-91ed8379. Verified by public.verify_social_assets_token; rotate with vault.update_secret (no redeploy).'
    );
  end if;
end
$$;

create or replace function public.verify_social_assets_token(candidate text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from vault.decrypted_secrets s
    where s.name = 'navigatewealth_social_assets_token'
      and candidate is not null
      and length(candidate) > 0
      -- Compare digests, not the strings: bytea equality on two fixed-length
      -- hashes leaks nothing useful about the secret's prefix.
      and extensions.digest(s.decrypted_secret, 'sha256') = extensions.digest(candidate, 'sha256')
  );
$$;

comment on function public.verify_social_assets_token(text) is
  'Boolean oracle for the social library integration token held in Vault (navigatewealth_social_assets_token). service_role only.';

revoke execute on function public.verify_social_assets_token(text) from public, anon, authenticated;
grant execute on function public.verify_social_assets_token(text) to service_role;
