/**
 * GoAML morning-digest routes.
 *
 * The Edge Function does not scrape goAML. A scheduled Cursor Automation
 * signs in (Outlook OTP), scans the portal, and POSTs the result here.
 * This router persists the snapshot and sends the transactional digest.
 *
 *   GET  /goaml-digest/latest   — last snapshot (for the next-day diff)
 *   GET  /goaml-digest/status   — last send metadata
 *   POST /goaml-digest/notify   — accept a scan and mail the digest
 *
 * Auth: dedicated NW_GOAML_DIGEST_TOKEN (x-nw-goaml-digest-token) or the
 * shared cron token / service-role fallback from cron-auth.ts.
 */

import { Hono } from 'npm:hono';
import { asyncHandler } from './error.middleware.ts';
import { constantTimeEqual } from './crypto-utils.ts';
import { isAuthorizedCronRequest } from './cron-auth.ts';
import { createModuleLogger } from './stderr-logger.ts';
import {
  GOAML_DIGEST_TOKEN_HEADER,
  GOAML_HOME_URL,
  GOAML_LOGIN_URL,
} from './goaml-digest-types.ts';
import { GoamlNotifySchema, stripForbiddenKeys } from './goaml-digest-validation.ts';
import {
  getLastSent,
  getLatestSnapshot,
  processGoamlNotify,
  toPublicSnapshot,
} from './goaml-digest-service.ts';
import type { GoamlScanReport } from './goaml-digest-types.ts';

const app = new Hono();
const log = createModuleLogger('goaml-digest-routes');

app.use('*', async (c, next) => {
  const dedicated = (c.req.header(GOAML_DIGEST_TOKEN_HEADER) || '').trim();
  const expected = (Deno.env.get('NW_GOAML_DIGEST_TOKEN') || '').trim();
  if (expected !== '' && dedicated !== '' && constantTimeEqual(dedicated, expected)) {
    return next();
  }
  if (await isAuthorizedCronRequest(c)) return next();
  return c.json(
    { error: 'Unauthorized — GoAML digest auth required', code: 'GOAML_DIGEST_AUTH_REQUIRED' },
    401,
  );
});

app.get(
  '/latest',
  asyncHandler(async (c) => {
    const latest = await getLatestSnapshot();
    return c.json({ success: true, snapshot: toPublicSnapshot(latest) });
  }),
);

app.get(
  '/status',
  asyncHandler(async (c) => {
    const [latest, lastSent] = await Promise.all([getLatestSnapshot(), getLastSent()]);
    return c.json({
      success: true,
      loginUrl: GOAML_LOGIN_URL,
      homeUrl: GOAML_HOME_URL,
      latest: toPublicSnapshot(latest),
      lastSent: toPublicSnapshot(lastSent),
    });
  }),
);

app.post(
  '/notify',
  asyncHandler(async (c) => {
    const raw = stripForbiddenKeys(await c.req.json().catch(() => ({})));
    const parsed = GoamlNotifySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Invalid GoAML scan payload', issues: parsed.error.flatten() },
        400,
      );
    }

    const body = parsed.data;
    const report: GoamlScanReport = {
      scannedAt: body.scannedAt || new Date().toISOString(),
      sourceUrl: body.sourceUrl || GOAML_HOME_URL,
      loginSucceeded: body.loginSucceeded,
      otpRequired: body.otpRequired,
      otpSucceeded: body.otpSucceeded,
      updates: body.updates,
      notes: body.notes,
      rawExcerpt: body.rawExcerpt,
      dryRun: body.dryRun,
      force: body.force,
    };

    log.info('GoAML notify received', {
      loginSucceeded: report.loginSucceeded,
      updateCount: report.updates.length,
      dryRun: report.dryRun,
    });

    const result = await processGoamlNotify(report);
    return c.json(result);
  }),
);

export default app;
