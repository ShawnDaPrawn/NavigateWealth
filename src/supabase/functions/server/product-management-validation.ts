/**
 * Product Management Validation Schemas
 *
 * P1 — Zod validation for product-management-routes.ts
 */

import { z } from 'npm:zod';

export const CreateProviderSchema = z.object({
  name: z.string().min(1, 'Provider name is required').max(200),
  code: z.string().max(50).optional(),
  type: z.string().max(100).optional(),
  status: z.enum(['active', 'inactive', 'pending']).default('active'),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(20).optional(),
  website: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
}).passthrough();

export const UpdateProviderSchema = CreateProviderSchema.partial();

export const CreateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  providerId: z.string().min(1, 'Provider ID is required'),
  category: z.string().max(100).optional(),
  type: z.string().max(100).optional(),
  status: z.enum(['active', 'inactive', 'draft']).default('active'),
  description: z.string().max(5000).optional(),
  fees: z.record(z.unknown()).optional(),
}).passthrough();

export const UpdateProductSchema = CreateProductSchema.partial();

export const CreateIntegrationSchema = z.object({
  providerId: z.string().min(1, 'Provider ID is required'),
  categoryId: z.string().optional(),
  type: z.string().max(100).optional(),
  config: z.record(z.unknown()).optional(),
}).passthrough();
