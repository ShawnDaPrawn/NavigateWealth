-- Connector-safe intake bridge for ChatGPT-generated social images.
-- Scheduled ChatGPT runs can base64-encode their final locally composed image
-- and hand it to Supabase through pg_net without arbitrary outbound multipart HTTP.

create or replace function public.social_asset_intake_post(p_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_token text;
  v_request_id bigint;
begin
  select s.decrypted_secret
    into v_token
  from vault.decrypted_secrets s
  where s.name = 'navigatewealth_social_assets_token'
  limit 1;

  if v_token is null or length(v_token) = 0 then
    raise exception 'navigatewealth_social_assets_token is missing from Vault';
  end if;

  select net.http_post(
    url := 'https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/social-asset-intake',
    body := p_payload,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-nw-social-assets-token', v_token
    ),
    timeout_milliseconds := 30000
  )
  into v_request_id;

  return v_request_id;
end;
$fn$;

comment on function public.social_asset_intake_post(jsonb) is
  'Connector-safe bridge for ChatGPT-generated social images. Posts JSON/base64 to social-asset-intake using the Vault token and returns the pg_net request id.';

revoke execute on function public.social_asset_intake_post(jsonb)
  from public, anon, authenticated;
grant execute on function public.social_asset_intake_post(jsonb)
  to service_role;

create or replace function public.social_asset_intake_response(p_request_id bigint)
returns jsonb
language sql
security definer
set search_path = ''
as $fn$
  select case
    when r.id is null then null
    else jsonb_build_object(
      'id', r.id,
      'status_code', r.status_code,
      'content_type', r.content_type,
      'content', r.content,
      'timed_out', r.timed_out,
      'error_msg', r.error_msg,
      'created', r.created
    )
  end
  from net._http_response r
  where r.id = p_request_id
$fn$;

comment on function public.social_asset_intake_response(bigint) is
  'Reads the pg_net response for a social_asset_intake_post request. Null means the async response has not landed yet or has expired.';

revoke execute on function public.social_asset_intake_response(bigint)
  from public, anon, authenticated;
grant execute on function public.social_asset_intake_response(bigint)
  to service_role;
