/**
 * Client Document Summary — request schemas.
 *
 * Every body-accepting route in this module validates through one of these.
 */

import { z } from 'npm:zod';

/**
 * POST /client-document-summaries/:clientId/generate
 *
 * Either a `packId` (summarise that pack) or a `documentId` (summarise that
 * single document). `force` re-generates over an existing summary — including
 * one a super admin has edited, which is why it is explicit rather than the
 * default.
 */
export const GenerateSummarySchema = z
  .object({
    packId: z.string().min(1).max(200).optional(),
    documentId: z.string().min(1).max(200).optional(),
    force: z.boolean().optional().default(false),
  })
  .refine((v) => Boolean(v.packId) !== Boolean(v.documentId), {
    message: 'Provide exactly one of packId or documentId',
  });

/**
 * PATCH /client-document-summaries/:clientId/:summaryId — super admin only.
 *
 * Only the human-readable fields are editable. The document set, dates and
 * provenance are facts about what was summarised and are not up for editing.
 */
export const UpdateSummarySchema = z
  .object({
    headline: z.string().min(1).max(300).optional(),
    summary: z.string().min(1).max(8000).optional(),
    highlights: z.array(z.string().min(1).max(600)).max(25).optional(),
    followUps: z.array(z.string().min(1).max(600)).max(25).optional(),
  })
  .refine((v) => Object.values(v).some((entry) => entry !== undefined), {
    message: 'At least one field must be provided',
  });

/**
 * POST /client-document-summaries/maintenance/weekly-scan
 *
 * `dryRun` defaults to true (§14.1 — dry-run first): a scan that costs money
 * per document should not be the thing that happens when you forget a flag.
 * The scheduled job sends `dryRun: false` explicitly.
 */
export const WeeklyScanSchema = z.object({
  lookbackDays: z.number().int().min(1).max(90).optional().default(7),
  dryRun: z.boolean().optional().default(true),
  maxGroups: z.number().int().min(1).max(200).optional().default(40),
  force: z.boolean().optional().default(false),
});
