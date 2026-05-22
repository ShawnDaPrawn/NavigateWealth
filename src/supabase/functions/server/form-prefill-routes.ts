/**
 * Form Prefill API routes (Phase 1 + Phase 2 entry points).
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { authenticateUser } from './fna-auth.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { listFormPrefillIds } from '../../../shared/form-prefill/form-field-registry.ts';
import type { FormPrefillId } from '../../../shared/form-prefill/types.ts';
import { normalizeIntakeToWizard } from '../../../shared/form-prefill/intake-field-mapping.ts';
import { applySelectedMatches, resolveFormPrefill } from './form-prefill-resolver.ts';

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

routes.get('/forms', async (c) => {
  await authenticateUser(c.req.header('Authorization'));
  return c.json({ success: true, data: listFormPrefillIds() });
});

routes.post('/resolve', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'));
    const body = await c.req.json();
    const { clientId, formId, currentFormValues, options } = body ?? {};

    if (!clientId || !formId || !isFormPrefillId(formId)) {
      return c.json({ success: false, error: 'clientId and valid formId are required' }, 400);
    }

    const result = await resolveFormPrefill(clientId, formId, {
      currentFormValues,
      intakeInputs: options?.intakeInputs,
      includePolicies: options?.includePolicies ?? true,
      includeClientKeys: options?.includeClientKeys ?? true,
    });

    return c.json({ success: true, data: result });
  } catch (error) {
    log.error('Prefill resolve failed', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Prefill resolve failed' },
      500,
    );
  }
});

routes.post('/apply-audit', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const body = await c.req.json();
    const { clientId, formId, appliedFields, resolverVersion } = body ?? {};

    if (!clientId || !formId) {
      return c.json({ success: false, error: 'clientId and formId are required' }, 400);
    }

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
    log.error('Prefill audit failed', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Prefill audit failed' },
      500,
    );
  }
});

routes.post('/normalize-intake', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'));
    const body = await c.req.json();
    const { domain, inputs, clientId } = body ?? {};

    if (!domain || !inputs) {
      return c.json({ success: false, error: 'domain and inputs are required' }, 400);
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
    log.error('Intake normalize failed', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Intake normalize failed' },
      500,
    );
  }
});

export default routes;
