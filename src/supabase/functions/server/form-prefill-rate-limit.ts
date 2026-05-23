/**
 * Rate limits for form prefill API mutations.
 */

import * as kv from './kv_store.tsx';
import { intakeRateLimited } from './fna-intake-errors.ts';

const ONE_HOUR_MS = 60 * 60 * 1000;
const RESOLVE_LIMIT = 120;
const TEMPLATE_UPLOAD_LIMIT = 20;

async function checkLimit(key: string, limit: number): Promise<void> {
  const now = Date.now();
  const rateData = (await kv.get(key)) as { timestamps?: number[] } | null;
  const recent = (rateData?.timestamps ?? []).filter((t) => now - t < ONE_HOUR_MS);

  if (recent.length >= limit) {
    throw intakeRateLimited('Form prefill rate limit exceeded. Please wait before retrying.');
  }

  await kv.set(key, { timestamps: [...recent, now] });
}

export async function assertPrefillResolveRateLimit(userId: string): Promise<void> {
  await checkLimit(`rate_limit:form-prefill:resolve:${userId}`, RESOLVE_LIMIT);
}

export async function assertTemplateUploadRateLimit(userId: string): Promise<void> {
  await checkLimit(`rate_limit:form-prefill:template-upload:${userId}`, TEMPLATE_UPLOAD_LIMIT);
}
