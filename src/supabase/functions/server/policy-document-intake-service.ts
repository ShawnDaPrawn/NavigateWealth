/**
 * Policy document intake — storing a PDF an agent handed over through SQL.
 *
 * An agent with no Navigate Wealth login (the update bot, through the Supabase
 * connector) cannot use the app's upload route, and SQL cannot write to
 * Storage. So it hands the PDF over with `public.policy_document_intake_submit`
 * and this worker does the upload, through the same
 * `replacePolicyDocumentForPolicy` the app's route and the portal worker use:
 * the PDF lands at `{clientId}/{policyId}/{documentType}.pdf` in the
 * policy-documents bucket, replacing what was there, and `policy.document`
 * records it. See docs/runbooks/policy-document-intake.md.
 *
 * Rows are claimed one at a time (each one carries up to 20 MB of base64), up
 * to `INTAKE_ROWS_PER_RUN` per call and within `INTAKE_RUN_BUDGET_MS`, so a
 * wake-up never outlives the pg_net request that started it by much. What is
 * left over is picked up by the next wake-up or the 2-minute sweep. A failed
 * attempt is handed back to SQL, which retries it twice and then marks it
 * failed with this error.
 */
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { replacePolicyDocumentForPolicy } from './integrations-document-storage.ts';
import {
  claimNextIntake,
  completeIntake,
  failIntake,
  type ClaimedIntake,
} from './repositories/policy-document-intake-repository.ts';

const log = createModuleLogger('policy-document-intake');

/** Rows one wake-up stores at most. The rest wait for the next. */
export const INTAKE_ROWS_PER_RUN = 3;

/** No new row is claimed once a run has taken this long. */
export const INTAKE_RUN_BUDGET_MS = 40_000;

/** Longest error recorded on a row, matching the column the SQL side trims to. */
const MAX_ERROR_LENGTH = 1000;

export interface IntakeRunOutcome {
  id: string;
  clientId: string;
  policyId: string;
  /** `pending` = it will be retried; `lost` = another worker had taken the row over. */
  status: 'processed' | 'pending' | 'failed' | 'lost';
  storageKey?: string;
  error?: string;
}

export interface IntakeRunResult {
  claimed: number;
  processed: number;
  retrying: number;
  failed: number;
  outcomes: IntakeRunOutcome[];
}

/**
 * The PDF's bytes. The SQL side stores standard, padded base64, so this is a
 * plain `atob`; it throws on anything else, which fails the attempt. The
 * return type is left to inference so it stays an ArrayBuffer-backed view,
 * which is what `File` accepts.
 */
export function decodeIntakePdf(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Store one claimed hand-over and set `policy.document`. Throws on any failure. */
async function storeIntake(claim: ClaimedIntake) {
  if (!claim.pdf_base64) {
    throw new Error('The hand-over holds no PDF');
  }
  const bytes = decodeIntakePdf(claim.pdf_base64);
  const file = new File([bytes], claim.file_name, { type: 'application/pdf' });
  return replacePolicyDocumentForPolicy({
    clientId: claim.client_id,
    policyId: claim.policy_id,
    file,
    documentType: claim.document_type,
    uploadedBy: `intake:${claim.submitted_by}`,
    stableStorageKey: true,
    fileName: claim.file_name,
  });
}

/** Store what is due, up to the per-run limits. */
export async function processPolicyDocumentIntake(
  options: { maxRows?: number; budgetMs?: number; now?: () => number } = {},
): Promise<IntakeRunResult> {
  const maxRows = options.maxRows ?? INTAKE_ROWS_PER_RUN;
  const budgetMs = options.budgetMs ?? INTAKE_RUN_BUDGET_MS;
  const now = options.now ?? Date.now;
  const startedAt = now();
  const result: IntakeRunResult = {
    claimed: 0,
    processed: 0,
    retrying: 0,
    failed: 0,
    outcomes: [],
  };

  while (result.claimed < maxRows && now() - startedAt < budgetMs) {
    const claim = await claimNextIntake();
    if (!claim) break;
    result.claimed++;
    const outcome: IntakeRunOutcome = {
      id: claim.id,
      clientId: claim.client_id,
      policyId: claim.policy_id,
      status: 'processed',
    };

    try {
      const document = await storeIntake(claim);
      outcome.storageKey = document.storageKey;
      const recorded = await completeIntake(claim, {
        storageKey: document.storageKey,
        fileSize: document.fileSize,
      });
      if (recorded) {
        result.processed++;
        log.info('Policy document stored from intake', {
          intakeId: claim.id,
          policyId: claim.policy_id,
          storageKey: document.storageKey,
          submittedBy: claim.submitted_by,
        });
      } else {
        // The document is stored either way; another worker owns the row now.
        outcome.status = 'lost';
        log.warn('Intake claim was taken over before it completed', { intakeId: claim.id });
      }
    } catch (error) {
      const message = getErrMsg(error).slice(0, MAX_ERROR_LENGTH);
      outcome.error = message;
      const status = await failIntake(claim, message);
      outcome.status = status ?? 'lost';
      if (status === 'failed') result.failed++;
      else if (status === 'pending') result.retrying++;
      log.error('Intake attempt failed', {
        intakeId: claim.id,
        policyId: claim.policy_id,
        attempt: claim.attempts,
        status: outcome.status,
        message,
      });
    }
    result.outcomes.push(outcome);
  }

  return result;
}
