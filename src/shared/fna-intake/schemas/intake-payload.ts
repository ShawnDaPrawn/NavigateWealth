/**
 * Shared client intake payload validation (mirrors server fna-validation intake schemas).
 */

import { z } from 'zod';

const MAX_INTAKE_FIELDS = 200;
const MAX_INTAKE_JSON_BYTES = 256_000;

function intakePayloadSizeOk(obj: Record<string, unknown>): boolean {
  try {
    return JSON.stringify(obj).length <= MAX_INTAKE_JSON_BYTES;
  } catch {
    return false;
  }
}

export const FnaIntakeDomainSchema = z.enum([
  'risk',
  'medical',
  'retirement',
  'investment',
  'tax',
  'estate',
]);

export const FnaIntakeSaveDraftSchema = z.object({
  inputs: z
    .record(z.unknown())
    .refine((obj) => Object.keys(obj).length <= MAX_INTAKE_FIELDS, {
      message: `Intake may contain at most ${MAX_INTAKE_FIELDS} fields`,
    })
    .refine(intakePayloadSizeOk, { message: 'Intake payload is too large' }),
});

export const FnaIntakeSubmitSchema = z.object({
  consentAccepted: z.literal(true),
});

export type FnaIntakeDomain = z.infer<typeof FnaIntakeDomainSchema>;
