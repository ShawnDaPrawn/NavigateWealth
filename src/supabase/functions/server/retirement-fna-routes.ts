/**
 * Retirement Planning FNA Backend Routes
 * Handles Retirement Planning FNA calculation, storage, and versioning
 *
 * FAIS-Compliant | Nominal Future Value Projections | Audit Trail
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { authenticateUser, fnaErrorResponse } from './fna-auth.ts';
import { assertClientAccess, assertRecordClientAccess } from './client-access.ts';
import { CreateSessionSchema, UpdateInputsSchema } from './fna-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { nextVersion } from './fna-versioning.ts';
import {
  calculateRetirement,
  retirementInputProblem,
} from '../../../shared/fna-calculations/retirement.ts';

const retirementFnaRoutes = new Hono();
const log = createModuleLogger('retirement-fna-routes');

// ==================== CONSTANTS ====================

// 2.0.0: shared engine (src/shared/fna-calculations/retirement.ts) — gross
// income basis, salary-linked contribution escalation, other provision,
// today's-money figures, drawdown and s11F checks; age is required.
const SYSTEM_VERSION = '2.0.0';

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate unique FNA ID
 */
function generateFnaId(): string {
  return `retirement-fna-${crypto.randomUUID()}`;
}

/**
 * Get next version number for a client
 */
async function getNextVersionNumber(clientId: string): Promise<number> {
  // Read the client's OWN records, via the id list.
  //
  // This used to prefix-scan `retirement_fna:${clientId}:`, which never
  // contained a single FNA. Records are keyed `retirement_fna:${fnaId}` with
  // `fnaId` a uuid, so that prefix only ever matched the two bookkeeping keys
  // beside them — `:latest` and `:list`. The version was therefore derived from
  // whether those two keys happened to exist: 1 before the first create, 2 for
  // every create after it, and 3 for every create once anything was published.
  // An adviser looking at a client's Retirement history saw version numbers
  // that meant nothing.
  //
  // The id list is the only thing that knows which FNAs belong to this client,
  // so it is what this reads. `mget` keeps it to two round trips rather than
  // one per FNA.
  const ids = ((await kv.get(`retirement_fna:${clientId}:list`)) as string[] | null) || [];
  if (ids.length === 0) return 1;

  const records = await kv.mget(ids.map((id) => `retirement_fna:${id}`));
  return nextVersion(records.filter(Boolean));
}

/** A finite number from stored input (stored values may be strings), else undefined. */
function optionalNumber(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const num = Number(val);
  return Number.isFinite(num) ? num : undefined;
}

/**
 * Auto-populate logic extracted to a reusable function
 * Fetches profile, keys, and policies to determine default inputs
 */
async function autoPopulateFromProfile(clientId: string) {
  log.info('📋 Auto-populating Retirement FNA for client:', { clientId });
  const { retirementAutoPopulateFromResolver } = await import('./form-prefill-auto-populate.ts');
  return retirementAutoPopulateFromResolver(clientId);
}

// ==================== CALCULATION ENGINE ====================

/**
 * Run the shared engine on a stored session. The wizard saves inputs and
 * adjustments merged into `inputs`, so assumption keys are read from there.
 * Stored values may be strings; each is parsed, and anything unparseable is
 * left to the engine's default. The caller checks retirementInputProblem first.
 */
function performCalculations(stored: RetirementCalcInputs) {
  return calculateRetirement(
    {
      currentAge: optionalNumber(stored.currentAge),
      retirementAge: optionalNumber(stored.retirementAge),
      currentMonthlyIncome: optionalNumber(stored.currentMonthlyIncome),
      currentGrossMonthlyIncome: optionalNumber(stored.currentGrossMonthlyIncome),
      currentMonthlyContribution: optionalNumber(stored.currentMonthlyContribution),
      currentRetirementSavings: optionalNumber(stored.currentRetirementSavings),
      otherRetirementCapital: optionalNumber(stored.otherRetirementCapital),
      otherMonthlyRetirementIncome: optionalNumber(stored.otherMonthlyRetirementIncome),
    },
    {
      yearsInRetirement: optionalNumber(stored.yearsInRetirement),
      replacementRatio: optionalNumber(stored.replacementRatio),
      inflationRate: optionalNumber(stored.inflationRate),
      preRetirementReturn: optionalNumber(stored.preRetirementReturn),
      postRetirementReturn: optionalNumber(stored.postRetirementReturn),
      salaryEscalation: optionalNumber(stored.salaryEscalation),
      premiumEscalation: optionalNumber(stored.premiumEscalation),
    },
  );
}

