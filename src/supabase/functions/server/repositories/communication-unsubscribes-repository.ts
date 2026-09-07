/**
 * Communication unsubscribe repository.
 *
 * KV key: `communication:unsubscribed:{email}`
 */
import { createKvRepository } from './kv-repository.ts';

export interface UnsubscribedContact {
  email: string;
  clientId?: string | null;
  name?: string;
  unsubscribedAt: string;
  unsubscribedBy: 'admin';
}

export const UNSUBSCRIBE_NAMESPACE = 'communication:unsubscribed:';

export const communicationUnsubscribes =
  createKvRepository<UnsubscribedContact>(UNSUBSCRIBE_NAMESPACE);
