import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import * as service from './honeycomb-service.ts';
import type { HoneycombCheckType } from './honeycomb-types.ts';
import {
  IdvNoPhotoSchema,
  IdvWithPhotoSchema,
  BankVerificationSchema,
  ConsumerCreditSchema,
  SanctionsSearchSchema,
  BulkIdvSchema,
} from './honeycomb-validation.ts';
import { routeError } from './honeycomb-utils.ts';

const app = new Hono();
const log = createModuleLogger('honeycomb-phase1');

// ============================================================================
// PHASE 1 — IDV (Identity Verification)
// ============================================================================

app.post('/idv/no-photo', async (c) => {
  try {
    const body = await c.req.json();
    const input = IdvNoPhotoSchema.parse(body);
    const secondary = body.secondary === true;

    const result = await service.runIdvNoPhoto(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
      secondary,
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error('IDV no-photo route error:', e);
    return routeError(c, e) as Response;
  }
});

app.post('/idv/with-photo', async (c) => {
  try {
    const body = await c.req.json();
    const input = IdvWithPhotoSchema.parse(body);
    const secondary = body.secondary === true;

    const result = await service.runIdvWithPhoto(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
      input.photo,
      secondary,
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error('IDV with-photo route error:', e);
    return routeError(c, e) as Response;
  }
});

app.post('/idv/bulk', async (c) => {
  try {
    const input = BulkIdvSchema.parse(await c.req.json());

    const result = await service.runBulkIdv(input.clientId, input.persons);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error('Bulk IDV route error:', e);
    return routeError(c, e) as Response;
  }
});

// ============================================================================
// PHASE 1 — BANK ACCOUNT VERIFICATION
// ============================================================================

app.post('/financial/bank-verify', async (c) => {
  try {
    const input = BankVerificationSchema.parse(await c.req.json());

    const result = await service.runBankVerification(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
      input.bankName,
      input.accountNumber,
      input.branchCode,
      input.accountType,
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error('Bank verification route error:', e);
    return routeError(c, e) as Response;
  }
});

// ============================================================================
// PHASE 1 — CONSUMER CREDIT CHECK
// ============================================================================

app.post('/financial/credit-check', async (c) => {
  try {
    const input = ConsumerCreditSchema.parse(await c.req.json());

    const result = await service.runConsumerCredit(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error('Credit check route error:', e);
    return routeError(c, e) as Response;
  }
});

// ============================================================================
// PHASE 1 — SANCTIONS SEARCH
// ============================================================================

app.post('/sanctions/search', async (c) => {
  try {
    const input = SanctionsSearchSchema.parse(await c.req.json());

    const result = await service.searchSanctions(
      input.clientId,
      input.name || '',
      input.surname || '',
      input.identityNumber,
      input.uniqueId,
      input.source,
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({
      success: true,
      data: result.data,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error('Sanctions search route error:', e);
    return routeError(c, e) as Response;
  }
});

// ============================================================================
// CHECK HISTORY
// ============================================================================

app.get('/checks/history/:clientId', async (c) => {
  try {
    const clientId = c.req.param('clientId')!;
    const history = await service.getAllCheckHistory(clientId);
    return c.json({ success: true, history });
  } catch (e: unknown) {
    log.error('Check history error:', e);
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

app.get('/checks/history/:clientId/:checkType', async (c) => {
  try {
    const clientId = c.req.param('clientId')!;
    const checkType = c.req.param('checkType')!;
    const history = await service.getCheckHistory(clientId, checkType as HoneycombCheckType);
    return c.json({ success: true, history });
  } catch (e: unknown) {
    log.error('Check type history error:', e);
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

export default app;
