/**
 * Client Management Module - Validation Schemas
 * 
 * Comprehensive validation for client management:
 * - Client CRUD operations
 * - Profile updates
 * - Security operations (suspend/unsuspend)
 * - Query filters
 * 
 * Phase 3 - Increment 3.3
 * VERSION: 3.3.8 - Inlined validation utilities to avoid bundler issues
 */

import { z } from 'npm:zod';
import {
  UuidSchema,
  EmailSchema,
  OptionalEmailSchema,
  NonEmptyStringSchema,
  OptionalStringSchema,
  SaPhoneSchema,
  OptionalSaPhoneSchema,
  SaIdNumberSchema,
  OptionalSaIdNumberSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  PastDateSchema,
  AddressSchema,
  SaProvinceSchema,
  SaPostalCodeSchema,
} from './common-schemas.ts';

// Inlined validation utilities to avoid bundler import issues
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>?/gm, '');
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/**
 * Account type
 */
export const AccountTypeSchema = z.enum(['personal', 'business']);

/**
 * Application status
 */
export const ApplicationStatusSchema = z.enum([
  'none',
  'incomplete',
  'pending',
  'approved',
  'declined',
]);

/**
 * Client role
 */
export const ClientRoleSchema = z.enum(['client', 'admin']);

/**
 * Gender
 */
export const GenderSchema = z.enum(['male', 'female', 'other', 'prefer_not_to_say']);

/**
 * Nationality
 */
export const NationalitySchema = z.enum([
  'south_african',
  'zimbabwean',
  'namibian',
  'botswanan',
  'other',
]);

/**
 * Employment status
 */
export const EmploymentStatusSchema = z.enum([
  'employed',
  'self_employed',
  'unemployed',
  'retired',
  'student',
  'other',
]);

/**
 * Investment experience
 */
export const InvestmentExperienceSchema = z.enum([
  'none',
  'beginner',
  'intermediate',
  'advanced',
  'expert',
]);

/**
 * Risk tolerance
 */
export const RiskToleranceSchema = z.enum([
  'conservative',
  'moderate',
  'balanced',
  'aggressive',
  'very_aggressive',
]);

/**
 * Financial goals
 */
export const FinancialGoalSchema = z.enum([
  'wealth_creation',
  'retirement_planning',
  'estate_planning',
  'tax_planning',
  'insurance_protection',
  'education_funding',
  'debt_management',
  'other',
]);

/**
 * Account status
 */
export const AccountStatusSchema = z.enum([
  'pending',
  'approved',
  'active',
  'suspended',
  'closed',
]);

// ============================================================================
// NESTED OBJECT SCHEMAS
// ============================================================================

/**
 * Personal Information Schema
 */
export const PersonalInformationSchema = z.object({
  firstName: NonEmptyStringSchema,
  lastName: NonEmptyStringSchema,
  dateOfBirth: IsoDateSchema.optional(),
  gender: GenderSchema.optional(),
  nationality: NationalitySchema.optional(),
  idNumber: OptionalSaIdNumberSchema,
  passportNumber: OptionalStringSchema,
  cellphone: OptionalSaPhoneSchema,
  email: OptionalEmailSchema,
}).refine(
  (data) => data.idNumber || data.passportNumber,
  {
    message: 'Either ID number or passport number is required',
    path: ['idNumber'],
  }
);

/**
 * Contact Information Schema
 */
export const ContactInformationSchema = z.object({
  residentialAddress: AddressSchema.optional(),
  postalAddress: AddressSchema.optional(),
  workAddress: AddressSchema.optional(),
  sameAsResidential: z.boolean().optional(), // Flag for postal address
});

/**
 * Employment Information Schema
 */
export const EmploymentInformationSchema = z.object({
  status: EmploymentStatusSchema.optional(),
  occupation: OptionalStringSchema,
  employer: OptionalStringSchema,
  monthlyIncome: z.string()
    .optional()
    .transform((val) => val ? parseFloat(val) : undefined)
    .pipe(z.number().nonnegative().optional()),
}).refine(
  (data) => {
    if (data.status === 'employed' || data.status === 'self_employed') {
      return !!data.occupation;
    }
    return true;
  },
  {
    message: 'Occupation is required when employment status is employed or self-employed',
    path: ['occupation'],
  }
);

/**
 * Financial Information Schema
 */
export const FinancialInformationSchema = z.object({
  goals: z.array(FinancialGoalSchema).optional(),
  investmentExperience: InvestmentExperienceSchema.optional(),
  riskTolerance: RiskToleranceSchema.optional(),
});

/**
 * Complete Client Profile Schema
 */
