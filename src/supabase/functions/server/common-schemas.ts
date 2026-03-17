/**
 * Common Validation Schemas
 * 
 * Reusable Zod schemas for standard data types used across all modules.
 * These schemas provide consistent validation patterns and can be composed
 * into larger module-specific schemas.
 * 
 * Phase 3 - Increment 3.1
 */

import { z } from 'npm:zod';
import {
  EMAIL_REGEX,
  SA_PHONE_REGEX,
  INTERNATIONAL_PHONE_REGEX,
  UUID_REGEX,
  ISO_DATE_REGEX,
  URL_REGEX,
  NAME_REGEX,
  SA_ID_NUMBER_REGEX,
  isValidSAIdNumber,
  pastDateRefinement,
  futureDateRefinement,
  dateRangeRefinement,
  strongPasswordRefinement,
  noPathTraversalRefinement,
  sanitizeEmail,
  sanitizePhone,
  normalizeWhitespace,
} from './validation-utils.ts';

// ============================================================================
// PRIMITIVE SCHEMAS
// ============================================================================

/**
 * UUID validation (for IDs in path params and request bodies)
 */
export const UuidSchema = z.string().regex(UUID_REGEX, {
  message: 'Must be a valid UUID',
});

/**
 * Non-empty string with trimming
 */
export const NonEmptyStringSchema = z.string()
  .min(1, 'Field is required')
  .transform(normalizeWhitespace);

/**
 * Optional string with trimming
 */
export const OptionalStringSchema = z.string()
  .optional()
  .transform((val) => val ? normalizeWhitespace(val) : val);

/**
 * Positive integer
 */
export const PositiveIntSchema = z.number().int().positive({
  message: 'Must be a positive integer',
});

/**
 * Non-negative integer (includes 0)
 */
export const NonNegativeIntSchema = z.number().int().nonnegative({
  message: 'Must be zero or positive',
});

/**
 * Positive number (allows decimals)
 */
export const PositiveNumberSchema = z.number().positive({
  message: 'Must be a positive number',
});

/**
 * Percentage (0-100)
 */
export const PercentageSchema = z.number()
  .min(0, 'Percentage must be at least 0')
  .max(100, 'Percentage cannot exceed 100');

/**
 * Decimal percentage (0-1)
 */
export const DecimalPercentageSchema = z.number()
  .min(0, 'Value must be at least 0')
  .max(1, 'Value cannot exceed 1');

// ============================================================================
// DATE & TIME SCHEMAS
// ============================================================================

/**
 * ISO Date string (YYYY-MM-DD)
 */
export const IsoDateSchema = z.string().regex(ISO_DATE_REGEX, {
  message: 'Date must be in YYYY-MM-DD format',
});

/**
 * ISO DateTime string
 */
export const IsoDateTimeSchema = z.string().datetime({
  message: 'Must be a valid ISO 8601 datetime',
});

/**
 * Date that must be in the past
 */
export const PastDateSchema = z.string()
  .datetime()
  .refine(pastDateRefinement, {
    message: 'Date must be in the past',
  });

/**
 * Date that must be in the future
 */
export const FutureDateSchema = z.string()
  .datetime()
  .refine(futureDateRefinement, {
    message: 'Date must be in the future',
  });

/**
 * Date range validation
 */
export const DateRangeSchema = z.object({
  startDate: IsoDateTimeSchema,
  endDate: IsoDateTimeSchema,
}).refine(dateRangeRefinement, {
  message: 'Start date must be before end date',
});

// ============================================================================
// CONTACT INFORMATION SCHEMAS
// ============================================================================

/**
 * Email with validation and sanitization
 */
export const EmailSchema = z.string()
  .min(1, 'Email is required')
  .regex(EMAIL_REGEX, 'Invalid email format')
  .transform(sanitizeEmail);

/**
 * Optional email
 */
export const OptionalEmailSchema = z.string()
  .regex(EMAIL_REGEX, 'Invalid email format')
  .transform(sanitizeEmail)
  .optional();

/**
 * South African phone number
 */
export const SaPhoneSchema = z.string()
  .transform(sanitizePhone)
  .refine(
    (val) => SA_PHONE_REGEX.test(val),
    { message: 'Invalid South African phone number. Use format: +27XXXXXXXXX or 0XXXXXXXXX' }
  );

