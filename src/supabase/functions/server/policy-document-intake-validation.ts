/**
 * Policy document intake — the fields beside the file in an HTTPS upload.
 *
 * The SQL side checks the ids, the file name and the key again when the
 * upload is submitted, with its own messages; these catch the obvious early,
 * with field-by-field errors, before anything is staged.
 */

import { z } from 'npm:zod';

const ID = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,128}$/, '1-128 letters, digits, _ or -');

/** `policy.document.documentType`, as the table's CHECK allows it. */
export const INTAKE_DOCUMENT_TYPES = [
  'policy_schedule',
  'amendment',
  'statement',
  'benefit_summary',
  'other',
] as const;

export const PolicyDocumentUploadFieldsSchema = z.object({
  clientId: ID,
  policyId: ID,
  documentType: z.enum(INTAKE_DOCUMENT_TYPES).optional().default('policy_schedule'),
  /** One per document. Sending the same key again returns that hand-over. */
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
  /**
   * A label for a caller on the shared cron token. An agent is named by its
   * own token and an admin by the session; for them this is ignored.
   */
  submittedBy: z.string().trim().min(1).max(60).optional(),
});
