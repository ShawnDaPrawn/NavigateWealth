import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import * as kv from './kv_store.tsx';
import * as service from './honeycomb-service.ts';
import { RegisterClientSchema } from './honeycomb-validation.ts';
import { HONEYCOMB_API_URL, NIL_UUID, getHeaders } from './honeycomb-utils.ts';

const app = new Hono();
const log = createModuleLogger('honeycomb-registration');

// ============================================================================
// REGISTRATION
// ============================================================================

app.post('/register-client', async (c) => {
  try {
    const body = await c.req.json();
    const input = RegisterClientSchema.parse(body);

    // Check if already registered
    const existingMapping = await kv.get(`honeycomb_id:${input.clientId}`);
    if (existingMapping && existingMapping !== NIL_UUID) {
      return c.json({
        success: true,
        message: 'Client already registered',
        honeycombId: existingMapping,
      });
    }

    // Resolve identification
    const finalIdNumber =
      [input.profile_id_number, input.idNumber].find(service.isRealIdNumber) || null;
    const finalPassport = service.isRealIdNumber(input.passport) ? input.passport : null;

    if (!finalIdNumber && !finalPassport) {
      return c.json(
        {
          error:
            'Missing identification. Please ensure the client profile has a valid South African ID number or passport number before registering.',
        },
        400,
      );
    }

    log.info(`Registering client ${input.clientId} with Honeycomb`);

    // Build payload using exact API schema
    const honeycombPayload = {
      uniqueId: input.clientId,
      firstName: input.firstName,
      surname: input.lastName,
      identityNumber: finalIdNumber || '',
      passport: finalPassport || '',
    };

    // Try the known endpoint
    const response = await fetch(`${HONEYCOMB_API_URL}/natural-person`, {
      method: 'POST',
      headers: { ...getHeaders(), 'User-Agent': 'NavigateWealth-Admin/1.0' },
      body: JSON.stringify(honeycombPayload),
    });

    let successData = null;

    if (response.ok) {
      successData = await response.json();
    } else {
      // Fallback: try alternative endpoints
      const fallbacks = [
        '/api/NaturalPerson',
        '/api/natural-person',
        '/api/v1/NaturalPerson',
        '/api/Applicant',
        '/api/Client',
      ];

      for (const ep of fallbacks) {
        try {
          const res = await fetch(`${HONEYCOMB_API_URL}${ep}`, {
            method: 'POST',
            headers: { ...getHeaders(), 'User-Agent': 'NavigateWealth-Admin/1.0' },
            body: JSON.stringify(honeycombPayload),
          });
          if (res.ok) {
            successData = await res.json();
            break;
          }
        } catch {
          continue;
        }
      }
    }

    if (!successData) {
      throw new Error(
        'Registration failed — could not create client in Honeycomb. All endpoints returned errors.',
      );
    }

    let honeycombId = service.extractId(successData);
    if (!honeycombId) {
      log.warn('No ID in success response. Using prefixed clientId as reference.');
      honeycombId = `hc_${input.clientId}`;
    }

    // Store mapping
    await kv.set(`honeycomb_id:${input.clientId}`, honeycombId);

    // Log activity
    await service.logActivity(input.clientId, 'Client Registration', {
      honeycombId,
      registeredAt: new Date().toISOString(),
    });

    return c.json({ success: true, honeycombId });
  } catch (e: unknown) {
    log.error('Register error:', e);
    return c.json({ error: getErrMsg(e) }, 500);
  }
});

// ============================================================================
// STATUS & ACTIVITY
// ============================================================================

app.get('/status/:clientId', async (c) => {
  const clientId = c.req.param('clientId');
  const honeycombId = await kv.get(`honeycomb_id:${clientId}`);
  const isRegistered = !!honeycombId && honeycombId !== NIL_UUID;
  return c.json({ registered: isRegistered, honeycombId: isRegistered ? honeycombId : null });
});

app.get('/activity/:clientId', async (c) => {
  const clientId = c.req.param('clientId');
  const activity = (await kv.get(`honeycomb_activity:${clientId}`)) || [];
  return c.json({ activity });
});

export default app;
