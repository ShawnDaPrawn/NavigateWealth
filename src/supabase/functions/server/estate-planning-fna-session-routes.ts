import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { authenticateUser, fnaErrorResponse } from './fna-auth.ts';
import { assertClientAccess } from './client-access.ts';
import { SaveSessionSchema } from './fna-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { nextVersion, versionSuffix } from './fna-versioning.ts';
import {
  readSession,
  removeSession,
  sessionOwner,
  withPublished,
  writeSession,
} from './fna-client-scoped-sessions.ts';

const app = new Hono();
const log = createModuleLogger('estate-planning-fna-session-routes');
const PREFIX = 'estate-planning-fna';
const NOT_FOUND = 'Estate Planning session not found';

interface EstateDep {
  name?: string;
  age?: number;
  relationship?: string;
  specialNeeds?: boolean;
  [key: string]: unknown;
}
interface VersionedSession {
  version: number;
  status?: string;
  createdAt?: string;
  publishedAt?: string;
  [key: string]: unknown;
}

app.get('/', (c) => c.json({ service: 'estate-planning-fna', status: 'active' }));
app.get('', (c) => c.json({ service: 'estate-planning-fna', status: 'active' }));

app.get('/client/:clientId/auto-populate', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/client/:clientId/auto-populate');
    const user = await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId')!;
    await assertClientAccess(user, clientId, 'estate-planning-fna:auto-populate');

    const { estateAutoPopulateFromResolver } = await import('./form-prefill-auto-populate.ts');
    const resolverInputs = await estateAutoPopulateFromResolver(clientId);
    const familyInfo = (resolverInputs.familyInfo ?? {}) as Record<string, unknown>;
    const dependants = (resolverInputs.dependants ?? []) as EstateDep[];
    const willInfo = resolverInputs.willInfo ?? {
      hasValidWill: 'unknown' as const,
      executorNominated: 'unknown' as const,
      guardianNominated: 'unknown' as const,
      specialBequests: [],
      willNeedsUpdate: false,
    };

    // The client's assets and liabilities (Assets & liabilities) and their
    // policy register (Policy details) — see estate-client-records.ts.
    const { loadEstateClientRecords } = await import('./estate-client-records.ts');
    const { assets, liabilities, lifePolicies } = await loadEstateClientRecords(clientId);

    // Default assumptions. The executor's fee excludes VAT, which the
    // calculation adds; estate duty is 20% to R30m and 25% above it.
    const assumptions = {
      executorFeePercentage: 3.5,
      conveyancingFeesPerProperty: 50000,
      masterFeesEstimate: 5000,
      funeralCostsEstimate: 50000,
      estateDutyRate: 0.2,
      estateDutyAbatement: 3500000,
      spousalBequest: String(familyInfo.maritalStatus ?? '').startsWith('married'),
      cgtInclusionRate: 0.4,
      cgtMarginalRate: 0.45,
      predeceasedSpouseUnusedAbatement: 0,
    };

    // Check for offshore assets and trusts
    const hasOffshorAssets = assets.some((a: { location?: string }) => a.location === 'offshore');
    const hasTrusts = assets.some((a: { ownership?: string }) => a.ownership === 'trust');

    const inputs = {
      familyInfo,
      dependants,
      willInfo,
      assets,
      liabilities,
      lifePolicies,
      assumptions,
      hasOffshorAssets,
      hasTrusts,
      trustDetails: hasTrusts ? 'Trust structures exist - details to be confirmed' : '',
      planningNotes: '',
    };

    log.info('✅ Auto-populated Estate Planning inputs for client:', { clientId });

    return c.json({
      success: true,
      data: inputs,
    });
  } catch (error: unknown) {
    log.error('❌ Error auto-populating Estate Planning inputs:', error);
    return fnaErrorResponse(c, error);
  }
});

app.post('/save', async (c) => {
  try {
    log.info('POST /estate-planning-fna/save');
    const authUser = await authenticateUser(c.req.header('Authorization'), 'estate-planning-fna');

    const body = await c.req.json();

    // Validate input
    const parsed = SaveSessionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: formatZodError(parsed.error) }, 400);
    }

    const { clientId, inputs, results, status, adviserNotes } = parsed.data;
    await assertClientAccess(authUser, clientId, 'estate-planning-fna:save');

    const sessions = await kv.getByPrefix(`estate-planning-fna:client:${clientId}:`);
    // Highest stored version, not how many are stored — see fna-versioning.ts.
    const version = nextVersion(sessions);

    // `-${versionSuffix()}` is what makes this id unique. `v${version}` comes
    // from a read-then-write, so two saves whose reads overlap agree on it and
    // the second upserts over the first. Readers are unaffected: the whole id
    // goes into the key verbatim and `sessionId.split('-v')[0]` still yields
    // the client id, so the by-id lookup and the delete keep working — for ids
    // already stored under the old two-part shape as well.
    const sessionId = `${clientId}-v${version}-${versionSuffix()}`;
    const timestamp = new Date().toISOString();

    const session = {
      id: sessionId,
      clientId,
      adviserId: authUser.id,
      version,
      status: status || 'draft',
      inputs,
      results: results || null,
      adviserNotes: adviserNotes || '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const key = `estate-planning-fna:client:${clientId}:${sessionId}`;
    await kv.set(key, session);

    log.info('✅ Estate Planning session saved:', { sessionId });

    return c.json({
      success: true,
      data: session,
    });
  } catch (error: unknown) {
    log.error('❌ Error saving Estate Planning session:', error);
    return fnaErrorResponse(c, error);
  }
});

