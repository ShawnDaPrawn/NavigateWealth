-- ============================================================================
-- email_delivery_log.client_id — which client an email was for
-- ============================================================================
--
-- A linked client (a child or spouse on a parent's mailbox, see
-- client-email-identity.ts) is mailed at the SHARED contact address, so the
-- recipient alone cannot say whose email it was: their birthday greeting
-- would land in the mailbox owner's history and be missing from their own.
-- Senders that know the client now record it here, and a client's history
-- reads rows attributed to them plus unattributed rows sent to their own
-- sign-in address. Nullable: most kinds (staff alerts, website replies,
-- newsletters to subscribers) are not about one client.
-- ============================================================================

alter table public.email_delivery_log add column client_id uuid;

create index email_delivery_log_client_id_idx
  on public.email_delivery_log (client_id, created_at desc)
  where client_id is not null;
