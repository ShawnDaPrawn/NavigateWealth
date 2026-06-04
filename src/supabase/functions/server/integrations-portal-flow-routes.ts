import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { requireAuth } from './auth-mw.ts';
import {
  loadPortalBrainMemory,
  summarisePortalBrainMemory,
  getPortalBrainConfig,
} from './integrations-portal-brain.ts';
import {
  normalisePortalCredentialProfileId,
  loadPortalCredentialRecord,
  savePortalCredentialRecord,
  portalCredentialStatus,
} from './integrations-portal-credentials.ts';
import {
  normaliseFlowSteps,
  normaliseSearchConfig,
  normaliseExtractionFields,
  normalisePolicyScheduleConfig,
  normaliseDocumentArtifactConfigs,
  normalisePortalCredentialProfiles,
} from './integrations-portal-flow-config.ts';
import {
  getDefaultPortalFlow,
  portalFlowKey,
  getPortalFlow,
  sanitisePortalFlow,
} from './integrations-portal-flow.ts';
import type { KvProvider } from './integrations-types.ts';
import type { PortalCredentialRecord, PortalProviderFlow } from './integrations-portal-types.ts';

const log = createModuleLogger('integrations-portal-flow-routes');

const app = new Hono();

// GET /portal-flows/:providerId
app.get('/portal-flows/:providerId', requireAuth, async (c) => {
  try {
    const providerId = c.req.param('providerId')!;
    const categoryId = String(c.req.query('categoryId') || '').trim();
    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: 'Invalid provider ID' }, 400);
    }

    const flow = await getPortalFlow(provider, providerId, categoryId || undefined);
    return c.json({ success: true, flow: sanitisePortalFlow(flow) });
  } catch (e) {
    log.error('Portal flow fetch error:', e);
    return c.json({ error: 'Failed to fetch portal flow' }, 500);
  }
});

// PUT /portal-flows/:providerId
app.put('/portal-flows/:providerId', requireAuth, async (c) => {
  try {
    const providerId = c.req.param('providerId')!;
    const categoryId = String(c.req.query('categoryId') || '').trim();
    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: 'Invalid provider ID' }, 400);
    }

    const body = await c.req.json();
    const defaultFlow = getDefaultPortalFlow(provider, providerId, categoryId || undefined);
    const flow: PortalProviderFlow = {
      ...defaultFlow,
      ...body,
      providerId,
      id: categoryId ? `${providerId}:${categoryId}:default` : body?.id || `${providerId}:default`,
      loginUrl: String(body?.loginUrl || '').trim() || defaultFlow.loginUrl,
      credentialProfiles: normalisePortalCredentialProfiles(
        body?.credentialProfiles,
        defaultFlow.credentialProfiles,
      ),
      navigation: {
        ...(defaultFlow.navigation || {}),
        ...(body?.navigation || {}),
        policyListSteps: Array.isArray(body?.navigation?.policyListSteps)
          ? normaliseFlowSteps(body.navigation.policyListSteps)
          : defaultFlow.navigation?.policyListSteps || [],
      },
      search: normaliseSearchConfig(body?.search, defaultFlow.search),
      extraction: {
        ...(defaultFlow.extraction || {}),
        ...(body?.extraction || {}),
        fields: normaliseExtractionFields(
          body?.extraction?.fields,
          defaultFlow.extraction?.fields || [],
        ),
      },
      policySchedule: normalisePolicyScheduleConfig(
        body?.policySchedule,
        defaultFlow.policySchedule,
      ),
      documentArtifacts: normaliseDocumentArtifactConfigs(
        body?.documentArtifacts,
        defaultFlow.documentArtifacts || [],
      ),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(portalFlowKey(providerId, categoryId || undefined), flow);
    return c.json({ success: true, flow: sanitisePortalFlow(flow) });
  } catch (e) {
    log.error('Portal flow save error:', e);
    return c.json({ error: `Failed to save portal flow: ${getErrMsg(e)}` }, 500);
  }
});

// DELETE /portal-flows/:providerId
app.delete('/portal-flows/:providerId', requireAuth, async (c) => {
  try {
    const providerId = c.req.param('providerId')!;
    const categoryId = String(c.req.query('categoryId') || '').trim();
    if (!categoryId) {
      return c.json({ error: 'Missing categoryId' }, 400);
    }

    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: 'Invalid provider ID' }, 400);
    }

    const currentFlow = await getPortalFlow(provider, providerId, categoryId);
    const defaultFlow = getDefaultPortalFlow(provider, providerId, categoryId);
    const resetFlow: PortalProviderFlow = {
      ...defaultFlow,
      credentialProfiles:
        Array.isArray(currentFlow.credentialProfiles) && currentFlow.credentialProfiles.length > 0
          ? currentFlow.credentialProfiles
          : defaultFlow.credentialProfiles,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(portalFlowKey(providerId, categoryId), resetFlow);
    return c.json({ success: true, flow: sanitisePortalFlow(resetFlow) });
  } catch (e) {
    log.error('Portal flow reset error:', e);
    return c.json({ error: `Failed to reset portal flow: ${getErrMsg(e)}` }, 500);
  }
});

