-- ============================================================================
-- Client totals refresh, part 2 — one worker per client, and totals that
-- land only while they still match the policies
-- ============================================================================
--
-- WHY THIS EXISTS
-- `20261001105937_client_totals_refresh` let the Edge worker list the stale
-- clients and report each one done. Review of that worker found two ways it
-- could leave a profile wrong while this table called the client current:
--
--   1. A failed recalculation was reported done anyway.
--      `recalculateClientTotals` logs its errors instead of raising them, so
--      the worker could not tell a failed KV read or write from success.
--   2. Overlapping runs (a trigger wake-up, the sweep, an admin) could take
--      the same client. A run that read the policies before a newer write
--      could store its older totals over the newer ones, after the newer run
--      had already reported the client current.
--
-- So the worker now takes one client at a time under a claim, and its totals
-- reach the profile through the database:
--
--   - `client_totals_refresh_claim()` takes the oldest stale client that no
--     live claim holds and that is not backing off (FOR UPDATE SKIP LOCKED),
--     for 2 minutes under a new token. It returns the client's policies as
--     they are now, with their md5.
--   - The worker totals exactly those policies. If it cannot, it calls
--     `client_totals_refresh_fail()`, which records the error and backs the
--     client off for 1, 5, 15, then 60 minutes. The client stays stale.
--   - `client_totals_refresh_write()` stores the totals in
--     `user_profile:{clientId}:client_keys` and records the client current,
--     in one transaction, and only while the worker still holds the claim
--     and the policies still have the md5 it totalled. The policies row is
--     locked FOR SHARE for that check, so no write to it can land in
--     between. If the policies moved on, nothing is stored and the client is
--     taken again with the new ones.
--
-- A new direct write clears any back-off, so new policies get a prompt try.
-- A client that is failing no longer stops the trigger from waking the
-- worker for everyone else.
--
-- `client_totals_refresh_due` and `_done` are retired. Execute is revoked
-- from service_role, so nothing can record a client current without storing
-- its totals. They stay defined, which keeps this migration free of
-- destructive statements; a later cleanup can remove them.
--
-- LOCK ORDER
-- A direct write locks its policies row, then its trigger upserts the
-- client's refresh row. `client_totals_refresh_write` locks in the same
-- order, so the two cannot deadlock. The claim locks only the refresh row
-- and reads the policies without a lock.
--
-- CONVENTIONS as in 20261001105937. Safe to re-run: `add column if not
-- exists`, `create or replace`, and revoke/grant are idempotent.
-- ============================================================================

-- ── 1. The claim and the failure record ──────────────────────────────────────

alter table public.client_totals_refresh
  add column if not exists claim_token  uuid,
  add column if not exists claimed_at   timestamptz,
  add column if not exists claimed_seq  bigint,
  add column if not exists failures     integer not null default 0,
  add column if not exists retry_after  timestamptz,
  add column if not exists last_error   text;

comment on column public.client_totals_refresh.claim_token is
  'The worker holding this client, if any. A claim lapses 2 minutes after claimed_at.';
comment on column public.client_totals_refresh.claimed_seq is
  'The dirty_seq the claim read. A successful write records the client current up to it.';
comment on column public.client_totals_refresh.failures is
  'Failed recalculations since the last success or the last direct write.';
comment on column public.client_totals_refresh.retry_after is
  'After a failure, the client is not taken again before this.';
comment on column public.client_totals_refresh.last_error is
  'Why the last recalculation failed. Cleared by the next success.';

-- ── 2. Waking the worker, only for a client it could take ─────────────────────

create or replace function public.client_totals_refresh_kick()
returns bigint
language plpgsql security definer set search_path = '' as $fn$
declare
  v_token text;
begin
  -- Exactly what client_totals_refresh_claim() would take: stale, not held
  -- by a live claim, not backing off.
  if not exists (
    select 1
      from public.client_totals_refresh r
     where r.refreshed_seq < r.dirty_seq
       and (r.claim_token is null or r.claimed_at < now() - interval '2 minutes')
       and (r.retry_after is null or r.retry_after <= now())
  ) then
    return null;
  end if;

  select s.decrypted_secret
    into v_token
    from vault.decrypted_secrets s
   where s.name = 'navigatewealth_cron_auth_token'
   limit 1;
  if coalesce(v_token, '') = '' then
    raise warning 'client_totals_refresh_kick: Vault secret navigatewealth_cron_auth_token is missing';
    return null;
  end if;

  return net.http_post(
    url := 'https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/client-totals-refresh/process',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-nw-cron-auth', v_token),
    timeout_milliseconds := 30000
  );