export const ClientProfileSchema = z.object({
  userId: UuidSchema,
  profileType: z.string().default('personal'),
  role: ClientRoleSchema.default('client'),
  accountType: AccountTypeSchema.optional(),
  personalInformation: PersonalInformationSchema.optional(),
  contactInformation: ContactInformationSchema.optional(),
  employmentInformation: EmploymentInformationSchema.optional(),
  financialInformation: FinancialInformationSchema.optional(),
  applicationId: UuidSchema.optional(),
  application_id: UuidSchema.optional(), // Legacy support
  applicationNumber: OptionalStringSchema,
  applicationStatus: ApplicationStatusSchema.default('none'),
  adviserAssigned: z.boolean().default(false),
  createdAt: IsoDateTimeSchema.optional(),
  updatedAt: IsoDateTimeSchema.optional(),
});

// ============================================================================
// CLIENT CRUD SCHEMAS
// ============================================================================

/**
 * Create Client Schema
 */
export const CreateClientSchema = z.object({
  email: EmailSchema,
  firstName: NonEmptyStringSchema,
  lastName: NonEmptyStringSchema,
  accountType: AccountTypeSchema,
  profile: ClientProfileSchema.partial().optional(),
});

/**
 * Update Client Schema
 */
export const UpdateClientSchema = z.object({
  firstName: NonEmptyStringSchema.optional(),
  lastName: NonEmptyStringSchema.optional(),
  accountType: AccountTypeSchema.optional(),
  profile: ClientProfileSchema.partial().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: 'At least one field must be provided for update',
  }
);

/**
 * Update Client Profile Schema
 */
export const UpdateClientProfileSchema = ClientProfileSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: 'At least one field must be provided for update',
  }
);

// ============================================================================
// PROFILE ROUTES SCHEMAS
// ============================================================================

/**
 * Super Admin Profile Update Schema
 */
export const UpdateSuperAdminProfileSchema = z.object({
  firstName: NonEmptyStringSchema.optional(),
  lastName: NonEmptyStringSchema.optional(),
  phone: OptionalSaPhoneSchema,
  // Super admin fields are protected - role, accountStatus, etc. cannot be changed
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: 'At least one field must be provided for update',
  }
);

/**
 * Personal Info Query Schema
 */
export const PersonalInfoQuerySchema = z.object({
  key: NonEmptyStringSchema,
  email: EmailSchema.optional(),
});

/**
 * Personal Info Update Schema
 */
export const PersonalInfoUpdateSchema = z.object({
  key: z.string(),
  data: z.unknown(),
});

/**
 * Alternative Profile Update Schema (PUT /)
 */
export const AlternativeProfileUpdateSchema = z.object({
  userId: UuidSchema,
  firstName: NonEmptyStringSchema.optional(),
  lastName: NonEmptyStringSchema.optional(),
  surname: NonEmptyStringSchema.optional(), // Legacy support
  email: EmailSchema.optional(),
  phone: OptionalSaPhoneSchema,
  role: ClientRoleSchema.optional(),
  accountType: AccountTypeSchema.optional(),
  accountStatus: AccountStatusSchema.optional(),
  applicationStatus: ApplicationStatusSchema.optional(),
  adviserAssigned: z.boolean().optional(),
}).refine(
  (data) => {
    // Must have at least one update field besides userId
    const { userId, ...rest } = data;
    return Object.keys(rest).length > 0;
  },
  {
    message: 'At least one field must be provided for update',
  }
);

/**
 * Create Default Profile Schema
 */
export const CreateDefaultProfileSchema = z.object({
  userId: UuidSchema,
  email: EmailSchema,
  displayName: z.string().optional().default(''),
});

// ============================================================================
// SECURITY SCHEMAS
// ============================================================================

/**
 * Suspend Client Schema
 */
export const SuspendClientSchema = z.object({
  reason: z.string()
  .min(10, 'Suspension reason must be at least 10 characters')
  .max(500, 'Suspension reason cannot exceed 500 characters')
  .transform(stripHtml),
});

/**
 * Close Account Schema
 * Requires a reason for compliance audit trail.
 */
export const CloseAccountSchema = z.object({
  reason: z.string()
    .min(10, 'Closure reason must be at least 10 characters')
    .max(500, 'Closure reason cannot exceed 500 characters')
    .transform(stripHtml),
});

/**
 * Reinstate Account Schema
 * Optional note for audit trail.
 */
export const ReinstateAccountSchema = z.object({
  note: z.string()
    .max(500, 'Reinstatement note cannot exceed 500 characters')
    .transform(stripHtml)
    .optional(),
});

/**
 * Client Security Status Schema (response)
 */
export const ClientSecuritySchema = z.object({
  suspended: z.boolean(),
  suspendedAt: IsoDateTimeSchema.optional(),
  suspendedBy: UuidSchema.optional(),
  suspensionReason: OptionalStringSchema,
  twoFactorEnabled: z.boolean().default(false),
});

// ============================================================================
// QUERY & FILTER SCHEMAS
// ============================================================================

/**
 * Client List Query Schema
 */
export const ClientListQuerySchema = z.object({
  status: z.enum(['active', 'suspended', 'pending', 'approved', 'declined']).optional(),
  accountType: AccountTypeSchema.optional(),
  search: z.string()
  .optional()
  .transform((val) => val ? normalizeWhitespace(val) : val),
  limit: z.string()
  .optional()
  .transform((val) => val ? parseInt(val, 10) : 50)
  .pipe(z.number().int().min(1).max(100)),
  offset: z.string()
  .optional()
  .transform((val) => val ? parseInt(val, 10) : 0)
  .pipe(z.number().int().nonnegative()),
});

