/**
 * Runtime contracts for the client-management API boundary (Stage C / F8).
 *
 * WHY THIS BOUNDARY FIRST
 * -----------------------
 * `GetClientsResponse` carries a field marked `@deprecated`:
 *
 *   users?: ApiUser[]   // "Server now returns `clients` — kept for backward compatibility"
 *
 * That comment is the evidence. This exact response shape has already drifted
 * once in production, and the SPA absorbed it by reading whichever field
 * happened to be present — falling back to `[]` when neither is. An empty
 * client list is indistinguishable from "this firm has no clients", so the
 * rename could have shipped silently. This is precisely the failure F8 exists
 * to make loud, which makes it the right first adopter rather than an
 * arbitrary one.
 *
 * WHAT IS AND IS NOT CHECKED
 * --------------------------
 * `ClientListEnvelopeSchema` validates the ENVELOPE — the pagination fields and
 * that at least one recognised list field is present and is an array of objects
 * carrying an `id` and an `email`. It deliberately does NOT deep-validate each
 * user's nested `profile` / `application`; those are large, legacy-shaped, and
 * a strict schema over them would report false violations on every historic row
 * and drown the real signal.
 *
 * So this schema carries **no `Equals<>` drift assertion**, unlike
 * `BaseClientSchema`. Pinning it to `GetClientsResponse` would require mirroring
 * `ClientProfile` and `ClientApplication` in full, and a hand-maintained mirror
 * of two large nested types is exactly the drift-prone thing the assertion
 * exists to prevent elsewhere. Stating that plainly is better than a pin that
 * looks rigorous and is not.
 *
 * Everything here is REPORT-ONLY — see `parseContract`.
 */
import { z } from 'zod';

/**
 * One entry in the client list, checked shallowly.
 *
 * `.passthrough()` is here because `parseContract` returns the PARSED value on
 * success, and a schema without it strips every unknown key — which for this
 * shape means silently deleting each client's `profile` and `application`.
 *
 * Worth being precise about how much that matters today: the current call site
 * in `useClientList` DISCARDS the return value and reads `data.clients` off the
 * original response, so a lossy schema could not actually bite there. It is
 * kept non-lossy anyway, so that the next caller — one that does use the parsed
 * value, as `parseContract`'s signature invites — is not handed a stripped
 * object. `contracts.test.ts` pins the property directly rather than through
 * the hook, because through the hook it is unfalsifiable.
 */
export const ClientListEntrySchema = z
  .object({
    id: z.string(),
    email: z.string(),
  })
  .passthrough();

export const ClientListEnvelopeSchema = z
  .object({
    count: z.number().optional(),
    users: z.array(ClientListEntrySchema).optional(),
    clients: z.array(ClientListEntrySchema).optional(),
    total: z.number().optional(),
    page: z.number().optional(),
    perPage: z.number().optional(),
    totalPages: z.number().optional(),
  })
  .passthrough()
  .refine((value) => Array.isArray(value.clients) || Array.isArray(value.users), {
    // The rename that already happened once. If a future server drops both
    // field names, the hook's fallback yields an empty list and the UI shows
    // "no clients" — this is the line that says otherwise.
    message: 'response carries neither `clients` nor `users`',
  });

export type ClientListEnvelope = z.infer<typeof ClientListEnvelopeSchema>;
