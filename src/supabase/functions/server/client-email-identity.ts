/**
 * Sign-in identity vs contact address for client records.
 *
 * Every client in this system is a Supabase Auth user, and Supabase Auth
 * enforces one account per email address. That conflated two different things:
 *
 *   - the **sign-in email** — the client's login identity, which must be unique
 *   - the **contact email** — the inbox we actually write to, which need not be
 *
 * Households break the conflation. A minor with no inbox of her own is enrolled
 * on her father's address; that address is now spent, and the father himself can
 * never be onboarded. The advisory relationship is with two people, so there
 * must be two client records — the constraint is on mailboxes, not on people.
 *
 * The split here keeps the contact address on the profile and gives the linked
 * record a derived, unique sign-in identity. Derivation uses RFC 5233 sub-
 * addressing (`michael+charlotte@example.com`) rather than an invented domain,
 * so the alias stays deliverable to the same mailbox on every provider that
 * honours the convention — and remains recognisable to a human reading the
 * auth table. Delivery is not relied upon: `resolveContactEmail` sends every
 * client message to the real address regardless.
 *
 * These functions are pure. They do no I/O and know nothing about Supabase, so
 * the alias rules can be tested exhaustively without a database.
 *
 * @module server/client-email-identity
 */

/** Maximum length of the local part of an address (RFC 5321 §4.5.3.1.1). */
const MAX_LOCAL_PART = 64;

/** Shape stored on a client profile when its sign-in email is a derived alias. */
export interface SharedEmailLink {
  /** The real inbox this client is reachable at — the address the admin typed. */
  contactEmail: string;
  /** The derived, unique address the client signs in with. */
  signInEmail: string;
  /** The client who owns the mailbox, when the admin identified one. */
  ownerUserId?: string;
  /** Free text: "Child", "Spouse", "Dependant", … */
  relationship?: string;
  /** ISO timestamp of when the link was made. */
  linkedAt: string;
  /** Admin user id that made the link. */
  linkedBy?: string;
}

/** Lower-cases and trims an address. Returns '' for anything unusable. */
export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/**
 * Split an address into its local part and domain.
 *
 * Returns null when the input is not a plausible address, which is the caller's
 * signal to fall back rather than to construct nonsense.
 */
export function splitEmail(email: string): { local: string; domain: string } | null {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at === normalized.length - 1) return null;

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain.includes('.') || /\s/.test(normalized)) return null;

  return { local, domain };
}

/**
 * The address without any existing sub-address tag.
 *
 * Linking a client to `michael+charlotte@x.co` must not yield
 * `michael+charlotte+sibling@x.co` — providers split on the FIRST `+`, so the
 * nested form is legal but unreadable. Every alias is derived from the bare
 * mailbox instead.
 */
export function baseMailbox(email: string): string {
  const parts = splitEmail(email);
  if (!parts) return normalizeEmail(email);
  const plus = parts.local.indexOf('+');
  const local = plus === -1 ? parts.local : parts.local.slice(0, plus);
  return `${local}@${parts.domain}`;
}

/** True when the address already carries a sub-address tag. */
export function hasAliasTag(email: string): boolean {
  const parts = splitEmail(email);
  return parts ? parts.local.includes('+') : false;
}

/**
 * Slugify a client's name into an address-safe tag.
 *
 * Falls back to 'linked' when a name yields nothing usable (initials only,
 * non-Latin scripts, an empty surname) — an empty tag would produce
 * `michael+@x.co`, which is a different address on some providers and a
 * rejected one on others.
 */
export function aliasTagFromName(firstName: string, lastName: string): string {
  const slug = `${firstName ?? ''} ${lastName ?? ''}`
    .normalize('NFKD')
    // Strip combining marks so "Zoë" becomes "zoe" rather than losing the vowel.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'linked';
}

/**
 * Derive the nth candidate sign-in address for a client sharing `contactEmail`.
 *
 * `attempt` is 0-based and only appears in the tag from the second candidate on,
 * so the common case reads cleanly (`michael+charlotte-page-wood@x.co`) and a
 * collision — two Charlottes on one mailbox — still terminates
 * (`michael+charlotte-page-wood-2@x.co`).
 *
 * Returns null when `contactEmail` is not a usable address; the caller should
 * then reject the input rather than invent an identity for it.
 */
export function buildSignInAlias(
  contactEmail: string,
  firstName: string,
  lastName: string,
  attempt = 0,
): string | null {
  const parts = splitEmail(baseMailbox(contactEmail));
  if (!parts) return null;

  const suffix = attempt > 0 ? `-${attempt + 1}` : '';
  const tag = aliasTagFromName(firstName, lastName);

  // Trim the tag, never the mailbox: a truncated local part would address a
  // different (or non-existent) account, whereas a truncated tag still resolves
  // to the same inbox on every provider that implements sub-addressing.
  const budget = MAX_LOCAL_PART - parts.local.length - 1 - suffix.length;
  if (budget < 1) return null;

  const trimmed = tag.slice(0, budget).replace(/-+$/, '') || 'linked'.slice(0, budget);

  return `${parts.local}+${trimmed}${suffix}@${parts.domain}`;
}

/** Reads the shared-email link off a profile, if it has one. */
export function readSharedEmailLink(
  profile: Record<string, unknown> | null | undefined,
): SharedEmailLink | null {
  const link = profile?.sharedEmail;
  if (!link || typeof link !== 'object') return null;

  const contactEmail = normalizeEmail((link as Record<string, unknown>).contactEmail);
  if (!contactEmail) return null;

  return link as unknown as SharedEmailLink;
}

/**
 * The address to write to for a client.
 *
 * Prefers the shared-email link's contact address over the auth identity, so a
 * linked minor's newsletter, birthday greeting and campaign mail all land in the
 * guardian's real inbox rather than at a derived alias. Everything that emails
 * clients reads `client.email`, and `ClientsService.getAllClients` populates it
 * from here — that one seam is why no call site had to learn about aliases.
 */
export function resolveContactEmail(
  authEmail: string | undefined | null,
  profile: Record<string, unknown> | null | undefined,
): string {
  const link = readSharedEmailLink(profile);
  if (link?.contactEmail) return link.contactEmail;
  return normalizeEmail(authEmail);
}
