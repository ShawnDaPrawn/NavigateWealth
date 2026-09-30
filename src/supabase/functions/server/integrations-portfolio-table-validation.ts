/**
 * Portfolio table — request schemas.
 *
 * Forgiving about types on purpose: the same rows arrive from a spreadsheet
 * (strings and numbers as the cell held them) and from an agent's JSON. A
 * policy number may well be sent as a number; a bot should not have to guess.
 * Values are validated against the product structure later, per field.
 */

import { z } from 'npm:zod';
import { PORTFOLIO_MAX_ROWS } from '../../../shared/integrations/portfolio-table.ts';

const ID = z.string().trim().min(1).max(120);

/** `?providerId=&categoryId=` on every read. */
export const PortfolioQuerySchema = z.object({
  providerId: ID,
  categoryId: ID,
});

const LooseString = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => (value === undefined ? undefined : String(value).trim().slice(0, 240)));

export const PortfolioRowInputSchema = z
  .object({
    rowNumber: z.coerce.number().int().positive().optional(),
    clientName: LooseString,
    policyNumber: LooseString,
    policyId: LooseString,
    clientId: LooseString,
    /** Keyed by field id, field name, or the configured spreadsheet column. */
    values: z.record(z.string().max(200), z.unknown()).optional().default({}),
  })
  .passthrough();

export const PortfolioApplySchema = z
  .object({
    providerId: ID,
    categoryId: ID,
    /** Report what would change without writing anything. */
    dryRun: z.boolean().optional().default(false),
    /** Shown in the run and history records, e.g. the bot's name. */
    submittedBy: z.string().trim().max(80).optional(),
    rows: z.array(PortfolioRowInputSchema).min(1).max(PORTFOLIO_MAX_ROWS),
  })
  .passthrough();

/** The text fields beside the file in a multipart upload. */
export const PortfolioUploadFieldsSchema = z.object({
  providerId: ID,
  categoryId: ID,
  mode: z.enum(['preview', 'apply']).optional().default('preview'),
  submittedBy: z.string().trim().max(80).optional(),
});

/** `?policyId=&clientId=` for a policy print link. */
export const PolicyPrintQuerySchema = z.object({
  policyId: ID,
  clientId: ID,
});
