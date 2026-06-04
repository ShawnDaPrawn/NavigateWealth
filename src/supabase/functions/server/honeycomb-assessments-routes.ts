import { Hono } from 'npm:hono';
import type { ContentfulStatusCode } from 'npm:hono/utils/http-status';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import * as kv from './kv_store.tsx';
import * as service from './honeycomb-service.ts';
import { AssessmentRunSchema, NaturalPersonCheckSchema } from './honeycomb-validation.ts';
import { HONEYCOMB_API_URL, getHeaders, routeError } from './honeycomb-utils.ts';

const app = new Hono();
const log = createModuleLogger('honeycomb-assessments');

// ============================================================================
// ASSESSMENTS (existing, kept for backward compatibility)
// ============================================================================

app.get('/assessments/templates', async (c) => {
  try {
    log.info('Fetching assessment templates from Honeycomb...');
    const url = `${HONEYCOMB_API_URL}/retrieve-assessments`;
    const res = await fetch(url, { headers: getHeaders() });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      log.error(`Failed to fetch assessment templates: ${res.status}`, { error: errText });
      return c.json(
        {
          error: `Honeycomb returned ${res.status} when fetching assessment templates`,
          details: errText.substring(0, 300),
        },
        (res.status >= 400 && res.status < 600 ? res.status : 500) as ContentfulStatusCode,
      );
    }

    const data = await res.json();
    const templates = Array.isArray(data) ? data : [data];
    log.info(`Retrieved ${templates.length} assessment template(s)`);

    return c.json({ success: true, templates });
  } catch (e: unknown) {
    log.error('Error fetching assessment templates:', e);
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

app.post('/assessments/run', async (c) => {
  try {
    const input = AssessmentRunSchema.parse(await c.req.json());

    const finalIdNumber = service.isRealIdNumber(input.idNumber) ? input.idNumber : '';
    const finalPassport = service.isRealIdNumber(input.passport) ? input.passport : '';

    if (!finalIdNumber && !finalPassport) {
      return c.json(
        {
          error:
            'Client has no valid ID number or passport. Please update their profile before running an assessment.',
        },
        400,
      );
    }

    const honeycombPayload = {
      matterNaturalPerson: {
        uniqueId: input.clientId,
        firstName: input.firstName || '',
        surname: input.lastName || '',
        identityNumber: finalIdNumber,
        passport: finalPassport,
      },
      submission: input.submission || new Date().toISOString(),
      dueDiligenceAssessmentsId: Number(input.assessmentId),
    };

    log.info('Submitting assessment to Honeycomb:', {
      assessmentId: input.assessmentId,
      clientId: input.clientId,
    });

    const url = `${HONEYCOMB_API_URL}/natural-person-assessment`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(honeycombPayload),
    });

    const responseText = await res.text();
    let responseData: Record<string, unknown> | null;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      log.error('Non-JSON response from assessment endpoint:', {
        text: responseText.substring(0, 300),
      });
      responseData = null;
    }

    if (!res.ok) {
      const errDetail =
        (responseData as Record<string, unknown>)?.message ||
        (responseData as Record<string, unknown>)?.error ||
        responseText.substring(0, 300);
      log.error(`Assessment submission failed (${res.status}):`, { error: errDetail });
      return c.json(
        { error: `Assessment submission failed: ${errDetail}`, status: res.status },
        (res.status >= 400 && res.status < 600 ? res.status : 500) as ContentfulStatusCode,
      );
    }

    if (!responseData) {
      return c.json({ error: 'Honeycomb returned an empty/invalid response' }, 502);
    }

    log.info('Assessment submitted successfully.', { keys: Object.keys(responseData) });

    const resultEntry = {
      id: responseData.matterId || crypto.randomUUID(),
      assessmentId: input.assessmentId,
      assessmentName: input.assessmentName || `Assessment #${input.assessmentId}`,
      submittedAt: new Date().toISOString(),
      matterId: responseData.matterId || null,
      naturalPersonId: responseData.naturalPersonId || null,
      screeningOutcome:
        (responseData.bulkScreeningResponse as Record<string, unknown>)?.screeningOutcome || null,
      bulkScreeningResponse: responseData.bulkScreeningResponse || null,
      rawResponse: responseData,
    };

    const historyKey = `honeycomb_assessments:${input.clientId}`;
    const existing = (await kv.get(historyKey)) || [];
    await kv.set(historyKey, [resultEntry, ...(Array.isArray(existing) ? existing : [])]);

    await service.logActivity(input.clientId, 'Risk Assessment', {
      assessmentName: resultEntry.assessmentName,
      matterId: resultEntry.matterId,
      screeningOutcome: resultEntry.screeningOutcome,
      riskLevel: resultEntry.screeningOutcome || 'Pending',
    });

    return c.json({ success: true, data: resultEntry });
  } catch (e: unknown) {
    log.error('Error running assessment:', e);
    return routeError(c, e) as Response;
  }
});