// ==================== ROUTE HANDLERS ====================

// GET All for Client
retirementFnaRoutes.get('/client/:clientId', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const clientId = c.req.param('clientId')!;
    await assertClientAccess(user, clientId, 'retirement-fna:list');

    // Fetch all sessions (using list pattern or prefix scan)
    const listKey = `retirement_fna:${clientId}:list`;
    const list = (await kv.get(listKey)) || [];

    const sessions = [];
    for (const id of list) {
      const session = await kv.get(`retirement_fna:${id}`);
      if (session) sessions.push(session);
    }

    // Sort by updated at desc
    sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return c.json({ success: true, data: sessions });
  } catch (error: unknown) {
    log.error('Error fetching sessions:', error);
    return fnaErrorResponse(c, error);
  }
});

// GET By ID
retirementFnaRoutes.get('/:fnaId', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const fnaId = c.req.param('fnaId')!;
    const session = await kv.get(`retirement_fna:${fnaId}`);

    if (!session) return c.json({ success: false, error: 'Session not found' }, 404);

    await assertRecordClientAccess(user, session, 'retirement-fna:read');

    return c.json({ success: true, data: session });
  } catch (error: unknown) {
    return fnaErrorResponse(c, error);
  }
});

// CREATE Session
retirementFnaRoutes.post('/create', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const body = await c.req.json();
    const parsed = CreateSessionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: formatZodError(parsed.error) }, 400);
    }
    const { clientId } = parsed.data;
    await assertClientAccess(user, clientId, 'retirement-fna:create');

    const id = generateFnaId();
    const version = await getNextVersionNumber(clientId);

    const session = {
      id,
      clientId,
      version,
      status: 'draft',
      inputs: {},
      adjustments: {},
      results: null,
      metadata: {
        systemVersion: SYSTEM_VERSION,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.id,
    };

    // Save
    await kv.set(`retirement_fna:${id}`, session);

    // Add to list
    const listKey = `retirement_fna:${clientId}:list`;
    const list = (await kv.get(listKey)) || [];
    list.push(id);
    await kv.set(listKey, list);

    return c.json({ success: true, data: session });
  } catch (error: unknown) {
    log.error('Error creating session:', error);
    return fnaErrorResponse(c, error);
  }
});

// UPDATE Inputs
retirementFnaRoutes.put('/:fnaId/inputs', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const fnaId = c.req.param('fnaId')!;
    const body = await c.req.json();
    const parsed = UpdateInputsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: formatZodError(parsed.error) }, 400);
    }
    const inputUpdates = parsed.data;

    const session = await kv.get(`retirement_fna:${fnaId}`);
    if (!session) return c.json({ success: false, error: 'Session not found' }, 404);

    await assertRecordClientAccess(user, session, 'retirement-fna:update-inputs');

    session.inputs = { ...session.inputs, ...inputUpdates };
    session.updatedAt = new Date().toISOString();

    await kv.set(`retirement_fna:${fnaId}`, session);

    return c.json({ success: true, data: session });
  } catch (error: unknown) {
    return fnaErrorResponse(c, error);
  }
});

// CALCULATE Results
retirementFnaRoutes.post('/:fnaId/calculate', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const fnaId = c.req.param('fnaId')!;

    const session = await kv.get(`retirement_fna:${fnaId}`);
    if (!session) return c.json({ success: false, error: 'Session not found' }, 404);

    await assertRecordClientAccess(user, session, 'retirement-fna:calculate');

    log.info(`Calculating FNA ${fnaId} with inputs:`, session.inputs);

    // The engine never invents an age (it used to assume 30).
    const problem = retirementInputProblem(session.inputs ?? {});
    if (problem) return c.json({ success: false, error: problem }, 400);

    const results = performCalculations(session.inputs ?? {});

    session.results = results;
    session.updatedAt = new Date().toISOString();

    await kv.set(`retirement_fna:${fnaId}`, session);

    return c.json({ success: true, data: session });
  } catch (error: unknown) {
    log.error('Error calculating:', error);
    return fnaErrorResponse(c, error);
  }
});

