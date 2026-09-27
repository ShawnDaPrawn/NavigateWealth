/**
 * Documents Module Validation Schemas
 *
 * P1 — Zod validation for documents.tsx
 */

import { z } from 'npm:zod';

export const CreateDocumentLinkSchema = z.object({
  title: z.string().min(1, 'Document title is required').max(300),
  // http(s) only. The admin panel opens a stored link with window.open, so a
  // `javascript:` URL here would run in whichever staff session clicked it.
  url: z
    .string()
    .min(1, 'URL is required')
    .max(2000)
    .refine((u) => /^https?:\/\//i.test(u.trim()), 'Link must start with http:// or https://'),
  description: z.string().max(2000).optional().default(''),
  productCategory: z.string().max(100).optional().default('General'),
  policyNumber: z.string().max(100).optional().default(''),
  uploadedBy: z.string().optional(),
});

export const UpdateDocumentSchema = z
  .object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(2000).optional(),
    productCategory: z.string().max(100).optional(),
    policyNumber: z.string().max(100).optional(),
    isFavourite: z.boolean().optional(),
    status: z.enum(['new', 'reviewed', 'archived']).optional(),
  })
  // Unknown keys are STRIPPED, never stored. This was `.passthrough()`, and the
  // handler spreads the result over the stored record — so a client could
  // rewrite `filePath`, `sourceSystem` or `url` on their own document and
  // point the download or delete at another client's file.
  .strip();

/** What a client may change on their own document: nothing but their own view of it. */
export const ClientUpdateDocumentSchema = UpdateDocumentSchema.pick({
  isFavourite: true,
  status: true,
});

export const EmailDocumentSchema = z
  .object({
    documentIds: z.array(z.string().min(1)).min(1, 'At least one document ID is required'),
    recipientEmail: z.string().email('Valid recipient email is required'),
    recipientName: z.string().max(200).optional(),
    subject: z.string().min(1).max(500).optional(),
    message: z.string().max(5000).optional(),
    password: z.string().min(4).max(100).optional(),
  })
  .passthrough();