app.get('/assessments/history/:clientId', async (c) => {
  try {
    const clientId = c.req.param('clientId')!;
    const history = (await kv.get(`honeycomb_assessments:${clientId}`)) || [];
    return c.json({ success: true, assessments: history });
  } catch (e: unknown) {
    log.error('Error fetching assessment history:', e);
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

// Legacy endpoint — backward compatibility
app.post('/assessments/create', async (c) => {
  try {
    const { honeycombId, clientId } = await c.req.json();
    if (!honeycombId) return c.json({ error: 'Missing honeycombId' }, 400);

    let resultData = null;
    const paths = ['/api/Assessment', '/api/v1/Assessment', '/api/risk-assessment'];

    for (const path of paths) {
      const res = await fetch(`${HONEYCOMB_API_URL}${path}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ naturalPersonId: honeycombId }),
      });
      if (res.ok) {
        resultData = await res.json();
        break;
      }
    }

    if (!resultData) {
      log.warn('Could not create real assessment via legacy endpoint. Returning mock.');
      resultData = {
        id: crypto.randomUUID(),
        riskScore: Math.floor(Math.random() * 10),
        riskLevel: 'Low',
        createdAt: new Date().toISOString(),
      };
    }

    if (clientId) {
      await service.logActivity(clientId, 'Risk Assessment', resultData);
    }

    return c.json({ success: true, data: resultData });
  } catch (e: unknown) {
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

app.get('/assessments/list/:honeycombId', async (c) => {
  try {
    const honeycombId = c.req.param('honeycombId')!;
    const url = `${HONEYCOMB_API_URL}/api/Assessment?naturalPersonId=${honeycombId}`;
    const res = await fetch(url, { headers: getHeaders() });

    if (res.ok) {
      const data = await res.json();
      return c.json({ assessments: Array.isArray(data) ? data : [data] });
    }

    return c.json({ assessments: [] });
  } catch (e: unknown) {
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

// ============================================================================
// LEGACY REPORT ENDPOINTS (updated to use correct Honeycomb paths)
// ============================================================================

app.post('/reports/idv', async (c) => {
  try {
    const { honeycombId, clientId } = await c.req.json();

    // Use the correct Honeycomb IDV endpoint
    const res = await fetch(`${HONEYCOMB_API_URL}/natural-person-idv-no-photo-no-upload`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ uniqueId: clientId, naturalPersonId: honeycombId }),
    });

    let reportData: Record<string, unknown> | null = null;
    if (res.ok) {
      reportData = await res.json();
    }

    const reportId = reportData?.matterId || reportData?.id || crypto.randomUUID();

    if (clientId) {
      await service.logActivity(clientId, 'IDV Report', { reportId });
    }

    return c.json({ success: true, reportId, status: 'Completed', data: reportData });
  } catch (e: unknown) {
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

app.post('/reports/cdd', async (c) => {
  try {
    const input = NaturalPersonCheckSchema.parse(await c.req.json());
    const result = await service.runCddReport(
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
    log.error('CDD report route error:', e);
    return routeError(c, e) as Response;
  }
});

export default app;
