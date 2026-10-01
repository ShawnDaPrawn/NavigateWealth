-- ============================================================================
-- Client totals refresh — a policy written straight into the database still
-- updates the client's profile
-- ============================================================================
--
-- WHY THIS EXISTS
-- A client's profile shows totals derived from their policies (retirement
-- fund value, life cover, premiums …), stored at
-- `user_profile:{clientId}:client_keys`. Only `recalculateClientTotals` in the
-- Edge Function writes them, and every app path that writes
-- `policies:client:{clientId}` calls it: the policy editor, extraction, and
-- `publishSyncRun` (the Portfolio tab, the external-agent endpoint, the portal
-- worker). A write made straight into the database calls nothing. That is how
-- the update bot works through the Supabase connector, and on 2026-10-01 it
-- left a client's policy at a current value of 569,366.18 while the profile
-- still said 551,894.41.
--
-- The owner's rule (ROADMAP §9a item 5): an external agent's update applies
-- automatically, with no further action or approval. So a direct write now
-- marks that client's totals stale, and a worker recalculates them:
--
--   1. A trigger on `kv_store_91ed8379`, for `policies:client:*` rows only,
--      notes the client in `client_totals_refresh` and wakes the worker,
--      `POST /client-totals-refresh/process`, through pg_net with the shared
--      cron token from Vault.
--   2. The worker runs the same `recalculateClientTotals` the app runs and
--      records which write it caught up with: each direct write bumps a
--      per-client counter, and the worker reports the counter it read. A
--      write that lands while it works leaves the client stale, so the next
--      pass picks it up; nothing is lost. (A counter rather than a timestamp:
--      `now()` is the transaction's start, so a write in a transaction that
--      began earlier could look older than the last refresh and be missed.)
--   3. A pg_cron job repeats the wake-up every 2 minutes, but it only calls
--      out when a client is stale, so normally it costs one index probe.
--
-- WHICH WRITES COUNT AS DIRECT
-- Writes from the app arrive through PostgREST, which sets
-- `request.jwt.claims` for the transaction. The app has already recalculated
-- after those, so the trigger leaves them alone. A write with no claims came
-- from the connector, the SQL editor or a migration, and only those are
-- marked. If that test ever misreads an app write, the cost is one redundant
-- recalculation, never a wrong total.
--
-- The trigger never blocks the write it fires on: any error inside it is
-- caught and reported as a warning.
--
-- CONVENTIONS (supabase/migrations/README.md)
--   - named `create index if not exists`, never an unnamed CREATE INDEX;
--   - RLS on, no policies, explicit revoke from anon/authenticated;
--   - SECURITY DEFINER functions pin search_path and are revoked from PUBLIC
--     explicitly (revoking only named roles is a no-op) before the grant.
--
-- Safe to re-run: `if not exists`, `create or replace`, cron.schedule
-- replaces a job of the same name, and the backfill only marks clients stale.
-- ============================================================================

-- ── 1. Which clients' totals are stale ───────────────────────────────────────