/**
 * Client Filters Schema (object-based)
 */
export const ClientFiltersSchema = z.object({
  status: z.string().optional(),
  accountType: AccountTypeSchema.optional(),
  search: OptionalStringSchema,
});

// ============================================================================
// PATH PARAMETER SCHEMAS
// ============================================================================

/**
 * Client ID Parameter
 */
export const ClientIdParamSchema = z.object({
  id: UuidSchema,
});

// ============================================================================
// ENHANCED PERSONNEL VALIDATION
// (Extends existing personnel-validation.ts)
// ============================================================================

/**
 * Enhanced Personnel Schema with additional fields
 */
export const EnhancedPersonnelSchema = z.object({
  firstName: NonEmptyStringSchema,
  lastName: NonEmptyStringSchema,
  email: EmailSchema,
  phone: OptionalSaPhoneSchema,
  role: z.enum(['super_admin', 'admin', 'adviser', 'paraplanner', 'compliance', 'viewer']),
  status: z.enum(['active', 'suspended', 'pending']).default('active'),
  commissionSplit: z.number()
  .min(0, 'Commission split cannot be negative')
  .max(1, 'Commission split cannot exceed 1')
  .optional(),
  fscaNumber: OptionalStringSchema,
  fscaStatus: z.enum(['active', 'debarred', 'pending', 'suspended']).optional(),
  department: z.enum(['operations', 'compliance', 'sales', 'support', 'management']).optional(),
  startDate: IsoDateSchema.optional(),
  dateOfBirth: IsoDateSchema.optional(),
  idNumber: OptionalSaIdNumberSchema,
});

/**
 * Update Personnel Schema
 */
export const UpdatePersonnelSchema = EnhancedPersonnelSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: 'At least one field must be provided for update',
  }
);

/**
 * Personnel Query Schema
 */
export const PersonnelQuerySchema = z.object({
  role: z.enum(['super_admin', 'admin', 'adviser', 'paraplanner', 'compliance', 'viewer']).optional(),
  status: z.enum(['active', 'suspended', 'pending']).optional(),
  department: z.enum(['operations', 'compliance', 'sales', 'support', 'management']).optional(),
  search: OptionalStringSchema,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// ============================================================================
// TYPE EXPORTS (for TypeScript inference)
// ============================================================================

export type AccountType = z.infer<typeof AccountTypeSchema>;
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
export type ClientRole = z.infer<typeof ClientRoleSchema>;
export type Gender = z.infer<typeof GenderSchema>;
export type EmploymentStatus = z.infer<typeof EmploymentStatusSchema>;
export type InvestmentExperience = z.infer<typeof InvestmentExperienceSchema>;
export type RiskTolerance = z.infer<typeof RiskToleranceSchema>;
export type FinancialGoal = z.infer<typeof FinancialGoalSchema>;

// Nested objects
export type PersonalInformation = z.infer<typeof PersonalInformationSchema>;
export type ContactInformation = z.infer<typeof ContactInformationSchema>;
export type EmploymentInformation = z.infer<typeof EmploymentInformationSchema>;
export type FinancialInformation = z.infer<typeof FinancialInformationSchema>;
export type ClientProfile = z.infer<typeof ClientProfileSchema>;

// CRUD operations
export type CreateClient = z.infer<typeof CreateClientSchema>;
export type UpdateClient = z.infer<typeof UpdateClientSchema>;
export type UpdateClientProfile = z.infer<typeof UpdateClientProfileSchema>;

// Profile routes
export type UpdateSuperAdminProfile = z.infer<typeof UpdateSuperAdminProfileSchema>;
export type PersonalInfoQuery = z.infer<typeof PersonalInfoQuerySchema>;
export type PersonalInfoUpdate = z.infer<typeof PersonalInfoUpdateSchema>;
export type AlternativeProfileUpdate = z.infer<typeof AlternativeProfileUpdateSchema>;
export type CreateDefaultProfile = z.infer<typeof CreateDefaultProfileSchema>;

// Security
export type SuspendClient = z.infer<typeof SuspendClientSchema>;
export type CloseAccount = z.infer<typeof CloseAccountSchema>;
export type ReinstateAccount = z.infer<typeof ReinstateAccountSchema>;
export type ClientSecurity = z.infer<typeof ClientSecuritySchema>;

// Queries
export type ClientListQuery = z.infer<typeof ClientListQuerySchema>;
export type ClientFilters = z.infer<typeof ClientFiltersSchema>;

// Personnel
export type EnhancedPersonnel = z.infer<typeof EnhancedPersonnelSchema>;
export type UpdatePersonnel = z.infer<typeof UpdatePersonnelSchema>;
export type PersonnelQuery = z.infer<typeof PersonnelQuerySchema>;