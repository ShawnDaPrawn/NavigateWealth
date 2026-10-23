/**
 * Portfolio table — the provider/product book, for the admin panel and for an
 * outside agent on a schedule.
 *
 *   GET  /integrations/portfolio-table/providers  — every provider, its products, policy counts
 *   GET  /integrations/portfolio-table            — the table for ?providerId=&categoryId=
 *   GET  /integrations/portfolio-table/download   — the same table as an .xlsx workbook
 *   GET  /integrations/portfolio-table/print      — a signed link to one policy's PDF print
 *   POST /integrations/portfolio-table            — apply rows (JSON), matched by client + policy number
 *   POST /integrations/portfolio-table/upload     — apply or preview an uploaded workbook
 *
 * TWO KINDS OF CALLER, ONE SURFACE
 * --------------------------------
 * The Portfolio tab and an integrating agent do exactly the same things here,
 * so they share the routes. The gate accepts, in order: the dedicated token
 * against an env var (development only), an agent's own token (the production
 * path for a bot), the shared cron token, and finally an admin session (the
 * browser).
 *
 * WHO WROTE IT
 * ------------
 * Each agent has its own token, and the token decides the actor recorded on a
 * write (`agent:grok`); a `submittedBy` in the body cannot change it. The
 * tokens are issued and revoked through `/integrations/portfolio-agents`,
 * which only a super admin reaches — never with an agent token.
 *
 * The env branch is honoured ONLY when DENO_ENV is 'development', which is set
 * nowhere in deployment, so in production it can never act as a second
 * credential. Its writes are recorded as `agent:development`, a name no real
 * agent can be issued.
 *
 * Kept in its own router, mounted ahead of `/integrations`, so the machine
 * gate cannot leak onto the client-scoped policy routes next door and so this
 * surface stays a small, documented contract rather than the whole
 * integrations family.
 */

import { Hono, type Context, type Next } from 'npm:hono';
import { requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { constantTimeEqual } from './crypto-utils.ts';
import { isAuthorizedCronRequest } from './cron-auth.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { validateBody, body } from './validate.ts';
import { identifyPortfolioAgent } from './integrations-portfolio-table-auth.ts';
import { PORTFOLIO_TOKEN_HEADER } from '../../../shared/integrations/portfolio-table.ts';
import { MAX_INTEGRATION_UPLOAD_BYTES } from './integrations-spreadsheet.ts';
import {
  PolicyPrintQuerySchema,
  PortfolioApplySchema,
  PortfolioQuerySchema,
  PortfolioUploadFieldsSchema,
} from './integrations-portfolio-table-validation.ts';
import {
  applyPortfolioRows,
  buildPortfolioWorkbook,
  createPolicyPrintDownload,
  listPortfolioCatalogue,
  loadPortfolioBook,
  parsePortfolioSpreadsheet,
  tableFromBook,
} from './integrations-portfolio-table-service.ts';

const app = new Hono();
const log = createModuleLogger('integrations-portfolio-table-routes');

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * The env override, honoured only under DENO_ENV=development.
 *
 * Kept out of the gate body so `constantTimeEqual` stays inside the
 * route-auth detector's scan window of `app.use(`.
 */
/** The actor the development-only override records; reserved, so never issued. */
const DEVELOPMENT_AGENT = 'development';

const developmentOverrideToken = (): string =>
  Deno.env.get('DENO_ENV') === 'development'
    ? (Deno.env.get('NW_PORTFOLIO_TABLE_TOKEN') || '').trim()
    : '';

app.use('*', async (c: Context, next: Next) => {
  const dedicated = (c.req.header(PORTFOLIO_TOKEN_HEADER) || '').trim();
  const expected = developmentOverrideToken();
  if (expected !== '' && dedicated !== '' && constantTimeEqual(dedicated, expected)) {
    c.set('portfolioAgent', DEVELOPMENT_AGENT);
    return next();
  }
  const agent = dedicated === '' ? null : await identifyPortfolioAgent(dedicated);
  if (agent) {
    c.set('portfolioAgent', agent);
    return next();
  }
  if (await isAuthorizedCronRequest(c)) {
    c.set('portfolioScheduled', true);
    return next();
  }
  return requireAdmin(c, next);
});

/**
 * Who is writing. An agent is named by its token, never by the body: that is
 * what makes the recorded actor authenticated. A scheduled job shares one cron
 * credential, so its self-declared name is all there is; the admin is the
 * signed-in user.
 */
function actorOf(c: Context, submittedBy?: string): string {
  const agent = c.get('portfolioAgent') as string | undefined;
  if (agent) return `agent:${agent}`;
  if (c.get('portfolioScheduled')) {
    const name = (submittedBy || '').trim();
    return name ? `scheduled:${name}` : 'scheduled';
  }
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

function readScope(c: Context) {
  return PortfolioQuerySchema.safeParse({
    providerId: c.req.query('providerId') ?? undefined,
    categoryId: c.req.query('categoryId') ?? undefined,
  });
}

app.get(
  '/providers',
  asyncHandler(async (c) => {
    return c.json({ success: true, providers: await listPortfolioCatalogue() });
  }),
);

app.get(
  '/',
  asyncHandler(async (c) => {
    const scope = readScope(c);
    if (!scope.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(scope.error) }, 400);
    }
    const book = await loadPortfolioBook(scope.data.providerId, scope.data.categoryId);
    if (!book) return c.json({ error: 'Invalid provider ID' }, 400);
    return c.json({ success: true, table: tableFromBook(book) });
  }),
);

