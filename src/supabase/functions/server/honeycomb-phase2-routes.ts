import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import * as service from './honeycomb-service.ts';
import {
  NaturalPersonCheckSchema,
  CustomScreeningSchema,
  EnforcementActionsSchema,
  LegalAListingSchema,
} from './honeycomb-validation.ts';
import { routeError } from './honeycomb-utils.ts';

const app = new Hono();
const log = createModuleLogger('honeycomb-phase2');

// ============================================================================
// PHASE 2 — FINANCIAL INTELLIGENCE (POST matter-creation)
// ============================================================================

app.post('/financial/consumer-trace', async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runConsumerTrace(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error('Consumer trace route error:', e);
    return routeError(c, e) as Response;
  }
});

app.post('/financial/debt-review', async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runDebtReviewEnquiry(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error('Debt review route error:', e);
    return routeError(c, e) as Response;
  }
});

// ============================================================================
// PHASE 2 — CORPORATE & GOVERNANCE (POST matter-creation)
// ============================================================================

app.post('/corporate/cipc', async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runCipcSearch(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error('CIPC route error:', e);
    return routeError(c, e) as Response;
  }
});

app.post('/corporate/director-enquiry', async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runDirectorEnquiry(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error('Director enquiry route error:', e);
    return routeError(c, e) as Response;
  }
});

// ============================================================================
// PHASE 2 — ADDRESS & SCREENING (POST/GET)
// ============================================================================

app.post('/address/best-known', async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runBestKnownAddress(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error('Best known address route error:', e);
    return routeError(c, e) as Response;
  }
});

app.post('/screening/custom', async (c) => {
  try {
    const input = CustomScreeningSchema.parse(await c.req.json());
    const result = await service.runCustomScreening(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
      input.packageId,
      input.screeningPackage,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error('Custom screening route error:', e);
    return routeError(c, e) as Response;
  }
});

app.post('/sanctions/enforcement-actions', async (c) => {
  try {
    const input = EnforcementActionsSchema.parse(await c.req.json());
    const result = await service.searchEnforcementActions(
      input.clientId,
      input.name || '',
      input.surname || '',
      input.identityNumber,
      input.uniqueId,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({ success: true, data: result.data, checkType: result.checkType });
  } catch (e: unknown) {
    log.error('Enforcement actions route error:', e);
    return routeError(c, e) as Response;
  }
});

app.post('/sanctions/legal-a-listing', async (c) => {
  try {
    const input = LegalAListingSchema.parse(await c.req.json());
    const result = await service.searchLegalAListing(
      input.clientId,
      input.name || '',
      input.surname || '',
      input.identityNumber,
      input.uniqueId,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({ success: true, data: result.data, checkType: result.checkType });
  } catch (e: unknown) {
    log.error('Legal A listing route error:', e);
    return routeError(c, e) as Response;
  }
});

// ============================================================================
// PHASE 3 — FINANCIAL PROFILING (POST matter-creation)
// ============================================================================

app.post('/financial/lifestyle-audit', async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runLifestyleAudit(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error('Lifestyle audit route error:', e);
    return routeError(c, e) as Response;
  }
});

app.post('/financial/income-predictor', async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runIncomePredictor(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error('Income predictor route error:', e);
    return routeError(c, e) as Response;
  }
});

app.post('/corporate/tenders-blue', async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runTendersBlue(
      input.clientId,
      input.firstName,
      input.lastName,
      input.idNumber || null,
      input.passport || null,
    );
    if (!result.success) return c.json({ error: result.error }, 400);
    return c.json({
      success: true,
      data: result.data,
      matterId: result.matterId,
      checkType: result.checkType,
    });
  } catch (e: unknown) {
    log.error('Tenders blue route error:', e);
    return routeError(c, e) as Response;
  }
});

export default app;
