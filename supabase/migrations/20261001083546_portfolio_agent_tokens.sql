-- ============================================================================
-- Portfolio table: one token per agent
-- ============================================================================
--
-- WHY THIS EXISTS
-- `/integrations/portfolio-table` on make-server-91ed8379 admitted every
-- outside agent on ONE shared Vault secret (20260930114009), and the actor
-- recorded on each write was whatever name the agent put in its request body.
-- A token per agent makes the recorded actor authenticated (`agent:<name>` is
-- read from the token, never from the body) and lets one agent be revoked
-- without rotating every other agent's credential (ROADMAP §9a, item 2).
--
-- WHY HASHES IN A TABLE, NOT A VAULT SECRET PER AGENT
-- Only the SHA-256 of each token is stored. A token is 32 random bytes, so
-- its hash is useless to whoever reads it; the plaintext exists only in the
-- response that issued it and in the agent's own configuration. Identifying
-- the caller is one indexed equality, not a decryption of every agent's
-- secret on every request. The row also carries what an operator needs:
-- who issued the token and when, when it was last used, when it was revoked.
--
-- NAMES
-- An agent's name is the actor on its writes (`agent:grok`). At most one
-- ACTIVE token per name (partial unique index). A revoked row stays as the
-- record of the old token, so revoking `grok` and issuing a new `grok` token
-- is a rotation that keeps the same actor.
--
-- THE SHARED TOKEN
-- If the Vault secret from 20260930114009 exists, its hash is carried over as
-- the agent `shared`, so a bot already configured with it keeps working and
-- is now recorded as `agent:shared`. Revoke `shared` once every bot has its
-- own token. The Vault secret and `public.verify_portfolio_table_token` are
-- left in place because the Edge Function live before this change still calls
-- them; a later migration drops both.
--
-- ACCESS
-- Service role only. RLS is on with no policy, and every privilege is revoked
-- from anon and authenticated, because this project's default privileges
-- grant them on new public tables (20260825085435 lesson).
-- ============================================================================

create table if not exists public.portfolio_agent_tokens (
  id           uuid primary key default gen_random_uuid(),
  agent_name   text not null
               check (agent_name ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  token_hash   text not null
               check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at   timestamptz not null default now(),
  created_by   text,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  revoked_by   text
);

comment on table public.portfolio_agent_tokens is
  'One row per token an outside agent sends as x-nw-portfolio-token to /integrations/portfolio-table on make-server-91ed8379. Only the SHA-256 of the token is stored. agent_name is the actor recorded on the agent''s writes. service_role only.';
comment on column public.portfolio_agent_tokens.token_hash is
  'Lowercase hex SHA-256 of the token as the agent sends it. The plaintext is shown once, when the token is issued, and never stored.';
comment on column public.portfolio_agent_tokens.revoked_at is
  'Set when the token is revoked. A revoked row is kept as the record of the old token; the name can then be issued a new one.';

-- The lookup the gate makes on every agent request.
create unique index if not exists portfolio_agent_tokens_token_hash
  on public.portfolio_agent_tokens (token_hash);

-- At most one live token per agent name.
create unique index if not exists portfolio_agent_tokens_active_name
  on public.portfolio_agent_tokens (agent_name)
  where revoked_at is null;

alter table public.portfolio_agent_tokens enable row level security;

revoke all on table public.portfolio_agent_tokens from public;
revoke all on table public.portfolio_agent_tokens from anon, authenticated;
grant select, insert, update on table public.portfolio_agent_tokens to service_role;

-- Carry the shared Vault token over as the agent `shared`.
insert into public.portfolio_agent_tokens (agent_name, token_hash, created_at, created_by)
select
  'shared',
  encode(extensions.digest(s.decrypted_secret, 'sha256'), 'hex'),
  s.created_at,
  'migration: carried over from Vault secret navigatewealth_portfolio_table_token'
from vault.decrypted_secrets s
where s.name = 'navigatewealth_portfolio_table_token'
  and s.decrypted_secret is not null
  and length(s.decrypted_secret) > 0
  and not exists (
    select 1 from public.portfolio_agent_tokens t where t.agent_name = 'shared'
  );