end;
$fn$;

revoke execute on function public.client_totals_refresh_kick() from public, anon, authenticated;
grant execute on function public.client_totals_refresh_kick() to service_role;

-- ── 3. The trigger: a new write clears any back-off ───────────────────────────

create or replace function public.kv_policies_mark_totals_stale()
returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare
  v_client  text;
  v_pending boolean;
begin
  -- The app's own writes come through PostgREST and recalculate themselves.
  if coalesce(current_setting('request.jwt.claims', true), '') <> '' then
    return null;
  end if;

  begin
    v_client := substring(new.key from char_length('policies:client:') + 1);
    if v_client !~ '^[A-Za-z0-9_-]{1,128}$' then
      return null;
    end if;

    -- A wake-up is already on its way while some client is stale and not
    -- failing: a worker is running or was woken, or the sweep will send one.
    -- A failing client waits out its back-off, so it does not count.
    select exists (
      select 1
        from public.client_totals_refresh r
       where r.refreshed_seq < r.dirty_seq
         and r.failures = 0
    ) into v_pending;

    insert into public.client_totals_refresh as r (client_id, dirty_seq, dirty_at)
    values (v_client, 1, clock_timestamp())
    on conflict (client_id) do update
      set dirty_seq = r.dirty_seq + 1,
          dirty_at = clock_timestamp(),
          failures = 0,
          retry_after = null;

    if not v_pending then
      perform public.client_totals_refresh_kick();
    end if;
  exception when others then
    raise warning 'kv_policies_mark_totals_stale: could not mark % stale (%); the totals stay as they were until the next write or a manual recalculation',
      coalesce(v_client, new.key), sqlerrm;
  end;
  return null;
end;
$fn$;

revoke execute on function public.kv_policies_mark_totals_stale() from public, anon, authenticated;

-- ── 4. What the worker calls ──────────────────────────────────────────────────

-- Take the oldest stale client that is free, for 2 minutes. No row when there
-- is none. The policies are read after the counter, so they include every
-- write the counter counts.
create or replace function public.client_totals_refresh_claim()
returns table (client_id text, dirty_seq bigint, claim_token uuid, policies jsonb, policies_md5 text)
language plpgsql security definer set search_path = '' as $fn$
#variable_conflict use_column
declare
  v_client text;
  v_seq    bigint;
  v_token  uuid := gen_random_uuid();
  v_value  jsonb;
begin
  select r.client_id, r.dirty_seq
    into v_client, v_seq
    from public.client_totals_refresh r
   where r.refreshed_seq < r.dirty_seq
     and (r.claim_token is null or r.claimed_at < now() - interval '2 minutes')
     and (r.retry_after is null or r.retry_after <= now())
   order by r.dirty_at
   limit 1
     for update skip locked;
  if v_client is null then
    return;
  end if;

  update public.client_totals_refresh r
     set claim_token = v_token,
         claimed_at = now(),
         claimed_seq = v_seq
   where r.client_id = v_client;

  select k.value
    into v_value
    from public.kv_store_91ed8379 k
   where k.key = 'policies:client:' || v_client;

  client_id := v_client;
  dirty_seq := v_seq;
  claim_token := v_token;
  policies := v_value;
  policies_md5 := md5(v_value::text);
  return next;
end;
$fn$;

comment on function public.client_totals_refresh_claim() is
  'Worker: take the oldest free stale client for 2 minutes, with its policies and their md5. See docs/runbooks/client-totals-refresh.md.';

revoke execute on function public.client_totals_refresh_claim() from public, anon, authenticated;
grant execute on function public.client_totals_refresh_claim() to service_role;