create table if not exists public.client_totals_refresh (
  client_id      text primary key check (client_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  -- Bumped by every direct write to this client's policies.
  dirty_seq      bigint not null default 1,
  -- The dirty_seq the last recalculation caught up with. Stale while lower.
  refreshed_seq  bigint not null default 0,
  -- When the last direct write landed, and when the last recalculation did.
  dirty_at       timestamptz not null default now(),
  refreshed_at   timestamptz
);

comment on table public.client_totals_refresh is
  'One row per client whose policies were written straight into the database. Stale while refreshed_seq < dirty_seq; the Edge worker recalculates user_profile:{clientId}:client_keys. See docs/runbooks/client-totals-refresh.md.';

create index if not exists client_totals_refresh_stale_idx
  on public.client_totals_refresh (dirty_at)
  where refreshed_seq < dirty_seq;

alter table public.client_totals_refresh enable row level security;
revoke all on table public.client_totals_refresh from public, anon, authenticated;

-- ── 2. Waking the worker ──────────────────────────────────────────────────────

-- Calls the Edge worker when, and only when, a client is stale. Returns the
-- pg_net request id, or null when nothing is stale or the token is missing.
-- The URL is this project's; a copy of the schema elsewhere would need its own.
create or replace function public.client_totals_refresh_kick()
returns bigint
language plpgsql security definer set search_path = '' as $fn$
declare
  v_token text;
begin
  if not exists (
    select 1
      from public.client_totals_refresh r
     where r.refreshed_seq < r.dirty_seq
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

comment on function public.client_totals_refresh_kick() is
  'Wake the client totals worker if a client is stale. Called by the policies trigger and the every-2-minute pg_cron job.';

revoke execute on function public.client_totals_refresh_kick() from public, anon, authenticated;
grant execute on function public.client_totals_refresh_kick() to service_role;

-- ── 3. The trigger on direct policy writes ────────────────────────────────────

create or replace function public.kv_policies_mark_totals_stale()
returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare
  v_client    text;
  v_any_stale boolean;
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

    select exists (
      select 1
        from public.client_totals_refresh r
       where r.refreshed_seq < r.dirty_seq
    ) into v_any_stale;

    insert into public.client_totals_refresh as r (client_id, dirty_seq, dirty_at)
    values (v_client, 1, clock_timestamp())
    on conflict (client_id) do update
      set dirty_seq = r.dirty_seq + 1, dirty_at = clock_timestamp();

    -- One wake-up per burst: while anything is stale, one is already on its
    -- way (the worker runs until nothing is stale) or the sweep will send it.
    if not v_any_stale then
      perform public.client_totals_refresh_kick();
    end if;
  exception when others then
    raise warning 'kv_policies_mark_totals_stale: could not mark % stale (%); the totals stay as they were until the next write or a manual recalculation',
      coalesce(v_client, new.key), sqlerrm;
  end;
  return null;
end;
$fn$;

comment on function public.kv_policies_mark_totals_stale() is
  'Trigger: a policies:client:* row written outside the app API marks that client''s totals stale and wakes the worker.';

revoke execute on function public.kv_policies_mark_totals_stale() from public, anon, authenticated;

create or replace trigger kv_policies_mark_totals_stale
  after insert or update of value on public.kv_store_91ed8379
  for each row
  when (new.key like 'policies:client:%')
  execute function public.kv_policies_mark_totals_stale();

-- ── 4. What the worker calls ──────────────────────────────────────────────────

-- The stale clients, oldest change first, with the dirty_seq to report back.
create or replace function public.client_totals_refresh_due(p_limit integer default 25)
returns table (client_id text, dirty_seq bigint)
language sql security definer set search_path = public stable as $fn$
  select r.client_id, r.dirty_seq
    from public.client_totals_refresh r
   where r.refreshed_seq < r.dirty_seq
   order by r.dirty_at
   limit greatest(1, least(coalesce(p_limit, 25), 100));
$fn$;

revoke execute on function public.client_totals_refresh_due(integer) from public, anon, authenticated;
grant execute on function public.client_totals_refresh_due(integer) to service_role;

-- Record a recalculation started after reading dirty_seq p_seq. Returns true
-- when the client is now up to date, false when a newer write arrived in the
-- meantime (it stays stale for the next pass).
create or replace function public.client_totals_refresh_done(p_client_id text, p_seq bigint)
returns boolean
language plpgsql security definer set search_path = public as $fn$
declare
  v_up_to_date boolean;
begin
  update public.client_totals_refresh r
     set refreshed_seq = greatest(r.refreshed_seq, p_seq),
         refreshed_at = now()
   where r.client_id = p_client_id
  returning r.refreshed_seq >= r.dirty_seq into v_up_to_date;
  return coalesce(v_up_to_date, false);
end;
$fn$;

revoke execute on function public.client_totals_refresh_done(text, bigint) from public, anon, authenticated;
grant execute on function public.client_totals_refresh_done(text, bigint) to service_role;

-- ── 5. The safety sweep ───────────────────────────────────────────────────────

-- Missed wake-ups. Calls out only when a client is stale.
select cron.schedule(
  'client-totals-refresh-sweep',
  '*/2 * * * *',
  $$select public.client_totals_refresh_kick()$$
);

-- ── 6. Catch up what was written before this existed ──────────────────────────

-- Every client with policies gets one recalculation, which corrects totals
-- that direct writes left behind. Recalculating up-to-date totals changes
-- nothing: the totals are derived from the policies alone.
insert into public.client_totals_refresh as r (client_id, dirty_seq, dirty_at)
select substring(k.key from char_length('policies:client:') + 1), 1, now()
  from public.kv_store_91ed8379 k
 where k.key like 'policies:client:%'
   and substring(k.key from char_length('policies:client:') + 1) ~ '^[A-Za-z0-9_-]{1,128}$'
on conflict (client_id) do update
  set dirty_seq = r.dirty_seq + 1, dirty_at = now();

select public.client_totals_refresh_kick();
