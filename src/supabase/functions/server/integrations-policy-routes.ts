/**
 * Policy management routes (Phase 5 Slice D decomposition).
 * ==========================================================
 *
 * Extracted verbatim from integrations.tsx. No logic changes.
 *
 * Routes owned here:
 *   GET  /policies              — list policies for a client
 *   POST /policies/archive      — soft-delete a policy
 *   POST /policies/reinstate    — un-archive a policy
 *   POST /policies              — create a new policy
 *   PUT  /policies              — update an existing policy
 *   DELETE /policies            — hard-delete a policy (+ storage cleanup)
 *   POST /recalculate-totals    — trigger client-total recalculation
 *   GET  /dashboard-stats       — aggregate counts for the adviser dashboard
 *   GET  /policy-renewals       — calendar renewal data (requires auth)
 *
 * @module server/integrations-policy-routes
 */

import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { requireAuth } from './auth-mw.ts';
import { DEFAULT_SCHEMAS } from './default-schemas.ts';
import {
  CreatePolicySchema,
  UpdatePolicySchema,
  ArchivePolicySchema,
  ReinstatePolicySchema,
  RecalculateTotalsSchema,
} from './integrations-validation.ts';
import type {
  KvPolicy,
  KvSchema,
  SchemaField,
  KvProvider,
  KvFnaEntry,
  PolicyRenewal,
} from './integrations-types.ts';
import { recalculateClientTotals } from './integrations-derive.ts';
import { isValidDate } from './integrations-field-utils.ts';
import { POLICY_DOC_BUCKET } from './integrations-document-storage.ts';

const app = new Hono();
const log = createModuleLogger('integrations-policy');

// SECURITY: policy CRUD reads/writes/deletes client insurance policies keyed by
// clientId. The gateway runs with verify_jwt=false, so authentication MUST be
// enforced — previously only /policy-renewals was guarded, leaving the rest
// reachable unauthenticated (IDOR over any client's policies). requireAuth is
// applied PER-ROUTE below rather than via app.use('*'), because this router is
// mounted with `.route('/', policyRoutes)` alongside sibling integrations routers
// (provider/schema/upload/portal-worker) and a wildcard middleware would leak
// onto them — notably breaking the worker-secret-authenticated portal routes.

const getByPrefix = async (prefix: string) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await supabase
    .from('kv_store_91ed8379')
    .select('value')
    .like('key', prefix + '%');

  if (error) throw new Error(error.message);
  return data?.map((d) => d.value) || [];
};

// GET /policies
app.get('/policies', requireAuth, async (c) => {
  try {
    const clientId = c.req.query('clientId');
    const categoryId = c.req.query('categoryId');
    const includeArchived = c.req.query('includeArchived') === 'true';

    if (!clientId) {
      return c.json({ error: 'Missing clientId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    let policies = (await kv.get(policiesKey)) || [];

    if (categoryId) {
      if (categoryId === 'retirement_planning') {
        policies = policies.filter(
          (p: KvPolicy) =>
            p.categoryId === 'retirement_planning' ||
            p.categoryId === 'retirement_pre' ||
            p.categoryId === 'retirement_post',
        );
      } else if (categoryId === 'investments') {
        policies = policies.filter(
          (p: KvPolicy) =>
            p.categoryId === 'investments' ||
            p.categoryId === 'investments_voluntary' ||
            p.categoryId === 'investments_guaranteed',
        );
      } else {
        policies = policies.filter((p: KvPolicy) => p.categoryId === categoryId);
      }
    }

    if (!includeArchived) {
      policies = policies.filter((p: KvPolicy) => !p.archived);
    } else {
      policies = policies.filter((p: KvPolicy) => p.archived);
    }

    return c.json({ policies });
  } catch (e) {
    log.error('Error fetching policies, returning empty array:', e as Error, {
      clientId: c.req.query('clientId'),
      categoryId: c.req.query('categoryId'),
    });
    return c.json({ policies: [] });
  }
});

// POST /policies/archive
app.post('/policies/archive', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ArchivePolicySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { id, clientId, reason } = parsed.data;

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];

    const policyIndex = policies.findIndex((p: KvPolicy) => p.id === id);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    policies[policyIndex] = {
      ...policies[policyIndex],
      archived: true,
      archivedReason: reason,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);
    await recalculateClientTotals(clientId);

    return c.json({ success: true, policy: policies[policyIndex] });
  } catch (e) {
    log.error('Error archiving policy:', e);
    return c.json({ error: 'Failed to archive policy' }, 500);
  }
});

// POST /policies/reinstate
app.post('/policies/reinstate', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ReinstatePolicySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { id, clientId } = parsed.data;

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];

    const policyIndex = policies.findIndex((p: KvPolicy) => p.id === id);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    policies[policyIndex] = {
      ...policies[policyIndex],
      archived: false,
      archivedReason: undefined,
      archivedAt: undefined,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);
    await recalculateClientTotals(clientId);

    return c.json({ success: true, policy: policies[policyIndex] });
  } catch (e) {
    log.error('Error reinstating policy:', e);
    return c.json({ error: 'Failed to reinstate policy' }, 500);
  }
});

