/**
 * Honeycomb Integration — Input Validation (Zod Schemas)
 *
 * All request bodies are validated here before reaching the service layer.
 * Per Guidelines §4.2: validation schemas are defined separately
 * and applied in route handlers.
 */

import { z } from "npm:zod";

// ============================================================================
// SHARED FIELD SCHEMAS
// ============================================================================

const clientIdField = z.string().min(1, "clientId is required");
const firstNameField = z.string().min(1, "firstName is required");
const lastNameField = z.string().min(1, "lastName is required");

/**
 * ID number — optional but must be a real value if provided.
 * Sentinel values (n/a, null, etc.) are normalised to empty string by the service.
 */
const idNumberField = z.string().nullable().optional();
const passportField = z.string().nullable().optional();

// ============================================================================
// REGISTRATION
// ============================================================================

export const RegisterClientSchema = z.object({
  clientId: clientIdField,
  firstName: firstNameField,
  lastName: lastNameField,
  idNumber: idNumberField,
  passport: passportField,
  email: z.string().email().optional(),
  profile_id_number: z.string().nullable().optional(),
});
export type RegisterClientInput = z.infer<typeof RegisterClientSchema>;

// ============================================================================
// IDV (Identity Verification)
// ============================================================================

export const IdvNoPhotoSchema = z.object({
  clientId: clientIdField,
  firstName: firstNameField,
  lastName: lastNameField,
  idNumber: idNumberField,
  passport: passportField,
});
export type IdvNoPhotoInput = z.infer<typeof IdvNoPhotoSchema>;

export const IdvWithPhotoSchema = IdvNoPhotoSchema.extend({
  photo: z.string().min(1, "Base64 photo data is required"),
});
export type IdvWithPhotoInput = z.infer<typeof IdvWithPhotoSchema>;

// ============================================================================
// BANK ACCOUNT VERIFICATION
// ============================================================================