// PUBLISH
retirementFnaRoutes.put('/:fnaId/publish', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const fnaId = c.req.param('fnaId')!;

    const session = await kv.get(`retirement_fna:${fnaId}`);
    if (!session) return c.json({ success: false, error: 'Session not found' }, 404);

    await assertRecordClientAccess(user, session, 'retirement-fna:publish');

    session.status = 'published';
    session.publishedAt = new Date().toISOString();
    session.publishedBy = user.id;
    session.updatedAt = new Date().toISOString();

    // The record and the client's `:latest` pointer, written together.
    await kv.mset(
      [`retirement_fna:${fnaId}`, `retirement_fna:${session.clientId}:latest`],
      [session, session],
    );

    return c.json({ success: true, data: session });
  } catch (error: unknown) {
    return fnaErrorResponse(c, error);
  }
});

/**
 * Stop the client's `:latest` pointer serving an FNA that is no longer
 * published (withdrawn, archived or deleted).
 *
 * The pointer is not only a cache for GET latest-published. The client portal
 * and the adviser overview read it through batch status and do not scan the
 * list, so deleting it hides every older FNA that is still published. Point it
 * at the same FNA latest-published would fall back to — the last published one
 * still on the list — and delete it only when nothing published remains.
 */
async function clearLatestIfThis(clientId: string, fnaId: string): Promise<void> {
  const latestKey = `retirement_fna:${clientId}:latest`;
  const latest = await kv.get(latestKey);
  if (!latest || latest.id !== fnaId) return;

  const list = ((await kv.get(`retirement_fna:${clientId}:list`)) as string[] | null) || [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i] === fnaId) continue;
    const session = await loadFna(list[i]);
    if (session?.status === 'published') {
      await kv.set(latestKey, session);
      return;
    }
  }
  await kv.del(latestKey);
}

/** Take an FNA off the client's list, so it no longer shows in their FNA list. */
async function removeFromList(clientId: string, fnaId: string): Promise<void> {
  const listKey = `retirement_fna:${clientId}:list`;
  const list = ((await kv.get(listKey)) as string[] | null) || [];
  if (list.includes(fnaId)) {
    await kv.set(
      listKey,
      list.filter((id) => id !== fnaId),
    );
  }
}

/** One FNA by id, or null. Callers check access against its own client. */
async function loadFna(fnaId: string) {
  return await kv.get(`retirement_fna:${fnaId}`);
}

async function saveFna(fnaId: string, session: Record<string, unknown>): Promise<void> {
  await kv.set(`retirement_fna:${fnaId}`, session);
}

// UNPUBLISH — back to a draft; the client no longer sees it.
retirementFnaRoutes.put('/:fnaId/unpublish', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const fnaId = c.req.param('fnaId')!;
    const session = await loadFna(fnaId);
    if (!session) return c.json({ success: false, error: 'Session not found' }, 404);
    await assertRecordClientAccess(user, session, 'retirement-fna:unpublish');
    if (session.status !== 'published') {
      return c.json({ success: false, error: 'FNA is not published' }, 400);
    }

    const updated = {
      ...session,
      status: 'draft',
      publishedAt: undefined,
      publishedBy: undefined,
      updatedAt: new Date().toISOString(),
    };
    await saveFna(fnaId, updated);
    await clearLatestIfThis(updated.clientId, fnaId);

    return c.json({ success: true, data: updated });
  } catch (error: unknown) {
    return fnaErrorResponse(c, error);
  }
});

// SAVE AS DRAFT — keeps the FNA as a draft. A published FNA is unpublished,
// publication stamp included, exactly as the unpublish route does it: the FNA
// list shows a "Published" date whenever `publishedAt` is set.
retirementFnaRoutes.put('/:fnaId/draft', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const fnaId = c.req.param('fnaId')!;
    const session = await loadFna(fnaId);
    if (!session) return c.json({ success: false, error: 'Session not found' }, 404);
    await assertRecordClientAccess(user, session, 'retirement-fna:draft');

    const updated = {
      ...session,
      status: 'draft',
      publishedAt: undefined,
      publishedBy: undefined,
      updatedAt: new Date().toISOString(),
    };
    await saveFna(fnaId, updated);
    await clearLatestIfThis(updated.clientId, fnaId);

    return c.json({ success: true, data: updated });
  } catch (error: unknown) {
    return fnaErrorResponse(c, error);
  }
});

