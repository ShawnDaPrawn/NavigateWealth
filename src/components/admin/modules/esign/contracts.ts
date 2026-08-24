/**
 * Runtime contracts for the e-signature API boundary (Stage C / F8).
 *
 * WHY THIS BOUNDARY
 * -----------------
 * The envelope list has the same silent-empty-list failure mode that made
 * client-management the first adopter, and it carries it over legal signature
 * records rather than a directory listing.
 *
 * Two things stack up here. `envelopeApi.getAllEnvelopes` and
 * `getClientEnvelopes` both CATCH their errors and return `{ envelopes: [] }`,
 * and both hooks then read `response.envelopes || []`. So if the server ever
 * renames the list field — exactly the drift that already happened once on
 * `GetClientsResponse`, where `users` became `clients` — nothing throws,
 * nothing logs, and the UI renders "no envelopes" for a client who has
 * several. On an e-signature history, "you have no documents" is not a
 * degraded view; it is a wrong answer about a legal record.
 *
 * `EnvelopeListSchema` is the line that says otherwise: it requires the
 * `envelopes` field to be present and an array. It cannot tell a genuinely
 * empty list from a fetch the api layer swallowed — that is the api layer's
 * bug to fix, not the schema's — but it does make a renamed or dropped field
 * loud instead of silent.
 *
 * WHY `status` IS CHECKED STRICTLY
 * --------------------------------
 * Every consumer branches on `status`: the tab's filters and stat cards, the
 * dashboard's grouping, and the signer flows. An unrecognised status is not
 * rendered as "unknown" anywhere — it simply matches none of the branches and
 * disappears from every count. So the enum here is deliberately the full
 * declared union and nothing wider: a status the SPA does not know about is a
 * real finding, and `parseContract` reports it without throwing.
 *
 * WHAT IS NOT CHECKED
 * -------------------
 * Nested `signers`, `fields`, `audit_events` and `document` are left alone, and
 * this schema carries **no `Equals<>` drift assertion** against `EsignEnvelope`.
 * Pinning it would mean hand-mirroring five large nested interfaces, and a
 * hand-maintained mirror of those is the very drift the assertion exists to
 * prevent — the same reasoning `client-management/contracts.ts` records for
 * `ClientListEnvelopeSchema`. A pin that looks rigorous and is not is worse
 * than an honest shallow check.
 *
 * Everything here is REPORT-ONLY — see `parseContract`.
 */
import { z } from 'zod';

/**
 * The declared `EnvelopeStatus` union, mirrored exactly.
 *
 * Kept in the same order as `types.ts` so the two read as one list when
 * compared side by side.
 */
export const EnvelopeStatusSchema = z.enum([
  'draft',
  'sent',
  'viewed',
  'partially_signed',
  'completing',
  'completed',
  'declined',
  'rejected',
  'expired',
  'voided',
]);

/**
 * One envelope in a list response, checked shallowly.
 *
 * `.passthrough()` for the same reason client-management uses it: `parseContract`
 * returns the PARSED value, and a schema without it would strip every unknown
 * key — here that would silently drop `signers`, `fields` and `document` from
 * any caller that used the return value instead of the original response.
 */
export const EnvelopeEntrySchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: EnvelopeStatusSchema,
    client_id: z.string(),
    created_at: z.string(),
  })
  .passthrough();

/**
 * The list envelope itself.
 *
 * The `refine` is the point of this file: it fires when `envelopes` is absent
 * or is not an array, which is precisely the shape a field rename produces and
 * the shape both hooks would otherwise absorb into an empty list.
 */
export const EnvelopeListSchema = z
  .object({
    envelopes: z.array(EnvelopeEntrySchema).optional(),
  })
  .passthrough()
  .refine((value) => Array.isArray(value.envelopes), {
    message: 'response carries no `envelopes` array',
  });

export type EnvelopeList = z.infer<typeof EnvelopeListSchema>;
