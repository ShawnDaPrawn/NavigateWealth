/**
 * Newsletter Studio — audiences.
 *
 * Audiences are the existing communication groups — the studio deliberately
 * introduces no parallel list system. POPIA invariant: anyone whose
 * `newsletter:{email}` record says `active: false` is excluded from every
 * campaign audience, whatever group membership says.
 *
 * Split out of newsletter-studio-service.ts (§20.1); the logic is unchanged.
 */

import { ValidationError } from './error.middleware.ts';
import { getGroupById, getGroups } from './communication-repo.ts';
import { getAllClients } from './communication-messaging.ts';
import { listSubscribers } from './newsletter-service.ts';
import type { NewsletterAudienceItem, NewsletterListView } from './newsletter-studio-types.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The studio's always-present audience: every confirmed newsletter subscriber
 * who has not opted out. It shares its id with the "Newsletter Contacts"
 * communication group so existing campaigns keep resolving, but it is backed
 * by the `newsletter:{email}` consent records directly — the group is only
 * lazily created/backfilled by the subscription flow, and a store with
 * subscribers but no group record (seen in production) must still be
 * reachable from the studio.
 */
export const SUBSCRIBER_LIST_ID = 'sys_newsletter_contacts';
export const SUBSCRIBER_LIST_NAME = 'Newsletter Contacts';
const SUBSCRIBER_LIST_DESCRIPTION =
  'Every confirmed newsletter subscriber who has not opted out. Kept in sync automatically.';

type SubscriberRecord = Awaited<ReturnType<typeof listSubscribers>>[number];

/** Confirmed and still-active subscribers — the only ones a campaign may reach. */
function eligibleSubscribers(subscribers: SubscriberRecord[]): SubscriberRecord[] {
  return subscribers.filter((s) => s.confirmed && s.active);
}

function firstNameOf(name: string | undefined, email: string): string {
  const first = (name || '').trim().split(/\s+/)[0] || '';
  return first || email.split('@')[0] || '';
}

/** Validate list ids and snapshot their display names. */
export async function resolveListNames(listIds: string[]): Promise<string[]> {
  const groups = await Promise.all(listIds.map((id) => getGroupById(id)));
  // The subscriber list is virtual: valid even before its group record exists.
  const missing = listIds.filter((id, i) => !groups[i] && id !== SUBSCRIBER_LIST_ID);
  if (missing.length > 0) {
    throw new ValidationError(`Unknown audience list(s): ${missing.join(', ')}`);
  }
  return listIds.map((id, i) => (groups[i]?.name as string | undefined) ?? SUBSCRIBER_LIST_NAME);
}

export interface ResolvedAudience {
  items: NewsletterAudienceItem[];
  excludedUnsubscribed: number;
  excludedInvalid: number;
}

/**
 * Resolve group membership into a frozen recipient snapshot.
 * External contacts come straight off the groups; client members are resolved
 * through the communication client list (active clients only). Explicit
 * newsletter opt-outs are removed last, whatever group they sit in.
 */
export async function resolveAudience(listIds: string[]): Promise<ResolvedAudience> {
  const groups = (await Promise.all(listIds.map((gid) => getGroupById(gid)))).filter(
    (g): g is NonNullable<typeof g> => Boolean(g),
  );

  const needsClients = groups.some((g) => (g.clientIds || []).length > 0);
  const clientById = new Map<string, { email: string; name: string }>();
  if (needsClients) {
    const clients = await getAllClients();
    for (const client of clients) {
      if (client.id && client.email) {
        clientById.set(client.id, { email: client.email, name: client.name || client.email });
      }
    }
  }

  const subscribers = await listSubscribers();
  const unsubscribed = new Set(
    subscribers.filter((s) => s.active === false).map((s) => s.email.toLowerCase()),
  );

  const byEmail = new Map<string, NewsletterAudienceItem>();
  let excludedUnsubscribed = 0;
  let excludedInvalid = 0;

  const consider = (rawEmail: string | undefined, name: string | undefined) => {
    const email = (rawEmail || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      excludedInvalid++;
      return;
    }
    if (unsubscribed.has(email)) {
      excludedUnsubscribed++;
      return;
    }
    if (byEmail.has(email)) return;
    const displayName = (name || '').trim() || email;
    byEmail.set(email, {
      email,
      name: displayName,
      firstName: firstNameOf(name, email),
      token: crypto.randomUUID().replace(/-/g, ''),
    });
  };

  // The subscriber base itself, whether or not its group record has been
  // created or backfilled yet. Only confirmed, active consent records count.
  if (listIds.includes(SUBSCRIBER_LIST_ID)) {
    for (const subscriber of eligibleSubscribers(subscribers)) {
      consider(subscriber.email, subscriber.name);
    }
  }

  for (const group of groups) {
    for (const contact of group.externalContacts || []) {
      consider(contact.email, contact.name);
    }
    for (const clientId of group.clientIds || []) {
      const client = clientById.get(clientId);
      if (client) consider(client.email, client.name);
    }
  }

  return { items: [...byEmail.values()], excludedUnsubscribed, excludedInvalid };
}

export async function listAudienceLists(): Promise<NewsletterListView[]> {
  // getGroups paginates in memory over the full namespace; 1000 is the
  // repository's own MAX_PAGE_SIZE and far above any realistic group count.
  const [{ data: groups }, subscribers] = await Promise.all([
    getGroups({ limit: 1000 }),
    listSubscribers().catch(() => [] as SubscriberRecord[]),
  ]);
  const eligibleEmails = new Set(
    eligibleSubscribers(subscribers).map((s) => s.email.toLowerCase()),
  );

  const lists = groups.map((group): NewsletterListView => {
    const externalContacts = group.externalContacts || [];
    const clientIds = group.clientIds || [];
    if (group.id === SUBSCRIBER_LIST_ID) {
      // The group record may lag behind the consent records — count the
      // union of unique addresses so the estimate matches what
      // resolveAudience will reach. Client members of this group are there
      // BECAUSE they are confirmed subscribers, so their address is already
      // in the eligible set; adding clientIds.length would count them twice.
      const reachable = new Set([
        ...eligibleEmails,
        ...externalContacts.map((c) => c.email.toLowerCase()),
      ]);
      return {
        id: group.id,
        name: group.name,
        description: group.description || SUBSCRIBER_LIST_DESCRIPTION,
        type: 'system',
        memberCount: reachable.size,
        externalContactCount: reachable.size,
        clientCount: clientIds.length,
      };
    }
    return {
      id: group.id,
      name: group.name,
      description: group.description || '',
      type: group.type === 'system' ? 'system' : 'custom',
      memberCount: group.clientCount ?? clientIds.length + externalContacts.length,
      externalContactCount: externalContacts.length,
      clientCount: clientIds.length,
    };
  });

  if (!lists.some((list) => list.id === SUBSCRIBER_LIST_ID)) {
    lists.push({
      id: SUBSCRIBER_LIST_ID,
      name: SUBSCRIBER_LIST_NAME,
      description: SUBSCRIBER_LIST_DESCRIPTION,
      type: 'system',
      memberCount: eligibleEmails.size,
      externalContactCount: eligibleEmails.size,
      clientCount: 0,
    });
  }

  // Subscriber base first — it is the default audience — then by reach.
  return lists.sort((a, b) => {
    if (a.id === SUBSCRIBER_LIST_ID) return -1;
    if (b.id === SUBSCRIBER_LIST_ID) return 1;
    return b.memberCount - a.memberCount;
  });
}
