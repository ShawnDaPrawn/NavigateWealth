/**
 * Form Prefill API routes (Phase 1 + Phase 2 entry points).
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { authenticateUser, isFnaUnauthorized } from './fna-auth.ts';
import { FnaIntakeError } from './fna-intake-errors.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { listFormPrefillIds } from '../../../shared/form-prefill/form-field-registry.ts';
import type { FormPrefillId } from '../../../shared/form-prefill/types.ts';
import { normalizeIntakeToWizard } from '../../../shared/form-prefill/intake-field-mapping.ts';
import { applySelectedMatches, resolveFormPrefill } from './form-prefill-resolver.ts';
import { assertPrefillClientAccess, requirePrefillUser } from './form-prefill-auth.ts';
import { assertPrefillResolveRateLimit } from './form-prefill-rate-limit.ts';

const routes = new Hono();
const log = createModuleLogger('form-prefill-routes');

const INTAKE_DOMAIN_FORM_IDS: Record<string, FormPrefillId> = {
  risk: 'risk-fna-step1',
  medical: 'medical-fna-step1',
  retirement: 'retirement-fna-step1',
  tax: 'tax-fna-step1',
  estate: 'estate-fna-step1',
  investment: 'investment-ina-step1',
};

function isFormPrefillId(value: string): value is FormPrefillId {
  return listFormPrefillIds().includes(value as FormPrefillId);
}

function handleRouteError(
  c: { json: (body: unknown, status?: number) => Response },
  error: unknown,
) {
  if (isFnaUnauthorized(error)) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  if (error instanceof FnaIntakeError) {
    return c.json({ success: false, error: error.message }, error.status);
  }
  log.error('Form prefill route error', error);
  return c.json(
    { success: false, error: error instanceof Error ? error.message : 'Request failed' },
    500,
  );
}

routes.get('/forms', async (c) => {
  try {
    requirePrefillUser(await authenticateUser(c.req.header('Authorization')));
    return c.json({ success: true, data: listFormPrefillIds() });
  } catch (error) {
    return handleRouteError(c, error);
  }
});

routes.post('/resolve', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    requirePrefillUser(user);
    await assertPrefillResolveRateLimit(user.id);

    const body = await c.req.json();
    const { clientId, formId, currentFormValues, options } = body ?? {};

    if (!clientId || !formId || !isFormPrefillId(formId)) {
      return c.json({ success: false, error: 'clientId and valid formId are required' }, 400);
    }

    assertPrefillClientAccess(user, clientId);

    const result = await resolveFormPrefill(clientId, formId, {
      currentFormValues,
      intakeInputs: options?.intakeInputs,
      includePolicies: options?.includePolicies ?? true,
      includeClientKeys: options?.includeClientKeys ?? true,
    });

    return c.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError(c, error);
  }
});

routes.post('/apply-audit', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    requirePrefillUser(user);

    const body = await c.req.json();
    const { clientId, formId, appliedFields, resolverVersion } = body ?? {};

    if (!clientId || !formId) {
      return c.json({ success: false, error: 'clientId and formId are required' }, 400);
    }

    assertPrefillClientAccess(user, clientId);

    const auditKey = `form_prefill_audit:${clientId}:${Date.now()}`;
    await kv.set(auditKey, {
      clientId,
      formId,
      appliedFields: appliedFields ?? [],
      resolverVersion: resolverVersion ?? 'unknown',
      adminUserId: user.id,
      timestamp: new Date().toISOString(),
    });

    return c.json({ success: true, data: { auditKey } });
  } catch (error) {
    return handleRouteError(c, error);
  }
});

routes.get('/audit/:clientId', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    requirePrefillUser(user);

    const clientId = c.req.param('clientId')!;
    assertPrefillClientAccess(user, clientId);

    const limit = Math.min(Number(c.req.query('limit') || 50), 200);
    const prefix = `form_prefill_audit:${clientId}:`;
    const records = ((await kv.getByPrefix(prefix)) as Array<Record<string, unknown>>) ?? [];

    const sorted = records
      .filter((row) => row && typeof row === 'object')
      .sort((a, b) => {
        const aTs = String(a.timestamp ?? '');
        const bTs = String(b.timestamp ?? '');
        return bTs.localeCompare(aTs);
      })
      .slice(0, limit);

    return c.json({ success: true, data: sorted });
  } catch (error) {
    return handleRouteError(c, error);
  }
});

routes.post('/normalize-intake', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    requirePrefillUser(user);

    const body = await c.req.json();
    const { domain, inputs, clientId } = body ?? {};

    if (!domain || !inputs) {
      return c.json({ success: false, error: 'domain and inputs are required' }, 400);
    }

    if (clientId) {
      assertPrefillClientAccess(user, clientId);
      await assertPrefillResolveRateLimit(user.id);
    }

    const wizardInputs = normalizeIntakeToWizard(domain, inputs);

    if (clientId) {
      const formId = INTAKE_DOMAIN_FORM_IDS[domain];
      if (formId && isFormPrefillId(formId)) {
        const prefill = await resolveFormPrefill(clientId, formId, { intakeInputs: inputs });
        const merged = applySelectedMatches(
          wizardInputs,
          prefill.matches.filter((m) => !m.conflict),
          prefill.matches.filter((m) => !m.conflict).map((m) => m.formField),
        );
        return c.json({
          success: true,
          data: { wizardInputs: merged, prefill },
        });
      }
    }

    return c.json({ success: true, data: { wizardInputs } });
  } catch (error) {
    return handleRouteError(c, error);
  }
});

export default routes;
