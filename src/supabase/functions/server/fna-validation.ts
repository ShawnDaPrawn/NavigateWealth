/**
 * FNA Validation Schemas
 *
 * Shared Zod schemas for Financial Needs Analysis route input validation.
 * Used by: medical-fna, estate-planning-fna, investment-ina, tax-planning-fna,
 *          retirement-fna route files.
 *
 * Per Guidelines v5 section 4.2:
 *   Validation schemas are defined separately and applied in route handlers.
 */

import { z } from 'npm:zod';
import { UUID_REGEX } from './shared-validation-utils.ts';

// ============================================================================
// COMMON PRIMITIVES
// ============================================================================

/** Validates a UUID string (used for clientId, userId, etc.) */
export const UuidSchema = z.string().regex(UUID_REGEX, 'Must be a valid UUID');

/** FNA session status values */
export const FnaStatusSchema = z.enum(['draft', 'published', 'archived']);

/** Client intake session status (separate from formal FNA lifecycle) */
export const FnaIntakeStatusSchema = z.enum(['client_draft', 'submitted', 'accepted']);

export const FnaIntakeDomainSchema = z.enum([
  'risk',
  'medical',
  'retirement',
  'investment',
  'tax',
  'estate',
]);

// ============================================================================
// SESSION LIFECYCLE SCHEMAS
// ============================================================================

/** POST /create — Create a new FNA session (medical-fna, retirement-fna) */
export const CreateSessionSchema = z.object({
  clientId: UuidSchema,
});

/**
 * POST /save — Save an FNA session with inputs and optional results.
 * Used by: estate-planning-fna, investment-ina
 */
export const SaveSessionSchema = z.object({
  clientId: UuidSchema,
  inputs: z.record(z.unknown()),
  results: z.record(z.unknown()).nullable().optional(),
  status: FnaStatusSchema.optional(),
  adviserNotes: z.string().optional(),
});

/**
 * POST /save — Save a Tax Planning session.
 * Extends SaveSessionSchema with tax-specific fields.
 */
export const SaveTaxPlanningSessionSchema = z.object({
  clientId: UuidSchema,
  inputs: z.record(z.unknown()),
  finalResults: z.record(z.unknown()),
  adjustments: z.array(z.record(z.unknown())).optional(),
  recommendations: z.array(z.record(z.unknown())).optional(),
  adviserNotes: z.string().optional(),
  status: FnaStatusSchema.optional(),
});

/**
 * PUT /inputs/:fnaId — Partial input update.
 * Accepts any valid JSON object to merge into existing inputs.
 */
export const UpdateInputsSchema = z.record(z.unknown()).refine(
  (obj) => Object.keys(obj).length > 0,
  { message: 'Input update must contain at least one field' },
);

/**
 * PUT /results/:fnaId — Update results and/or adjustments (medical-fna).
 */
export const UpdateResultsSchema = z.object({
  results: z.record(z.unknown()).optional(),
  adjustments: z.record(z.unknown()).optional(),
}).refine(
  (data) => data.results !== undefined || data.adjustments !== undefined,
  { message: 'At least one of results or adjustments must be provided' },
);

/**
 * POST /client/:clientId/save — Save Investment INA session.
 */
export const SaveInvestmentSessionSchema = z.object({
  inputs: z.record(z.unknown()),
  results: z.record(z.unknown()).nullable().optional(),
  status: FnaStatusSchema.optional(),
});

/**
 * POST /client/:clientId/calculate — Calculate Investment INA.
 * Accepts the full inputs object for calculation.
 */
export const CalculateInputsSchema = z.record(z.unknown()).refine(
  (obj) => Object.keys(obj).length > 0,
  { message: 'Calculation inputs must not be empty' },
);

/**
 * POST /risk-planning-fna/create — Create a Risk Planning FNA session.
 */
export const CreateRiskPlanningFnaSchema = z.object({
  clientId: UuidSchema,
  inputData: z.record(z.unknown()).optional(),
  calculations: z.record(z.unknown()).nullable().optional(),
  adjustments: z.record(z.unknown()).nullable().optional(),
  finalNeeds: z.record(z.unknown()).nullable().optional(),
});

/**
 * PUT /risk-planning-fna/update/:fnaId — Update a Risk Planning FNA session.
 */
export const UpdateRiskPlanningFnaSchema = z.object({
  inputData: z.record(z.unknown()).optional(),
  calculations: z.record(z.unknown()).nullable().optional(),
  adjustments: z.record(z.unknown()).nullable().optional(),
  finalNeeds: z.record(z.unknown()).nullable().optional(),
  status: FnaStatusSchema.optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' },
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type SaveSessionInput = z.infer<typeof SaveSessionSchema>;
export type SaveTaxPlanningSessionInput = z.infer<typeof SaveTaxPlanningSessionSchema>;
export type UpdateResultsInput = z.infer<typeof UpdateResultsSchema>;
export type SaveInvestmentSessionInput = z.infer<typeof SaveInvestmentSessionSchema>;
export type CreateRiskPlanningFnaInput = z.infer<typeof CreateRiskPlanningFnaSchema>;
export type UpdateRiskPlanningFnaInput = z.infer<typeof UpdateRiskPlanningFnaSchema>;

// ============================================================================
// CLIENT INTAKE SCHEMAS
// ============================================================================

const MAX_INTAKE_FIELDS = 200;
const MAX_INTAKE_JSON_BYTES = 256_000;

function intakePayloadSizeOk(obj: Record<string, unknown>): boolean {
  try {
    return JSON.stringify(obj).length <= MAX_INTAKE_JSON_BYTES;
  } catch {
    return false;
  }
}

/** PUT /fna-intake/:domain/draft/:clientId — mirrors src/shared/fna-intake/schemas/intake-payload.ts */
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

/** Route param: clientId or sessionId */
export const FnaIntakeClientIdParamSchema = UuidSchema;
export const FnaIntakeSessionIdParamSchema = UuidSchema;

export type FnaIntakeSaveDraftInput = z.infer<typeof FnaIntakeSaveDraftSchema>;
export type FnaIntakeSubmitInput = z.infer<typeof FnaIntakeSubmitSchema>;