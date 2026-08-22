/**
 * Runtime contract parsing (Stage A / F8).
 *
 * `src/shared/types/` already declares the client↔server shapes as the "single
 * source of truth" — but TypeScript types are erased at runtime, so nothing
 * checks that the server actually sent what the type promises. `api.get<T>()`
 * is caller-asserted: `<T>` is a claim the compiler cannot keep. When the
 * server changes a field, the SPA does not fail loudly at the boundary; it
 * fails three components deep as an `undefined`, and often only in production.
 *
 * This module adds the missing runtime half.
 *
 * REPORT-ONLY BY DESIGN
 * ---------------------
 * `parseContract` NEVER throws and never alters the payload it returns. A
 * mismatch is reported and the original data passes through untouched. That is
 * deliberate: bolting throwing validation onto a live system whose real
 * response shapes cannot be verified from a dev machine would turn a cosmetic
 * drift into a production outage. This is the CSP `report-only` posture — watch
 * first, enforce once the reports are quiet.
 *
 * To enforce later, switch call sites to `parseContractStrict`.
 */
import type { ZodType } from 'zod';

/** Where a violation happened, for the report. */
export interface ContractContext {
  /** e.g. 'GET /clients/:id' — identifies the endpoint, not the payload. */
  endpoint: string;
}

export type ContractViolationReporter = (report: { endpoint: string; issues: string }) => void;

/**
 * Default reporter: a console warning. Kept dependency-free on purpose —
 * `src/shared` is imported BY `src/utils`, so reaching back into the app's
 * telemetry from here would invert the dependency direction the boundary rules
 * enforce. Callers that want richer reporting inject their own.
 */
const defaultReporter: ContractViolationReporter = ({ endpoint, issues }) => {
  console.warn(`[contract] response from ${endpoint} did not match its schema: ${issues}`);
};

let reporter: ContractViolationReporter = defaultReporter;

/** Wire app-level telemetry (e.g. the runtime issue reporter) into contracts. */
export function setContractViolationReporter(next: ContractViolationReporter): void {
  reporter = next;
}

/** Restore the console reporter. Intended for tests. */
export function resetContractViolationReporter(): void {
  reporter = defaultReporter;
}

/**
 * Validate `data` against `schema`, REPORT-ONLY.
 *
 * Returns the parsed value on success, and the ORIGINAL value unchanged on
 * failure — so adopting this can never change behaviour, only add signal.
 */
export function parseContract<T>(schema: ZodType<T>, data: unknown, context: ContractContext): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const issues = result.error.issues
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
  reporter({ endpoint: context.endpoint, issues });
  return data as T;
}

/**
 * Throwing variant. Use only where a malformed payload is genuinely
 * unrecoverable and failing fast beats rendering wrong data.
 */
export function parseContractStrict<T>(
  schema: ZodType<T>,
  data: unknown,
  context: ContractContext,
): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issues = result.error.issues
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
  throw new Error(`Contract violation from ${context.endpoint}: ${issues}`);
}
