/**
 * Honeycomb integration — Authenticated calls to the Honeycomb API, and the ID handling around them.
 *
 * One slice of what used to be all 1,613 lines of `honeycomb-service.ts`.
 * That file still re-exports the whole public surface, because all five
 * honeycomb route files reach it as `import * as service`.
 *
 * The logger keeps the channel name `honeycomb-service` on purpose: splitting
 * the file should not rename anything in the logs.
 */
import { createModuleLogger } from './stderr-logger.ts';
import type { HoneycombNaturalPersonRequest } from './honeycomb-types.ts';

const log = createModuleLogger('honeycomb-service');

const HONEYCOMB_API_URL = 'https://publicapi.honeycombonline.co.za';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** Sentinel values that indicate "no real ID number" */
const INVALID_ID_SENTINELS = ['not provided', 'n/a', 'undefined', 'null', 'none', '-', ''];

// ============================================================================
// HELPERS
// ============================================================================

/** Check if a string is a real identification value (not a sentinel/placeholder) */
export function isRealIdNumber(val: unknown): val is string {
  return (
    typeof val === 'string' &&
    val.trim().length > 0 &&
    !INVALID_ID_SENTINELS.includes(val.trim().toLowerCase())
  );
}

/** Check if a value is a valid UUID / non-nil ID */
function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length > 0 && id !== NIL_UUID;
}

/** Get authenticated headers for Honeycomb API */
function getHeaders(): Record<string, string> {
  const apiKey = Deno.env.get('HONEYCOMB_API_KEY');
  if (!apiKey) {
    throw new Error('HONEYCOMB_API_KEY is not configured');
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'NavigateWealth-Admin/1.0',
  };
}

/**
 * Extract a usable ID from various Honeycomb response shapes.
 * The API returns different key names depending on the endpoint.
 */
export function extractId(data: Record<string, unknown>): string | null {
  // 1. Top-level keys
  const topLevelKeys = [
    'Id',
    'ClientId',
    'ReferenceId',
    'id',
    'PersonId',
    'NaturalPersonId',
    'naturalPersonId',
    'reference',
  ];
  for (const key of topLevelKeys) {
    if (isValidId(data[key])) return data[key] as string;
  }

  // 2. Nested objects
  const nestedPaths = ['naturalPerson', 'entity', 'client', 'result', 'data'];
  for (const path of nestedPaths) {
    const nested = data[path] as Record<string, unknown> | undefined;
    if (nested && isValidId(nested.id)) return nested.id as string;
  }

  // 3. Fallback: search for any key containing "id"
  const probableKey = Object.keys(data).find(
    (k) =>
      (k.toLowerCase().includes('id') && !k.toLowerCase().includes('valid')) ||
      k.toLowerCase() === 'code',
  );
  if (probableKey && isValidId(data[probableKey])) {
    log.info(`Found probable ID in key: ${probableKey}`);
    return data[probableKey] as string;
  }

  return null;
}

/**
 * Centralised HTTP caller with rate-limit retry (429 backoff).
 * All Honeycomb API calls go through this function.
 */
export async function callHoneycomb(
  method: string,
  path: string,
  body?: unknown,
  maxRetries = 3,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null; raw?: string }> {
  const url = `${HONEYCOMB_API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = getHeaders();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      log.info(`Honeycomb ${method} ${url} (attempt ${attempt + 1})`);

      const fetchOpts: RequestInit = {
        method,
        headers,
      };
      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        fetchOpts.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOpts);

      // Handle rate limiting with exponential backoff
      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(1000 * Math.pow(2, attempt), 30000);
        log.warn(`Rate limited (429). Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Parse response
      const rawText = await response.text();
      let data: Record<string, unknown> | null;
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }

      return { ok: response.ok, status: response.status, data, raw: rawText };
    } catch (err) {
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt);
        log.warn(`Network error, retrying in ${delay}ms:`, { error: (err as Error).message });
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  // Unreachable, but satisfies TS
  throw new Error('Max retries exhausted');
}

/** Build the standard natural-person payload from normalised inputs */
export function buildPersonPayload(
  clientId: string,
  firstName: string,
  lastName: string,
  idNumber: string | null,
  passport: string | null,
): HoneycombNaturalPersonRequest {
  return {
    uniqueId: clientId,
    firstName,
    surname: lastName,
    identityNumber: isRealIdNumber(idNumber) ? idNumber : '',
    passport: isRealIdNumber(passport) ? passport : '',
  };
}

/** Require at least one form of identification */
export function requireIdentification(idNumber: string | null, passport: string | null): void {
  if (!isRealIdNumber(idNumber) && !isRealIdNumber(passport)) {
    throw new Error(
      'Client has no valid ID number or passport. ' +
        'Please update their profile before running this check.',
    );
  }
}