export const BankVerificationSchema = z.object({
  clientId: clientIdField,
  firstName: firstNameField,
  lastName: lastNameField,
  idNumber: idNumberField,
  passport: passportField,
  bankName: z.string().min(1, "Bank name is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  branchCode: z.string().min(1, "Branch code is required"),
  accountType: z.string().default("savings"),
});
export type BankVerificationInput = z.infer<typeof BankVerificationSchema>;

// ============================================================================
// CONSUMER CREDIT CHECK
// ============================================================================

export const ConsumerCreditSchema = z.object({
  clientId: clientIdField,
  firstName: firstNameField,
  lastName: lastNameField,
  idNumber: idNumberField,
  passport: passportField,
  consentGiven: z.boolean().refine(val => val === true, {
    message: "Client consent is required before running a credit check",
  }),
});
export type ConsumerCreditInput = z.infer<typeof ConsumerCreditSchema>;

// ============================================================================
// CONSUMER TRACE
// ============================================================================

export const ConsumerTraceSchema = z.object({
  clientId: clientIdField,
  firstName: firstNameField,
  lastName: lastNameField,
  idNumber: idNumberField,
  passport: passportField,
});
export type ConsumerTraceInput = z.infer<typeof ConsumerTraceSchema>;

// ============================================================================
// DEBT REVIEW ENQUIRY
// ============================================================================

export const DebtReviewSchema = z.object({
  clientId: clientIdField,
  firstName: firstNameField,
  lastName: lastNameField,
  idNumber: idNumberField,
  passport: passportField,
});
export type DebtReviewInput = z.infer<typeof DebtReviewSchema>;

// ============================================================================
// SANCTIONS SEARCH
// ============================================================================

export const SanctionsSearchSchema = z.object({
  clientId: clientIdField,
  name: z.string().optional(),
  surname: z.string().optional(),
  identityNumber: z.string().optional(),
  uniqueId: z.string().optional(),
  source: z.string().optional(),
});
export type SanctionsSearchInput = z.infer<typeof SanctionsSearchSchema>;

// ============================================================================
// ENFORCEMENT ACTIONS SEARCH
// ============================================================================

export const EnforcementActionsSchema = z.object({
  clientId: clientIdField,
  name: z.string().optional(),
  surname: z.string().optional(),
  identityNumber: z.string().optional(),
  uniqueId: z.string().optional(),
});
export type EnforcementActionsInput = z.infer<typeof EnforcementActionsSchema>;

// ============================================================================
// LEGAL A LISTING SEARCH
// ============================================================================

export const LegalAListingSchema = z.object({
  clientId: clientIdField,
  name: z.string().optional(),
  surname: z.string().optional(),
  identityNumber: z.string().optional(),
  uniqueId: z.string().optional(),
});
export type LegalAListingInput = z.infer<typeof LegalAListingSchema>;

// ============================================================================
// CIPC COMPANY SEARCH
// ============================================================================

export const CipcSchema = z.object({
  clientId: clientIdField,
  firstName: firstNameField,
  lastName: lastNameField,
  idNumber: idNumberField,
  passport: passportField,
});
export type CipcInput = z.infer<typeof CipcSchema>;

// ============================================================================
// DIRECTOR ENQUIRY
// ============================================================================

export const DirectorEnquirySchema = z.object({
  clientId: clientIdField,
  firstName: firstNameField,
  lastName: lastNameField,
  idNumber: idNumberField,
  passport: passportField,
});
export type DirectorEnquiryInput = z.infer<typeof DirectorEnquirySchema>;

// ============================================================================
// BEST KNOWN ADDRESS
// ============================================================================

export const BestKnownAddressSchema = z.object({
  clientId: clientIdField,
  firstName: firstNameField,
  lastName: lastNameField,
  idNumber: idNumberField,
  passport: passportField,
});
export type BestKnownAddressInput = z.infer<typeof BestKnownAddressSchema>;

// ============================================================================
// CUSTOM SCREENING
// ============================================================================

export const CustomScreeningSchema = z.object({
  clientId: clientIdField,
  firstName: firstNameField,
  lastName: lastNameField,
  idNumber: idNumberField,
  passport: passportField,
  packageId: z.string().optional(),
  screeningPackage: z.string().optional(),
});
export type CustomScreeningInput = z.infer<typeof CustomScreeningSchema>;

// ============================================================================
// ASSESSMENT (existing, now formalised)
// ============================================================================

export const AssessmentRunSchema = z.object({
  clientId: clientIdField,
  assessmentId: z.number({ required_error: "assessmentId (dueDiligenceAssessmentsId) is required" }),
  assessmentName: z.string().optional(),
  firstName: firstNameField,
  lastName: lastNameField,
  idNumber: idNumberField,
  passport: passportField,
  submission: z.string().optional(),
});
export type AssessmentRunInput = z.infer<typeof AssessmentRunSchema>;

// ============================================================================
// GENERIC MATTER REQUEST (for endpoints that only need the standard person body)
// ============================================================================

export const NaturalPersonCheckSchema = z.object({
  clientId: clientIdField,
  firstName: firstNameField,
  lastName: lastNameField,
  idNumber: idNumberField,
  passport: passportField,
});
export type NaturalPersonCheckInput = z.infer<typeof NaturalPersonCheckSchema>;

// ============================================================================
// PROXY
// ============================================================================

export const ProxySchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  path: z.string().min(1, "API path is required"),
  body: z.unknown().optional(),
});
export type ProxyInput = z.infer<typeof ProxySchema>;

// ============================================================================
// BULK IDV (Phase 4)
// ============================================================================

export const BulkIdvPersonSchema = z.object({
  firstName: z.string().min(1, "firstName is required"),
  lastName: z.string().min(1, "lastName is required"),
  idNumber: z.string().min(1, "SA ID number is required"),
});

export const BulkIdvSchema = z.object({
  clientId: clientIdField,
  persons: z.array(BulkIdvPersonSchema).min(1, "At least one person is required").max(50, "Maximum 50 persons per batch"),
});
export type BulkIdvInput = z.infer<typeof BulkIdvSchema>;