// POST /policies
app.post('/policies', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = CreatePolicySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { clientId, categoryId, providerId, providerName, data } = parsed.data;

    const provider = await kv.get(`provider:${providerId}`);
    if (!provider) {
      return c.json({ error: 'Invalid provider ID' }, 400);
    }
    const safeProviderName = (provider as KvProvider).name || providerName;

    const policyId = `policy_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const policy = {
      id: policyId,
      clientId,
      categoryId,
      providerId,
      providerName: safeProviderName,
      data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];

    policies.push(policy);

    await kv.set(policiesKey, policies);
    await recalculateClientTotals(clientId);

    return c.json({ success: true, policy });
  } catch (e) {
    log.error('Error creating policy:', e);
    return c.json({ error: 'Failed to create policy' }, 500);
  }
});

// PUT /policies
app.put('/policies', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = UpdatePolicySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { id, clientId, categoryId, providerId, providerName, data } = parsed.data;

    if (!id || !clientId) {
      return c.json({ error: 'Missing policy id or clientId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];

    const policyIndex = policies.findIndex((p: KvPolicy) => p.id === id);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    let newProviderName = providerName || policies[policyIndex].providerName;
    if (providerId && providerId !== policies[policyIndex].providerId) {
      const provider = await kv.get(`provider:${providerId}`);
      if (!provider) {
        return c.json({ error: 'Invalid provider ID' }, 400);
      }
      newProviderName = (provider as KvProvider).name;
    }

    policies[policyIndex] = {
      ...policies[policyIndex],
      categoryId: categoryId || policies[policyIndex].categoryId,
      providerId: providerId || policies[policyIndex].providerId,
      providerName: newProviderName,
      data: data || policies[policyIndex].data,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);
    await recalculateClientTotals(clientId);

    return c.json({ success: true, policy: policies[policyIndex] });
  } catch (e) {
    log.error('Error updating policy:', e);
    return c.json({ error: 'Failed to update policy' }, 500);
  }
});

// DELETE /policies
app.delete('/policies', requireAuth, async (c) => {
  try {
    const id = c.req.query('id');
    const clientId = c.req.query('clientId');

    if (!id || !clientId) {
      return c.json({ error: 'Missing policy id or clientId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    let policies = (await kv.get(policiesKey)) || [];

    // Find the policy to check for attached document before removing
    const policyToDelete = (policies as KvPolicy[]).find((p: KvPolicy) => p.id === id);

    const initialLength = policies.length;
    policies = policies.filter((p: KvPolicy) => p.id !== id);

    if (policies.length === initialLength) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    // Clean up attached document from storage if present
    if (policyToDelete?.document?.storageKey) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );
        await supabase.storage.from(POLICY_DOC_BUCKET).remove([policyToDelete.document.storageKey]);
        log.info('Deleted attached document during policy deletion', {
          policyId: id,
          storageKey: policyToDelete.document.storageKey,
        });
      } catch (docErr) {
        // Non-fatal: log and continue
        log.error('Failed to delete attached document during policy deletion (non-fatal):', docErr);
      }
    }

    await kv.set(policiesKey, policies);

    return c.json({ success: true });
  } catch (e) {
    log.error('Error deleting policy:', e);
    return c.json({ error: 'Failed to delete policy' }, 500);
  }
});

// --- DASHBOARD STATS ENDPOINTS ---

// POST /recalculate-totals
app.post('/recalculate-totals', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const parsed = RecalculateTotalsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { clientId } = parsed.data;

    await recalculateClientTotals(clientId);

    return c.json({ success: true, message: 'Totals recalculated successfully' });
  } catch (e) {
    log.error('Error triggering recalculation:', e);
    return c.json({ error: 'Failed to recalculate totals' }, 500);
  }
});

// GET /dashboard-stats
app.get('/dashboard-stats', requireAuth, async (c) => {
  try {
    const allPoliciesKeys = await getByPrefix('policies:client:');
    let totalActivePolicies = 0;
    let newPoliciesCount = 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const policies of allPoliciesKeys) {
      if (Array.isArray(policies)) {
        totalActivePolicies += policies.length;

        newPoliciesCount += policies.filter((p: KvPolicy) => {
          return p.createdAt && new Date(p.createdAt) >= startOfMonth;
        }).length;
      }
    }

    const riskFnaKeys = await getByPrefix('risk_planning_fna:client:');
    const medicalFnaKeys = await getByPrefix('medical_fna:client:');
    const retirementFnaKeys = await getByPrefix('retirement_fna:client:');
    const investmentInaKeys = await getByPrefix('investment_ina:client:');
    const taxPlanningKeys = await getByPrefix('tax_planning_fna:client:');
    const estatePlanningKeys = await getByPrefix('estate_planning_fna:client:');

    let publishedFnasCount = 0;

    const countPublished = (items: KvFnaEntry[]) => {
      if (!items || !Array.isArray(items)) return 0;
      return items.filter((item) => item?.status === 'published').length;
    };

    publishedFnasCount += countPublished(riskFnaKeys);
    publishedFnasCount += countPublished(medicalFnaKeys);
    publishedFnasCount += countPublished(retirementFnaKeys);
    publishedFnasCount += countPublished(investmentInaKeys);
    publishedFnasCount += countPublished(taxPlanningKeys);
    publishedFnasCount += countPublished(estatePlanningKeys);

    log.info('Dashboard stats calculated', {
      activePolicies: totalActivePolicies,
      newPoliciesCount,
      publishedFnas: publishedFnasCount,
    });

    return c.json({
      activePolicies: totalActivePolicies,
      newPoliciesCount,
      publishedFnas: publishedFnasCount,
    });
  } catch (e) {
    log.error('Error fetching dashboard stats:', e);
    return c.json({
      activePolicies: 0,
      newPoliciesCount: 0,
      publishedFnas: 0,
    });
  }
});

// GET /policy-renewals
app.get('/policy-renewals', requireAuth, async (c) => {
  try {
    log.info('Fetching policy renewal data for calendar');

    const allPoliciesEntries = await getByPrefix('policies:client:');

    const customSchemas = await getByPrefix('config:schema:');
    const schemaMap: Record<string, SchemaField[]> = {};

    for (const schema of customSchemas) {
      const s = schema as KvSchema;
      if (s && s.categoryId && s.fields) {
        schemaMap[s.categoryId] = s.fields;
      }
    }

    for (const [catId, schema] of Object.entries(DEFAULT_SCHEMAS)) {
      if (!schemaMap[catId] && (schema as { fields?: SchemaField[] }).fields) {
        schemaMap[catId] = (schema as { fields: SchemaField[] }).fields;
      }
    }

    const inceptionFieldMap: Record<string, { fieldId: string; fieldName: string }[]> = {};
    for (const [catId, fields] of Object.entries(schemaMap)) {
      const inceptionFields: { fieldId: string; fieldName: string }[] = [];
      for (const field of fields) {
        const fieldType = (field.type || '').toLowerCase();
        const fieldName = (field.name || '').toLowerCase();

        if (
          fieldType === 'date_inception' ||
          fieldName.includes('inception') ||
          fieldName.includes('commencement') ||
          fieldName.includes('start date') ||
          (fieldName === 'anniversary date' && catId.includes('retirement'))
        ) {
          inceptionFields.push({ fieldId: field.id, fieldName: field.name });
        }
      }
      if (inceptionFields.length > 0) {
        inceptionFieldMap[catId] = inceptionFields;
      }
    }

    const renewals: PolicyRenewal[] = [];

    const categoryLabels: Record<string, string> = {
      risk_planning: 'Risk Planning',
      medical_aid: 'Medical Aid',
      retirement_planning: 'Retirement Planning',
      retirement_pre: 'Pre-Retirement',
      retirement_post: 'Post-Retirement',
      investments: 'Investments',
      investments_voluntary: 'Voluntary Investments',
      investments_guaranteed: 'Guaranteed Investments',
      employee_benefits: 'Employee Benefits',
      employee_benefits_risk: 'Employee Benefits (Risk)',
      employee_benefits_retirement: 'Employee Benefits (Retirement)',
      tax_planning: 'Tax Planning',
      estate_planning: 'Estate Planning',
    };

    for (const policies of allPoliciesEntries) {
      if (!Array.isArray(policies)) continue;

      for (const policy of policies) {
        if (!policy || !policy.data || policy.archived) continue;

        const catId = policy.categoryId;

        const fieldsToCheck = inceptionFieldMap[catId] || [];

        const schemaFields = schemaMap[catId] || [];

        let inceptionDate: string | null = null;
        let inceptionFieldName: string = 'Date of Inception';

        for (const { fieldId, fieldName } of fieldsToCheck) {
          const val = policy.data[fieldId];
          if (val && isValidDate(val)) {
            inceptionDate = val;
            inceptionFieldName = fieldName;
            break;
          }
        }

        if (!inceptionDate) {
          for (const field of schemaFields) {
            const fieldType = (field.type || '').toLowerCase();
            if (fieldType === 'date_inception') {
              const val = policy.data[field.id];
              if (val && isValidDate(val)) {
                inceptionDate = val;
                inceptionFieldName = field.name || 'Date of Inception';
                break;
              }
            }
          }
        }

        if (!inceptionDate) continue;

        let policyNumber = '';
        for (const field of schemaFields) {
          const fn = (field.name || '').toLowerCase();
          if (
            fn.includes('policy number') ||
            fn.includes('policy no') ||
            fn.includes('reference')
          ) {
            policyNumber = policy.data[field.id] || '';
            if (policyNumber) break;
          }
        }

        renewals.push({
          clientId: policy.clientId,
          policyId: policy.id,
          providerName: policy.providerName || 'Unknown Provider',
          categoryId: catId,
          categoryLabel: categoryLabels[catId] || catId,
          policyNumber,
          inceptionDate,
          inceptionFieldName,
        });
      }
    }

    log.info(`Found ${renewals.length} policies with renewal dates`);
    return c.json({ renewals });
  } catch (e) {
    log.error('Error fetching policy renewals:', e);
    return c.json({ renewals: [] });
  }
});

export default app;
