/**
 * FNA Intake Routes — client-led financial discovery API
 */

import { Hono } from 'npm:hono';
import {
  authenticateUser,
  fnaErrorResponse,
  isFnaAdminRole,
  requireRealUserForClientWrite,
  requireRealUserForIntakeAdmin,
} from './fna-auth.ts';
import { createModuleLogger } from './stderr-logger.ts';
import {
  acceptIntakeSession,
  createOrUpdateIntakeDraft,
  getActiveIntakeSession,
  getIntakeSession,
  isFnaIntakeDomain,
  listSubmittedIntakeSessions,
  requestMoreInfo,
  sanitizeIntakeForClient,
  submitIntakeSession,
  type FnaIntakeDomain,
} from './fna-intake-service.ts';
import {
  FnaIntakeClientIdParamSchema,
  FnaIntakeSaveDraftSchema,
  FnaIntakeSessionIdParamSchema,
  FnaIntakeSubmitSchema,
} from './fna-validation.ts';
import { intakeUnprocessable } from './fna-intake-errors.ts';
import { assertClientAccess, isPlatformAdminRole } from './client-access.ts';
import {
  assertIntakeDraftRateLimit,
  assertIntakeSubmitRateLimit,
} from './fna-intake-rate-limit.ts';

const fnaIntakeRoutes = new Hono();
const log = createModuleLogger('fna-intake-routes');

async function requireAuth(c: { req: { header: (name: string) => string | undefined } }) {
  return authenticateUser(c.req.header('Authorization'), 'fna-intake');
}

// Client scoping goes through the one shared policy in client-access.ts (self,
// platform admin, or the client's ASSIGNED adviser). This file used to carry
// its own `assertClientAccess` that shadowed that import and let ANY adviser
// read or edit ANY client's intake — the same bypass once fixed in
// fna-batch-status-routes.ts.

function parseParam(
  schema: { safeParse: (v: string) => { success: boolean; data?: string } },
  value: string,
) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw intakeUnprocessable('Invalid ID format');
  }
  return parsed.data as string;
}

/** GET /fna-intake/queue/list — admin submitted intakes (register before /:domain) */
fnaIntakeRoutes.get('/queue/list', async (c) => {
  try {
    const user = await requireAuth(c);
    requireRealUserForIntakeAdmin(user);
    // Platform admins only: the queue is every submitted intake, firm-wide.
    // Advisers see their own clients' intakes through the per-client routes.
    if (!isPlatformAdminRole(user.role)) {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }

    const sessions = await listSubmittedIntakeSessions();
    return c.json({ success: true, data: sessions });
  } catch (error) {
    return fnaErrorResponse(c, error);
  }
});

/** GET /fna-intake/:domain/status/:clientId */
fnaIntakeRoutes.get('/:domain/status/:clientId', async (c) => {
  try {
    const user = await requireAuth(c);
    const clientId = parseParam(FnaIntakeClientIdParamSchema, c.req.param('clientId')!);
    const domain = c.req.param('domain')! as FnaIntakeDomain;
    if (!isFnaIntakeDomain(domain)) {
      return c.json({ success: false, error: 'Invalid domain' }, 400);
    }
    await assertClientAccess(user, clientId, 'fna-intake');

    const session = await getActiveIntakeSession(clientId, domain);
    return c.json({
      success: true,
      data: session ? sanitizeIntakeForClient(session) : null,
    });
  } catch (error) {
    log.error('GET intake status failed', error);
    return fnaErrorResponse(c, error);
  }
});

/** GET /fna-intake/:domain/draft/:clientId */
fnaIntakeRoutes.get('/:domain/draft/:clientId', async (c) => {
  try {
    const user = await requireAuth(c);
    const clientId = parseParam(FnaIntakeClientIdParamSchema, c.req.param('clientId')!);
    const domain = c.req.param('domain')! as FnaIntakeDomain;
    if (!isFnaIntakeDomain(domain)) {
      return c.json({ success: false, error: 'Invalid domain' }, 400);
    }
    await assertClientAccess(user, clientId, 'fna-intake');

    const session = await getActiveIntakeSession(clientId, domain);
    if (!session || session.status === 'accepted') {
      return c.json({ success: true, data: null });
    }

    return c.json({ success: true, data: sanitizeIntakeForClient(session) });
  } catch (error) {
    return fnaErrorResponse(c, error);
  }
});