-- Store the totals and record the client current, if the claim is still this
-- worker's and the policies are still the ones it totalled. Returns
--   'refreshed'   stored; the client is current
--   'stale'       stored; a newer write is waiting, so the client stays stale
--   'superseded'  not stored; the policies changed after the claim read them
--   'lost'        not stored; the claim lapsed and another worker took over
create or replace function public.client_totals_refresh_write(
  p_client_id    text,
  p_claim_token  uuid,
  p_policies_md5 text,
  p_totals       jsonb
)
returns text
language plpgsql security definer set search_path = '' as $fn$
declare
  v_md5        text;
  v_token      uuid;
  v_up_to_date boolean;
begin
  if jsonb_typeof(p_totals) is distinct from 'object' then
    raise exception 'client_totals_refresh_write: p_totals must be a JSON object'
      using errcode = '22023';
  end if;

  -- The policies row first, the order a direct write takes (see the header).
  -- FOR SHARE holds off any write to the policies until this transaction
  -- ends, so the totals stored match the policies it leaves behind.
  select md5(k.value::text)
    into v_md5
    from public.kv_store_91ed8379 k
   where k.key = 'policies:client:' || p_client_id
     for share;

  select r.claim_token
    into v_token
    from public.client_totals_refresh r
   where r.client_id = p_client_id
     for update;

  if p_claim_token is null or v_token is distinct from p_claim_token then
    return 'lost';
  end if;

  if v_md5 is distinct from p_policies_md5 then
    update public.client_totals_refresh r
       set claim_token = null,
           claimed_at = null,
           claimed_seq = null
     where r.client_id = p_client_id;
    return 'superseded';
  end if;

  insert into public.kv_store_91ed8379 (key, value)
  values ('user_profile:' || p_client_id || ':client_keys', p_totals)
  on conflict (key) do update set value = excluded.value;

  update public.client_totals_refresh r
     set refreshed_seq = greatest(r.refreshed_seq, r.claimed_seq),
         refreshed_at = now(),
         claim_token = null,
         claimed_at = null,
         claimed_seq = null,
         failures = 0,
         retry_after = null,
         last_error = null
   where r.client_id = p_client_id
  returning r.refreshed_seq >= r.dirty_seq into v_up_to_date;

  return case when v_up_to_date then 'refreshed' else 'stale' end;
end;
$fn$;

comment on function public.client_totals_refresh_write(text, uuid, text, jsonb) is
  'Worker: store a claimed client''s totals and record it current, only under its claim and only while the policies are unchanged.';

revoke execute on function public.client_totals_refresh_write(text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.client_totals_refresh_write(text, uuid, text, jsonb) to service_role;

-- Record a failed recalculation under the worker's claim, release the claim
-- and back the client off for 1, 5, 15, then 60 minutes. False when the claim
-- was no longer this worker's, and nothing was recorded.
create or replace function public.client_totals_refresh_fail(
  p_client_id   text,
  p_claim_token uuid,
  p_error       text
)
returns boolean
language plpgsql security definer set search_path = '' as $fn$
declare
  v_failures integer;
begin
  update public.client_totals_refresh r
     set failures = r.failures + 1,
         last_error = left(coalesce(nullif(p_error, ''), 'unknown error'), 1000),
         retry_after = now() + case r.failures
                                 when 0 then interval '1 minute'
                                 when 1 then interval '5 minutes'
                                 when 2 then interval '15 minutes'
                                 else interval '60 minutes'
                               end,
         claim_token = null,
         claimed_at = null,
         claimed_seq = null
   where r.client_id = p_client_id
     and r.claim_token = p_claim_token
  returning r.failures into v_failures;
  return v_failures is not null;
end;
$fn$;

comment on function public.client_totals_refresh_fail(text, uuid, text) is
  'Worker: record a failed recalculation under its claim and back the client off.';

revoke execute on function public.client_totals_refresh_fail(text, uuid, text) from public, anon, authenticated;
grant execute on function public.client_totals_refresh_fail(text, uuid, text) to service_role;

-- ── 5. Retire the list-and-report pair ────────────────────────────────────────

revoke execute on function public.client_totals_refresh_due(integer) from service_role;
revoke execute on function public.client_totals_refresh_done(text, bigint) from service_role;

comment on function public.client_totals_refresh_due(integer) is
  'Retired by client_totals_refresh_claims; the worker calls client_totals_refresh_claim(). Executable by its owner only.';
comment on function public.client_totals_refresh_done(text, bigint) is
  'Retired by client_totals_refresh_claims; the worker calls client_totals_refresh_write(). Executable by its owner only.';
