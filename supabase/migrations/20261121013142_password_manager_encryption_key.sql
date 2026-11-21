-- Provision the key inside Supabase Vault. It never appears in the migration or client config.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'navigatewealth_password_manager_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'navigatewealth_password_manager_key',
      'AES-256-GCM key for encrypted password manager records. Retain with backups.'
    );
  end if;
end
$$;

-- The edge service role already has access to the underlying Vault view.
-- Keep its projection narrow and retain the caller's permissions.
create function public.password_manager_encryption_key()
returns text
language sql stable security invoker
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'navigatewealth_password_manager_key'
$$;

revoke all on function public.password_manager_encryption_key() from public, anon, authenticated;
grant execute on function public.password_manager_encryption_key() to service_role;