// ARCHIVE — kept on record, but off the client's list and never "latest".
retirementFnaRoutes.put('/:fnaId/archive', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const fnaId = c.req.param('fnaId')!;
    const session = await loadFna(fnaId);
    if (!session) return c.json({ success: false, error: 'Session not found' }, 404);
    await assertRecordClientAccess(user, session, 'retirement-fna:archive');

    const now = new Date().toISOString();
    const updated = { ...session, status: 'archived', archivedAt: now, updatedAt: now };
    await saveFna(fnaId, updated);
    await clearLatestIfThis(updated.clientId, fnaId);
    await removeFromList(updated.clientId, fnaId);

    return c.json({ success: true, data: updated });
  } catch (error: unknown) {
    return fnaErrorResponse(c, error);
  }
});

// DELETE — removes the FNA, its list entry and any `:latest` pointer to it.
retirementFnaRoutes.delete('/:fnaId', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const fnaId = c.req.param('fnaId')!;
    const session = await loadFna(fnaId);
    if (!session) return c.json({ success: false, error: 'Session not found' }, 404);
    await assertRecordClientAccess(user, session, 'retirement-fna:delete');

    await kv.del(`retirement_fna:${fnaId}`);
    await clearLatestIfThis(session.clientId, fnaId);
    await removeFromList(session.clientId, fnaId);

    return c.json({ success: true, data: null });
  } catch (error: unknown) {
    return fnaErrorResponse(c, error);
  }
});

// GET Latest Published
retirementFnaRoutes.get('/client/:clientId/latest-published', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const clientId = c.req.param('clientId')!;
    await assertClientAccess(user, clientId, 'retirement-fna:latest-published');

    const latest = await kv.get(`retirement_fna:${clientId}:latest`);

    // `:latest` is the most recent FNA, not necessarily a published one (an
    // intake draft used to be written there), so anything else falls back to
    // the newest published FNA in the list.
    if (!latest || latest.status !== 'published') {
      const listKey = `retirement_fna:${clientId}:list`;
      const list = (await kv.get(listKey)) || [];

      // Find most recent published
      for (let i = list.length - 1; i >= 0; i--) {
        const session = await kv.get(`retirement_fna:${list[i]}`);
        if (session && session.status === 'published') {
          return c.json({ success: true, data: session });
        }
      }
      return c.json({ success: true, data: null }); // No published found
    }

    return c.json({ success: true, data: latest });
  } catch (error: unknown) {
    return fnaErrorResponse(c, error);
  }
});

// Auto Populate (Refactored to use helper)
retirementFnaRoutes.get('/client/:clientId/auto-populate', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const clientId = c.req.param('clientId')!;
    await assertClientAccess(user, clientId, 'retirement-fna:auto-populate');

    const inputs = await autoPopulateFromProfile(clientId);

    return c.json({ success: true, data: inputs });
  } catch (error: unknown) {
    log.error('Error in auto-populate:', error);
    return fnaErrorResponse(c, error);
  }
});

export default retirementFnaRoutes;

// ==================== INTERFACES ====================

/** Input shape for retirement FNA calculations */
interface RetirementCalcInputs {
  currentAge?: number | string;
  retirementAge?: number | string;
  currentMonthlyIncome?: number | string;
  currentGrossMonthlyIncome?: number | string;
  otherRetirementCapital?: number | string;
  otherMonthlyRetirementIncome?: number | string;
  currentRetirementSavings?: number | string;
  currentMonthlyContribution?: number | string;
  yearsInRetirement?: number | string;
  inflationRate?: number | string;
  preRetirementReturn?: number | string;
  postRetirementReturn?: number | string;
  salaryEscalation?: number | string;
  replacementRatio?: number | string;
  premiumEscalation?: number | string;
  [key: string]: unknown;
}
