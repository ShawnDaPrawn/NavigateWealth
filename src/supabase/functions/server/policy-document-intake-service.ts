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
 *
 * An agent that can make an HTTPS request hands the PDF over with
 * `uploadPolicyDocument` instead: the file arrives whole, is staged and
 * submitted through the same SQL functions, and is stored in the same request
 * when nothing else holds the client. A PDF too large for one SQL statement no
 * longer has to be cut into pieces by the agent.
 */
import { encodeBase64 } from 'jsr:@std/encoding/base64';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { replacePolicyDocumentForPolicy } from './integrations-document-storage.ts';
import {
  claimNextIntake,
  completeIntake,
  discardStagedParts,
  failIntake,
  findIntake,
  IntakeRejectedError,
  stageIntakePart,
  submitStagedIntake,
  type ClaimedIntake,
  type IntakeDocumentType,
  type IntakeStatus,
} from './repositories/policy-document-intake-repository.ts';

const log = createModuleLogger('policy-document-intake');

/** Rows one wake-up stores at most. The rest wait for the next. */
export const INTAKE_ROWS_PER_RUN = 3;

/** No new row is claimed once a run has taken this long. */
export const INTAKE_RUN_BUDGET_MS = 40_000;

/** Longest error recorded on a row, matching the column the SQL side trims to. */
const MAX_ERROR_LENGTH = 1000;

/** The largest PDF a hand-over may carry: the SQL side's limit, and Storage's. */
export const MAX_INTAKE_PDF_BYTES = 20 * 1024 * 1024;

/**
 * Bytes of PDF per staged part. 750,000 bytes encode to exactly 1,000,000
 * base64 characters, the most `put_part` takes, and being a multiple of 3 no
 * part but the last carries `=` padding, so the parts join into valid base64.
 */
export const INTAKE_PART_BYTES = 750_000;

/** How long an upload waits for its PDF to be stored before answering 202. */
export const UPLOAD_WAIT_MS = 20_000;

/** How often an upload looks at its hand-over while it waits. */
const UPLOAD_POLL_MS = 1_000;

/** Where a PDF's `%%EOF` must be: Acrobat looks for it in the last 1 KB. */
const PDF_TAIL_BYTES = 1024;

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const PDF_EOF = [0x25, 0x25, 0x45, 0x4f, 0x46]; // %%EOF

export const INCOMPLETE_PDF_MESSAGE =
  'The PDF is incomplete: it has no %%EOF in its last 1 KB, so it was cut short. Hand the whole file over again under a new key.';

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return bytes.length >= prefix.length && prefix.every((byte, i) => bytes[i] === byte);
}

/** True when `%%EOF` appears in the last 1 KB, as it does at the end of a whole PDF. */
export function endsLikeWholePdf(bytes: Uint8Array): boolean {
  const from = Math.max(0, bytes.length - PDF_TAIL_BYTES);
  for (let i = bytes.length - PDF_EOF.length; i >= from; i--) {
    if (PDF_EOF.every((byte, j) => bytes[i + j] === byte)) return true;
  }
  return false;
}

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
  // A PDF that starts right but stops short is pieces of a file, not a file:
  // never put it on a policy. (One that does not start right fails below, in
  // the same check the app's upload makes.)
  if (startsWith(bytes, PDF_HEADER) && !endsLikeWholePdf(bytes)) {
    throw new Error(INCOMPLETE_PDF_MESSAGE);
  }
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

/** A PDF handed over in one HTTPS request. */
export interface PolicyDocumentUpload {
  clientId: string;
  policyId: string;
  documentType: IntakeDocumentType;
  fileName: string;
  bytes: Uint8Array;
  /** Makes a retry safe: a key already submitted returns that hand-over. */
  idempotencyKey?: string;
  /** Who is handing it over, as recorded on the document (`intake:<this>`). */
  submittedBy: string;
}

export interface PolicyDocumentUploadResult {
  idempotencyKey: string;
  intakeId: string;
  /** True when the key had been submitted before: nothing new was queued. */
  existed: boolean;
  status: IntakeStatus;
  storageKey: string | null;
  error: string | null;
}

/**
 * Check what can be checked before anything is queued. The SQL side checks
 * the header and size again, and the worker the ending, so these only make a
 * bad file fail in the caller's own request.
 */
function assertWholePdf(bytes: Uint8Array): void {
  if (bytes.length === 0) throw new IntakeRejectedError('The file is empty');
  if (bytes.length > MAX_INTAKE_PDF_BYTES) {
    throw new IntakeRejectedError('The PDF is larger than 20 MB');
  }
  if (!startsWith(bytes, PDF_HEADER)) {
    throw new IntakeRejectedError('The file is not a PDF: it does not start with %PDF-');
  }
  if (!endsLikeWholePdf(bytes)) throw new IntakeRejectedError(INCOMPLETE_PDF_MESSAGE);
}

/**
 * Hand a PDF over to the intake in one request, and store it if it can be.
 *
 * The file is staged in parts under its key (after clearing anything an
 * earlier attempt left there), submitted through the same SQL function an
 * agent calls, and then this request runs the worker itself, so the PDF is
 * normally stored and on the policy by the time it answers. When another
 * hand-over for the same client is being stored, it waits up to
 * `UPLOAD_WAIT_MS` and then reports where its own one stands; the worker
 * finishes it either way.
 */
export async function uploadPolicyDocument(
  input: PolicyDocumentUpload,
  options: { waitMs?: number; sleep?: (ms: number) => Promise<void>; now?: () => number } = {},
): Promise<PolicyDocumentUploadResult> {
  const waitMs = options.waitMs ?? UPLOAD_WAIT_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise((done) => setTimeout(done, ms)));
  const now = options.now ?? Date.now;

  assertWholePdf(input.bytes);
  const idempotencyKey = input.idempotencyKey ?? `upload:${crypto.randomUUID()}`;

  const earlier = await findIntake(idempotencyKey);
  if (earlier) {
    return {
      idempotencyKey,
      intakeId: earlier.id,
      existed: true,
      status: earlier.status,
      storageKey: earlier.storage_key,
      error: earlier.error,
    };
  }

  await discardStagedParts(idempotencyKey);
  for (let seq = 0; seq * INTAKE_PART_BYTES < input.bytes.length; seq++) {
    const part = input.bytes.subarray(seq * INTAKE_PART_BYTES, (seq + 1) * INTAKE_PART_BYTES);
    await stageIntakePart(idempotencyKey, seq, encodeBase64(part));
  }
  const submitted = await submitStagedIntake({
    clientId: input.clientId,
    policyId: input.policyId,
    documentType: input.documentType,
    fileName: input.fileName,
    idempotencyKey,
    submittedBy: input.submittedBy,
  });

  // Store it now rather than waiting for the wake-up submit sent. The claim
  // keeps this safe beside the worker that wake-up starts: one takes the row.
  try {
    await processPolicyDocumentIntake();
  } catch (error) {
    log.warn('Upload could not run the worker; the wake-up or sweep will store it', {
      idempotencyKey,
      error: getErrMsg(error),
    });
  }

  const startedAt = now();
  let latest = await findIntake(idempotencyKey);
  while (
    latest &&
    (latest.status === 'pending' || latest.status === 'processing') &&
    now() - startedAt < waitMs
  ) {
    await sleep(UPLOAD_POLL_MS);
    latest = await findIntake(idempotencyKey);
  }

  return {
    idempotencyKey,
    intakeId: submitted.id,
    existed: submitted.existed,
    status: latest?.status ?? submitted.status,
    storageKey: latest?.storage_key ?? null,
    error: latest?.error ?? null,
  };
}