app.get('/client/:clientId/sessions', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/client/:clientId/sessions');
    const user = await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId')!;
    await assertClientAccess(user, clientId, 'estate-planning-fna:sessions');

    const sessions = await kv.getByPrefix(`estate-planning-fna:client:${clientId}:`);
    const sortedSessions = (sessions || []).sort(
      (a: VersionedSession, b: VersionedSession) => b.version - a.version,
    );

    log.info(`✅ Retrieved ${sortedSessions.length} Estate Planning sessions for client:`, {
      clientId,
    });

    return c.json({
      success: true,
      data: sortedSessions,
    });
  } catch (error: unknown) {
    log.error('❌ Error fetching Estate Planning sessions:', error);
    return fnaErrorResponse(c, error);
  }
});

app.get('/client/:clientId/latest-published', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/client/:clientId/latest-published');
    const clientId = c.req.param('clientId')!;

    // Authenticated, and scoped to the client — the same gate as the retirement
    // and tax equivalents. This used to be OPTIONAL: no Authorization header
    // skipped every check, and an invalid token was caught and waved through
    // ("WORKAROUND: Auth bypass for backward compatibility with client
    // portal"), so anyone holding a client id could read that client's
    // published Estate Planning FNA without signing in. Every SPA caller already goes
    // through the shared API client, which sends the session token.
    const user = await authenticateUser(c.req.header('Authorization'));
    await assertClientAccess(user, clientId, 'estate-planning-fna:latest-published');

    const sessions = await kv.getByPrefix(`estate-planning-fna:client:${clientId}:`);

    const published = (sessions || [])
      .filter((s: VersionedSession) => s.status === 'published')
      .sort((a: VersionedSession, b: VersionedSession) => b.version - a.version);

    const latest = published[0] || null;

    log.info(
      latest
        ? `✅ Latest published Estate Planning session found: ${latest.id}`
        : '⚠️ No published Estate Planning FNA',
    );
    return c.json({ success: true, data: latest });
  } catch (error: unknown) {
    log.error('❌ Error fetching latest published Estate Planning FNA:', error);
    return fnaErrorResponse(c, error);
  }
});

// `?clientId=` names the client of a session whose id does not (one made from
// a client intake) — see fna-client-scoped-sessions.ts.
app.get('/session/:sessionId', async (c) => {
  try {
    log.info('📥 GET /estate-planning-fna/session/:sessionId');
    const user = await authenticateUser(c.req.header('Authorization'));
    const sessionId = c.req.param('sessionId')!;
    const clientId = sessionOwner(sessionId, c.req.query('clientId'));
    await assertClientAccess(user, clientId, 'estate-planning-fna:session-read');

    const session = await readSession(PREFIX, clientId, sessionId);
    if (!session) return c.json({ success: false, error: NOT_FOUND }, 404);

    log.info('✅ Estate Planning session retrieved:', { sessionId });
    return c.json({ success: true, data: session });
  } catch (error: unknown) {
    log.error('❌ Error fetching Estate Planning session:', error);
    return fnaErrorResponse(c, error);
  }
});

// Publish a session, so the client sees it.
app.put('/session/:sessionId/publish', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const sessionId = c.req.param('sessionId')!;
    const clientId = sessionOwner(sessionId, c.req.query('clientId'));
    await assertClientAccess(user, clientId, 'estate-planning-fna:session-publish');

    const session = await readSession(PREFIX, clientId, sessionId);
    if (!session) return c.json({ success: false, error: NOT_FOUND }, 404);

    const updated = withPublished(session, true, user.id);
    await writeSession(PREFIX, clientId, sessionId, updated);
    return c.json({ success: true, data: updated });
  } catch (error: unknown) {
    log.error('❌ Error publishing Estate Planning session:', error);
    return fnaErrorResponse(c, error);
  }
});

// Return a published session to a draft.
app.put('/session/:sessionId/unpublish', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const sessionId = c.req.param('sessionId')!;
    const clientId = sessionOwner(sessionId, c.req.query('clientId'));
    await assertClientAccess(user, clientId, 'estate-planning-fna:session-unpublish');

    const session = await readSession(PREFIX, clientId, sessionId);
    if (!session) return c.json({ success: false, error: NOT_FOUND }, 404);
    if (session.status !== 'published') {
      return c.json({ success: false, error: 'Estate Planning session is not published' }, 400);
    }

    const updated = withPublished(session, false, user.id);
    await writeSession(PREFIX, clientId, sessionId, updated);
    return c.json({ success: true, data: updated });
  } catch (error: unknown) {
    log.error('❌ Error unpublishing Estate Planning session:', error);
    return fnaErrorResponse(c, error);
  }
});

// Delete a session. 404 when there is none: this used to answer success for
// any id, so deleting an intake draft (whose id does not name its client)
// reported success and deleted nothing.
app.delete('/session/:sessionId', async (c) => {
  try {
    log.info('📥 DELETE /estate-planning-fna/session/:sessionId');
    const user = await authenticateUser(c.req.header('Authorization'));
    const sessionId = c.req.param('sessionId')!;
    const clientId = sessionOwner(sessionId, c.req.query('clientId'));
    await assertClientAccess(user, clientId, 'estate-planning-fna:session-delete');

    if (!(await removeSession(PREFIX, clientId, sessionId))) {
      return c.json({ success: false, error: NOT_FOUND }, 404);
    }

    log.info('✅ Estate Planning session deleted:', { sessionId });
    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('❌ Error deleting Estate Planning session:', error);
    return fnaErrorResponse(c, error);
  }
});

export default app;