/** PUT /fna-intake/:domain/draft/:clientId */
fnaIntakeRoutes.put('/:domain/draft/:clientId', async (c) => {
  try {
    const user = await requireAuth(c);
    requireRealUserForClientWrite(user);
    const clientId = parseParam(FnaIntakeClientIdParamSchema, c.req.param('clientId')!);
    const domain = c.req.param('domain')! as FnaIntakeDomain;
    if (!isFnaIntakeDomain(domain)) {
      return c.json({ success: false, error: 'Invalid domain' }, 400);
    }
    await assertClientAccess(user, clientId, 'fna-intake');

    const bodyParse = FnaIntakeSaveDraftSchema.safeParse(await c.req.json());
    if (!bodyParse.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: bodyParse.error.issues },
        400,
      );
    }

    await assertIntakeDraftRateLimit(user.id);

    const session = await createOrUpdateIntakeDraft(clientId, domain, bodyParse.data.inputs, {
      id: user.id,
      email: user.email,
    });

    return c.json({ success: true, data: sanitizeIntakeForClient(session) });
  } catch (error) {
    return fnaErrorResponse(c, error);
  }
});

/** POST /fna-intake/session/:sessionId/submit */
fnaIntakeRoutes.post('/session/:sessionId/submit', async (c) => {
  try {
    const user = await requireAuth(c);
    requireRealUserForClientWrite(user);
    const sessionId = parseParam(FnaIntakeSessionIdParamSchema, c.req.param('sessionId')!);

    const bodyParse = FnaIntakeSubmitSchema.safeParse(await c.req.json());
    if (!bodyParse.success) {
      return c.json(
        { success: false, error: 'Validation failed', details: bodyParse.error.issues },
        400,
      );
    }

    const existing = await getIntakeSession(sessionId);
    if (!existing) return c.json({ success: false, error: 'Session not found' }, 404);
    await assertClientAccess(user, existing.clientId, 'fna-intake:submit');

    if (existing.status !== 'submitted') {
      await assertIntakeSubmitRateLimit(user.id);
    }

    const session = await submitIntakeSession(
      sessionId,
      { id: user.id, email: user.email },
      bodyParse.data.consentAccepted,
    );
    return c.json({ success: true, data: session });
  } catch (error) {
    return fnaErrorResponse(c, error);
  }
});

/** POST /fna-intake/session/:sessionId/accept */
fnaIntakeRoutes.post('/session/:sessionId/accept', async (c) => {
  try {
    const user = await requireAuth(c);
    requireRealUserForIntakeAdmin(user);
    if (!isFnaAdminRole(user.role)) {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }

    const sessionId = parseParam(FnaIntakeSessionIdParamSchema, c.req.param('sessionId')!);
    const existing = await getIntakeSession(sessionId);
    if (!existing) return c.json({ success: false, error: 'Session not found' }, 404);
    // Staff role is not enough: an adviser acts only on an assigned client's intake.
    await assertClientAccess(user, existing.clientId, 'fna-intake:accept');

    const result = await acceptIntakeSession(sessionId, {
      id: user.id,
      email: user.email,
    });

    return c.json({
      success: true,
      data: {
        session: result.session,
        linkedFnaId: result.linkedFnaId,
        domain: result.session.domain,
        clientId: result.session.clientId,
        initialStep: 2,
      },
    });
  } catch (error) {
    return fnaErrorResponse(c, error);
  }
});

/** POST /fna-intake/session/:sessionId/request-info */
fnaIntakeRoutes.post('/session/:sessionId/request-info', async (c) => {
  try {
    const user = await requireAuth(c);
    requireRealUserForIntakeAdmin(user);
    if (!isFnaAdminRole(user.role)) {
      return c.json({ success: false, error: 'Admin access required' }, 403);
    }

    const sessionId = parseParam(FnaIntakeSessionIdParamSchema, c.req.param('sessionId')!);
    const existing = await getIntakeSession(sessionId);
    if (!existing) return c.json({ success: false, error: 'Session not found' }, 404);
    // Staff role is not enough: an adviser acts only on an assigned client's intake.
    await assertClientAccess(user, existing.clientId, 'fna-intake:request-info');

    const session = await requestMoreInfo(sessionId, {
      id: user.id,
      email: user.email,
    });

    return c.json({ success: true, data: session });
  } catch (error) {
    return fnaErrorResponse(c, error);
  }
});

export default fnaIntakeRoutes;
