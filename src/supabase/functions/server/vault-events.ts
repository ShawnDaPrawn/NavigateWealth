/** Activity for the password manager: who did what to which login, and why. Never secrets. */
import type { VaultEvent, EventPage } from '../../../shared/password-manager.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import { events } from './repositories/vault-store.ts';

/** Newest first: keys sort ascending, so the time part counts down. */
function eventKey(at: number) {
  return String(9_999_999_999_999 - at).padStart(13, '0') + '-' + crypto.randomUUID().slice(0, 8);
}

export async function recordEvent(input: Omit<VaultEvent, 'id' | 'at'>) {
  const at = Date.now();
  const event: VaultEvent = { ...input, id: eventKey(at), at: new Date(at).toISOString() };
  await events.put(event.id, event);
  await AdminAuditService.record({
    category: 'security',
    actorId: input.actorKind === 'person' ? input.actorId : input.actorKind + ':' + input.actorId,
    actorRole: input.actorKind === 'person' ? 'super_admin' : 'service',
    action: 'password_vault_' + input.action.toLowerCase().replace(/[^a-z]+/g, '_'),
    summary: 'Password vault: ' + input.action,
    entityType: 'vault_entry',
    entityId: input.credentialId ?? undefined,
    metadata: { outcome: input.outcome },
  });
  return event;
}

export async function listEvents(after?: string, actorKind?: string): Promise<EventPage> {
  const items: VaultEvent[] = [];
  let cursor = after ? events.key(after) : undefined;
  // A filter can thin a page out; read on until it is full or the log ends.
  for (let i = 0; i < 5 && items.length < 50; i++) {
    const page = await events.list({ limit: 100, startAfter: cursor });
    for (const e of page.items) if (!actorKind || e.actorKind === actorKind) items.push(e);
    cursor = page.nextCursor ?? undefined;
    if (!cursor) break;
  }
  const trimmed = items.slice(0, 50);
  return {
    items: trimmed,
    nextCursor: trimmed.length === 50 || cursor ? (trimmed.at(-1)?.id ?? null) : null,
  };
}