/**
 * Optional South African phone number
 */
export const OptionalSaPhoneSchema = z.string()
  .transform(sanitizePhone)
  .refine(
    (val) => !val || SA_PHONE_REGEX.test(val),
    { message: 'Invalid South African phone number' }
  )
  .optional();

/**
 * International phone number (E.164 format)
 */
export const InternationalPhoneSchema = z.string()
  .transform(sanitizePhone)
  .refine(
    (val) => INTERNATIONAL_PHONE_REGEX.test(val),
    { message: 'Invalid international phone number. Use E.164 format: +[country][number]' }
  );

/**
 * URL validation
 */
export const UrlSchema = z.string().regex(URL_REGEX, {
  message: 'Invalid URL format. Must start with http:// or https://',
});

/**
 * Optional URL
 */
export const OptionalUrlSchema = z.string()
  .regex(URL_REGEX, 'Invalid URL format')
  .optional();

// ============================================================================
// IDENTITY SCHEMAS
// ============================================================================

/**
 * South African ID Number with validation
 */
export const SaIdNumberSchema = z.string()
  .regex(SA_ID_NUMBER_REGEX, 'ID number must be 13 digits')
  .refine(isValidSAIdNumber, {
    message: 'Invalid ID number (failed checksum validation)',
  });

/**
 * Optional SA ID Number
 */
export const OptionalSaIdNumberSchema = z.string()
  .regex(SA_ID_NUMBER_REGEX, 'ID number must be 13 digits')
  .refine((val) => !val || isValidSAIdNumber(val), {
    message: 'Invalid ID number',
  })
  .optional();

/**
 * Name field (letters, spaces, hyphens, apostrophes)
 */
export const NameSchema = z.string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name cannot exceed 100 characters')
  .regex(NAME_REGEX, "Name can only contain letters, spaces, hyphens, and apostrophes")
  .transform(normalizeWhitespace);

/**
 * Optional name
 */
export const OptionalNameSchema = z.string()
  .max(100, 'Name cannot exceed 100 characters')
  .regex(NAME_REGEX, "Name can only contain letters, spaces, hyphens, and apostrophes")
  .transform(normalizeWhitespace)
  .optional();

// ============================================================================
// FINANCIAL SCHEMAS
// ============================================================================

/**
 * Currency amount (in cents to avoid floating point issues)
 */
export const CurrencySchema = z.number()
  .nonnegative('Amount cannot be negative')
  .int('Amount must be in cents (no decimals)')
  .max(999999999999, 'Amount exceeds maximum value'); // ~10 billion in cents = 100 million in currency

/**
 * Currency amount (in decimal format - for display/input)
 */
export const DecimalCurrencySchema = z.number()
  .nonnegative('Amount cannot be negative')
  .max(100000000, 'Amount exceeds maximum value'); // 100 million

/**
 * Optional currency
 */
export const OptionalCurrencySchema = z.number()
  .nonnegative('Amount cannot be negative')
  .optional();

/**
 * Commission split (0-100%)
 */
export const CommissionSplitSchema = z.number()
  .min(0, 'Commission split cannot be negative')
  .max(100, 'Commission split cannot exceed 100%');

/**
 * Commission split as decimal (0-1)
 */
export const DecimalCommissionSplitSchema = z.number()
  .min(0, 'Commission split cannot be negative')
  .max(1, 'Commission split cannot exceed 1');

// ============================================================================
// PAGINATION & FILTERING SCHEMAS
// ============================================================================

/**
 * Pagination parameters
 */
export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

/**
 * Pagination with optional search
 */
export const SearchPaginationSchema = PaginationSchema.extend({
  search: z.string().optional(),
});

/**
 * Sort order
 */
export const SortOrderSchema = z.enum(['asc', 'desc']).default('asc');

/**
 * Generic sort parameters
 */
export const SortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: SortOrderSchema,
});

/**
 * Combined pagination + sort + search
 */
export const ListQuerySchema = PaginationSchema
  .merge(SortSchema)
  .extend({
    search: z.string().optional(),
  });