// GET /portal-flows/:providerId/brain-memory
app.get('/portal-flows/:providerId/brain-memory', requireAuth, async (c) => {
  try {
    const providerId = c.req.param('providerId')!;
    const categoryId = String(c.req.query('categoryId') || '').trim();
    if (!categoryId) {
      return c.json({ error: 'Missing categoryId' }, 400);
    }

    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: 'Invalid provider ID' }, 400);
    }

    const flow = await getPortalFlow(provider, providerId, categoryId);
    const memory = await loadPortalBrainMemory(providerId, categoryId);
    const brainConfig = getPortalBrainConfig();
    const summary = summarisePortalBrainMemory(memory, {
      available: brainConfig.available,
      configured: brainConfig.available && flow.search?.brain?.enabled === true,
      model: brainConfig.model,
    });

    return c.json({ success: true, summary });
  } catch (e) {
    log.error('Portal brain memory fetch error:', e);
    return c.json({ error: `Failed to fetch portal brain memory: ${getErrMsg(e)}` }, 500);
  }
});

// GET /portal-flows/:providerId/credentials/:profileId
app.get('/portal-flows/:providerId/credentials/:profileId', requireAuth, async (c) => {
  try {
    const providerId = c.req.param('providerId')!;
    const profileId = normalisePortalCredentialProfileId(c.req.param('profileId')!);
    const categoryId = String(c.req.query('categoryId') || '').trim();
    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: 'Invalid provider ID' }, 400);
    }

    const flow = await getPortalFlow(provider, providerId, categoryId || undefined);
    if (!flow.credentialProfiles.some((profile) => profile.id === profileId)) {
      return c.json({ error: 'Invalid credential profile' }, 400);
    }

    const record = await loadPortalCredentialRecord(providerId, profileId);
    return c.json({ success: true, status: portalCredentialStatus(record, providerId, profileId) });
  } catch (e) {
    log.error('Portal credential status error:', e);
    return c.json({ error: 'Failed to fetch portal credential status' }, 500);
  }
});

// PUT /portal-flows/:providerId/credentials/:profileId
app.put('/portal-flows/:providerId/credentials/:profileId', requireAuth, async (c) => {
  try {
    const providerId = c.req.param('providerId')!;
    const profileId = normalisePortalCredentialProfileId(c.req.param('profileId')!);
    const categoryId = String(c.req.query('categoryId') || '').trim();
    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: 'Invalid provider ID' }, 400);
    }

    const flow = await getPortalFlow(provider, providerId, categoryId || undefined);
    if (!flow.credentialProfiles.some((profile) => profile.id === profileId)) {
      return c.json({ error: 'Invalid credential profile' }, 400);
    }

    const body = await c.req.json();
    const current = await loadPortalCredentialRecord(providerId, profileId);
    const username =
      typeof body?.username === 'string' && body.username.trim()
        ? body.username.trim()
        : current?.username || '';
    const password =
      typeof body?.password === 'string' && body.password ? body.password : current?.password || '';

    if (!username || !password) {
      return c.json(
        { error: 'Username and password are required the first time credentials are saved' },
        400,
      );
    }

    const record: PortalCredentialRecord = {
      providerId,
      profileId,
      username,
      password,
      updatedAt: new Date().toISOString(),
      updatedBy: String(c.get('userId') || 'admin'),
    };
    await savePortalCredentialRecord(record);

    const profile = flow.credentialProfiles.find((item) => item.id === profileId);
    if (profile && profile.source !== 'supabase_kv') {
      const updatedFlow: PortalProviderFlow = {
        ...flow,
        credentialProfiles: flow.credentialProfiles.map((item) =>
          item.id === profileId ? { ...item, source: 'supabase_kv' } : item,
        ),
        updatedAt: new Date().toISOString(),
      };
      await kv.set(portalFlowKey(providerId, categoryId || undefined), updatedFlow);
    }

    return c.json({ success: true, status: portalCredentialStatus(record, providerId, profileId) });
  } catch (e) {
    log.error('Portal credential save error:', e);
    return c.json({ error: `Failed to save portal credentials: ${getErrMsg(e)}` }, 500);
  }
});

export default app;
