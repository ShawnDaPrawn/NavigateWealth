/**
 * Compliance Module Validation Schemas
 *
 * P1 — Zod validation for compliance-routes.ts
 */

import { z } from 'npm:zod';

export const CreateFAISRecordSchema = z.object({
  adviserId: z.string().min(1, 'Adviser ID is required'),
  clientId: z.string().optional(),
  type: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
}).passthrough();

export const AMLCheckSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
});

export const POPIAConsentSchema = z.object({
  consentType: z.string().max(100).optional(),
  consentGiven: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
}).passthrough();

export const DebarmentCheckSchema = z.object({
  adviserId: z.string().min(1, 'Adviser ID is required'),
  name: z.string().min(1, 'Name is required').max(200),
  idNumber: z.string().max(13).optional(),
});

export const DocumentsInsuranceRecordSchema = z.object({
  type: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  description: z.string().max(2000).optional(),
  expiryDate: z.string().optional(),
}).passthrough();
