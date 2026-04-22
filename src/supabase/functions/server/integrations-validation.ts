/**
 * Integrations Module Validation Schemas
 *
 * P1 — Zod validation for integrations.tsx
 * Validates config, schema, and policy mutation inputs.
 */

import { z } from 'npm:zod';

// --- Config ---

export const SaveConfigSchema = z.object({
  providerId: z.string().min(1, 'Provider ID is required'),
  categoryId: z.string().min(1, 'Category ID is required'),
  fieldMapping: z.record(z.string(), z.unknown()),
  fieldBindings: z.array(z.object({
    targetFieldId: z.string().min(1),
    targetFieldName: z.string().optional(),
    columnName: z.string().min(1),
    required: z.boolean().optional(),
    fieldType: z.string().optional(),
    portalLabels: z.array(z.string()).optional(),
    portalSelector: z.string().optional(),
    blankBehavior: z.enum(['ignore', 'clear', 'error']).optional(),
    transform: z.string().optional(),
  }).passthrough()).optional(),
  settings: z.record(z.string(), z.unknown()),
});

// --- Schema ---

export const SaveSchemaInputSchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  fields: z.array(z.object({
    key: z.string().min(1),
    label: z.string().optional(),
    type: z.string().optional(),
  }).passthrough()).min(1, 'At least one field is required'),
});

// --- Policies ---

export const CreatePolicySchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  categoryId: z.string().min(1, 'Category ID is required'),
  providerId: z.string().min(1, 'Provider ID is required'),
  providerName: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});

export const UpdatePolicySchema = z.object({
  id: z.string().min(1, 'Policy ID is required'),
  clientId: z.string().min(1, 'Client ID is required'),
  categoryId: z.string().optional(),
  providerId: z.string().optional(),
  providerName: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const ArchivePolicySchema = z.object({
  id: z.string().min(1, 'Policy ID is required'),
  clientId: z.string().min(1, 'Client ID is required'),
  reason: z.string().min(1, 'Archive reason is required').max(2000),
});

export const ReinstatePolicySchema = z.object({
  id: z.string().min(1, 'Policy ID is required'),
  clientId: z.string().min(1, 'Client ID is required'),
});

export const RecalculateTotalsSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
});

// --- Policy Documents ---

export const ALLOWED_DOCUMENT_TYPES = [
  'policy_schedule',
  'amendment',
  'statement',
  'benefit_summary',
  'other',
] as const;

export const PolicyDocumentMetadataSchema = z.object({
  policyId: z.string().min(1, 'Policy ID is required'),
  clientId: z.string().min(1, 'Client ID is required'),
  documentType: z.enum(ALLOWED_DOCUMENT_TYPES).default('policy_schedule'),
  uploadedBy: z.string().min(1, 'Uploader ID is required'),
});

export const DeletePolicyDocumentSchema = z.object({
  policyId: z.string().min(1, 'Policy ID is required'),
  clientId: z.string().min(1, 'Client ID is required'),
});
