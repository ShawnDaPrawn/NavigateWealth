/**
 * One answer to "what is this client called?".
 *
 * A client's name is written in two stores that drift apart:
 *
 *   - the **KV profile** (`user_profile:{id}:personal_info`) — what an admin
 *     edits in the client profile viewer, and the only copy anyone corrects
 *   - **auth `user_metadata`** — a snapshot taken when the account was created
 *     and, for most clients, never written again
 *
 * Nothing reconciles them, and the read paths disagreed about which one wins:
 * client management preferred `user_metadata`, while `getAllClients` — the
 * loader behind every outbound email — preferred the profile but looked in only
 * ONE of the two shapes a profile comes in. So a client renamed on their profile
 * was still addressed by the old name in the birthday digest and in the greeting
 * sent to them. That is not cosmetic: mail addressed to the wrong human is the
 * kind of error a client notices before the advisor does.
 *
 * WHY THE PROFILE WINS, AND WHY THE FLAT ROOT WINS INSIDE IT:
 *
 * The profile is the copy with an editor pointed at it, so it is the correction.
 * Auth metadata is a signup-time snapshot and belongs last.
 *
 * Inside the profile there are two shapes, and the flat one is the current one:
 *   - **Flat root** (`profile.firstName`) — written by
 *     `buildClientProfileFromApplication` for every self-service client, and by
 *     the profile editor, which strips `personalInformation` from its payload on
 *     save precisely so a stale nested name cannot outlive a root edit.
 *   - **Nested** (`profile.personalInformation.firstName`) — the older
 *     admin-entered shape, still on most rows, and left untouched by a flat save
 *     because `updateClientProfile` merges shallowly.
 * A row carrying both is therefore one whose root was written more recently.
 *
 * These functions are pure: no I/O, no Supabase, no KV. Every shape can be
 * exercised from a fixture.
 *
 * @module server/client-display-name
 */

/** Anything the auth user's `user_metadata` bag may carry for a name. */
export type NameMetadata = Record<string, unknown> | null | undefined;

/** A KV client profile, in any of the shapes described above. */
export type NameProfile = Record<string, unknown> | null | undefined;

/** Trimmed string, or '' for anything that is not usable text. */
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** First non-empty candidate, or ''. */
function firstOf(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    const value = text(candidate);
    if (value) return value;
  }
  return '';
}

/** The nested legacy block, as a record. */
function nested(profile: NameProfile): Record<string, unknown> {
  const block = (profile as Record<string, unknown> | null | undefined)?.personalInformation;
  return block && typeof block === 'object' ? (block as Record<string, unknown>) : {};
}

/**
 * `user_metadata.name` split into given and family parts.
 *
 * Some auth rows carry only a single display name. Everything before the first
 * space is the given name and the remainder the family name — wrong for a few
 * naming conventions, but it is the same split the codebase already used, and
 * it applies only when no structured name exists anywhere.
 */
function splitFullName(metadata: NameMetadata): { first: string; last: string } {
  const full = text((metadata as Record<string, unknown> | null | undefined)?.name);
  if (!full) return { first: '', last: '' };

  const parts = full.split(/\s+/);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}

/**
 * The client's given name.
 *
 * `fallback` is what to use when no store holds a name at all — call sites pass
 * whatever they render today ('Client', 'there', or '') rather than inheriting a
 * placeholder chosen here.
 */
export function resolveClientFirstName(
  profile: NameProfile,
  metadata: NameMetadata,
  fallback = '',
): string {
  const root = (profile ?? {}) as Record<string, unknown>;
  const pi = nested(profile);
  const meta = (metadata ?? {}) as Record<string, unknown>;

  return (
    firstOf(
      root.firstName,
      root.first_name,
      pi.firstName,
      pi.first_name,
      meta.firstName,
      meta.first_name,
      splitFullName(metadata).first,
    ) || fallback
  );
}

/**
 * The client's family name.
 *
 * Reads `surname` alongside `lastName` in both profile shapes: the two spellings
 * are used interchangeably across this codebase, and auth metadata stores the
 * family name under `surname` specifically.
 */
export function resolveClientLastName(
  profile: NameProfile,
  metadata: NameMetadata,
  fallback = '',
): string {
  const root = (profile ?? {}) as Record<string, unknown>;
  const pi = nested(profile);
  const meta = (metadata ?? {}) as Record<string, unknown>;

  return (
    firstOf(
      root.lastName,
      root.surname,
      root.last_name,
      pi.lastName,
      pi.surname,
      pi.last_name,
      meta.surname,
      meta.lastName,
      meta.last_name,
      splitFullName(metadata).last,
    ) || fallback
  );
}

/**
 * Given and family name joined, or `fallback` when neither is known.
 *
 * The fallback applies to the WHOLE name rather than to each half, so a client
 * with only a given name reads "Kirtan" and never "Kirtan Client".
 */
export function resolveClientFullName(
  profile: NameProfile,
  metadata: NameMetadata,
  fallback = '',
): string {
  const full = [resolveClientFirstName(profile, metadata), resolveClientLastName(profile, metadata)]
    .filter(Boolean)
    .join(' ');

  return full || fallback;
}

/**
 * Write a name onto a profile so that every reader sees the same one.
 *
 * The canonical home is the flat root, but a legacy row may also carry the name
 * inside `personalInformation`, and not every consumer reads through the
 * resolver above — `newsletter-service` walks raw KV profiles, for one. Leaving
 * a stale nested copy behind is how a corrected name half-propagates: right in
 * the digest, wrong in the newsletter. So the nested block is updated in place
 * when it already exists, and is never created when it does not — the profile
 * editor is retiring that shape and this must not resurrect it.
 *
 * Only non-empty values are applied, matching the auth-metadata write in
 * `updateClient`: a request that omits a name must not blank the stored one.
 *
 * Returns a new object; the input is not mutated.
 */
export function applyClientName(
  profile: Record<string, unknown> | null | undefined,
  name: { firstName?: string; lastName?: string },
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(profile ?? {}) };

  const firstName = text(name.firstName);
  const lastName = text(name.lastName);
  if (!firstName && !lastName) return next;

  if (firstName) next.firstName = firstName;
  if (lastName) next.lastName = lastName;

  const block = next.personalInformation;
  if (block && typeof block === 'object') {
    const pi: Record<string, unknown> = { ...(block as Record<string, unknown>) };
    if (firstName) pi.firstName = firstName;
    if (lastName) pi.lastName = lastName;
    // `surname` is the other spelling this codebase uses for the same field;
    // updating one and not the other is how the two disagree.
    if (lastName && 'surname' in pi) pi.surname = lastName;
    next.personalInformation = pi;
  }

  return next;
}