// ============================================================================
// AUTHENTICATION SCHEMAS
// ============================================================================

/**
 * Password with strength validation
 */
export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password cannot exceed 128 characters')
  .refine(strongPasswordRefinement, {
    message: 'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character',
  });

/**
 * Simple password (for login - no strength check)
 */
export const LoginPasswordSchema = z.string()
  .min(1, 'Password is required');

// ============================================================================
// STATUS & ENUM SCHEMAS
// ============================================================================

/**
 * Generic active/inactive status
 */
export const ActiveStatusSchema = z.enum(['active', 'inactive']);

/**
 * Generic status with pending
 */
export const StatusSchema = z.enum(['active', 'inactive', 'pending', 'suspended']);

/**
 * User roles
 */
export const UserRoleSchema = z.enum([
  'super_admin',
  'admin',
  'adviser',
  'paraplanner',
  'compliance',
  'viewer',
]);

/**
 * FSCA Status
 */
export const FscaStatusSchema = z.enum(['active', 'debarred', 'pending', 'suspended']);

/**
 * Document verification status
 */
export const VerificationStatusSchema = z.enum([
  'pending',
  'verified',
  'rejected',
  'expired',
]);

/**
 * Application status
 */
export const ApplicationStatusSchema = z.enum([
  'draft',
  'submitted',
  'in_review',
  'approved',
  'declined',
  'cancelled',
]);

/**
 * Communication channel
 */
export const CommunicationChannelSchema = z.enum([
  'email',
  'sms',
  'whatsapp',
  'call',
  'in_person',
]);

// ============================================================================
// FILE & UPLOAD SCHEMAS
// ============================================================================

/**
 * File extension whitelist
 */
export const AllowedFileExtensionSchema = z.enum([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'csv',
]);

/**
 * File path (with path traversal protection)
 */
export const SafeFilePathSchema = z.string()
  .min(1, 'File path is required')
  .refine(noPathTraversalRefinement, {
    message: 'File path contains invalid characters',
  });

/**
 * File metadata
 */
export const FileMetadataSchema = z.object({
  filename: z.string().min(1),
  size: z.number().int().positive().max(50 * 1024 * 1024), // Max 50MB
  mimeType: z.string().min(1),
  extension: AllowedFileExtensionSchema,
});

// ============================================================================
// LOCATION SCHEMAS
// ============================================================================

/**
 * South African postal code (4 digits)
 */
export const SaPostalCodeSchema = z.string().regex(/^[0-9]{4}$/, {
  message: 'Postal code must be 4 digits',
});

/**
 * South African province
 */
export const SaProvinceSchema = z.enum([
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
]);

/**
 * Address schema
 */
export const AddressSchema = z.object({
  street: NonEmptyStringSchema,
  suburb: OptionalStringSchema,
  city: NonEmptyStringSchema,
  province: SaProvinceSchema.optional(),
  postalCode: SaPostalCodeSchema,
  country: z.string().default('South Africa'),
});

// ============================================================================
// METADATA SCHEMAS
// ============================================================================

/**
 * Created/Updated timestamps
 */
export const TimestampsSchema = z.object({
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

/**
 * Soft delete metadata
 */
export const SoftDeleteSchema = z.object({
  deletedAt: IsoDateTimeSchema.optional(),
  deletedBy: UuidSchema.optional(),
});

/**
 * Audit trail
 */
export const AuditSchema = z.object({
  createdBy: UuidSchema,
  updatedBy: UuidSchema,
}).merge(TimestampsSchema);

// ============================================================================
// UTILITY SCHEMAS
// ============================================================================

/**
 * Success response wrapper
 */
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  message: z.string().optional(),
});

/**
 * Error response wrapper
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

/**
 * Boolean string conversion (for query params)
 */
export const BooleanStringSchema = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((val) => val === 'true'),
]);

/**
 * Number string conversion (for query params)
 */
export const NumberStringSchema = z.union([
  z.number(),
  z.string().transform((val) => parseInt(val, 10)),
]).pipe(z.number());

/**
 * Array of UUIDs
 */
export const UuidArraySchema = z.array(UuidSchema);

/**
 * Generic ID parameter (path param)
 */
export const IdParamSchema = z.object({
  id: UuidSchema,
});