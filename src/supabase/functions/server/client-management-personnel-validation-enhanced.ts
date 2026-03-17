/**
 * Personnel Validation - Enhanced
 * 
 * Extended personnel validation with comprehensive schemas.
 * This file extends the basic personnel-validation.ts from Phase 1.
 * 
 * Phase 3 - Increment 3.3
 */

import { z } from 'npm:zod';
import {
  UuidSchema,
  EmailSchema,
  NonEmptyStringSchema,
  OptionalStringSchema,
  OptionalSaPhoneSchema,
  OptionalSaIdNumberSchema,
  IsoDateSchema,
  DecimalPercentageSchema,
} from './common-schemas.ts';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Personnel Roles
 */
export const PersonnelRoleSchema = z.enum([
  'super_admin',
  'admin',
  'adviser',
  'paraplanner',
  'compliance',
  'viewer',
]);

/**
 * Personnel Status
 */
export const PersonnelStatusSchema = z.enum([
  'active',
  'suspended',
  'pending',
  'inactive',
]);

/**
 * FSCA Status
 */
export const FSCAStatusSchema = z.enum([
  'active',
  'debarred',
  'pending',
  'suspended',
  'not_applicable',
]);

/**
 * Department
 */
export const DepartmentSchema = z.enum([
  'operations',
  'compliance',
  'sales',
  'support',
  'management',
  'finance',
]);

// ============================================================================
// FULL PERSONNEL SCHEMAS
// ============================================================================

/**
 * Complete Personnel Schema
 */
export const CompletePersonnelSchema = z.object({
  // Basic Information
  id: UuidSchema.optional(), // For updates
  firstName: NonEmptyStringSchema,
  lastName: NonEmptyStringSchema,
  email: EmailSchema,
  phone: OptionalSaPhoneSchema,
  
  // Role & Status
  role: PersonnelRoleSchema,
  status: PersonnelStatusSchema.default('active'),
  department: DepartmentSchema.optional(),
  
  // Financial
  commissionSplit: DecimalPercentageSchema.optional(),
  
  // Regulatory
  fscaNumber: OptionalStringSchema,
  fscaStatus: FSCAStatusSchema.optional(),
  
  // Personal
  dateOfBirth: IsoDateSchema.optional(),
  idNumber: OptionalSaIdNumberSchema,
  
  // Employment
  startDate: IsoDateSchema.optional(),
  endDate: IsoDateSchema.optional(),
  
  // Metadata
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  createdBy: UuidSchema.optional(),
  updatedBy: UuidSchema.optional(),
});

/**
 * Create Personnel Schema
 */
export const CreatePersonnelSchema = CompletePersonnelSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/**
 * Update Personnel Schema
 */
export const UpdatePersonnelSchema = CompletePersonnelSchema.partial().refine(
  (data) => {
    // Must have at least one update field
    const { id, createdAt, updatedAt, ...rest } = data;
    return Object.keys(rest).length > 0;
  },
  {
    message: 'At least one field must be provided for update',
  }
);

/**
 * Personnel Query/Filter Schema
 */
export const PersonnelQuerySchema = z.object({
  role: PersonnelRoleSchema.optional(),
  status: PersonnelStatusSchema.optional(),
  department: DepartmentSchema.optional(),
  fscaStatus: FSCAStatusSchema.optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

/**
 * Personnel ID Parameter
 */
export const PersonnelIdParamSchema = z.object({
  id: UuidSchema,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PersonnelRole = z.infer<typeof PersonnelRoleSchema>;
export type PersonnelStatus = z.infer<typeof PersonnelStatusSchema>;
export type FSCAStatus = z.infer<typeof FSCAStatusSchema>;
export type Department = z.infer<typeof DepartmentSchema>;
export type CompletePersonnel = z.infer<typeof CompletePersonnelSchema>;
export type CreatePersonnel = z.infer<typeof CreatePersonnelSchema>;
export type UpdatePersonnel = z.infer<typeof UpdatePersonnelSchema>;
export type PersonnelQuery = z.infer<typeof PersonnelQuerySchema>;
