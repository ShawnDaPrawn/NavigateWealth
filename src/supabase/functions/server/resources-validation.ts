/**
 * Resources Module Validation Schemas
 *
 * P1 — Zod validation for resources-routes.ts
 */

import { z } from 'npm:zod';

export const CreateResourceSchema = z.object({
  title: z.string().min(1, 'Resource title is required').max(300),
  type: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
  url: z.string().max(1000).optional(),
  content: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
  tags: z.array(z.string().max(50)).max(20).optional(),
}).passthrough();

export const UpdateResourceSchema = CreateResourceSchema.partial();

export const RetirementScenarioSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  scenario: z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(200),
    currentAge: z.number().int().min(18).max(100).optional(),
    retirementAge: z.number().int().min(40).max(100).optional(),
    currentSavings: z.number().nonnegative().optional(),
    monthlyContribution: z.number().nonnegative().optional(),
    expectedReturn: z.number().min(0).max(100).optional(),
    inflationRate: z.number().min(0).max(100).optional(),
  }).passthrough(),
});

export const UpsertLegalDocumentDraftSchema = z.object({
  versionNumber: z.string().min(1, 'Version number is required').max(50),
  effectiveDate: z.string().max(100).nullable().optional(),
  changeSummary: z.string().max(2000).nullable().optional(),
  sourceHtml: z.string().max(250_000, 'Legal document content is too large'),
  pdfConfig: z.object({
    pageSize: z.enum(['A4', 'A3']).default('A4'),
    orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  }).optional(),
});
