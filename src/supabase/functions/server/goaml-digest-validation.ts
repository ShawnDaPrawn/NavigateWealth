import { z } from 'npm:zod';
import {
  MAX_EXCERPT,
  MAX_NOTES,
  MAX_SUMMARY,
  MAX_TITLE,
  MAX_UPDATES,
} from './goaml-digest-types.ts';

/**
 * Keys the automation (or a mistaken curl) must never persist or mail.
 * Matched case-insensitively on the JSON property name.
 */
const FORBIDDEN_KEY =
  /^(password|passwd|pwd|otp|one.?time.?password|secret|token|credential|username|user.?name|p12|ssn)$/i;

export function stripForbiddenKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripForbiddenKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEY.test(key)) continue;
      out[key] = stripForbiddenKeys(entry);
    }
    return out;
  }
  return value;
}

export const GoamlUpdateSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE),
  summary: z.string().trim().max(MAX_SUMMARY).optional().default(''),
  href: z.string().trim().max(500).optional(),
  area: z.string().trim().max(80).optional(),
  severity: z.enum(['info', 'attention', 'urgent']).optional().default('info'),
  observedAt: z.string().max(40).optional(),
});

export const GoamlNotifySchema = z.object({
  scannedAt: z.string().max(40).optional(),
  sourceUrl: z.string().trim().max(500).optional(),
  loginSucceeded: z.boolean(),
  otpRequired: z.boolean().optional().default(false),
  otpSucceeded: z.boolean().optional(),
  updates: z.array(GoamlUpdateSchema).max(MAX_UPDATES).optional().default([]),
  notes: z.string().trim().max(MAX_NOTES).optional(),
  rawExcerpt: z.string().trim().max(MAX_EXCERPT).optional(),
  dryRun: z.boolean().optional().default(false),
  force: z.boolean().optional().default(false),
});
