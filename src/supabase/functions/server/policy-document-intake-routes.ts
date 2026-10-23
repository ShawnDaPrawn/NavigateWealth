/**
 * Policy document intake — the agent's upload and the worker's door.
 *
 *   POST /policy-document-intake/upload  — hand a PDF over as a file, and store it
 *   POST /policy-document-intake/process — store whatever hand-overs are due
 *
 * UPLOAD. An agent with no Navigate Wealth login attaches a policy's PDF here,
 * as multipart/form-data: the PDF in `file`, with `clientId`, `policyId`,
 * `documentType` (default `policy_schedule`) and an `idempotencyKey` that
 * makes a retry safe. The file is handed over through the same SQL functions
 * an agent calls with `public.policy_document_intake_submit`, so it is checked
 * and queued the same way, and then stored in the same request: the answer is
 * 200 with the storage key once the PDF is on the policy, 202 while another
 * hand-over for that client is still being stored (the worker finishes it),
 * 422 when storing it failed for good, and 400 when the file or the fields
 * were refused. A PDF too large for one SQL statement no longer has to be cut
 * into pieces by the agent. See docs/runbooks/policy-document-intake.md.
 *
 * Who may upload, in order: an agent's own token in `x-nw-portfolio-token`
 * (the same token as the portfolio table; the document records
 * `intake:agent:<name>`, and a `submittedBy` field cannot change it), the
 * shared cron token (`intake:scheduled:<submittedBy>`), or an admin session.
 *
 * PROCESS. Called by `public.policy_document_intake_kick()` — from submit, and
 * from the every-2-minute pg_cron sweep — with the shared cron token, and an
 * admin can call it to run the queue by hand. Running it with nothing due does
 * nothing. An agent's token does not open it.
 *
 * Kept in its own router so neither gate leaks onto the policy routes, where
 * the app's own upload (`/integrations/policy-documents/upload`) keeps
 * requiring a signed-in user.
 */
import { Hono, type Context } from 'npm:hono';
import { requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { isAuthorizedCronRequest } from './cron-auth.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { identifyPortfolioAgent } from './integrations-portfolio-table-auth.ts';
import { PORTFOLIO_TOKEN_HEADER } from '../../../shared/integrations/portfolio-table.ts';
import {
  MAX_INTAKE_PDF_BYTES,
  processPolicyDocumentIntake,
  uploadPolicyDocument,
} from './policy-document-intake-service.ts';
import { IntakeRejectedError } from './repositories/policy-document-intake-repository.ts';
import { PolicyDocumentUploadFieldsSchema } from './policy-document-intake-validation.ts';

const app = new Hono();

/**
 * An agent's own token, then the cron token. Either marks the request with who
 * is calling; false sends the caller on to the admin check.
 */
async function machineCaller(c: Context): Promise<boolean> {
  const token = (c.req.header(PORTFOLIO_TOKEN_HEADER) || '').trim();
  const agent = token === '' ? null : await identifyPortfolioAgent(token);
  if (agent) {
    c.set('intakeAgent', agent);
    return true;
  }
  if (await isAuthorizedCronRequest(c)) {
    c.set('intakeScheduled', true);
    return true;
  }
  return false;
}

app.use('/upload', async (c, next) => {
  if (!(await machineCaller(c))) return requireAdmin(c, next);
  return next();
});

app.use('/process', async (c, next) => {
  if (await isAuthorizedCronRequest(c)) return next();
  return requireAdmin(c, next);
});

/**
 * Who is handing the PDF over. An agent is named by its token, never by the
 * form: that is what makes the recorded name authenticated. A caller on the
 * shared cron token can only label itself; an admin is the signed-in user.
 */
function submitterOf(c: Context, label?: string): string {
  const agent = c.get('intakeAgent') as string | undefined;
  if (agent) return `agent:${agent}`;
  if (c.get('intakeScheduled')) return label ? `scheduled:${label}` : 'scheduled';
  const userId = c.get('userId') as string | undefined;
  return userId ? `admin:${userId}` : 'admin';
}

const isUploadedFile = (value: unknown): value is File =>
  value instanceof File ||
  (typeof value === 'object' &&
    value !== null &&
    typeof (value as File).arrayBuffer === 'function' &&
    typeof (value as File).name === 'string' &&
    typeof (value as File).size === 'number');

/** A text field as sent, or undefined when it is missing or blank. */
const field = (form: Record<string, unknown>, name: string): string | undefined => {
  const value = form[name];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
};

app.post(
  '/upload',
  asyncHandler(async (c) => {
    let form: Record<string, string | File>;
    try {
      form = await c.req.parseBody();
    } catch {
      return c.json({ error: 'Send multipart/form-data with the PDF in a "file" field' }, 400);
    }
    const file = form['file'];
    if (!isUploadedFile(file)) {
      return c.json({ error: 'No file provided: send the PDF in a "file" field' }, 400);
    }
    const fields = PolicyDocumentUploadFieldsSchema.safeParse({
      clientId: field(form, 'clientId'),
      policyId: field(form, 'policyId'),
      documentType: field(form, 'documentType'),
      idempotencyKey: field(form, 'idempotencyKey'),
      submittedBy: field(form, 'submittedBy'),
    });
    if (!fields.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(fields.error) }, 400);
    }
    if (file.size > MAX_INTAKE_PDF_BYTES) {
      return c.json({ error: 'The PDF is larger than 20 MB' }, 413);
    }

    const { clientId, policyId, documentType, idempotencyKey, submittedBy } = fields.data;
    try {
      const result = await uploadPolicyDocument({
        clientId,
        policyId,
        documentType,
        fileName: file.name.trim() || `${documentType}.pdf`,
        bytes: new Uint8Array(await file.arrayBuffer()),
        idempotencyKey,
        submittedBy: submitterOf(c, submittedBy),
      });
      const status = result.status === 'processed' ? 200 : result.status === 'failed' ? 422 : 202;
      return c.json({ success: result.status !== 'failed', ...result }, status);
    } catch (error) {
      if (error instanceof IntakeRejectedError) return c.json({ error: error.message }, 400);
      throw error;
    }
  }),
);

app.post(
  '/process',
  asyncHandler(async (c) => {
    const result = await processPolicyDocumentIntake();
    return c.json({ success: true, ...result });
  }),
);

export default app;
