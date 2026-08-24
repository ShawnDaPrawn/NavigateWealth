-- ============================================================================
-- APPLIED IN PRODUCTION as version 20260821210412 (name: atomic_auth_rate_limit)
--
-- RECONSTRUCTED? NO. Body copied verbatim from
-- `supabase_migrations.schema_migrations.statements` on 2026-08-24.
--
-- STAMP CORRECTION: previously carried here as
-- `20260821000001_atomic_auth_rate_limit.sql`. Production recorded
-- 20260821210412. The mis-stamped file has been deleted and replaced by this
-- one so filename == applied version.
--
-- This one is the good example in the folder: named, idempotent, EXECUTE
-- revoked from public/anon/authenticated and granted only to service_role, and
-- `set search_path = public` on a SECURITY DEFINER function. The five older
-- functions in the baseline migration do none of that — see README.md.
-- ============================================================================

-- Atomic authentication rate-limit decision.
-- The service-role Edge function is the only caller; advisory locking covers
-- both first-write and update races for a given action/identifier pair.
create or replace function public.check_auth_rate_limit_91ed8379(
  p_identifier text,
  p_action text,
  p_max_attempts integer,
  p_window_ms bigint,
  p_block_duration_ms bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := 'ratelimit:' || p_action || ':' || p_identifier;
  v_block_key text := 'ratelimit:block:' || p_action || ':' || p_identifier;
  v_now bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  v_attempt jsonb;
  v_block jsonb;
  v_attempts integer;
  v_first_attempt bigint;
  v_blocked_until bigint;
begin
  if p_max_attempts < 1 or p_window_ms < 1 or p_block_duration_ms < 1 then
    raise exception 'Invalid rate-limit configuration';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select value into v_block
  from public.kv_store_91ed8379
  where key = v_block_key;

  v_blocked_until := coalesce((v_block->>'blockedUntil')::bigint, 0);
  if v_blocked_until > v_now then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'resetAt', v_blocked_until,
      'blocked', true
    );
  end if;

  select value into v_attempt
  from public.kv_store_91ed8379
  where key = v_key;

  v_first_attempt := coalesce((v_attempt->>'firstAttempt')::bigint, v_now);
  if v_attempt is null or v_now - v_first_attempt > p_window_ms then
    v_attempts := 1;
    v_first_attempt := v_now;
  else
    v_attempts := coalesce((v_attempt->>'attempts')::integer, 0) + 1;
  end if;

  insert into public.kv_store_91ed8379(key, value)
  values (
    v_key,
    jsonb_build_object(
      'attempts', v_attempts,
      'firstAttempt', v_first_attempt,
      'lastAttempt', v_now
    )
  )
  on conflict (key) do update set value = excluded.value;

  if v_attempts > p_max_attempts then
    v_blocked_until := v_now + p_block_duration_ms;
    insert into public.kv_store_91ed8379(key, value)
    values (
      v_block_key,
      jsonb_build_object(
        'blockedAt', v_now,
        'blockedUntil', v_blocked_until,
        'attempts', v_attempts
      )
    )
    on conflict (key) do update set value = excluded.value;

    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'resetAt', v_blocked_until,
      'blocked', true
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(0, p_max_attempts - v_attempts),
    'resetAt', v_first_attempt + p_window_ms,
    'blocked', false
  );
end;
$$;

revoke all on function public.check_auth_rate_limit_91ed8379(text, text, integer, bigint, bigint)
from public, anon, authenticated;
grant execute on function public.check_auth_rate_limit_91ed8379(text, text, integer, bigint, bigint)
to service_role;