app.get(
  '/download',
  asyncHandler(async (c) => {
    const scope = readScope(c);
    if (!scope.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(scope.error) }, 400);
    }
    const book = await loadPortfolioBook(scope.data.providerId, scope.data.categoryId);
    if (!book) return c.json({ error: 'Invalid provider ID' }, 400);
    const { bytes, fileName } = buildPortfolioWorkbook(tableFromBook(book), book.bindings);
    return new Response(bytes, {
      headers: {
        'Content-Type': XLSX_CONTENT_TYPE,
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  }),
);

app.get(
  '/print',
  asyncHandler(async (c) => {
    const parsed = PolicyPrintQuerySchema.safeParse({
      policyId: c.req.query('policyId') ?? undefined,
      clientId: c.req.query('clientId') ?? undefined,
    });
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const result = await createPolicyPrintDownload(parsed.data.clientId, parsed.data.policyId);
    if (result.status === 'no_policy') return c.json({ error: 'Policy not found' }, 404);
    if (result.status === 'no_document') {
      return c.json({ error: 'No policy print on record for this policy' }, 404);
    }
    if (result.status === 'storage_error') {
      return c.json({ error: 'Failed to generate download URL' }, 500);
    }
    return c.json({ success: true, url: result.url, document: result.document });
  }),
);

app.post(
  '/',
  validateBody(PortfolioApplySchema),
  asyncHandler(async (c) => {
    const input = body(c, PortfolioApplySchema);
    const actor = actorOf(c, input.submittedBy);
    const report = await applyPortfolioRows({
      providerId: input.providerId,
      categoryId: input.categoryId,
      rows: input.rows.map((row) => ({
        ...(row.rowNumber !== undefined ? { rowNumber: row.rowNumber } : {}),
        ...(row.clientName !== undefined ? { clientName: row.clientName } : {}),
        ...(row.policyNumber !== undefined ? { policyNumber: row.policyNumber } : {}),
        ...(row.policyId ? { policyId: row.policyId } : {}),
        ...(row.clientId ? { clientId: row.clientId } : {}),
        values: row.values,
      })),
      dryRun: input.dryRun,
      source: 'api',
      actor,
    });
    if (!report) return c.json({ error: 'Invalid provider ID' }, 400);
    log.info('Portfolio rows received', {
      providerId: input.providerId,
      categoryId: input.categoryId,
      actor,
      dryRun: input.dryRun,
      rows: input.rows.length,
      updated: report.summary.updated,
    });
    return c.json(report);
  }),
);

app.post(
  '/upload',
  asyncHandler(async (c) => {
    const form = await c.req.formData().catch(() => null);
    if (!form) {
      return c.json(
        { error: 'Send multipart/form-data with a "file" field and providerId/categoryId.' },
        400,
      );
    }
    const file = form.get('file');
    if (!isUploadedFile(file)) return c.json({ error: 'No file uploaded' }, 400);

    const fields = PortfolioUploadFieldsSchema.safeParse({
      providerId: form.get('providerId') ?? undefined,
      categoryId: form.get('categoryId') ?? undefined,
      mode: form.get('mode') ?? undefined,
      submittedBy: form.get('submittedBy') ?? undefined,
    });
    if (!fields.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(fields.error) }, 400);
    }
    if (file.size > MAX_INTEGRATION_UPLOAD_BYTES) {
      return c.json(
        { error: 'Spreadsheet is too large. Please upload a file smaller than 5 MB.' },
        400,
      );
    }

    const book = await loadPortfolioBook(fields.data.providerId, fields.data.categoryId);
    if (!book) return c.json({ error: 'Invalid provider ID' }, 400);

    let parsed;
    try {
      parsed = parsePortfolioSpreadsheet(await file.arrayBuffer(), book);
    } catch (error) {
      return c.json({ error: getErrMsg(error) }, 400);
    }
    if (parsed.rows.length === 0) {
      return c.json({ error: 'The spreadsheet has no policy rows to apply' }, 400);
    }

    const actor = actorOf(c, fields.data.submittedBy);
    const report = await applyPortfolioRows({
      providerId: fields.data.providerId,
      categoryId: fields.data.categoryId,
      rows: parsed.rows,
      dryRun: fields.data.mode !== 'apply',
      source: 'spreadsheet',
      actor,
      fileName: file.name || 'portfolio.xlsx',
      sheetWarnings: parsed.warnings,
      book,
    });
    if (!report) return c.json({ error: 'Invalid provider ID' }, 400);
    log.info('Portfolio spreadsheet received', {
      providerId: fields.data.providerId,
      categoryId: fields.data.categoryId,
      actor,
      mode: fields.data.mode,
      rows: parsed.rows.length,
      updated: report.summary.updated,
    });
    return c.json(report);
  }),
);

export default app;
