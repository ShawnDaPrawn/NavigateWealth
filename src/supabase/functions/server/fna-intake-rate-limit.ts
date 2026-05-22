/**
 * Per-user rate limiting for FNA intake mutations.
 */

import * as kv from './kv_store.tsx';
import { intakeRateLimited } from './fna-intake-errors.ts';

const ONE_HOUR_MS = 60 * 60 * 1000;
const DRAFT_LIMIT = 60;
const SUBMIT_LIMIT = 5;

async function checkLimit(key: string, limit: number): Promise<void> {
  const now = Date.now();
  const rateData = (await kv.get(key)) as { timestamps?: number[] } | null;
  const recent = (rateData?.timestamps ?? []).filter((t) => now - t < ONE_HOUR_MS);

  if (recent.length >= limit) {
    throw intakeRateLimited();
  }

  await kv.set(key, { timestamps: [...recent, now] });
}

export async function assertIntakeDraftRateLimit(userId: string): Promise<void> {
  await checkLimit(`rate_limit:fna-intake:draft:${userId}`, DRAFT_LIMIT);
}

export async function assertIntakeSubmitRateLimit(userId: string): Promise<void> {
  await checkLimit(`rate_limit:fna-intake:submit:${userId}`, SUBMIT_LIMIT);
}
