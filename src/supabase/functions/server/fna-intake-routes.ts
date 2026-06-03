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
import { intakeForbidden, intakeUnprocessable } from './fna-intake-errors.ts';
import {
  assertIntakeDraftRateLimit,
  assertIntakeSubmitRateLimit,
} from './fna-intake-rate-limit.ts';

const fnaIntakeRoutes = new Hono();
const log = createModuleLogger('fna-intake-routes');

async function requireAuth(c: { req: { header: (name: string) => string | undefined } }) {
  return authenticateUser(c.req.header('Authorization'), 'fna-intake');
}

function assertClientAccess(user: { id: string; role: string }, clientId: string) {
  if (isFnaAdminRole(user.role)) return;
  if (user.id !== clientId) {
    throw intakeForbidden();
  }
}

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
    if (!isFnaAdminRole(user.role)) {
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
    assertClientAccess(user, clientId);

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
    assertClientAccess(user, clientId);

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
    assertClientAccess(user, clientId);

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
    assertClientAccess(user, existing.clientId);

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

    parseParam(FnaIntakeSessionIdParamSchema, c.req.param('sessionId')!);

    const result = await acceptIntakeSession(c.req.param('sessionId')!, {
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

    parseParam(FnaIntakeSessionIdParamSchema, c.req.param('sessionId')!);

    const session = await requestMoreInfo(c.req.param('sessionId')!, {
      id: user.id,
      email: user.email,
    });

    return c.json({ success: true, data: session });
  } catch (error) {
    return fnaErrorResponse(c, error);
  }
});

export default fnaIntakeRoutes;
